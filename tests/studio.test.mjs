import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleApi} from '../server/api.js';
import {studioAuthorized,studioEnabled} from '../server/studio-access.js';
const env={SESSION_SECRET:'s'.repeat(48),STUDIO_ACCESS_KEY:'a-secure-owner-access-code-with-40-chars'};
const req=(path,{method='GET',cookie='',code,origin='https://test.example'}={})=>new Request('https://test.example'+path,{method,headers:{'oai-authenticated-user-id':'visitor',...(cookie?{cookie}:{}),...(method==='POST'?{'content-type':'application/json',origin}:{})},...(method==='POST'?{body:JSON.stringify(code===undefined?{}:{code})}:{})});
test('public HTML excludes private studio markup and navigation',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.ok(!html.includes('id="data-stats"'));
 assert.ok(!html.includes('id="provider-cards"'));
 assert.ok(!html.includes('data-view="data"'));
 assert.ok(html.includes('id="studio-access"'));
 assert.ok(html.includes('gyuri.webp'));
});
test('private studio and provider metadata need owner cookie',async()=>{
 assert.equal(studioEnabled(env),true);
 assert.equal((await handleApi(req('/api/studio/view'),env)).status,403);
 assert.equal((await handleApi(req('/api/providers'),env)).status,403);
 assert.equal((await handleApi(req('/api/studio/view'),{SESSION_SECRET:env.SESSION_SECRET})).status,403);
 assert.equal((await handleApi(req('/api/studio/view',{cookie:'__Host-jeju-ref-studio=invalid'}),env)).status,403);
});
test('strong code sets secure cookie which unlocks studio',async()=>{
 assert.equal((await handleApi(req('/api/studio/session',{method:'POST',code:'incorrect'}),env)).status,403);
 const success=await handleApi(req('/api/studio/session',{method:'POST',code:env.STUDIO_ACCESS_KEY}),env);
 assert.equal(success.status,200);
 const setCookie=success.headers.get('set-cookie');
 assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);
 const cookie=setCookie.split(';')[0];
 assert.equal(studioAuthorized(req('/api/studio/view',{cookie}),env),true);
 const page=await handleApi(req('/api/studio/view',{cookie}),env);
 assert.equal(page.status,200);assert.match((await page.json()).html,/id="data-stats"/);
 assert.equal((await handleApi(req('/api/studio/view',{cookie}),{...env,STUDIO_ACCESS_KEY:'different-owner-access-code-with-length'})).status,403);
});
test('cross-site logins fail and logout expires cookie',async()=>{
 assert.equal((await handleApi(req('/api/studio/session',{method:'POST',code:env.STUDIO_ACCESS_KEY,origin:'https://evil.example'}),env)).status,403);
 const logout=await handleApi(req('/api/studio/logout',{method:'POST'}),env);
 assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
