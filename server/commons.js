import {searchIntent} from '../public/intent.js';
const COMMONS_API='https://commons.wikimedia.org/w/api.php';
const clean=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|lt|gt);/g,s=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>'}[s])).replace(/\s+/g,' ').trim();
export function trustedHttps(value,hosts){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&hosts.includes(u.hostname)?u.href:null;}catch{return null;}}
export function commonsQuery(query){return searchIntent(query).effectiveQuery;}
export function normalizeCommonsPage(page,query,now=new Date().toISOString()){
 const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
 if(!info||!['image/jpeg','image/png','image/webp'].includes(info.mime)||!Number.isSafeInteger(page.pageid)||page.pageid<=0)return null;
 const url=trustedHttps(info.descriptionurl,['commons.wikimedia.org']);
 if(!url)return null;
 const license=clean(meta.LicenseShortName?.value).slice(0,100)||'이용 조건 미확인';
 const licenseUrl=trustedHttps(meta.LicenseUrl?.value,['creativecommons.org','www.creativecommons.org']);
 const allowed=!!licenseUrl&&/^https:\/\/(?:www\.)?creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/\d\.\d|publicdomain\/(?:zero\/1\.0|mark\/1\.0))(?:\/|$)/.test(licenseUrl)&&/^(CC0|CC BY(?:-SA)? \d\.\d|Public domain)$/i.test(license);
 const image=allowed?trustedHttps(info.thumburl,['upload.wikimedia.org','thumb.wikimedia.org']):null;
 return {id:'commons-'+page.pageid,title:clean(page.title).replace(/^File:/,'').slice(0,200),originalTitle:clean(page.title).slice(0,200),type:'image',source:'Wikimedia Commons · 실시간',creator:clean(meta.Artist?.value).slice(0,250)||'제작자 미확인',url,image,license,licenseUrl,jeju:'unknown',tags:[...new Set(['실시간 검색',...query.split(' ')])],note:'Commons 검색으로 발견한 자료입니다. 목적과의 시각적 적합성·제주 관계는 원본에서 확인해 주세요.',provenance:'API의 제작자·라이선스 메타데이터 자동 확인. 사람의 검수 완료를 의미하지 않습니다.',description:clean(meta.ImageDescription?.value).slice(0,700),checkedAt:now.slice(0,10),fetchedAt:now,status:'published',origin:'commons_live',rights:{link:'allowed',display:image?'allowed':'unknown',training:'unknown'},attributionRequired:clean(meta.AttributionRequired?.value),changes:'원본 변형 저장 없음. 카드에서는 화면 비율에 따라 일부 영역이 잘려 보일 수 있음.'};
}
export async function searchCommons(query,offset=0,fetcher=fetch){
 const effectiveQuery=commonsQuery(query),url=new URL(COMMONS_API);
 url.search=new URLSearchParams({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:effectiveQuery,gsrnamespace:'6',gsrlimit:'12',gsroffset:String(offset),prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'640',maxlag:'5'}).toString();
 const response=await fetcher(url,{headers:{'User-Agent':'JejuRefStudio/0.2 (https://jeju-ref-studio.workspace-642979.chatgpt.site; source-based creative reference search)','Accept':'application/json'},signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok){console.error(JSON.stringify({event:'commons_upstream_error',status:response.status}));throw Error(response.status===429?'Commons 요청이 많습니다. 잠시 후 다시 검색해 주세요.':'Commons 검색 서버가 응답하지 않았습니다.');}
 const data=await response.json();if(data.error)throw Error('Commons 검색을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
 const pages=data.query?.pages||[];
 const results=pages.sort((a,b)=>(a.index||0)-(b.index||0)).map(p=>normalizeCommonsPage(p,effectiveQuery)).filter(Boolean);
 const next=data.continue?.gsroffset;
 return {provider:'Wikimedia Commons',effectiveQuery,results,nextOffset:Number.isSafeInteger(next)&&next<=600?next:null,fetchedAt:new Date().toISOString(),cached:false,scope:'Commons 이미지 검색 · 일반 웹 전체 검색 아님'};
}
