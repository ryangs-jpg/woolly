import {searchCommons} from './commons.js';
import {searchOpenverse,searchTourism} from './public-sources.js';
export async function searchAutomatic(query,env={},fetcher=fetch){
 const calls=[searchCommons(query,0,fetcher),env.TOURAPI_SERVICE_KEY?searchTourism(query,1,env,fetcher):searchOpenverse(query,1,fetcher)];
 const outcomes=await Promise.allSettled(calls);
 const successes=outcomes.filter(x=>x.status==='fulfilled').map(x=>x.value);
 let results=successes.flatMap(x=>x.results),broadened=false;
 if(!results.length){
  try{const fallback=await searchOpenverse('제주',1,fetcher);successes.push(fallback);results=fallback.results;broadened=results.length>0;}catch{}
 }
 if(!successes.length)throw Error('공개 자료 검색에 연결하지 못했습니다.');
 const deduped=new Map();
 for(const item of results){
  const url=new URL(item.url);url.hash='';
  let canonical=url.href;try{canonical=decodeURI(canonical);}catch{}
  const key=item.origin==='tourapi_live'?item.id:canonical.replaceAll('_',' ');
  if(!deduped.has(key)||(!deduped.get(key).image&&item.image))deduped.set(key,item);
 }
 const unique=[...deduped.values()];
 // Prefer usable previews; never fabricate display or training permission.
 unique.sort((a,b)=>Number(!!b.image)-Number(!!a.image));
 return {provider:'자동 검색',results:unique.slice(0,24),effectiveQuery:[...new Set(successes.map(x=>x.effectiveQuery))].join(' / '),nextOffset:null,cached:false,fetchedAt:new Date().toISOString(),broadened,partial:outcomes.some(x=>x.status==='rejected'),scope:'제주 공개 이미지·관광 자료'};
}
