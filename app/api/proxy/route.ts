import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const BLOCKED_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /192\.168\./,
  /10\.\d+\./,
  /172\.(1[6-9]|2\d|3[01])\./,
  /0\.0\.0\.0/,
];

const isBlockedDomain = (hostname: string): boolean =>
  BLOCKED_PATTERNS.some(pattern => pattern.test(hostname));

const getProxiedHeaders = (
  originalHeaders: Headers,
  targetOrigin: string,
  includeContentHeaders = false,
): Record<string, string> => {
  const headers: Record<string, string> = {};

  for (const header of [
    'accept',
    'accept-language',
    'cache-control',
    'user-agent',
    'range',
    'if-range',
    'if-none-match',
    'if-modified-since',
  ]) {
    const value = originalHeaders.get(header);
    if (value) headers[header] = value;
  }

  if (includeContentHeaders) {
    for (const header of ['content-type', 'content-length']) {
      const value = originalHeaders.get(header);
      if (value) headers[header] = value;
    }
  }

  headers['referer'] = targetOrigin + '/';
  headers['origin'] = targetOrigin;

  if (!headers['user-agent']) {
    headers['user-agent'] = 'Mozilla/5.0 (compatible; Web-Proxy/1.0)';
  }

  return headers;
};

const proxyUrl = (url: string): string => `/api/proxy?url=${encodeURIComponent(url)}`;

const rewriteHtml = (html: string, baseUrl: string): string => {
  const rewrite = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('#') || /^(data|blob|javascript|mailto|tel):/i.test(trimmed)) return value;
    try {
      return proxyUrl(new URL(trimmed, baseUrl).toString());
    } catch {
      return value;
    }
  };

  return html
    .replace(/(\b(?:src|href|action|poster)\s*=\s*["'])([^"']+)(["'])/gi, (_m, prefix, value, suffix) => `${prefix}${rewrite(value)}${suffix}`)
    .replace(/(\bsrcset\s*=\s*["'])([^"']+)(["'])/gi, (_m, prefix, value, suffix) => {
      const rewritten = value.split(',').map((candidate: string) => {
        const parts = candidate.trim().split(/\s+/);
        if (!parts[0]) return candidate;
        parts[0] = rewrite(parts[0]);
        return parts.join(' ');
      }).join(', ');
      return `${prefix}${rewritten}${suffix}`;
    })
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_m, quote, value) => `url(${quote}${rewrite(value)}${quote})`)
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv\s*=\s*["']content-security-policy["'][^>]*>/gi, '');
};

const createRuntimeBridge = (baseUrl: string): string => {
  const serializedBase = JSON.stringify(baseUrl);
  return `<script>(function(){
    var __proxyBase=${serializedBase};
    var __proxyPrefix='/api/proxy?url=';
    function __proxyTarget(input){
      var raw=typeof input==='string'?input:(input&&input.url);
      if(!raw) return null;
      try{
        var resolved=new URL(raw,__proxyBase);
        if(resolved.pathname==='/api/proxy' && resolved.searchParams.has('url')) return null;
        return __proxyPrefix+encodeURIComponent(resolved.toString());
      }catch(e){return null;}
    }

    var __fetch=window.fetch;
    window.fetch=function(input,init){
      var target=__proxyTarget(input);
      if(!target) return __fetch.call(this,input,init);
      if(typeof input==='object' && input instanceof Request){
        return __fetch.call(this,new Request(target,input));
      }
      return __fetch.call(this,target,init);
    };

    var __open=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url,async,user,password){
      var target=__proxyTarget(url);
      return __open.call(this,method,target||url,async,user,password);
    };

    if(navigator.sendBeacon){
      var __beacon=navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon=function(url,data){
        var target=__proxyTarget(url);
        return __beacon(target||url,data);
      };
    }
  })();</script>`;
};

const validateTarget = (targetUrl: string): URL | NextResponse => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 });
  }

  if (isBlockedDomain(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'Access to this domain is not allowed' }, { status: 403 });
  }

  return parsedUrl;
};

const proxyRequest = async (request: NextRequest, method: 'GET' | 'POST' | 'HEAD') => {
  try {
    const targetUrl = new URL(request.url).searchParams.get('url');
    if (!targetUrl) return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });

    const validated = validateTarget(targetUrl);
    if (validated instanceof NextResponse) return validated;
    const parsedUrl = validated;

    let response;
    try {
      const body = method === 'POST' ? Buffer.from(await request.arrayBuffer()) : undefined;

      response = await axios.request({
        method,
        url: targetUrl,
        headers: getProxiedHeaders(request.headers, parsedUrl.origin, method === 'POST'),
        data: body,
        timeout: 20000,
        maxRedirects: 10,
        responseType: 'arraybuffer',
        validateStatus: () => true,
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to reach website' }, { status: 503 });
    }

    const rawContentType = response.headers['content-type'];
    const contentType = typeof rawContentType === 'string' ? rawContentType : 'application/octet-stream';
    const isHtml = contentType.toLowerCase().includes('text/html');
    const finalUrl = response.request?.res?.responseUrl || targetUrl;

    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, Range, X-Requested-With',
      'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag',
      'x-content-type-options': 'nosniff',
      'cache-control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
      'content-type': contentType,
    };

    for (const header of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = response.headers[header];
      if (typeof value === 'string') responseHeaders[header] = value;
    }

    if (isHtml) {
      // The HTML is modified below, so the upstream Content-Length is no
      // longer valid. Sending the old length can make browsers truncate the
      // document and results in a completely blank iframe.
      delete responseHeaders['content-length'];
      delete responseHeaders['content-range'];
      delete responseHeaders['accept-ranges'];

      responseHeaders['content-type'] = 'text/html; charset=utf-8';
      const body = Buffer.from(response.data).toString('utf8');
      const rewritten = rewriteHtml(body, finalUrl);
      const bridged = rewritten.replace(/<head\b[^>]*>/i, match => `${match}${createRuntimeBridge(finalUrl)}`);

      return new NextResponse(bridged, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    return new NextResponse(method === 'HEAD' ? null : new Uint8Array(response.data), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
};

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function HEAD(request: NextRequest) {
  return proxyRequest(request, 'HEAD');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, Range, X-Requested-With',
      'access-control-max-age': '86400',
    },
  });
}
