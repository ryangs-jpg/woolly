import test from 'node:test';
import assert from 'node:assert/strict';
import {searchIntent} from '../public/intent.js';
import {search,chatGptPrompt} from '../public/core.js';
import {catalog} from '../public/catalog.js';
import {searchAutomatic} from '../server/auto-search.js';
import {createSearchController} from '../public/search-controller.js';
import {handleApi} from '../server/api.js';

test('짧은 목적을 확장하고 구체적으로 입력한 소재를 우선한다',()=>{
 assert.equal(searchIntent('카페 홍보').effectiveQuery,'Jeju cafe');
 assert.equal(searchIntent('감성 영상').effectiveQuery,'Jeju sea');
 assert.deepEqual(searchIntent('감성 영상').inferred,['바다']);
 assert.equal(searchIntent('차분한 현무암 영상').effectiveQuery,'Jeju basalt');
 assert.deepEqual(searchIntent('차분한 현무암 영상').inferred,[]);
 assert.equal(searchIntent('귤').effectiveQuery,'Jeju tangerine');
 assert.ok(search(catalog,{query:'행사 포스터'}).some(x=>x.type==='font'));
 assert.ok(search(catalog,{query:'감성 영상'}).some(x=>x.type==='image'));
});
const openverse=()=>({id:'photo',title:'Jeju cafe',foreign_landing_url:'https://example.org/jeju-cafe',thumbnail:'https://example.org/photo.jpg',license:'by',license_version:'4.0',license_url:'https://creativecommons.org/licenses/by/4.0/'});
test('한 출처가 실패해도 다른 출처의 실제 결과를 표시한다',async()=>{
 let calls=0;const result=await searchAutomatic('카페 홍보',{},async url=>{calls++;if(url.hostname==='commons.wikimedia.org')throw Error('offline');return Response.json({results:[openverse()]});});
 assert.equal(calls,2);assert.equal(result.results.length,1);assert.equal(result.partial,true);assert.equal(result.broadened,false);assert.equal(result.results[0].rights.training,'unknown');
});
test('검색 결과가 없으면 제주로 범위를 넓히고 이를 결과에 표시한다',async()=>{
 const queries=[];const result=await searchAutomatic('카페 홍보',{},async url=>{
  if(url.hostname==='commons.wikimedia.org')return Response.json({query:{pages:[]}});
  queries.push(url.searchParams.get('q'));return Response.json({results:url.searchParams.get('q')==='Jeju'?[openverse()]:[]});
 });
 assert.deepEqual(queries,['Jeju cafe','Jeju']);assert.equal(result.broadened,true);assert.equal(result.results.length,1);
});
test('전체 출처 실패를 빈 성공 응답으로 숨기지 않는다',async()=>{
 await assert.rejects(searchAutomatic('카페',{},async()=>{throw Error('offline');}),/연결하지 못/);
});
test('자동 검색은 캐시 DB 장애에도 외부 자료를 반환한다',async()=>{
 const request=new Request('https://example.org/api/search?provider=auto&q=cafe',{headers:{'oai-authenticated-user-id':'test'}});
 const response=await handleApi(request,{DB:{prepare(){throw Error('db offline');}},FETCH:async url=>Response.json(url.hostname==='commons.wikimedia.org'?{query:{pages:[]}}:{results:[openverse()]})});
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.results.length,1);assert.equal(data.cached,false);
});
test('입력을 묶고, 다음 입력 순간 이전 응답을 무효화하며 빈 입력에서 취소할 수 있다',async()=>{
 let pending,id=0;const calls=[];
 const controller=createSearchController({setTimer:fn=>{pending=fn;return ++id;},clearTimer:()=>{pending=null;},run:(value,context)=>calls.push({value,...context})});
 controller.schedule('카');controller.schedule('카페');assert.equal(calls.length,0);await pending();assert.equal(calls.length,1);assert.equal(calls[0].value,'카페');assert.equal(calls[0].isCurrent(),true);
 controller.schedule('감성');assert.equal(calls[0].isCurrent(),false);assert.equal(calls[0].signal.aborted,true);
 controller.cancel();assert.equal(pending,null);await controller.now('행사');assert.equal(calls.length,2);assert.equal(calls[1].isCurrent(),true);
});
test('개인 ChatGPT용 프롬프트에 목적·원본·활용 지시를 넣고 첨부·분석을 주장하지 않는다',()=>{
 const prompt=chatGptPrompt([catalog[0]],'카페 홍보');assert.ok(prompt.includes('만들고 싶은 것: 카페 홍보'));assert.ok(prompt.includes(catalog[0].url));assert.ok(prompt.includes('파일을 첨부한 것은 아닙니다'));assert.ok(prompt.includes('최종 프롬프트'));assert.ok(prompt.includes('다음에 할 일 3가지'));assert.equal(chatGptPrompt([],'카페'),'');
});
