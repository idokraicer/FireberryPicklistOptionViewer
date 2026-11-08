const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../src/background/partner.js'),'utf8');
function setup(existing) {
 const local={environments:[{id:'env',email:'customer@example.com'}],partnerEmail:'partner@example.com',remember:false};
 const session={partnerPassword:'fake-password'};
 const area=data=>({setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).filter(k=>k in data).map(k=>[k,data[k]])),set:async values=>Object.assign(data,values),remove:async key=>{delete data[key];}});
 let handler,updated;const calls={created:0,injected:0,updates:[]};
 const tabs=existing.map(t=>({...t}));
 const chrome={storage:{local:area(local),session:area(session)},runtime:{id:'test',onMessage:{addListener(fn){handler=fn;}}},windows:{update:async()=>{}},scripting:{executeScript:async()=>{calls.injected++;return [{result:{ok:true}}];}},tabs:{onUpdated:{addListener(fn){updated=fn;}},onRemoved:{addListener(){}},query:async q=>q.url?tabs:tabs.filter(t=>t.active),create:async()=>{calls.created++;const t={id:99,url:'about:blank',status:'complete'};tabs.push(t);return t;},update:async(id,props)=>{calls.updates.push({id,...props});const t=tabs.find(t=>t.id===id);Object.assign(t,props);if(props.url)t.status='complete';return t;},get:async id=>tabs.find(t=>t.id===id)}};
 const c=vm.createContext({chrome,URL,Date,Promise,Set});vm.runInContext(code,c);
 return {calls,session,local,updated,launch:()=>new Promise(resolve=>handler({type:'launch',id:'env'},{id:'test'},resolve))};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('existing login tab fills immediately without a new load event or new tab',async()=>{const x=setup([{id:1,url:'https://app.fireberry.com/app/partneraccess',status:'complete',active:true}]);assert.equal((await x.launch()).reused,true);await settle();assert.equal(x.calls.created,0);assert.equal(x.calls.injected,1);assert.equal(x.calls.updates.some(t=>t.url),false);});
test('existing CRM tab navigates to partner access instead of creating a tab',async()=>{const x=setup([{id:1,url:'https://app.fireberry.com/app/views/1',status:'complete',active:true}]);assert.equal((await x.launch()).reused,true);await settle();assert.equal(x.calls.created,0);assert.equal(x.calls.updates.find(t=>t.url).url,'https://app.fireberry.com/app/partneraccess');assert.equal(x.calls.injected,1);});
test('no Fireberry tab creates one and consumes request once',async()=>{const x=setup([]);assert.equal((await x.launch()).reused,false);await settle();assert.equal(x.calls.created,1);assert.equal(x.calls.injected,1);x.updated(99,{status:'complete'},{url:'https://app.fireberry.com/app/partneraccess'});await settle();assert.equal(x.calls.injected,1);assert.equal(Object.keys(x.session).some(k=>k.startsWith('pending:')),false);});
