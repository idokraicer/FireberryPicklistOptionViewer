const LOGIN_URL = 'https://app.fireberry.com/app/partneraccess';
const ready = Promise.all([
 chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),
 chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
]);
function isLogin(url) {
 try { const u=new URL(url); return u.origin==='https://app.fireberry.com' && u.pathname.replace(/\/$/,'')==='/app/partneraccess'; } catch { return false; }
}
async function fillAndSubmit(partnerEmail, password, customerEmail) {
 const matchesPage=()=>location.origin==='https://app.fireberry.com' && location.pathname.replace(/\/$/,'')==='/app/partneraccess';
 const visible=el=>!!(el && el.getClientRects().length && !el.disabled);
 const find=(name,label)=>Array.from(document.querySelectorAll('input')).find(el=>visible(el) && (el.name===name || [el.placeholder,el.getAttribute('aria-label'),...Array.from(el.labels||[],l=>l.textContent)].some(v=>v?.trim().toLowerCase()===label.toLowerCase())));
 const deadline=Date.now()+20000;
 while(Date.now()<deadline) {
  if(!matchesPage()) return {ok:false,error:'העמוד הועבר לפני מילוי הטופס. פתחו שוב דרך התוסף.'};
  const email=find('userName','Partner Email'), pass=find('password','Partner Password'), customer=find('targetUsername','Customer Username Email');
  const access=Array.from(document.querySelectorAll('button,input[type="submit"],a[role="button"]')).find(el=>visible(el) && (el.textContent||el.value||'').trim().toLowerCase()==='access');
  if(email && pass && customer && access) {
   const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
   for(const [el,value] of [[email,partnerEmail],[pass,password],[customer,customerEmail]]) {
    el.focus();set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    // Fireberry validates on blur using React state. Let the input state commit first.
    await new Promise(resolve=>setTimeout(resolve,80));
    el.blur();
    await new Promise(resolve=>setTimeout(resolve,80));
   }
   await new Promise(resolve=>setTimeout(resolve,150));
   if(!matchesPage() || email.value!==partnerEmail || pass.value!==password || customer.value!==customerEmail) return {ok:false,error:'לא ניתן היה למלא את הטופס. מלאו אותו ידנית.'};
   if(!visible(access)) return {ok:false,error:'כפתור Access אינו זמין. בדקו את הטופס.'};
   access.click();return {ok:true};
  }
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 return {ok:false,error:'טופס ההתחברות לא זוהה בתוך 20 שניות. נסו שוב או התחברו ידנית.'};
}
// Runs in the Fireberry tab so the request uses that profile's session cookies.
// No credentials are passed to this function or read from the page.
async function logoutCurrentSession() {
 if(location.origin!=='https://app.fireberry.com' || location.pathname.replace(/\/$/,'')!=='/app/partneraccess') return {ok:false};
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 try {
  const response=await fetch('/_common/webcontrols/logoff.aspx',{
   method:'GET',credentials:'include',cache:'no-store',redirect:'follow',signal:controller.signal
  });
  const destination=new URL(response.url);
  // Fireberry redirects this endpoint to its login page, including when already logged out.
  // Unexpected destinations/errors must not be followed by submitting new credentials.
  if(!response.ok || destination.origin!=='https://app.fireberry.com' || destination.pathname.replace(/\/$/,'')!=='/app/login') return {ok:false};
  // Match Fireberry's own logout cleanup, scoped to the site's localStorage.
  // This does not touch the extension's chrome.storage settings or saved password.
  localStorage.clear();
  return {ok:true};
 } catch { return {ok:false}; }
 finally { clearTimeout(timeout); }
}
const processing = new Set();
async function processTab(tabId, tab) {
 // New tabs can emit completion before their host-permitted URL is available.
 // Ignore these snapshots without consuming the pending login request.
 if(!isLogin(tab.url)) return;
 await ready;
 const key='pending:'+tabId;
 if(processing.has(tabId)) return;
 processing.add(tabId);
 try {
 const pending=(await chrome.storage.session.get(key))[key];
 if(!pending) return;
 // Consume before injection: one click per user request, never retry a submitted login.
 await chrome.storage.session.remove(key);
 if(Date.now()-pending.created>60000 || !isLogin(tab.url)) {
  await chrome.storage.local.set({lastStatus:'הכרטיסייה לא נשארה בעמוד Partner Access. לא נשלחו פרטים.'});return;
 }
 try {
  const local=await chrome.storage.local.get(['partnerEmail','remember','partnerPassword']);
  const session=await chrome.storage.session.get('partnerPassword');
  const password=local.remember?local.partnerPassword:session.partnerPassword;
  if(!local.partnerEmail || !password) throw Error('missing');
  await chrome.storage.local.set({lastStatus:'מתנתק מהסשן הנוכחי…'});
  const logout=await chrome.scripting.executeScript({target:{tabId},func:logoutCurrentSession});
  if(!logout[0]?.result?.ok) {
   await chrome.storage.local.set({lastStatus:'ההתנתקות לא הושלמה. לא נשלחו פרטי התחברות. נסו שוב או התנתקו ידנית.'});
   return;
  }
  await chrome.storage.local.set({lastStatus:'ההתנתקות הושלמה. מתחבר לסביבה שנבחרה…'});
  const results=await chrome.scripting.executeScript({target:{tabId},func:fillAndSubmit,args:[local.partnerEmail,password,pending.email]});
  const result=results[0]?.result;
  await chrome.storage.local.set({lastStatus:result?.ok?'הפרטים מולאו ונלחץ Access. בדקו בכרטיסיית Fireberry אם ההתחברות הצליחה.':result?.error||'המילוי לא הושלם. בדקו את כרטיסיית Fireberry.'});
 } catch {await chrome.storage.local.set({lastStatus:'המילוי לא הושלם. בדקו את פרטי השותף והרשאת הגישה של התוסף לאתר Fireberry, ונסו שוב.'});}
 } finally { processing.delete(tabId); }
}
chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{if(change.status==='complete')processTab(tabId,tab).catch(()=>{});});
chrome.tabs.onRemoved.addListener(tabId=>{chrome.storage.session.remove('pending:'+tabId).catch(()=>{});});
function selectExistingTab(tabs, currentId) {
 const safe=tabs.filter(tab=>{try{return new URL(tab.url).origin==='https://app.fireberry.com';}catch{return false;}});
 return safe.find(tab=>tab.id===currentId) || safe.find(tab=>isLogin(tab.url)) || safe.sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];
}
let launching=false;
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id || sender.tab || message.type!=='launch') return;
 (async()=>{
  await ready;
  if(launching)return {ok:false,error:'כרטיסייה כבר נפתחת. נסו שוב בעוד רגע.'};
  launching=true;
  try {
   const local=await chrome.storage.local.get(['environments','partnerEmail','remember','partnerPassword']);
   const session=await chrome.storage.session.get('partnerPassword');
   const password=local.remember?local.partnerPassword:session.partnerPassword;
   const env=(local.environments||[]).find(e=>e.id===message.id);
   if(!env)return {ok:false,error:'הסביבה לא נמצאה.'};
   if(!local.partnerEmail || !password)return {ok:false,error:'פתחו את פרטי השותף והזינו מייל וסיסמה.'};
   const matches=await chrome.tabs.query({url:'https://app.fireberry.com/*'});
   const current=await chrome.tabs.query({active:true,currentWindow:true});
   const selected=selectExistingTab(matches,current[0]?.id);
   if(selected && processing.has(selected.id)) return {ok:false,error:'התחברות כבר מתבצעת בכרטיסייה זו. המתינו לסיום ונסו שוב.'};
   const reused=!!selected;
   const tab=selected || await chrome.tabs.create({url:'about:blank',active:true});
   await chrome.storage.session.set({['pending:'+tab.id]:{email:env.email,created:Date.now()}});
   await chrome.storage.local.set({lastStatus:'ממתין לטעינת עמוד ההתחברות…'});
   try {
    await chrome.tabs.update(tab.id,{active:true});
    if(tab.windowId!==undefined) await chrome.windows.update(tab.windowId,{focused:true});
    if(isLogin(tab.url) && tab.status==='complete') {
     processTab(tab.id,tab).catch(()=>{});
    } else {
     // Force a full load, including when an existing login tab is still loading.
     await chrome.tabs.update(tab.id,{url:LOGIN_URL});
     const latest=await chrome.tabs.get(tab.id);
     if(latest.status==='complete' && isLogin(latest.url)) processTab(tab.id,latest).catch(()=>{});
    }
   }catch(error){await chrome.storage.session.remove('pending:'+tab.id);throw error;}
   return {ok:true,reused};
  } finally {launching=false;}
 })().then(respond,()=>respond({ok:false,error:'פתיחת הכרטיסייה נכשלה. נסו שוב.'}));
 return true;
});
