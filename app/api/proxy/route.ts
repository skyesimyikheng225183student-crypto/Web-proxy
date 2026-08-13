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
    'accept','accept-language','cache-control','user-agent','range',
    'if-range','if-none-match','if-modified-since',
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
  if (!headers['user-agent']) headers['user-agent'] = 'Mozilla/5.0 (compatible; Web-Proxy/1.0)';
  return headers;
};

const proxyUrl = (url: string): string => `/api/proxy?url=${encodeURIComponent(url)}`;

const rewriteHtml = (html: string, baseUrl: string): string => {
  const rewrite = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('#') || /^(data|blob|javascript|mailto|tel):/i.test(trimmed)) return value;
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
    var __debugSeq=0;
    function __safe(value,max){try{var s=typeof value==='string'?value:JSON.stringify(value);return s.length>(max||500)?s.slice(0,max||500)+'…':s;}catch(e){return String(value);}}
    function __element(el){if(!el||!el.tagName)return null;return {tag:el.tagName.toLowerCase(),id:el.id||'',className:typeof el.className==='string'?el.className.slice(0,120):'',text:(el.innerText||el.textContent||'').trim().slice(0,120),href:el.getAttribute&&el.getAttribute('href')||null,type:el.getAttribute&&el.getAttribute('type')||null,name:el.getAttribute&&el.getAttribute('name')||null};}
    function __debug(type,details){try{window.parent.postMessage({__webProxyDebug:true,type:type,seq:++__debugSeq,time:new Date().toISOString(),details:details},'*');}catch(e){}}
    __debug('RUNTIME_INIT',{baseUrl:__proxyBase,location:location.href,readyState:document.readyState,userAgent:navigator.userAgent});
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
    window.addEventListener('error',function(event){
      var target=event.target;
      __debug('JS_ERROR',{message:event.message||'Resource error',source:event.filename||'',line:event.lineno||0,column:event.colno||0,target:__element(target),resource:target&&target.src||target&&target.href||null});
    },true);
    window.addEventListener('unhandledrejection',function(event){__debug('UNHANDLED_REJECTION',{reason:__safe(event.reason,1000)});});
    window.addEventListener('load',function(){__debug('WINDOW_LOAD',{location:location.href,readyState:document.readyState});});
    document.addEventListener('DOMContentLoaded',function(){__debug('DOM_READY',{location:location.href});});
    document.addEventListener('click',function(event){
      var el=event.target&&event.target.closest?event.target.closest('a,button,input,select,textarea,[role="button"]'):event.target;
      __debug('CLICK',{element:__element(el),button:event.button,defaultPrevented:event.defaultPrevented,detail:event.detail});
    },true);
    document.addEventListener('pointerdown',function(event){
      var el=event.target&&event.target.closest?event.target.closest('a,button,input,select,textarea,[role="button"]'):event.target;
      __debug('POINTER_DOWN',{element:__element(el),button:event.button,pointerType:event.pointerType});
    },true);
    document.addEventListener('focusin',function(event){__debug('FOCUS',{element:__element(event.target)});},true);
    document.addEventListener('submit',function(event){
      var form=event.target;if(!form||!form.getAttribute)return;
      var destination=form.getAttribute('data-web-proxy-action');
      __debug('FORM_EVENT',{method:(form.getAttribute('method')||'GET').toUpperCase(),action:destination||form.getAttribute('action')||location.href,defaultPrevented:event.defaultPrevented});
      if(!destination)return;
      var method=(form.getAttribute('method')||'GET').toUpperCase();if(method!=='GET')return;
      event.preventDefault();
      try{
        var target=new URL(destination,__proxyBase),data=new FormData(form);
        data.forEach(function(value,key){if(typeof value==='string')target.searchParams.append(key,value);});
        var proxied=__proxyPrefix+encodeURIComponent(target.toString());
        __debug('FORM_SUBMIT',{method:'GET',destination:destination,target:target.toString(),proxy:proxied});window.location.href=proxied;
      }catch(e){__debug('FORM_SUBMIT_ERROR',{error:String(e)});}
    },true);
    window.addEventListener('beforeunload',function(){__debug('BEFORE_UNLOAD',{location:location.href});});
    window.addEventListener('hashchange',function(){__debug('HASH_CHANGE',{location:location.href});});
    window.addEventListener('popstate',function(){__debug('POPSTATE',{location:location.href});});
    var __push=history.pushState, __replace=history.replaceState;
    history.pushState=function(){var result=__push.apply(this,arguments);__debug('HISTORY_PUSH',{location:location.href});return result;};
    history.replaceState=function(){var result=__replace.apply(this,arguments);__debug('HISTORY_REPLACE',{location:location.href});return result;};
    var __fetch=window.fetch;
    window.fetch=function(input,init){var target=__proxyTarget(input);if(!target){__debug('FETCH_PASSTHROUGH',{input:__safe(input)});return __fetch.call(this,input,init);}__debug('FETCH_START',{proxy:target,method:(init&&init.method)||'GET'});return __fetch.call(this,typeof input==='object'&&input instanceof Request?new Request(target,input):target,init).then(function(response){__debug('FETCH_RESPONSE',{status:response.status,ok:response.ok,url:response.url});return response;}).catch(function(error){__debug('FETCH_ERROR',{error:String(error),proxy:target});throw error;});};
    var __open=XMLHttpRequest.prototype.open,__send=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open=function(method,url,async,user,password){var target=__proxyTarget(url);this.__webProxyDebugUrl=target||url;__debug('XHR_OPEN',{method:method,url:String(url),proxy:target||String(url)});return __open.call(this,method,target||url,async,user,password);};
    XMLHttpRequest.prototype.send=function(body){var xhr=this;__debug('XHR_SEND',{url:xhr.__webProxyDebugUrl||'',bodyType:body&&body.constructor?body.constructor.name:typeof body});xhr.addEventListener('load',function(){__debug('XHR_RESPONSE',{status:xhr.status,url:xhr.responseURL||xhr.__webProxyDebugUrl});});xhr.addEventListener('error',function(){__debug('XHR_ERROR',{status:xhr.status,url:xhr.__webProxyDebugUrl||''});});xhr.addEventListener('abort',function(){__debug('XHR_ABORT',{url:xhr.__webProxyDebugUrl||''});});xhr.addEventListener('timeout',function(){__debug('XHR_TIMEOUT',{url:xhr.__webProxyDebugUrl||''});});return __send.call(this,body);};
    if(navigator.sendBeacon){var __beacon=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(url,data){var target=__proxyTarget(url),result=__beacon(target||url,data);__debug('BEACON',{url:String(url),proxy:target||String(url),accepted:result});return result;};}
    try{if(navigator.serviceWorker){__debug('SERVICE_WORKER_STATE',{supported:true,controller:!!navigator.serviceWorker.controller});navigator.serviceWorker.addEventListener('controllerchange',function(){__debug('SERVICE_WORKER_CONTROLLER_CHANGE',{controller:!!navigator.serviceWorker.controller});});navigator.serviceWorker.getRegistrations().then(function(regs){__debug('SERVICE_WORKER_REGISTRATIONS',{count:regs.length,scopes:regs.map(function(r){return r.scope;})});}).catch(function(e){__debug('SERVICE_WORKER_ERROR',{stage:'getRegistrations',error:String(e)});});}}catch(e){__debug('SERVICE_WORKER_ERROR',{stage:'init',error:String(e)});}
    try{if(performance&&performance.getEntriesByType){setTimeout(function(){var entries=performance.getEntriesByType('resource').slice(-100).map(function(e){return {name:e.name,initiatorType:e.initiatorType,duration:Math.round(e.duration),transferSize:e.transferSize||0};});__debug('RESOURCE_TIMING',{count:entries.length,entries:entries});},1000);}}catch(e){__debug('RESOURCE_TIMING_ERROR',{error:String(e)});}
    try{var __log=console.log,__warn=console.warn,__error=console.error;console.log=function(){__debug('CONSOLE_LOG',{args:Array.prototype.slice.call(arguments).map(function(x){return __safe(x,500);})});return __log.apply(this,arguments);};console.warn=function(){__debug('CONSOLE_WARN',{args:Array.prototype.slice.call(arguments).map(function(x){return __safe(x,500);})});return __warn.apply(this,arguments);};console.error=function(){__debug('CONSOLE_ERROR',{args:Array.prototype.slice.call(arguments).map(function(x){return __safe(x,1000);})});return __error.apply(this,arguments);};}catch(e){__debug('CONSOLE_HOOK_ERROR',{error:String(e)});}
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
    debugLog('MISSING_URL', {method:request.method,requestUrl:request.url,referer:request.headers.get('referer')||null,userAgent:request.headers.get('user-agent')||null,accept:request.headers.get('accept')||null,secFetchSite:request.headers.get('sec-fetch-site')||null,secFetchDest:request.headers.get('sec-fetch-dest')||null,secFetchMode:request.headers.get('sec-fetch-mode')||null,origin:request.headers.get('origin')||null});
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
    debugLog('REQUEST',{method,target,hostname:parsedUrl.hostname,pathname:parsedUrl.pathname,hasQuery:parsedUrl.search.length>0,range:request.headers.get('range')||null,contentType:request.headers.get('content-type')||null,referer:request.headers.get('referer')||null});
    let response;
    try {
      const body = method === 'POST' ? Buffer.from(await request.arrayBuffer()) : undefined;
      response = await axios.request({method,url:target,headers:getProxiedHeaders(request.headers,parsedUrl.origin,method==='POST'),data:body,timeout:20000,maxRedirects:10,responseType:'arraybuffer',validateStatus:()=>true,decompress:true});
    } catch (fetchError) {
      debugLog('FETCH_FAILURE',{method,target,error:String(fetchError)}); console.error('Fetch error:',fetchError);
      return NextResponse.json({error:'Failed to reach website'},{status:503});
    }
    const rawContentType=response.headers['content-type'];
    const contentType=typeof rawContentType==='string'?rawContentType:'application/octet-stream';
    const isHtml=contentType.toLowerCase().includes('text/html');
    const contentEncoding=typeof response.headers['content-encoding']==='string'?response.headers['content-encoding']:null;
    const upstreamContentLength=typeof response.headers['content-length']==='string'?response.headers['content-length']:null;
    const finalUrl=response.request?.res?.responseUrl||target;
    const responseBytes=Buffer.isBuffer(response.data)?response.data.length:null;
    debugLog('RESPONSE',{method,target,finalUrl,status:response.status,contentType,contentEncoding,bytes:responseBytes,redirected:finalUrl!==target,upstreamContentLength,contentRange:response.headers['content-range']||null,location:response.headers.location||null});
    const responseHeaders: Record<string,string>={'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, HEAD, OPTIONS','access-control-allow-headers':'Content-Type, Authorization, Range, X-Requested-With','access-control-expose-headers':'Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag','x-content-type-options':'nosniff','cache-control':isHtml?'no-cache, no-store, must-revalidate':'public, max-age=3600','content-type':contentType};
    for(const header of ['etag','last-modified']){const value=response.headers[header];if(typeof value==='string')responseHeaders[header]=value;}
    if(isHtml){
      responseHeaders['content-type']='text/html; charset=utf-8';
      const body=Buffer.from(response.data).toString('utf8');
      const rewritten=rewriteHtml(body,finalUrl);
      const bridged=rewritten.replace(/<head\b[^>]*>/i,match=>`${match}${createRuntimeBridge(finalUrl)}`);
      return new NextResponse(bridged,{status:response.status,headers:responseHeaders});
    }
    if(response.status===206){delete responseHeaders['content-range'];delete responseHeaders['accept-ranges'];}
    return new NextResponse(method==='HEAD'?null:new Uint8Array(response.data),{status:response.status,headers:responseHeaders});
  } catch(error){debugLog('INTERNAL_ERROR',{method,error:String(error)});console.error('Proxy error:',error);return NextResponse.json({error:'Internal proxy error'},{status:500});}
};

export async function GET(request:NextRequest){return proxyRequest(request,'GET');}
export async function POST(request:NextRequest){return proxyRequest(request,'POST');}
export async function HEAD(request:NextRequest){return proxyRequest(request,'HEAD');}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, HEAD, OPTIONS','access-control-allow-headers':'Content-Type, Authorization, Range, X-Requested-With','access-control-max-age':'86400'}});}
