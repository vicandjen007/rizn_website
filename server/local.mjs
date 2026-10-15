import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {api} from './api.mjs';
export function createApp({database,adminPassword='',rateSalt='local-preview'}={}){
 const root=fileURLToPath(new URL('../',import.meta.url));
 database??=resolve(root,'.local/leads.sqlite');mkdirSync(resolve(database,'..'),{recursive:true});
 const sqlite=new DatabaseSync(database);sqlite.exec(readFileSync(resolve(root,'migrations/0001_leads.sql'),'utf8'));
 sqlite.exec(readFileSync(resolve(root,'migrations/0002_email_outbox.sql'),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this},async run(){return sqlite.prepare(sql).run(...args)},async first(){return sqlite.prepare(sql).get(...args)},async all(){return {results:sqlite.prepare(sql).all(...args)}}}}};
 const server=http.createServer(async(req,res)=>{
 try{
  const origin=`http://127.0.0.1:${server.address().port}`;if(req.headers.host!==new URL(origin).host){res.writeHead(403);return res.end('Invalid host');}
  const path=new URL(req.url,origin).pathname;
  const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');headers.set('cf-connecting-ip',req.socket.remoteAddress||'local');
  const provided=Buffer.from((headers.get('authorization')||'').replace(/^Basic /,''),'base64').toString();const expected='admin:'+adminPassword;
  const authorized=adminPassword.length>=16&&Buffer.byteLength(provided)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected));
  if(authorized)headers.set('oai-authenticated-user-id','local-admin');
  if(path.startsWith('/admin')||path.startsWith('/api/admin')){
   if(!authorized){res.writeHead(adminPassword?401:503,{'WWW-Authenticate':'Basic realm="ARQ local admin"','Cache-Control':'no-store'});return res.end(adminPassword?'Administrator sign-in required.':'Local admin disabled. Configure LOCAL_ADMIN_PASSWORD (16+ characters).');}
  }
  const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
  if(path.startsWith('/api/')){
   const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>16000){res.writeHead(413,security);return res.end('Submission too large');}chunks.push(chunk);}
   const request=new Request(origin+req.url,{method:req.method,headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body:Buffer.concat(chunks)}:{})});
   const response=await api(request,{DB,ADMIN_USER_IDS:'local-admin',RATE_LIMIT_SALT:rateSalt});res.writeHead(response.status,{...security,...Object.fromEntries(response.headers)});return res.end(Buffer.from(await response.arrayBuffer()));
  }
  const names={'/':'index.html','/admin':'admin.html','/privacy':'privacy.html','/contact':'contact.html'};
  const relative=names[path]||decodeURIComponent(path.slice(1));const file=resolve(root,'dist',relative),base=resolve(root,'dist');
  if(!file.startsWith(base+'\\')&&!file.startsWith(base+'/')){res.writeHead(404);return res.end('Not found');}
  if(!existsSync(file)){res.writeHead(404);return res.end('Not found');}
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain'};
  res.writeHead(200,{...security,'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':path.startsWith('/admin')?'no-store':'no-cache'});res.end(readFileSync(file));
 }catch{res.writeHead(500);res.end('Request failed');}
 });
 return {server,sqlite};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=createApp({adminPassword:process.env.LOCAL_ADMIN_PASSWORD});server.listen(Number(process.env.PORT||4317),'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${server.address().port}`));}

