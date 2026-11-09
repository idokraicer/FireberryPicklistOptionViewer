const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../src/background/partner.js'),'utf8');
function context(path='/app/partneraccess') {
 class Input {constructor(placeholder){this.placeholder=placeholder;this.labels=[];this.events=[];}getClientRects(){return [1];}getAttribute(){return null;}focus(){}blur(){this.validated=this.committed||'';}dispatchEvent(e){this.events.push(e.type);if(e.type==='input'){const next=this.value;Promise.resolve().then(()=>{this.committed=next;});}} }
 Object.defineProperty(Input.prototype,'value',{get(){return this.v||'';},set(v){this.v=v;}});
 const inputs=['Partner Email','Partner Password','Customer Username Email'].map(x=>new Input(x));
 const button={textContent:'Access',getClientRects:()=>[1],click(){this.clicks=(this.clicks||0)+1;}};
 const area={setAccessLevel:async()=>{},get:async()=>({}),set:async()=>{},remove:async()=>{}};
 const c=vm.createContext({URL,Date,Promise,setTimeout:r=>r(),Event:class{constructor(type){this.type=type;}},HTMLInputElement:Input,location:{origin:'https://app.fireberry.com',pathname:path},document:{querySelectorAll:s=>s==='input'?inputs:[button]},chrome:{storage:{local:area,session:area},tabs:{onUpdated:{addListener(){}},onRemoved:{addListener(){}}},runtime:{onMessage:{addListener(){}}}}});
 vm.runInContext(code,c);return {c,inputs,button};
}
test('fills exact fields, emits framework events and clicks once',async()=>{const {c,inputs,button}=context();const result=await vm.runInContext("fillAndSubmit('partner@example.com','fake-password','customer@example.com')",c);assert.equal(result.ok,true);assert.deepEqual(inputs.map(i=>i.value),['partner@example.com','fake-password','customer@example.com']);assert.deepEqual(inputs[0].events,['input','change']);assert.equal(button.clicks,1);});
test('refuses a different route without filling or clicking',async()=>{const {c,inputs,button}=context('/app/login');const result=await vm.runInContext("fillAndSubmit('p','s','c')",c);assert.equal(result.ok,false);assert.equal(inputs[0].value,'');assert.equal(button.clicks,undefined);});
test('URL guard rejects foreign origins and similar routes',()=>{const {c}=context();for(const url of ['https://evil.test/app/partneraccess','https://app.fireberry.com/app/partneraccess-other','http://app.fireberry.com/app/partneraccess'])assert.equal(vm.runInContext(`isLogin(${JSON.stringify(url)})`,c),false);assert.equal(vm.runInContext("isLogin('https://app.fireberry.com/app/partneraccess')",c),true);});
test('manifest limits host permissions and avoids sync',()=>{const manifest=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../manifest.json')));assert.deepEqual(manifest.host_permissions,['https://app.fireberry.com/*']);assert.deepEqual(manifest.permissions,['activeTab','storage','scripting']);assert.equal(code.includes('storage.sync'),false);});

test('lets React input state commit before blur validation',async()=>{const {c,inputs}=context();await vm.runInContext("fillAndSubmit('partner@example.com','fake-password','customer@example.com')",c);assert.deepEqual(inputs.map(i=>i.validated),['partner@example.com','fake-password','customer@example.com']);});
test('prefers active Fireberry tab, then login tab, then most recently used',()=>{const {c}=context();c.tabs=[{id:1,url:'https://app.fireberry.com/app/views/1',lastAccessed:4},{id:2,url:'https://app.fireberry.com/app/partneraccess',lastAccessed:2},{id:3,url:'https://app.fireberry.com/app/views/2',lastAccessed:7}];assert.equal(vm.runInContext('selectExistingTab(tabs,1).id',c),1);assert.equal(vm.runInContext('selectExistingTab(tabs,9).id',c),2);c.tabs.splice(1,1);assert.equal(vm.runInContext('selectExistingTab(tabs,9).id',c),3);});
test('does not reuse foreign or similarly named websites',()=>{const {c}=context();c.tabs=[{id:1,url:'https://app.fireberry.com.evil.test/app/partneraccess'}];assert.equal(vm.runInContext('selectExistingTab(tabs,1)',c),undefined);});
