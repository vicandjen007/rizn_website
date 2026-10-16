(() => {
  if (location.hostname !== 'thearqofficial.com' || !['/', '/privacy', '/privacy.html', '/contact', '/contact.html', '/index.html'].includes(location.pathname)) return;
  const id = 'G-7SWEWP0595', key = 'arq-analytics-consent-v1';
  const allowed = new Set(['hero_test_cta_click','hero_launch_cta_click','tester_form_start','launch_form_start','tester_application_success','launch_signup_success','tester_application_error','launch_signup_error']);
  let consent = null, loaded = false;
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved && Date.now() - saved.at < 15552000000) consent = saved.value; } catch {}
  if (navigator.globalPrivacyControl) consent = 'denied';
  const panel = document.createElement('section');
  panel.className = 'analytics-consent'; panel.setAttribute('aria-label', 'Analytics privacy choices');
  panel.innerHTML = '<h2>Your privacy choices</h2><p>May we use Google Analytics to understand visits and improve ARQ? Analytics is optional. Your forms work either way.</p><p><a href="/privacy">Privacy Policy</a></p><div class="consent-actions"><button type="button" data-choice="granted">Allow analytics</button><button type="button" data-choice="denied">Decline analytics</button><button type="button" data-close>Close</button></div>';
  const settings = document.createElement('button');
  settings.type = 'button'; settings.className = 'analytics-settings'; settings.textContent = 'Privacy choices';
  document.body.append(panel, settings);
  panel.hidden = consent !== null;
  panel.querySelector('[data-close]').hidden = consent === null;
  function start() {
    if (loaded || consent !== 'granted') return;
    loaded = true; window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){window.dataLayer.push(arguments);};
    window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    window.gtag('js',new Date());
    let referrer = ''; try { referrer = new URL(document.referrer).origin + '/'; } catch {}
    window.gtag('config',id,{send_page_view:true,page_location:location.origin + location.pathname,page_referrer:referrer,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_expires:15552000});
    const script = document.createElement('script'); script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id; document.head.append(script);
  }
  function clearCookies() {
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0]; if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', '; domain=thearqofficial.com', '; domain=.thearqofficial.com']) document.cookie = name + '=; Max-Age=0; path=/' + domain;
    }
  }
  panel.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    consent = navigator.globalPrivacyControl ? 'denied' : button.dataset.choice;
    try { localStorage.setItem(key,JSON.stringify({value:consent,at:Date.now()})); } catch {}
    panel.hidden = true; settings.focus();
    if (consent === 'granted') start();
    else { window['ga-disable-' + id] = true; clearCookies(); if (loaded) location.reload(); }
  }));
  settings.addEventListener('click',()=>{panel.hidden=false;panel.querySelector('[data-close]').hidden=consent===null;panel.querySelector('button').focus();});
  panel.querySelector('[data-close]').addEventListener('click',()=>{panel.hidden=true;settings.focus();});
  window.arqAnalytics = name => { if (consent==='granted' && allowed.has(name) && typeof window.gtag==='function') window.gtag('event',name); };
  if (consent==='denied') clearCookies();
  start();
})();
