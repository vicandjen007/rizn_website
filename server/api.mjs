import {isAdmin} from './access.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const statuses=['New','Under Review','Selected','Not Selected'];
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const csvCell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
export async function api(request,env){
 const url=new URL(request.url),path=url.pathname,db=env.DB;
 if(!db||!env.RATE_LIMIT_SALT)return json({error:'Submissions are temporarily unavailable. Please try again later.'},503);
 try{
 if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return json({error:'Request origin is not allowed.'},403);
 if(path.startsWith('/api/admin')){
  if(!isAdmin(request,env))return json({error:'Administrator sign-in required.'},403);
  if(path==='/api/admin/email-status'&&request.method==='GET'){
   const {results}=await db.prepare('SELECT state,COUNT(*) AS count FROM email_outbox GROUP BY state').all();
   return json({states:results,emailEnabled:env.EMAIL_ENABLED==='true'});
  }
  if(path==='/api/admin/status'&&request.method==='POST'){
   const body=await readBody(request);if(!statuses.includes(body.status)||typeof body.id!=='string')return json({error:'Invalid status.'},400);
   await db.prepare("UPDATE leads SET status=? WHERE id=? AND category='tester'").bind(body.status,body.id).run();return json({ok:true});
  }
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  const category=url.searchParams.get('category');if(!['tester','launch'].includes(category))return json({error:'Choose a list.'},400);
  const {results}=await db.prepare('SELECT * FROM leads WHERE category=? ORDER BY created_at DESC').bind(category).all();
  if(path==='/api/admin/export'){
   const fields=['id','category','email','first_name','lastName','barberStatus','social','city','region','country','experience','role','interest','feedback','acknowledgment','status','consent','consent_at','created_at','source','duplicate_count'];
   const lines=[fields.join(','),...results.map(row=>{const item={...JSON.parse(row.data),...row};return fields.map(f=>csvCell(item[f])).join(',')})];
   return new Response('\uFEFF'+lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="arq-${category}.csv"`,'Cache-Control':'no-store'}});
  }
  return json({records:results.map(row=>({...row,data:JSON.parse(row.data)}))});
 }
 if(!['/api/tester','/api/launch'].includes(path)||request.method!=='POST')return json({error:'Not found.'},404);
 const body=await readBody(request),category=path.slice(5);
 const ip=request.headers.get('cf-connecting-ip')||'local';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode((env.RATE_LIMIT_SALT||'local')+ip));
 const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const now=Date.now();await db.prepare('DELETE FROM limits WHERE expires < ?').bind(now).run();
 await db.prepare('INSERT INTO limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key,now+600000).run();
 const rate=await db.prepare('SELECT count FROM limits WHERE key=?').bind(key).first();if(rate.count>12)return json({error:'Too many attempts. Please try again in 10 minutes.'},429);
 if(body.website||!Number.isFinite(body.startedAt)||now-body.startedAt<2000||now-body.startedAt>86400000)return json({error:'Please reload the form and try again.'},400);
 const email=text(body.email,254).toLowerCase(),firstName=text(body.firstName,80),consent=body.marketingConsent===true;
 const errors={};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.email='Enter a valid email address.';
 if(category==='tester'){
  if(!firstName)errors.firstName='Enter your first name.';
  if(!['Professional Barber','Barber Student','Other'].includes(body.barberStatus))errors.barberStatus='Choose your barber status.';
  if(!text(body.social))errors.social='Enter your Instagram or TikTok handle.';
  if(body.acknowledgment!==true)errors.acknowledgment='Please acknowledge that selection is not guaranteed.';
  if(body.experience&&!/^(\d{1,2})(\.\d)?$/.test(String(body.experience)))errors.experience='Enter years from 0 to 99.';
  if(body.role&&!['Shop Owner','Independent Barber','Employed Barber','Student','Other'].includes(body.role))errors.role='Choose a listed role.';
  if(body.feedback&&!['Yes','No'].includes(body.feedback))errors.feedback='Choose Yes or No.';
 }else if(!consent)errors.marketingConsent='Please consent to receive launch emails.';
 if(Object.keys(errors).length)return json({error:'Please check the highlighted fields.',fields:errors},400);
 const data={};if(category==='tester')for(const f of ['lastName','barberStatus','social','city','region','country','experience','role','interest','feedback'])data[f]=text(String(body[f]??''),f==='interest'?2000:200);
 if(category==='tester')data.acknowledgment=true;
 const created=new Date().toISOString();
 await db.prepare('INSERT INTO leads (id,category,email,first_name,data,consent,consent_at,created_at,source) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(category,email) DO UPDATE SET duplicate_count=duplicate_count+1').bind(crypto.randomUUID(),category,email,firstName,JSON.stringify(data),consent?1:0,consent?created:null,created,category==='tester'?'website_tester_application_v1':'website_launch_form_v1').run();
 return json({ok:true},201);
 }catch(error){if(error.status)return json({error:error.message},error.status);return json({error:'We could not save your submission. Please try again.'},503);}
}
async function readBody(request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw Object.assign(new Error('Expected JSON.'),{status:415});
 const reader=request.body?.getReader();let bytes=0,chunks=[];if(!reader)throw Object.assign(new Error('Missing submission.'),{status:400});
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000){await reader.cancel();throw Object.assign(new Error('Submission is too large.'),{status:413});}chunks.push(value);}
 try{const merged=new Uint8Array(bytes);let offset=0;for(const c of chunks){merged.set(c,offset);offset+=c.length;}const body=JSON.parse(new TextDecoder().decode(merged));if(!body||Array.isArray(body)||typeof body!=='object')throw Error();return body;}catch{throw Object.assign(new Error('Invalid submission.'),{status:400});}
}
