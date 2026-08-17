import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import {
  guardTarget,
  createPinnedLookup,
  isRedirectStatus,
  isMethodDowngradingRedirect,
  InvalidTargetError,
  SsrfBlockedError,
  type ResolvedTarget,
} from './ssrfGuard';

const MAX_PROXY_REDIRECTS = 10;

type ProxyMethod = 'GET' | 'POST' | 'HEAD';

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
    'accept', 'accept-language', 'cache-control', 'user-agent', 'range',
    'if-range', 'if-none-match', 'if-modified-since',
  ]) {
    const value = originalHeaders.get(header);
    if (value) headers[header] = value;
  }
  if (includeContentHeaders) {
    const value = originalHeaders.get('content-type');
    if (value) headers['content-type'] = value;
  }
  headers.referer = `${targetOrigin}/`;
  headers.origin = targetOrigin;
  if (!headers['user-agent']) headers['user-agent'] = 'Mozilla/5.0 (compatible; Web-Proxy/1.0)';
  return headers;
};

const proxyUrl = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`;

const isProxyUrl = (value: string, baseUrl?: string): boolean => {
  const trimmed = value.trim();
  if (/^\/api\/proxy(?:\?|$)/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed, baseUrl || 'https://proxy.invalid/');
    return parsed.pathname === '/api/proxy' && parsed.searchParams.has('url');
  } catch {
    return false;
  }
};

const rewriteHtml = (html: string, baseUrl: string): string => {
  const rewrite = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('#') || isProxyUrl(trimmed) || /^(data|blob|javascript|mailto|tel):/i.test(trimmed)) return value;
    try { return proxyUrl(new URL(trimmed, baseUrl).toString()); } catch { return value; }
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
    try {
      const target = new URL(value, baseUrl).toString();
      return `<form${before}data-web-proxy-action=${quote}${target}${quote}${after}>`;
    } catch {
      return _m;
    }
  });
  return output;
};

const createRuntimeBridge = (baseUrl: string): string => {
  const serializedBase = JSON.stringify(baseUrl);
  return `<script>(function(){
    var __proxyBase=${serializedBase};
    var __proxyPrefix='/api/proxy?url=';
    var __debugSeq=0;
    function __safe(value,max){try{var s=typeof value==='string'?value:JSON.stringify(value);return s.length>(max||500)?s.slice(0,max||500)+'…':s;}catch(e){return String(value);}}
    function __element(el){if(!el||!el.tagName)return null;return {tag:el.tagName.toLowerCase(),id:el.id||'',className:typeof el.className==='string'?el.className.slice(0,120):'',text:(el.innerText||el.textContent||'').trim().slice(0,120),href:el.getAttribute&&el.getAttribute('href')||null,type:el.getAttribute&&el.getAttribute('type')||null,name:el.getAttribute&&el.getAttribute('name')||null};}
    function __debug(type,details){try{window.parent.postMessage({__webProxyDebug:true,type:type,seq:++__debugSeq,time:new Date().toISOString(),details:details},'*');}catch(e){}}
    __debug('RUNTIME_INIT',{baseUrl:__proxyBase,location:location.href,readyState:document.readyState,userAgent:navigator.userAgent});
    function isProxyAbsolute(value){try{var u=new URL(value,location.href);return u.pathname==='/api/proxy'&&u.searchParams.has('url');}catch(e){return false;}}
    function __proxyTarget(input){
      var raw=typeof input==='string'?input:(input&&input.url);
      if(!raw)return null;
      try{var resolved=new URL(raw,__proxyBase);if(resolved.pathname==='/api/proxy'&&resolved.searchParams.has('url'))return null;var target=__proxyPrefix+encodeURIComponent(resolved.toString());__debug('REQUEST_REWRITE',{original:raw,resolved:resolved.toString(),proxy:target});return target;}catch(e){__debug('REQUEST_REWRITE_ERROR',{original:String(raw),error:String(e)});return null;}
    }
    function __navigate(raw,replace){
      try{var value=String(raw||'');if(!value||/^(#|javascript:|mailto:|tel:|data:|blob:)/i.test(value))return false;if(/^\/api\/proxy(?:\?|$)/i.test(value)||isProxyAbsolute(value)){__debug('NAVIGATION_SKIP_PROXY',{original:value});return false;}var resolved=new URL(value,__proxyBase);if(resolved.pathname==='/api/proxy'&&resolved.searchParams.has('url'))return false;if(!/^https?:$/i.test(resolved.protocol))return false;var target=__proxyPrefix+encodeURIComponent(resolved.toString());__debug('NAVIGATION_REWRITE',{original:value,resolved:resolved.toString(),proxy:target,replace:!!replace});if(replace)location.replace(target);else location.href=target;return true;}catch(e){__debug('NAVIGATION_REWRITE_ERROR',{original:String(raw),error:String(e)});return false;}
    }
    window.addEventListener('error',function(event){var target=event.target;__debug('JS_ERROR',{message:event.message||'Resource error',source:event.filename||'',line:event.lineno||0,column:event.colno||0,target:__element(target),resource:target&&target.src||target&&target.href||null});},true);
    window.addEventListener('unhandledrejection',function(event){__debug('UNHANDLED_REJECTION',{reason:__safe(event.reason,1000)});});
    window.addEventListener('load',function(){__debug('WINDOW_LOAD',{location:location.href,readyState:document.readyState});});
    document.addEventListener('DOMContentLoaded',function(){__debug('DOM_READY',{location:location.href});});
    document.addEventListener('click',function(event){var el=event.target&&event.target.closest?event.target.closest('a,button,input,select,textarea,[role="button"]'):event.target;__debug('CLICK',{element:__element(el),button:event.button,defaultPrevented:event.defaultPrevented,detail:event.detail});if(event.defaultPrevented||event.button!==0||!el||el.tagName.toLowerCase()!=='a')return;var href=el.getAttribute('href');if(!href||el.hasAttribute('download')||el.target==='_blank'||el.target==='_top')return;if(__navigate(href,false))event.preventDefault();},true);
    document.addEventListener('submit',function(event){var form=event.target;if(!form||!form.getAttribute)return;var destination=form.getAttribute('data-web-proxy-action');if(!destination)return;event.preventDefault();try{var target=new URL(destination,__proxyBase);var method=(form.getAttribute('method')||'GET').toUpperCase();if(method==='GET'){var data=new FormData(form);data.forEach(function(value,key){if(typeof value==='string')target.searchParams.append(key,value);});location.href=__proxyPrefix+encodeURIComponent(target.toString());}else if(method==='POST'){form.action=__proxyPrefix+encodeURIComponent(target.toString());form.removeAttribute('data-web-proxy-action');form.submit();}else __navigate(target.toString(),false);}catch(e){__debug('FORM_SUBMIT_ERROR',{error:String(e)});}},true);
    var __push=history.pushState,__replace=history.replaceState;history.pushState=function(state,title,url){if(url&&__navigate(url,false))return;return __push.apply(this,arguments);};history.replaceState=function(state,title,url){if(url&&__navigate(url,true))return;return __replace.apply(this,arguments);};
    var __fetch=window.fetch;window.fetch=function(input,init){var target=__proxyTarget(input);if(!target)return __fetch.call(this,input,init);__debug('FETCH_START',{proxy:target,method:(init&&init.method)||'GET'});return __fetch.call(this,typeof input==='object'&&input instanceof Request?new Request(target,input):target,init).then(function(response){__debug('FETCH_RESPONSE',{status:response.status,ok:response.ok,url:response.url});return response;}).catch(function(error){__debug('FETCH_ERROR',{error:String(error),proxy:target});throw error;});};
    var __open=XMLHttpRequest.prototype.open,__send=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(method,url,async,user,password){var target=__proxyTarget(url);this.__webProxyDebugUrl=target||url;__debug('XHR_OPEN',{method:method,url:String(url),proxy:target||String(url)});return __open.call(this,method,target||url,async,user,password);};XMLHttpRequest.prototype.send=function(body){var xhr=this;xhr.addEventListener('load',function(){__debug('XHR_RESPONSE',{status:xhr.status,url:xhr.responseURL||xhr.__webProxyDebugUrl});});xhr.addEventListener('error',function(){__debug('XHR_ERROR',{status:xhr.status,url:xhr.__webProxyDebugUrl||''});});return __send.call(this,body);};
    if(navigator.sendBeacon){var __beacon=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(url,data){var target=__proxyTarget(url);return __beacon(target||url,data);};}
    try{if(navigator.serviceWorker){__debug('SERVICE_WORKER_STATE',{supported:true,controller:!!navigator.serviceWorker.controller});navigator.serviceWorker.getRegistrations().then(function(regs){__debug('SERVICE_WORKER_REGISTRATIONS',{count:regs.length,scopes:regs.map(function(r){return r.scope;})});}).catch(function(e){__debug('SERVICE_WORKER_ERROR',{error:String(e)});});}}catch(e){}
  })();</script>`;
};

const getTargetUrl = (request: NextRequest): string | NextResponse => {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');
  if (!targetUrl) return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  try {
    const destination = new URL(targetUrl);
    for (const [key, value] of requestUrl.searchParams) if (key !== 'url') destination.searchParams.append(key, value);
    return destination.toString();
  } catch {
    return targetUrl;
  }
};

const fetchWithValidatedFallback = async (
  target: ResolvedTarget,
  requestConfig: Omit<import('axios').AxiosRequestConfig, 'lookup' | 'url'>,
) => {
  let lastError: unknown;
  for (const candidate of target.addresses) {
    try {
      return await axios.request({
        ...requestConfig,
        url: target.url.toString(),
        lookup: createPinnedLookup(candidate),
      });
    } catch (err) {
      lastError = err;
      debugLog('ADDRESS_FALLBACK', { host: target.url.hostname, failedAddress: candidate.address, error: String(err) });
    }
  }
  throw lastError;
};

const proxyRequest = async (request: NextRequest, method: ProxyMethod) => {
  try {
    const target = getTargetUrl(request);
    if (target instanceof NextResponse) return target;

    let guarded: ResolvedTarget;
    try {
      guarded = await guardTarget(target);
    } catch (guardError) {
      if (guardError instanceof InvalidTargetError) {
        debugLog('INVALID_TARGET', { method, target, error: guardError.message });
        return NextResponse.json({ error: guardError.message }, { status: 400 });
      }
      if (guardError instanceof SsrfBlockedError) {
        debugLog('SSRF_BLOCKED', { method, target, error: guardError.message });
        return NextResponse.json({ error: guardError.message }, { status: 403 });
      }
      debugLog('SSRF_GUARD_ERROR', { method, target, error: String(guardError) });
      return NextResponse.json({ error: 'Failed to validate target URL' }, { status: 502 });
    }

    debugLog('REQUEST', {
      method,
      target,
      hostname: guarded.url.hostname,
      pathname: guarded.url.pathname,
      hasQuery: guarded.url.search.length > 0,
      range: request.headers.get('range') || null,
      contentType: request.headers.get('content-type') || null,
      referer: request.headers.get('referer') || null,
    });

    let response;
    let finalUrl = guarded.url.toString();
    try {
      let body = method === 'POST' ? Buffer.from(await request.arrayBuffer()) : undefined;
      let currentMethod: ProxyMethod = method;
      let currentTarget = guarded;
      let hop = 0;

      while (true) {
        response = await fetchWithValidatedFallback(currentTarget, {
          method: currentMethod,
          headers: getProxiedHeaders(request.headers, currentTarget.url.origin, currentMethod === 'POST'),
          data: body,
          timeout: 20000,
          maxRedirects: 0,
          responseType: 'arraybuffer',
          validateStatus: () => true,
          decompress: true,
        });
        finalUrl = currentTarget.url.toString();

        const location = response.headers.location;
        if (!isRedirectStatus(response.status) || typeof location !== 'string' || !location) break;

        hop += 1;
        if (hop > MAX_PROXY_REDIRECTS) {
          debugLog('REDIRECT_LIMIT', { method, target, hop });
          return NextResponse.json({ error: 'Too many redirects' }, { status: 502 });
        }

        let nextRaw: string;
        try {
          nextRaw = new URL(location, currentTarget.url).toString();
        } catch {
          debugLog('REDIRECT_INVALID', { method, target, location });
          return NextResponse.json({ error: 'Redirect target is invalid' }, { status: 502 });
        }

        debugLog('REDIRECT_FOLLOW', { method, from: currentTarget.url.toString(), to: nextRaw, status: response.status });
        try {
          currentTarget = await guardTarget(nextRaw);
        } catch (redirectGuardError) {
          if (redirectGuardError instanceof SsrfBlockedError) {
            debugLog('SSRF_BLOCKED_REDIRECT', { method, target: nextRaw, error: redirectGuardError.message });
            return NextResponse.json({ error: 'Redirect target is not allowed' }, { status: 403 });
          }
          debugLog('REDIRECT_INVALID', { method, target: nextRaw, error: String(redirectGuardError) });
          return NextResponse.json({ error: 'Redirect target is invalid' }, { status: 502 });
        }

        if (currentMethod === 'POST' && isMethodDowngradingRedirect(response.status)) {
          currentMethod = 'GET';
          body = undefined;
        }
      }
    } catch (fetchError) {
      debugLog('FETCH_FAILURE', { method, target, error: String(fetchError) });
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to reach website' }, { status: 503 });
    }

    const rawContentType = response.headers['content-type'];
    const contentType = typeof rawContentType === 'string' ? rawContentType : 'application/octet-stream';
    const isHtml = contentType.toLowerCase().includes('text/html');
    const contentEncoding = typeof response.headers['content-encoding'] === 'string' ? response.headers['content-encoding'] : null;
    const upstreamContentLength = typeof response.headers['content-length'] === 'string' ? response.headers['content-length'] : null;
    const responseBytes = Buffer.isBuffer(response.data) ? response.data.length : null;

    debugLog('RESPONSE', {
      method, target, finalUrl, status: response.status, contentType, contentEncoding,
      bytes: responseBytes, redirected: finalUrl !== target,
      upstreamContentLength, contentRange: response.headers['content-range'] || null,
      location: response.headers.location || null,
    });

    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, Range, X-Requested-With',
      'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag',
      'x-content-type-options': 'nosniff',
      'cache-control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
      'content-type': contentType,
    };

    for (const header of ['etag', 'last-modified']) {
      const value = response.headers[header];
      if (typeof value === 'string') responseHeaders[header] = value;
    }

    if (isHtml) {
      responseHeaders['content-type'] = 'text/html; charset=utf-8';
      const body = Buffer.from(response.data).toString('utf8');
      const rewritten = rewriteHtml(body, finalUrl);
      const bridged = rewritten.replace(/<head\b[^>]*>/i, match => `${match}${createRuntimeBridge(finalUrl)}`);
      return new NextResponse(bridged, { status: response.status, headers: responseHeaders });
    }

    if (response.status === 206) {
      delete responseHeaders['content-range'];
      delete responseHeaders['accept-ranges'];
    }

    return new NextResponse(method === 'HEAD' ? null : new Uint8Array(response.data), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    debugLog('INTERNAL_ERROR', { method, error: String(error) });
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
};

export async function GET(request: NextRequest) { return proxyRequest(request, 'GET'); }
export async function POST(request: NextRequest) { return proxyRequest(request, 'POST'); }
export async function HEAD(request: NextRequest) { return proxyRequest(request, 'HEAD'); }
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
