export function emailPayload(lead,kind,env){
 const tester=lead.category==='tester';
 const subject=kind==='notification'?(tester?'New ARQ testing application':'New ARQ launch signup'):(tester?'We received your ARQ testing application':'You’re on the ARQ launch list');
 const text=kind==='notification'
  ? `${subject}.\n\nReference: ${lead.id}\nReview this submission in the secure ARQ administrator dashboard.\n`
  : tester
   ? 'Thank you for applying to test ARQ. We received your application and will contact you if a testing opportunity is a fit. Applying does not guarantee selection, a product, or compensation.\n\nQuestions? Reply to this email.\n\nARQ | RIZN Barber Technologies'
   : 'Thank you for joining the ARQ launch list. We’ll email you with product availability and launch news.\n\nTo leave the list, reply with “unsubscribe” or contact privacy@thearqofficial.com.\n\nARQ | RIZN Barber Technologies';
 return {from:env.MAIL_FROM,to:[kind==='notification'?'earlyaccess@thearqofficial.com':lead.email],reply_to:'earlyaccess@thearqofficial.com',subject,text};
}
// D1 trigger queues both messages atomically with the submission. Duplicates do not enqueue again.
export async function drainEmails(env,send=fetch){
 if(env.EMAIL_ENABLED!=='true'||!env.RESEND_API_KEY||!env.MAIL_FROM||!env.DB)return;
 const now=Date.now();
 const {results}=await env.DB.prepare("SELECT * FROM email_outbox WHERE state='pending' AND next_attempt<=? ORDER BY next_attempt LIMIT 10").bind(now).all();
 for(const job of results){
  const claim=await env.DB.prepare("UPDATE email_outbox SET next_attempt=?, attempts=attempts+1,first_attempt=COALESCE(first_attempt,?) WHERE id=? AND state='pending' AND next_attempt<=?").bind(now+120000,now,job.id,now).run();
  if(!(claim.meta?.changes??claim.changes))continue;
  // Resend retains idempotency keys for 24 hours. Stop ambiguous retries before expiry.
  if(job.first_attempt&&now-job.first_attempt>23*3600000){await env.DB.prepare("UPDATE email_outbox SET state='review',last_error='Retry window expired; check Resend before resending' WHERE id=?").bind(job.id).run();continue;}
  try{
   let payload=job.payload;
   if(!payload){const lead=await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(job.lead_id).first();if(!lead)throw Error('Missing lead');payload=JSON.stringify(emailPayload(lead,job.kind,env));await env.DB.prepare('UPDATE email_outbox SET payload=? WHERE id=?').bind(payload,job.id).run();}
   const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:payload,signal:AbortSignal.timeout(15000)});
   if(!response.ok){const retry=response.status===429||response.status>=500;await env.DB.prepare('UPDATE email_outbox SET state=?,next_attempt=?,last_error=? WHERE id=?').bind(retry?'pending':'review',now+Math.min(3600000,60000*2**Math.min(job.attempts,6)),`Provider HTTP ${response.status}`,job.id).run();continue;}
   const result=await response.json();if(!result.id)throw Error('Missing provider receipt');
   await env.DB.prepare("UPDATE email_outbox SET state='accepted',provider_id=?,last_error=NULL WHERE id=?").bind(result.id,job.id).run();
  }catch{await env.DB.prepare("UPDATE email_outbox SET next_attempt=?,last_error='Delivery attempt interrupted; queued for retry' WHERE id=?").bind(now+300000,job.id).run();}
 }
}
