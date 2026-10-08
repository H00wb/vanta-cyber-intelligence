import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_COOKIE,hashAdminPassword,verifyAdminCredentials,createAdminSession,verifyAdminSession,sessionCookie} from '../lib/admin-auth.ts';
import {handleAdminLogin,handleAdminRequests,handleAdminLogout} from '../lib/admin-handlers.ts';
const config={username:'admin',passwordHash:await hashAdminPassword('admin123',Buffer.alloc(16,7)),sessionSecret:'a'.repeat(64)};
const now=Date.parse('2026-10-08T00:00:00Z');
const base='https://vanta.example';
const token=createAdminSession(config,now);
const credentials={username:'admin',password:'admin123'};
const post=(data=credentials,headers={})=>new Request(base+'/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:typeof data==='string'?data:JSON.stringify(data)});
const get=(cookie=token,query='')=>new Request(base+'/api/admin/requests'+query,{headers:cookie?{cookie:`${ADMIN_COOKIE}=${cookie}`}:{}});
function store(overrides={}){return {consumeLoginAttempt:async()=>({allowed:true,retryAfter:0}),list:async({page})=>({rows:[],total:0,page,pageSize:50}),...overrides};}
const configProvider=()=>config;

test('scrypt credentials accept the configured pair and reject either wrong field',async()=>{
 assert.equal(await verifyAdminCredentials('admin','admin123',config),true);
 assert.equal(await verifyAdminCredentials('Admin','admin123',config),false);
 assert.equal(await verifyAdminCredentials('admin','wrong',config),false);
});
test('signed session expires after one hour and cannot be used before issuance',()=>{
 assert.deepEqual(verifyAdminSession(token,config,now),{username:'admin'});
 assert.equal(verifyAdminSession(token,config,now+3600000),null);
 assert.equal(verifyAdminSession(token,config,now-1000),null);
});
test('tampered sessions and sessions signed with a different secret are rejected',()=>{
 const [payload,signature]=token.split('.');
 assert.equal(verifyAdminSession(`${payload}.${signature[0]==='A'?'B':'A'}${signature.slice(1)}`,config,now),null);
 assert.equal(verifyAdminSession(token,{...config,sessionSecret:'b'.repeat(64)},now),null);
 assert.equal(verifyAdminSession(token+'.extra',config,now),null);
});
test('session cookie is HttpOnly, Strict, scoped to root and Secure on HTTPS',()=>{
 const cookie=sessionCookie(token,true);
 for(const flag of ['HttpOnly','SameSite=Strict','Path=/','Secure','Max-Age=3600'])assert.ok(cookie.includes(flag));
});
test('cross-origin and missing-origin login attempts are rejected before storage',async()=>{
 let reads=0;const factory=()=>{reads++;return store();};
 const foreign=await handleAdminLogin(post(credentials,{Origin:'https://other.example'}),factory,configProvider,now);
 const missing=post();missing.headers.delete('origin');
 assert.equal(foreign.status,403);
 assert.equal((await handleAdminLogin(missing,factory,configProvider,now)).status,403);
 assert.equal(reads,0);
});
test('wrong credentials consume an attempt and do not create an admin cookie',async()=>{
 let attempts=0;const response=await handleAdminLogin(post({...credentials,password:'wrong'}),()=>store({consumeLoginAttempt:async()=>{attempts++;return {allowed:true,retryAfter:0};}}),configProvider,now);
 assert.equal(response.status,401);assert.equal(attempts,1);assert.equal(response.headers.get('set-cookie'),null);
 assert.deepEqual(await response.json(),{message:'Kullanıcı adı veya şifre yanlış.'});
});
test('successful login returns a verifiable cookie without the password or token in JSON',async()=>{
 const response=await handleAdminLogin(post(),()=>store(),configProvider,now);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
 const cookie=response.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));
 const value=cookie.split(';')[0].slice(ADMIN_COOKIE.length+1);
 assert.deepEqual(verifyAdminSession(value,config,now),{username:'admin'});
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('durable login limit returns 429 with Retry-After and no session',async()=>{
 const response=await handleAdminLogin(post(),()=>store({consumeLoginAttempt:async()=>({allowed:false,retryAfter:73})}),configProvider,now);
 assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'73');assert.equal(response.headers.get('set-cookie'),null);
});
test('failed attempt storage fails closed without disclosing internal errors',async()=>{
 const response=await handleAdminLogin(post(),()=>store({consumeLoginAttempt:async()=>{throw Error('private database token');}}),configProvider,now);
 assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);assert.ok(!(await response.text()).includes('private database token'));
});
test('actual login body size is limited even with a false Content-Length',async()=>{
 const response=await handleAdminLogin(post(' '.repeat(1025),{'Content-Length':'1'}),()=>store(),configProvider,now);
 assert.equal(response.status,413);
});
test('malformed login JSON and non-string fields are rejected before storage',async()=>{
 const unused=()=>{throw Error('must not call storage');};
 assert.equal((await handleAdminLogin(post('{'),unused,configProvider,now)).status,400);
 assert.equal((await handleAdminLogin(post({username:[],password:'x'}),unused,configProvider,now)).status,422);
});
test('anonymous record reads cannot call the database',async()=>{
 let calls=0;const response=await handleAdminRequests(get(''),()=>{calls++;return store();},configProvider,now);
 assert.equal(response.status,401);assert.equal(calls,0);
});
test('a valid session reads the requested page and filter with no-store',async()=>{
 let seen;const response=await handleAdminRequests(get(token,'?page=2&q=deniz'),()=>store({list:async options=>{seen=options;return {rows:[],total:1,page:2,pageSize:50};}}),configProvider,now);
 assert.equal(response.status,200);assert.deepEqual(seen,{page:2,query:'deniz'});
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('a modified admin cookie cannot call record storage',async()=>{
 let calls=0;const response=await handleAdminRequests(get(token+'bad'),()=>{calls++;return store();},configProvider,now);
 assert.equal(response.status,401);assert.equal(calls,0);
});
test('an expired admin cookie cannot call record storage',async()=>{
 let calls=0;const response=await handleAdminRequests(get(),()=>{calls++;return store();},configProvider,now+3600000);
 assert.equal(response.status,401);assert.equal(calls,0);
});
test('invalid pagination and oversized filters are rejected without querying',async()=>{
 let calls=0;const factory=()=>{calls++;return store();};
 for(const query of ['?page=0','?page=-1','?page=10001','?page=1.5','?q='+ 'a'.repeat(101)])assert.equal((await handleAdminRequests(get(token,query),factory,configProvider,now)).status,422);
 assert.equal(calls,0);
});
test('record storage failure is an error and never a successful empty list',async()=>{
 const response=await handleAdminRequests(get(),()=>store({list:async()=>{throw Error('SQL private credentials');}}),configProvider,now);
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('SQL private credentials'));
});
test('logout clears the HttpOnly cookie and refuses cross-origin requests',()=>{
 const request=new Request(base+'/api/admin/logout',{method:'POST',headers:{Origin:base}});
 const response=handleAdminLogout(request);assert.equal(response.status,204);assert.ok(response.headers.get('set-cookie').includes('Max-Age=0'));
 assert.equal(handleAdminLogout(new Request(base+'/api/admin/logout',{method:'POST',headers:{Origin:'https://other.example'}})).status,403);
});