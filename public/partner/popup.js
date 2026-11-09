const $ = id => document.getElementById(id);
let environments = [];
const status = message => { $('status').textContent = message; };
async function load() {
 const [local, session] = await Promise.all([chrome.storage.local.get(['environments','partnerEmail','remember','partnerPassword','lastStatus']),chrome.storage.session.get('partnerPassword')]);
 environments = local.environments || [];
 $('email').value = local.partnerEmail || '';
 $('remember').checked = !!local.remember;
 $('password').value = (local.remember ? local.partnerPassword : session.partnerPassword) || '';
 $('settings').open = !$('email').value || !$('password').value;
 if(local.lastStatus) status(local.lastStatus);
 render();
}
function render() {
 $('list').replaceChildren();
 const query = $('search').value.toLowerCase();
 const visible = environments.filter(e => (e.name+' '+e.email).toLowerCase().includes(query));
 if(!visible.length) { const p=document.createElement('p');p.className='empty';p.textContent=environments.length?'לא נמצאו סביבות.':'הוסיפו סביבה ראשונה כדי להתחיל.';$('list').append(p); }
 for(const env of visible) {
  const row=document.createElement('div'); row.className='row';
  const info=document.createElement('div');info.className='info';
  const name=document.createElement('strong');name.textContent=env.name;
  const email=document.createElement('small');email.textContent=env.email;info.append(name,email);
  const login=document.createElement('button');login.textContent='כניסה';login.setAttribute('aria-label','כניסה ל־'+env.name);
  login.onclick=async()=>{login.disabled=true;try{const result=await chrome.runtime.sendMessage({type:'launch',id:env.id});status(result.ok?(result.reused?'משתמש בכרטיסיית Fireberry הקיימת וממתין לטופס.':'נפתחה כרטיסייה. התוסף ממתין לטופס וילחץ על Access.'):result.error);}catch{status('לא ניתן לפתוח את הסביבה. נסו שוב.');}finally{login.disabled=false;}};
  const edit=document.createElement('button');edit.textContent='עריכה';edit.className='secondary';edit.onclick=()=>{$('env-id').value=env.id;$('name').value=env.name;$('customer').value=env.email;$('editor').open=true;$('name').focus();};
  const remove=document.createElement('button');remove.textContent='מחיקה';remove.className='secondary';remove.onclick=async()=>{if(!confirm('למחוק את הסביבה '+env.name+'?'))return;environments=environments.filter(e=>e.id!==env.id);await chrome.storage.local.set({environments});render();};
  row.append(info,login,edit,remove);$('list').append(row);
 }
}
$('search').oninput=render;
$('cancel').onclick=()=>{$('environment').reset();$('env-id').value='';$('editor').open=false;};
$('environment').onsubmit=async event=>{event.preventDefault();const env={id:$('env-id').value||crypto.randomUUID(),name:$('name').value.trim(),email:$('customer').value.trim()};if(!env.name)return;const index=environments.findIndex(e=>e.id===env.id);if(index<0)environments.push(env);else environments[index]=env;await chrome.storage.local.set({environments});$('cancel').click();render();status('הסביבה נשמרה.');};
$('partner').onsubmit=async event=>{event.preventDefault();try{const remember=$('remember').checked;const password=$('password').value;await chrome.storage.local.remove('partnerPassword');await chrome.storage.session.remove('partnerPassword');await chrome.storage.local.set({partnerEmail:$('email').value.trim(),remember});await (remember?chrome.storage.local:chrome.storage.session).set({partnerPassword:password});status('פרטי השותף נשמרו.');$('settings').open=false;}catch{status('השמירה נכשלה. נסו שוב.');}};
$('forget').onclick=async()=>{await chrome.storage.local.remove('partnerPassword');await chrome.storage.session.remove('partnerPassword');$('password').value='';status('הסיסמה נמחקה מהתוסף.');};
chrome.storage.onChanged.addListener(changes=>{if(changes.lastStatus)status(changes.lastStatus.newValue);});
load().catch(()=>status('טעינת ההגדרות נכשלה. סגרו ופתחו את התוסף.'));
