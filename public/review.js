import {safeUrl} from './core.js';
const normalize=s=>String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
const hash=s=>{let n=2166136261;for(const c of s){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(16).padStart(8,'0');};
export function canonicalSource(value){const safe=safeUrl(value);if(!safe)return null;const u=new URL(safe);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_/i.test(k)||['fbclid','gclid'].includes(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}
export function buildReviewBundle(assets,feedback){
 const byId=new Map(assets.map(a=>[a.id,a])),latest=new Map();let ignored=0;
 for(const [index,f] of feedback.entries()){
  if(!f||!['explicit_relevant','explicit_irrelevant'].includes(f.kind)){ignored++;continue;}
  const q=normalize(f.query),dimension=f.dimension||'purpose',key=JSON.stringify([q,f.asset_id,dimension]),previous=latest.get(key);
  if(!previous||String(f.created_at||'')>=String(previous.f.created_at||''))latest.set(key,{f,index,q,dimension});
 }
 const rows=[...latest.values()].map(({f,q,dimension})=>{
  const a=byId.get(f.asset_id),source=canonicalSource(a?.url),blockers=['label_review_pending','learning_consent_missing','training_permission_unverified'];
  if(!q)blockers.push('query_missing');if(!a)blockers.push('asset_missing');if(!source)blockers.push('source_missing');
  return {schema_version:'jeju-review-1',feedback_id:f.id,query:String(f.query||'').trim(),normalized_query:q,dimension,asset_id:f.asset_id,asset_title:a?.title||null,source_url:source,source_name:a?.source||null,license:a?.license||null,license_url:safeUrl(a?.licenseUrl),label:f.kind==='explicit_relevant'?1:0,rank:Number.isSafeInteger(f.rank)?f.rank:null,retrieval_version:f.retrieval_version||null,created_at:f.created_at||null,label_review_status:'pending',training_permission:'unverified',learning_consent:false,training_ready:false,blockers};
 });
 // Shared query or source joins one component, so duplicates cannot cross proposed splits.
 const parents=new Map(),root=x=>{if(!parents.has(x))parents.set(x,x);let r=x;while(parents.get(r)!==r)r=parents.get(r);while(parents.get(x)!==x){const next=parents.get(x);parents.set(x,r);x=next;}return r;},join=(a,b)=>{a=root(a);b=root(b);if(a!==b)parents.set(a<b?b:a,a<b?a:b);};
 const nodes=r=>[r.normalized_query?'q:'+r.normalized_query:'missing-query:'+r.feedback_id,'a:'+r.asset_id,...(r.source_url?['s:'+r.source_url]:[])];
 for(const row of rows){const ns=nodes(row);for(const n of ns)join(ns[0],n);}
 const labels=new Map();for(const row of rows){const key=JSON.stringify([row.normalized_query,row.source_url||row.asset_id,row.dimension]);if(!labels.has(key))labels.set(key,new Set());labels.get(key).add(row.label);}
 const queries=new Map();
 for(const row of rows){const group=hash(root(nodes(row)[0]));row.group_id='g-'+group;row.split_proposal=parseInt(group,16)%5===0?'evaluation_candidate':'training_candidate';
  if(labels.get(JSON.stringify([row.normalized_query,row.source_url||row.asset_id,row.dimension])).size>1)row.blockers.push('conflicting_labels');
  const key=JSON.stringify([row.normalized_query,row.dimension]);if(!queries.has(key))queries.set(key,{query:row.query,dimension:row.dimension,positive:0,negative:0,conflicts:0});const summary=queries.get(key);summary[row.label?'positive':'negative']++;if(row.blockers.includes('conflicting_labels'))summary.conflicts++;
 }
 const coverage=[...queries.values()];
 return {schema_version:'jeju-review-1',training_ready:false,training_executed:false,policy:'검수용 메타데이터. 같은 검색문·자료 ID·정규화 출처는 연결 그룹으로 묶어 분할 후보를 제안합니다. 실제 학습·평가 실행 전 권한·동의·라벨 검수와 분할 재확인이 필요합니다. 쿼리와 URL이 포함되며 그룹 ID는 익명화를 의미하지 않습니다.',summary:{raw_feedback:feedback.length,rows:rows.length,replaced:feedback.length-ignored-rows.length,ignored,positive:rows.filter(r=>r.label===1).length,negative:rows.filter(r=>r.label===0).length,groups:new Set(rows.map(r=>r.group_id)).size,missing_sources:rows.filter(r=>r.blockers.includes('source_missing')||r.blockers.includes('asset_missing')).length,conflicts:rows.filter(r=>r.blockers.includes('conflicting_labels')).length,comparable_queries:coverage.filter(q=>q.query&&q.positive&&q.negative&&!q.conflicts).length,training_ready:0},queries:coverage,rows};
}
