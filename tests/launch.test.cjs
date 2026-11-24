const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../src/background/partner.js'),'utf8');
function setup(existing, { delayedLoad = false, injectionGate = Promise.resolve(), logoutGate = Promise.resolve(), logoutOk = true, failedLogoutTab, failedNavigationTab, logoutThrows = false } = {}) {
 const local={environments:[{id:'env',email:'customer@example.com'}],partnerEmail:'partner@example.com',remember:false};
 const session={partnerPassword:'fake-password'};
 const area=data=>({setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).filter(k=>k in data).map(k=>[k,data[k]])),set:async values=>Object.assign(data,values),remove:async key=>{delete data[key];}});
 let handler,updated;const calls={created:0,injected:0,updates:[],loggedOut:[],events:[]};
 const tabs=existing.map(t=>({...t}));
 const chrome={storage:{local:area(local),session:area(session)},runtime:{id:'test',onMessage:{addListener(fn){handler=fn;}}},windows:{update:async()=>{}},scripting:{executeScript:async ({target,func})=>{if(func.name==='logoutCurrentSession'){calls.loggedOut.push(target.tabId);await logoutGate;if(logoutThrows)throw Error('tab closed');calls.events.push('logout:'+target.tabId);return [{result:{ok:logoutOk && target.tabId!==failedLogoutTab}}];}calls.events.push('login');calls.injected++;await injectionGate;return [{result:{ok:true}}];}},tabs:{onUpdated:{addListener(fn){updated=fn;}},onRemoved:{addListener(){}},query:async q=>q.url?tabs:tabs.filter(t=>t.active),create:async()=>{calls.created++;const t={id:99,url:'about:blank',status:'complete'};tabs.push(t);return t;},update:async(id,props)=>{if(props.url && id===failedNavigationTab)throw Error('navigation failed');calls.updates.push({id,...props});const t=tabs.find(t=>t.id===id);Object.assign(t,props);if(props.url)t.status=delayedLoad?'loading':'complete';return {...t};},get:async id=>tabs.find(t=>t.id===id)}};
 const c=vm.createContext({chrome,URL,Date,Promise,Set,setTimeout});vm.runInContext(code,c);
 return {calls,session,local,updated,tabs,launch:()=>new Promise(resolve=>handler({type:'launch',id:'env'},{id:'test'},resolve))};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('existing login tab fills immediately without a new load event or new tab',async()=>{const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true}]);assert.equal((await x.launch()).reused,true);await settle();assert.equal(x.calls.created,0);assert.equal(x.calls.injected,1);assert.equal(x.calls.updates.some(t=>t.url),false);});
test('existing CRM tab navigates to partner access instead of creating a tab',async()=>{const x=setup([{id:1,url:'https://app.fireberry.com/app/views/1',status:'complete',active:true}]);assert.equal((await x.launch()).reused,true);await settle();assert.equal(x.calls.created,0);assert.equal(x.calls.updates.find(t=>t.url).url,'https://app.fireberry.com/app/partneraccess');assert.equal(x.calls.injected,1);});
test('no Fireberry tab creates one and consumes request once',async()=>{const x=setup([]);assert.equal((await x.launch()).reused,false);await settle();assert.equal(x.calls.created,1);assert.equal(x.calls.injected,1);x.updated(99,{status:'complete'},{url:'https://app.fireberry.com/app/partneraccess'});await settle();assert.equal(x.calls.injected,1);assert.equal(Object.keys(x.session).some(k=>k.startsWith('pending:')),false);});

test('new tab ignores a completion event without an authorized URL until Fireberry finishes loading',async()=>{
 const x=setup([],{delayedLoad:true});
 assert.equal((await x.launch()).ok,true);
 x.updated(99,{status:'complete'},{id:99,status:'complete'});
 await settle();
 assert.equal(x.calls.injected,0);
 assert.ok(x.session['pending:99'],'early blank-page completion must not consume the login request');
 x.updated(99,{status:'complete'},{id:99,status:'complete',url:'https://app.fireberry.com/app/partneraccess'});
 await settle();
 assert.equal(x.calls.injected,1);
 assert.equal(x.session['pending:99'],undefined);
});
test('new tab waits through blank page and loading before injecting once on login completion',async()=>{
 const x=setup([],{delayedLoad:true});
 await x.launch();
 x.updated(99,{status:'complete'},{url:'about:blank',status:'complete'});
 x.updated(99,{status:'loading'},{url:'https://app.fireberry.com/app/partneraccess',status:'loading'});
 await settle();
 assert.equal(x.calls.injected,0);
 x.updated(99,{status:'complete'},{url:'https://app.fireberry.com/app/partneraccess',status:'complete'});
 x.updated(99,{status:'complete'},{url:'https://app.fireberry.com/app/partneraccess',status:'complete'});
 await settle();
 assert.equal(x.calls.injected,1);
});

test('rejects a second launch on a busy tab without stranding a pending request',async()=>{
 let release;
 const injectionGate=new Promise(resolve=>{release=resolve;});
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true}],{injectionGate});
 try {
  assert.equal((await x.launch()).ok,true);
  await settle();
  assert.equal(x.calls.injected,1);
  const result=await x.launch();
  assert.equal(result.ok,false);
  assert.ok(result.error);
  assert.equal(x.session['pending:1'],undefined);
  assert.equal(x.calls.injected,1);
 } finally {release();}
 await settle();
 assert.equal((await x.launch()).ok,true,'a new request is allowed after the previous injection settles');
 await settle();
 assert.equal(x.calls.injected,2);
 assert.equal(x.session['pending:1'],undefined);
});


test('logs out the shared session once before login and removes stale CRM pages',async()=>{
 let release;const logoutGate=new Promise(resolve=>{release=resolve;});
 const x=setup([{id:1,url:'https://app.fireberry.com/app/views/1',status:'complete',active:true},{id:2,url:'https://app.fireberry.com/app/views/2',status:'complete'}],{logoutGate});
 const launched=x.launch();await settle();
 assert.deepEqual(x.calls.loggedOut,[1]);assert.equal(x.calls.injected,0);
 release();assert.equal((await launched).ok,true);await settle();
 assert.equal(x.calls.injected,1);
 assert.deepEqual(x.calls.events,['logout:1','login']);
 assert.ok(x.calls.updates.some(t=>t.id===2 && t.url==='https://app.fireberry.com/app/partneraccess'));
});
test('logout failure prevents credential submission in every tab',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true}],{logoutOk:false});
 assert.equal((await x.launch()).ok,false);await settle();
 assert.equal(x.calls.injected,0);assert.equal(x.session['pending:1'],undefined);
});

test('waits for other tabs to replace the old document before starting login',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true},{id:2,url:'https://app.fireberry.com/app/views/2',status:'complete'}],{delayedLoad:true});
 const launched=x.launch();await settle();
 assert.equal(x.tabs[1].status,'loading');assert.equal(x.calls.injected,0);
 assert.equal((await x.launch()).ok,false,'overlapping environment switches are blocked');
 x.tabs[1].status='complete';
 assert.equal((await launched).ok,true);await settle();assert.equal(x.calls.injected,1);
});

test('a new tab logs out a lingering cookie session before filling credentials',async()=>{
 const x=setup([]);assert.equal((await x.launch()).ok,true);await settle();
 assert.deepEqual(x.calls.loggedOut,[99]);assert.deepEqual(x.calls.events,['logout:99','login']);
});
test('a new tab never submits credentials when its logout fails',async()=>{
 const x=setup([],{logoutOk:false});await x.launch();await settle();
 assert.equal(x.calls.injected,0);assert.equal(x.session['pending:99'],undefined);
 assert.ok(x.local.lastStatus.includes('התנתקות'));
});
test('every repeated switch performs logout again',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true}]);
 await x.launch();await settle();await x.launch();await settle();
 assert.deepEqual(x.calls.events,['logout:1','login','logout:1','login']);
});

test('falls back to another tab when the selected tab cannot log out',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true},{id:2,url:'https://app.fireberry.com/app/views/2',status:'complete'}],{failedLogoutTab:1});
 assert.equal((await x.launch()).ok,true);await settle();
 assert.deepEqual(x.calls.loggedOut,[1,2]);assert.deepEqual(x.calls.events,['logout:1','logout:2','login']);
});
test('logout failure in every live tab blocks login',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true},{id:2,url:'https://app.fireberry.com/app/views/2',status:'complete'}],{logoutOk:false});
 assert.equal((await x.launch()).ok,false);await settle();
 assert.deepEqual(x.calls.loggedOut,[1,2]);assert.equal(x.calls.injected,0);
 assert.equal(Object.keys(x.session).some(k=>k.startsWith('pending:')),false);
});
test('a sleeping background tab does not block the switch',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true},{id:2,url:'https://app.fireberry.com/app/views/2',status:'unloaded',discarded:true}]);
 assert.equal((await x.launch()).ok,true);await settle();
 assert.deepEqual(x.calls.loggedOut,[1]);assert.equal(x.calls.injected,1);
 assert.ok(x.calls.updates.some(t=>t.id===2 && t.url==='https://app.fireberry.com/app/partneraccess'));
});
test('when every tab is asleep the selected tab logs out after loading, before login',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/views/1',status:'unloaded',discarded:true,active:true}]);
 assert.equal((await x.launch()).ok,true);await settle();
 assert.deepEqual(x.calls.events,['logout:1','login']);
});
test('failure replacing an old CRM page blocks credential submission',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true},{id:2,url:'https://app.fireberry.com/app/views/2',status:'complete'}],{failedNavigationTab:2});
 assert.equal((await x.launch()).ok,false);await settle();assert.equal(x.calls.injected,0);
 assert.equal(x.session['pending:1'],undefined);
});
test('a closed or inaccessible tab fails safely and permits another attempt',async()=>{
 const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true}],{logoutThrows:true});
 assert.equal((await x.launch()).ok,false);assert.equal((await x.launch()).ok,false);
 assert.equal(x.calls.loggedOut.length,2);assert.equal(x.calls.injected,0);
});
