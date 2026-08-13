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

const debugLog = (event: string, details: Record<string, unknown>) => {
  console.log(`[WebProxy:${event}]`, JSON.stringify(details));
};

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
    const value = originalHeaders.get('content-type');
    if (value) headers['content-type'] = value;
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

  let output = html
    .replace(/(\b(?:src|href|poster)\s*=\s*["'])([^"']+)(["'])/gi, (_m, prefix, value, suffix) => `${prefix}${rewrite(value)}${suffix}`)
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

  output = output.replace(/<form\b([^>]*?)\baction\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (_m, before, quote, value, after) => {
    const target = new URL(value, baseUrl).toString();
    return `<form${before}data-web-proxy-action=${quote}${target}${quote}${after}>`;
  });

  return output;
};

const createRuntimeBridge = (baseUrl: string): string => {
  const serializedBase = JSON.stringify(baseUrl);
  return `<script>(function(){
    var __proxyBase=${serializedBase};
    var __proxyPrefix='/api/proxy?url=';
    function __debug(type,details){try{window.parent.postMessage({__webProxyDebug:true,type:type,details:details},'*');}catch(e){}}
    function __proxyTarget(input){
      var raw=typeof input==='string'?input:(input&&input.url);
      if(!raw){__debug('REQUEST_SKIPPED',{reason:'No URL',inputType:typeof input});return null;}
      try{
        var resolved=new URL(raw,__proxyBase);
        if(resolved.pathname==='/api/proxy'&&resolved.searchParams.has('url'))return null;
        var target=__proxyPrefix+encodeURIComponent(resolved.toString());
        __debug('REQUEST_REWRITE',{original:raw,resolved:resolved.toString(),proxy:target});
        return target;
      }catch(e){__debug('REQUEST_REWRITE_ERROR',{original:String(raw),error:String(e)});return null;}
    }
    window.addEventListener('error',function(event){__debug('JS_ERROR',{message:event.message||'Unknown error',source:event.filename||'',line:event.lineno||0,column:event.colno||0});});
    window.addEventListener('unhandledrejection',function(event){__debug('UNHANDLED_REJECTION',{reason:String(event.reason||'Unknown rejection')});});
    document.addEventListener('submit',function(event){
      var form=event.target;if(!form||!form.getAttribute)return;
      var destination=form.getAttribute('data-web-proxy-action');if(!destination)return;
      var method=(form.getAttribute('method')||'GET').toUpperCase();if(method!=='GET')return;
      event.preventDefault();
      try{
        var target=new URL(destination,__proxyBase),data=new FormData(form);
        data.forEach(function(value,key){if(typeof value==='string')target.searchParams.append(key,value);});
        var proxied=__proxyPrefix+encodeURIComponent(target.toString());
        __debug('FORM_SUBMIT',{method:'GET',destination:destination,proxy:proxied});window.location.href=proxied;
      }catch(e){__debug('FORM_SUBMIT_ERROR',{error:String(e)});}
    },true);
    var __fetch=window.fetch;
    window.fetch=function(input,init){var target=__proxyTarget(input);if(!target)return __fetch.call(this,input,init);__debug('FETCH_START',{proxy:target,method:(init&&init.method)||'GET'});return __fetch.call(this,typeof input==='object'&&input instanceof Request?new Request(target,input):target,init).then(function(response){__debug('FETCH_RESPONSE',{status:response.status,ok:response.ok,url:response.url});return response;}).catch(function(error){__debug('FETCH_ERROR',{error:String(error),proxy:target});throw error;});};
    var __open=XMLHttpRequest.prototype.open,__send=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open=function(method,url,async,user,password){var target=__proxyTarget(url);this.__webProxyDebugUrl=target||url;__debug('XHR_OPEN',{method:method,url:String(url),proxy:target||String(url)});return __open.call(this,method,target||url,async,user,password);};
    XMLHttpRequest.prototype.send=function(body){var xhr=this;xhr.addEventListener('load',function(){__debug('XHR_RESPONSE',{status:xhr.status,url:xhr.responseURL||xhr.__webProxyDebugUrl});});xhr.addEventListener('error',function(){__debug('XHR_ERROR',{status:xhr.status,url:xhr.__webProxyDebugUrl||''});});xhr.addEventListener('abort',function(){__debug('XHR_ABORT',{url:xhr.__webProxyDebugUrl||''});});return __send.call(this,body);};
    if(navigator.sendBeacon){var __beacon=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(url,data){var target=__proxyTarget(url),result=__beacon(target||url,data);__debug('BEACON',{url:String(url),proxy:target||String(url),accepted:result});return result;};}
  })();</script>`;
};

const validateTarget = (targetUrl: string): URL | NextResponse => {
  let parsedUrl: URL;
  try { parsedUrl = new URL(targetUrl); } catch { return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 }); }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 });
  if (isBlockedDomain(parsedUrl.hostname)) return NextResponse.json({ error: 'Access to this domain is not allowed' }, { status: 403 });
  return parsedUrl;
};

const getTargetUrl = (request: NextRequest): string | NextResponse => {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');
  if (!targetUrl) {
    debugLog('MISSING_URL', { method: request.method, requestUrl: request.url, referer: request.headers.get('referer') || null, userAgent: request.headers.get('user-agent') || null, accept: request.headers.get('accept') || null, secFetchSite: request.headers.get('sec-fetch-site') || null, secFetchDest: request.headers.get('sec-fetch-dest') || null });
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }
  try {
    const destination = new URL(targetUrl);
    for (const [key,value] of requestUrl.searchParams) if (key !== 'url') destination.searchParams.append(key,value);
    return destination.toString();
  } catch { return targetUrl; }
};

const proxyRequest = async (request: NextRequest, method: 'GET'|'POST'|'HEAD') => {
  try {
    const target = getTargetUrl(request); if (target instanceof NextResponse) return target;
    const validated = validateTarget(target); if (validated instanceof NextResponse) return validated;
    const parsedUrl = validated;
    debugLog('REQUEST',{method,target,hostname:parsedUrl.hostname,pathname:parsedUrl.pathname,hasQuery:parsedUrl.search.length>0,range:request.headers.get('range')||null,contentType:request.headers.get('content-type')||null});

    let response;
    try {
      const body = method === 'POST' ? Buffer.from(await request.arrayBuffer()) : undefined;
      response = await axios.request({
        method,url:target,
        headers:getProxiedHeaders(request.headers,parsedUrl.origin,method==='POST'),
        data:body,timeout:20000,maxRedirects:10,responseType:'arraybuffer',validateStatus:()=>true,
        decompress:false,
      });
    } catch (fetchError) {
      debugLog('FETCH_FAILURE',{method,target,error:String(fetchError)}); console.error('Fetch error:',fetchError);
      return NextResponse.json({error:'Failed to reach website'},{status:503});
    }

    const rawContentType=response.headers['content-type'];
    const contentType=typeof rawContentType==='string'?rawContentType:'application/octet-stream';
    const isHtml=contentType.toLowerCase().includes('text/html');
    const contentEncoding=typeof response.headers['content-encoding']==='string'?response.headers['content-encoding']:null;
    const finalUrl=response.request?.res?.responseUrl||target;
    const responseBytes=Buffer.isBuffer(response.data)?response.data.length:null;
    debugLog('RESPONSE',{method,target,finalUrl,status:response.status,contentType,contentEncoding,bytes:responseBytes,redirected:finalUrl!==target,contentLength:response.headers['content-length']||null,contentRange:response.headers['content-range']||null});

    const responseHeaders: Record<string,string>={
      'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, HEAD, OPTIONS','access-control-allow-headers':'Content-Type, Authorization, Range, X-Requested-With','access-control-expose-headers':'Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag','x-content-type-options':'nosniff','cache-control':isHtml?'no-cache, no-store, must-revalidate':'public, max-age=3600','content-type':contentType,
    };
    for(const header of ['content-length','content-range','accept-ranges','etag','last-modified','content-encoding']){
      const value=response.headers[header]; if(typeof value==='string') responseHeaders[header]=value;
    }

    if(isHtml){
      responseHeaders['content-type']='text/html; charset=utf-8';
      delete responseHeaders['content-length'];delete responseHeaders['content-range'];delete responseHeaders['accept-ranges'];
      const body=Buffer.from(response.data).toString('utf8');
      const rewritten=rewriteHtml(body,finalUrl);
      const bridged=rewritten.replace(/<head\b[^>]*>/i,match=>`${match}${createRuntimeBridge(finalUrl)}`);
      delete responseHeaders['content-encoding'];
      return new NextResponse(bridged,{status:response.status,headers:responseHeaders});
    }

    // With decompress:false, the body and Content-Encoding remain paired.
    // Do not alter Content-Length/Content-Encoding for opaque resources.
    return new NextResponse(method==='HEAD'?null:new Uint8Array(response.data),{status:response.status,headers:responseHeaders});
  } catch(error){
    debugLog('INTERNAL_ERROR',{method,error:String(error)});console.error('Proxy error:',error);
    return NextResponse.json({error:'Internal proxy error'},{status:500});
  }
};

export async function GET(request:NextRequest){return proxyRequest(request,'GET');}
export async function POST(request:NextRequest){return proxyRequest(request,'POST');}
export async function HEAD(request:NextRequest){return proxyRequest(request,'HEAD');}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, HEAD, OPTIONS','access-control-allow-headers':'Content-Type, Authorization, Range, X-Requested-With','access-control-max-age':'86400'}});}
