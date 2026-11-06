import {handleApi} from '../server/api.js';
import {neonStore} from '../server/neon-store.js';
import {visitorSession} from '../server/visitor-session.js';
export default {async fetch(request){let session;try{session=visitorSession(request.headers.get('cookie'),process.env.SESSION_SECRET);}catch{return Response.json({error:'서버 세션 설정이 필요합니다. Vercel의 SESSION_SECRET을 등록해 주세요.'},{status:503});}
 const headers=new Headers(request.headers);for(const key of [...headers.keys()])if(key.startsWith('oai-authenticated-'))headers.delete(key);headers.set('oai-authenticated-user-id',session.id);
 const trustedRequest=new Request(request,{headers});const env={DB:process.env.DATABASE_URL?neonStore(process.env.DATABASE_URL):null,TOURAPI_SERVICE_KEY:process.env.TOURAPI_SERVICE_KEY,INFERENCE_BASE_URL:process.env.INFERENCE_BASE_URL,INFERENCE_MODEL:process.env.INFERENCE_MODEL,INFERENCE_API_KEY:process.env.INFERENCE_API_KEY,SESSION_SECRET:process.env.SESSION_SECRET,STUDIO_ACCESS_KEY:process.env.STUDIO_ACCESS_KEY};
 const result=await handleApi(trustedRequest,env);const response=new Response(result?.body||null,{status:result?.status||404,headers:result?.headers});if(session.cookie)response.headers.append('Set-Cookie',session.cookie);return response;
}};
