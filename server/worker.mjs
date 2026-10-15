// Sites adapter: provision D1 and set ADMIN_USER_IDS and RATE_LIMIT_SALT before deployment.
// Identity headers must come from Sites authenticated dispatch, never an untrusted direct origin.
import {api} from './api.mjs';
import {isAdmin,securityHeaders} from './access.mjs';
export default {async fetch(request,env){
 const url=new URL(request.url);
 let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Invalid path',{status:400});}
 let response;
 if(path==='/admin/sign-in'){
  return new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt?return_to=%2Fadmin','Cache-Control':'no-store',...securityHeaders}});
 }
 if(path.startsWith('/admin')&&!isAdmin(request,env)){
  response=new Response('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>ARQ administrator access</title><link rel="stylesheet" href="/styles.css"></head><body><main class="legal section"><h1>Administrator access</h1><p>Sign in using the account designated for founders@thearqofficial.com. Administrator approval is required in addition to sign-in.</p><a class="button primary" href="/admin/sign-in" target="_top">Sign in with ChatGPT</a><p><a href="/">Return to ARQ</a></p></main></body></html>',{status:403,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 }else if(path.startsWith('/api/')){
  if(path!==url.pathname)return new Response('Invalid API path',{status:400});
  response=await api(request,env);
 }else{
  const routes={'/':'/index.html','/admin':'/admin.html','/privacy':'/privacy.html','/contact':'/contact.html'};
  url.pathname=routes[path]||path;
  response=await env.ASSETS.fetch(new Request(url,request));
 }
 const headers=new Headers(response.headers);for(const [key,value]of Object.entries(securityHeaders))headers.set(key,value);
 if(path.startsWith('/admin')||path.startsWith('/api/'))headers.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,headers});
}};
