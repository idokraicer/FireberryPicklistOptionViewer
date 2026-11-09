const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../src/background/partner.js'),'utf8');
function setup(existing, { delayedLoad = false, injectionGate = Promise.resolve() } = {}) {
 const local={environments:[{id:'env',email:'customer@example.com'}],partnerEmail:'partner@example.com',remember:false};
 const session={partnerPassword:'fake-password'};
 const area=data=>({setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).filter(k=>k in data).map(k=>[k,data[k]])),set:async values=>Object.assign(data,values),remove:async key=>{delete data[key];}});
 let handler,updated;const calls={created:0,injected:0,updates:[]};
 const tabs=existing.map(t=>({...t}));
 const chrome={storage:{local:area(local),session:area(session)},runtime:{id:'test',onMessage:{addListener(fn){handler=fn;}}},windows:{update:async()=>{}},scripting:{executeScript:async()=>{calls.injected++;await injectionGate;return [{result:{ok:true}}];}},tabs:{onUpdated:{addListener(fn){updated=fn;}},onRemoved:{addListener(){}},query:async q=>q.url?tabs:tabs.filter(t=>t.active),create:async()=>{calls.created++;const t={id:99,url:'about:blank',status:'complete'};tabs.push(t);return t;},update:async(id,props)=>{calls.updates.push({id,...props});const t=tabs.find(t=>t.id===id);Object.assign(t,props);if(props.url)t.status=delayedLoad?'loading':'complete';return {...t};},get:async id=>tabs.find(t=>t.id===id)}};
 const c=vm.createContext({chrome,URL,Date,Promise,Set});vm.runInContext(code,c);
 return {calls,session,local,updated,launch:()=>new Promise(resolve=>handler({type:'launch',id:'env'},{id:'test'},resolve))};
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
