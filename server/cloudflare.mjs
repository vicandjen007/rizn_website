import {createRemoteJWKSet,jwtVerify} from 'jose';
import {api} from './api.mjs';
import {securityHeaders} from './access.mjs';
import {drainEmails} from './email.mjs';
const keysets=new Map();
export async function authorize(request,env){
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)return false;
 const issuer=env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'');
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))return false;
 const token=request.headers.get('cf-access-jwt-assertion');if(!token)return false;
 try{
  if(!keysets.has(issuer))keysets.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs')));
  const {payload}=await jwtVerify(token,keysets.get(issuer),{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','iat','email']});
  return payload.email?.toLowerCase()==='founders@thearqofficial.com';
 }catch{return false;}
}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);let path;
  try{path=decodeURIComponent(url.pathname);}catch{return new Response('Invalid path',{status:400});}
  const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
  const admin=path.startsWith('/admin')||path.startsWith('/api/admin');
  if(admin){
   if(!await authorize(request,env))return new Response('Administrator sign-in required. Access is restricted to founders@thearqofficial.com.',{status:403,headers:{...securityHeaders,'Cache-Control':'no-store'}});
   headers.set('oai-authenticated-user-id','verified-cloudflare-admin');
  }
  const safeRequest=new Request(request,{headers});let response;
  if(path.startsWith('/api/')){
   if(path!==url.pathname)return new Response('Invalid API path',{status:400});
   response=await api(safeRequest,{...env,ADMIN_USER_IDS:'verified-cloudflare-admin'});
   if(response.status===201)ctx.waitUntil(drainEmails(env));
  }else{
   const routes={'/':'/index.html','/admin':'/admin.html','/admin/sign-in':'/admin.html','/privacy':'/privacy.html','/contact':'/contact.html'};
   url.pathname=routes[path]||path;response=await env.ASSETS.fetch(new Request(url,safeRequest));
  }
  const outgoing=new Headers(response.headers);for(const [k,v]of Object.entries(securityHeaders))outgoing.set(k,v);
  if(!admin&&!path.startsWith('/api/')&&url.hostname==='thearqofficial.com')outgoing.set('Content-Security-Policy',securityHeaders['Content-Security-Policy'].replace("img-src 'self' data:","img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com").replace("script-src 'self'","script-src 'self' https://www.googletagmanager.com")+"; connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com");
  if(url.hostname!=='thearqofficial.com')outgoing.set('X-Robots-Tag','noindex, nofollow');
  if(admin||path.startsWith('/api/'))outgoing.set('Cache-Control','no-store');
  return new Response(response.body,{status:response.status,headers:outgoing});
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(drainEmails(env));}
};
