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

const getProxiedHeaders = (originalHeaders: Headers, targetOrigin: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const header of ['accept', 'accept-language', 'cache-control']) {
    const value = originalHeaders.get(header);
    if (value) headers[header] = value;
  }
  headers['referer'] = targetOrigin + '/';
  headers['origin'] = targetOrigin;
  headers['user-agent'] = 'Mozilla/5.0 (compatible; Web-Proxy/1.0)';
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

  let result = html
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

  return result;
};

export async function GET(request: NextRequest) {
  try {
    const targetUrl = new URL(request.url).searchParams.get('url');
    if (!targetUrl) return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });

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

    let response;
    try {
      response = await axios.get(targetUrl, {
        headers: getProxiedHeaders(request.headers, parsedUrl.origin),
        timeout: 15000,
        maxRedirects: 10,
        responseType: 'text',
        transformResponse: [(data) => data],
        validateStatus: () => true,
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to reach website' }, { status: 503 });
    }

    const rawContentType = response.headers['content-type'];
    const contentType = typeof rawContentType === 'string' ? rawContentType : 'application/octet-stream';
    const isHtml = contentType.toLowerCase().includes('text/html');

    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'x-content-type-options': 'nosniff',
      'cache-control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
      'content-type': contentType,
    };

    if (isHtml) {
      responseHeaders['content-type'] = 'text/html; charset=utf-8';
      const body = typeof response.data === 'string' ? response.data : String(response.data);
      return new NextResponse(rewriteHtml(body, parsedUrl.toString()), { status: response.status, headers: responseHeaders });
    }

    return new NextResponse(response.data, { status: response.status, headers: responseHeaders });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}
