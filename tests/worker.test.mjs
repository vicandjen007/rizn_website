import test from 'node:test';import assert from 'node:assert/strict';import worker from '../server/worker.mjs';
test('hosted routing guards admin assets and exposes only a sign-in prompt',async()=>{
 const calls=[];const env={ADMIN_USER_IDS:'approved-id',ASSETS:{async fetch(r){calls.push(new URL(r.url).pathname);return new Response('asset');}}};
 for(const path of ['/admin','/admin.html','/admin.js','/%61dmin.html']){const r=await worker.fetch(new Request('https://arq.test'+path),env);assert.equal(r.status,403);assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal(calls.length,0);
 assert.equal((await worker.fetch(new Request('https://arq.test/admin',{headers:{'oai-authenticated-user-id':'other-user'}}),env)).status,403);
 const signed=await worker.fetch(new Request('https://arq.test/admin',{headers:{'oai-authenticated-user-id':'approved-id'}}),env);assert.equal(signed.status,200);assert.equal(calls.at(-1),'/admin.html');assert.ok(signed.headers.has('content-security-policy'));
 const signin=await worker.fetch(new Request('https://arq.test/admin/sign-in'),env);assert.equal(signin.status,302);assert.equal(signin.headers.get('location'),'/signin-with-chatgpt?return_to=%2Fadmin');
 await worker.fetch(new Request('https://arq.test/privacy'),env);assert.equal(calls.at(-1),'/privacy.html');
 const unavailable=await worker.fetch(new Request('https://arq.test/api/launch',{method:'POST',headers:{Origin:'https://arq.test'}}),env);assert.equal(unavailable.status,503);
});
