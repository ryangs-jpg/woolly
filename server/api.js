import {searchCommons,commonsQuery} from './commons.js';
import {publicProviders,searchOpenverse,searchTourism} from './public-sources.js';
import {safeUrl,labels} from '../public/core.js';
import {inferenceStatus,generatePlan} from './inference.js';
export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const sendJson=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const text=(v,n=300)=>typeof v==='string'?v.slice(0,n):'';
function sanitizedAsset(a){
 if(!a||typeof a!=='object'||!text(a.id,120)||!text(a.title,200)||!Object.hasOwn(labels,a.type)||a.type==='all')throw new ApiError(400,'저장 자료의 형식이 올바르지 않습니다.');
 const origin=['commons_live','openverse_live','tourapi_live','user_import'].includes(a.origin)?a.origin:'user_import';
 const url=safeUrl(a.url);if(!url)throw new ApiError(400,'원본 출처 주소가 필요합니다.');
 const image=safeUrl(a.image),licenseUrl=safeUrl(a.licenseUrl),display=a.rights?.display==='allowed'&&!!licenseUrl;
 const result={id:text(a.id,120),title:text(a.title,200),originalTitle:text(a.originalTitle,200),type:a.type,source:origin==='user_import'?'사용자 등록':text(a.source,100),creator:text(a.creator,500)||'미확인',url,image:display?image:null,license:text(a.license,100)||'이용 조건 미확인',licenseUrl,jeju:'unknown',tags:Array.isArray(a.tags)?a.tags.slice(0,30).map(t=>text(t,60)).filter(Boolean):[],note:text(a.note,800),description:text(a.description,700),provenance:text(a.provenance,800),checkedAt:text(a.checkedAt,30),fetchedAt:text(a.fetchedAt,40),status:origin!=='user_import'||display?'published':'review',origin,rights:{link:'allowed',display:display?'allowed':'unknown',training:'unknown'},changes:text(a.changes,300)};
 return result;
}
export function sanitizeSnapshot(value){
 if(!value||typeof value!=='object')throw new ApiError(400,'저장 데이터가 올바르지 않습니다.');
 if(!Array.isArray(value.saved)||value.saved.length>300||!Array.isArray(value.imports)||value.imports.length>300||!Array.isArray(value.assets)||value.assets.length>300||!Array.isArray(value.feedback)||value.feedback.length>2000||value.feedback.some(f=>!f||typeof f!=='object'))throw new ApiError(400,'보드는 자료 300개, 피드백 2,000개까지 저장할 수 있습니다.');
 return {title:text(value.title,100)||'첫 번째 제주 프로젝트',saved:[...new Set(value.saved.map(v=>text(v,120)).filter(Boolean))],imports:value.imports.map(sanitizedAsset),assets:value.assets.map(sanitizedAsset),feedback:value.feedback.map(f=>({id:text(f.id,120),search_id:text(f.search_id,120),asset_id:text(f.asset_id,120),query:text(f.query,500),rank:Number.isSafeInteger(f.rank)&&f.rank>0?f.rank:null,retrieval_version:text(f.retrieval_version,60),effective_query:text(f.effective_query,200),kind:['explicit_relevant','explicit_irrelevant'].includes(f.kind)?f.kind:'unverified',dimension:['purpose','jeju','color','motion','typography'].includes(f.dimension)?f.dimension:'purpose',created_at:text(f.created_at,40),label_review_status:'pending',global_learning_consent:false})),schema_version:2};
}
async function readBody(request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError(415,'JSON 형식의 요청이 필요합니다.');
 if(Number(request.headers.get('content-length'))>600000)throw new ApiError(413,'저장할 데이터가 너무 큽니다.');
 const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'요청 본문이 필요합니다.');
 const chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>600000){await reader.cancel();throw new ApiError(413,'저장할 데이터가 너무 큽니다.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,'JSON 데이터를 읽을 수 없습니다.');}
}
export async function handleApi(request,env){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return null;
 try{
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)throw new ApiError(401,'ChatGPT로 로그인한 뒤 이용해 주세요.');
  if(!['GET','POST'].includes(request.method))throw new ApiError(405,'지원하지 않는 요청입니다.');
  if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))throw new ApiError(403,'같은 사이트에서만 저장할 수 있습니다.');
  if(url.pathname==='/api/status')return sendJson({version:'0.2.0',authenticated:true,storage:env.DB?'server_database':'unavailable',search:'commons_live',video_analysis:'not_connected',model_training:'not_executed'});
  if(url.pathname==='/api/providers'&&request.method==='GET')return sendJson({providers:publicProviders(env)});
  if(url.pathname==='/api/inference'&&request.method==='GET')return sendJson(inferenceStatus(env));
  if(url.pathname==='/api/plan'&&request.method==='POST'){
   try{return sendJson(await generatePlan(await readBody(request),env));}
   catch(error){if(error.status)throw new ApiError(error.status,error.message);throw error;}
  }
  if(url.pathname==='/api/search'&&request.method==='GET'){
   const query=(url.searchParams.get('q')||'').trim();if(!query||query.length>500)throw new ApiError(400,'검색 목적을 1~500자로 입력해 주세요.');
   const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>600)throw new ApiError(400,'검색 페이지가 올바르지 않습니다.');
   const provider=url.searchParams.get('provider')||'commons';if(!['commons','openverse','tourapi'].includes(provider))throw new ApiError(400,'지원하지 않는 공개 API입니다.');
   if(provider==='tourapi'&&!env.TOURAPI_SERVICE_KEY)throw new ApiError(424,'TourAPI 활용 신청 후 TOURAPI_SERVICE_KEY를 Vercel 서버 환경변수에 등록해 주세요.');
   const cacheKey=provider+':'+(provider==='tourapi'?query:commonsQuery(query))+':'+offset;
   if(env.DB){const row=await env.DB.prepare('SELECT payload_json FROM search_cache WHERE query_key = ? AND expires_at > ?').bind(cacheKey,Date.now()).first();if(row)return sendJson({...JSON.parse(row.payload_json),cached:true});}
   const result=provider==='openverse'?await searchOpenverse(query,Math.max(1,offset),env.FETCH||fetch):provider==='tourapi'?await searchTourism(query,Math.max(1,offset),env,env.FETCH||fetch):await searchCommons(query,offset,env.FETCH||fetch);
   if(env.DB)await env.DB.batch([env.DB.prepare('DELETE FROM search_cache WHERE expires_at < ?').bind(Date.now()),env.DB.prepare('INSERT INTO search_cache(query_key,payload_json,expires_at) VALUES(?,?,?) ON CONFLICT(query_key) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at').bind(cacheKey,JSON.stringify(result),Date.now()+300000)]);
   return sendJson(result);
  }
  if(url.pathname==='/api/state'){
   if(!env.DB)throw new ApiError(503,'서버 저장소가 아직 준비되지 않았습니다.');
   if(request.method==='GET'){
    const row=await env.DB.prepare('SELECT payload_json,revision,updated_at FROM user_state WHERE user_id = ?').bind(user).first();
    return sendJson(row?{state:JSON.parse(row.payload_json),revision:row.revision,updatedAt:row.updated_at}:{state:null,revision:0});
   }
   const body=await readBody(request),snapshot=sanitizeSnapshot(body.state),revision=body.expectedRevision;
   if(!Number.isSafeInteger(revision)||revision<0)throw new ApiError(400,'저장 버전이 필요합니다.');
   const updatedAt=new Date().toISOString();
   const result=await env.DB.prepare('INSERT INTO user_state(user_id,payload_json,revision,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload_json=excluded.payload_json,revision=excluded.revision,updated_at=excluded.updated_at WHERE user_state.revision = excluded.revision - 1').bind(user,JSON.stringify(snapshot),revision+1,updatedAt).run();
   if(result.meta?.changes!==1)throw new ApiError(409,'다른 탭에서 보드가 변경되었습니다. 현재 보드를 내보낸 뒤 새로고침해 주세요.');
   return sendJson({revision:revision+1,updatedAt});
  }
  throw new ApiError(404,'API를 찾을 수 없습니다.');
 }catch(error){if(error instanceof ApiError)return sendJson({error:error.message},error.status);console.error(JSON.stringify({event:'jeju_api_error',path:url.pathname,name:error.name,message:String(error.message).slice(0,180)}));if(error.name==='TimeoutError'||error.name==='AbortError')return sendJson({error:'검색 응답이 늦습니다. 다시 시도해 주세요.'},504);return sendJson({error:url.pathname==='/api/search'?'외부 검색 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.':'서버 처리에 실패했습니다. 저장 상태를 확인한 뒤 다시 시도해 주세요.'},502);}
}
