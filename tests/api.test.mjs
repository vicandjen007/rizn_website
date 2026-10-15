import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomBytes} from 'node:crypto';import {createApp} from '../server/local.mjs';
test('real HTTP submissions, persistence, duplicate boundaries, consent and admin security',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'arq-test-')),database=join(temp,'test.sqlite'),password=randomBytes(24).toString('hex');
 const {server,sqlite}=createApp({database,adminPassword:password});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const auth='Basic '+Buffer.from('admin:'+password).toString('base64');
 const post=(path,body,headers={})=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(body)});
 const common={email:'barber@example.test',firstName:'Test',startedAt:Date.now()-5000,website:''};
 try{
  assert.equal((await fetch(origin+'/api/admin/leads?category=tester')).status,401);
  assert.equal((await fetch(origin+'/admin.html')).status,401);
  assert.equal((await fetch(origin+'/api/admin/leads?category=tester',{headers:{'oai-authenticated-user-id':'local-admin'}})).status,401);
  assert.equal((await post('/api/launch',{...common,marketingConsent:true},{Origin:'https://evil.test'})).status,403);
  assert.equal((await post('/api/launch',{...common,marketingConsent:false})).status,400);
  assert.equal((await post('/api/tester',{...common,barberStatus:'Professional Barber',social:'@test',acknowledgment:false})).status,400);
  assert.equal((await post('/api/tester',{...common,barberStatus:'Professional Barber',social:'@test',acknowledgment:true,marketingConsent:false,experience:'5'})).status,201);
  assert.equal((await post('/api/launch',{...common,marketingConsent:true})).status,201);
  assert.equal((await post('/api/launch',{...common,email:'BARBER@example.test',marketingConsent:true})).status,201);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM leads').get().n,2);
  assert.equal(sqlite.prepare("SELECT duplicate_count FROM leads WHERE category='launch'").get().duplicate_count,1);
  assert.equal(sqlite.prepare("SELECT consent FROM leads WHERE category='tester'").get().consent,0);
  const r=await fetch(origin+'/api/admin/leads?category=tester',{headers:{Authorization:auth}});assert.equal(r.status,200);const record=(await r.json()).records[0];
  assert.equal((await post('/api/admin/status',{id:record.id,status:'Selected'},{Authorization:auth})).status,200);
  assert.equal(sqlite.prepare('SELECT status FROM leads WHERE id=?').get(record.id).status,'Selected');
  assert.equal((await post('/api/admin/status',{id:record.id,status:'Hacked'},{Authorization:auth})).status,400);
  const exported=await fetch(origin+'/api/admin/export?category=tester',{headers:{Authorization:auth}});assert.equal(exported.status,200);assert.match(await exported.text(),/barber@example.test/);
  assert.equal((await post('/api/launch',{...common,website:'spam',marketingConsent:true})).status,400);
  assert.equal((await post('/api/launch',{...common,startedAt:Date.now(),marketingConsent:true})).status,400);
  let rate;for(let i=0;i<8;i++)rate=await post('/api/launch',{...common,marketingConsent:true});assert.equal(rate.status,429);
 }finally{await new Promise(r=>server.close(r));sqlite.close();}
 const reopened=createApp({database});assert.equal(reopened.sqlite.prepare('SELECT count(*) AS n FROM leads').get().n,2);reopened.sqlite.close();rmSync(temp,{recursive:true});
});
