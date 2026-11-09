const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/background/partner.js'),'utf8');
function setup({url='https://app.fireberry.com/app/login',ok=true,reject=false,timeout=false,origin='https://app.fireberry.com'}={}) {
 const calls={requests:[],cleared:0,timerCleared:false};
 const area={setAccessLevel:async()=>{}};
 const context=vm.createContext({URL,AbortController,location:{origin,pathname:'/app/partneraccess'},localStorage:{clear(){calls.cleared++;}},setTimeout(fn){calls.timeout=fn;return 1;},clearTimeout(){calls.timerCleared=true;},fetch:async(path,options)=>{calls.requests.push({path,options});if(timeout){calls.timeout();assert.equal(options.signal.aborted,true);throw Error('aborted');}if(reject)throw Error('network');return {url,ok};},chrome:{storage:{local:area,session:area},tabs:{onUpdated:{addListener(){}},onRemoved:{addListener(){}}},runtime:{onMessage:{addListener(){}}}}});
 vm.runInContext(source,context);return {calls,run:()=>vm.runInContext('logoutCurrentSession()',context)};
}
test('logout uses same-origin session cookies, bypasses cache and clears only site storage',async()=>{
 const x=setup();assert.equal((await x.run()).ok,true);
 const request=x.calls.requests[0];assert.equal(request.path,'/_common/webcontrols/logoff.aspx');
 assert.equal(request.options.credentials,'include');assert.equal(request.options.cache,'no-store');assert.equal(request.options.method,'GET');
 assert.equal(x.calls.cleared,1);assert.equal(x.calls.timerCleared,true);
});
for(const [name,options] of Object.entries({serverError:{ok:false},unexpectedPage:{url:'https://app.fireberry.com/app/views/1'},foreignRedirect:{url:'https://other.example/app/login'},networkError:{reject:true},timeout:{timeout:true}})) {
 test(`logout stops on ${name}`,async()=>{const x=setup(options);assert.equal((await x.run()).ok,false);assert.equal(x.calls.cleared,0);assert.equal(x.calls.timerCleared,true);});
}
test('logout refuses to execute on a foreign origin',async()=>{const x=setup({origin:'https://other.example'});assert.equal((await x.run()).ok,false);assert.equal(x.calls.requests.length,0);});
