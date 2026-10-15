function track(name){window.dispatchEvent(new CustomEvent('arq:analytics',{detail:{event:name}}));if(typeof window.arqAnalytics==='function')window.arqAnalytics(name);}
document.querySelectorAll('[data-event]').forEach(a=>a.addEventListener('click',()=>track(a.dataset.event)));
document.querySelectorAll('form[data-category]').forEach(form=>{
 const category=form.dataset.category;const startedAt=Date.now();let started=false;
 form.addEventListener('focusin',()=>{if(!started){started=true;track(category==='tester'?'tester_form_start':'launch_form_start');}});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button[type=submit]');if(button.disabled)return;
  const error=form.querySelector('.form-error');error.textContent='';form.querySelectorAll('.field-error').forEach(e=>e.textContent='');form.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));
  const payload=Object.fromEntries(new FormData(form));payload.marketingConsent=form.elements.marketingConsent.checked;payload.acknowledgment=!!form.elements.acknowledgment?.checked;payload.startedAt=startedAt;
  button.disabled=true;const label=button.textContent;button.textContent='Submitting…';
  try{
   const response=await fetch('/api/'+category,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const result=await response.json();if(!response.ok){for(const [name,message]of Object.entries(result.fields||{})){const input=form.elements[name];if(input){input.setAttribute('aria-invalid','true');const messageEl=form.querySelector(`[data-error="${name}"]`);if(messageEl){messageEl.textContent=message;messageEl.id=category+'-error-'+name;input.setAttribute('aria-describedby',messageEl.id);}}}throw Error(result.error||'Please try again.');}
   form.hidden=true;const success=document.getElementById(category+'-success');success.hidden=false;success.focus();track(category==='tester'?'tester_application_success':'launch_signup_success');
  }catch(e){error.textContent=e.message==='Failed to fetch'?'Connection unavailable. Your submission was not saved. Please try again.':e.message;const invalid=form.querySelector('[aria-invalid=true]');if(invalid){const details=invalid.closest('details');if(details)details.open=true;invalid.focus();}else error.focus();track(category==='tester'?'tester_application_error':'launch_signup_error');}
  finally{button.disabled=false;button.textContent=label;}
 });
});
