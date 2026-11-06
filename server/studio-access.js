import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const COOKIE='__Host-jeju-ref-studio',LIFE=2*60*60*1000;
export const studioEnabled=env=>typeof env?.STUDIO_ACCESS_KEY==='string'&&env.STUDIO_ACCESS_KEY.length>=32&&typeof env?.SESSION_SECRET==='string'&&env.SESSION_SECRET.length>=32;
const sign=(expires,env)=>createHmac('sha256',env.SESSION_SECRET).update('jeju-studio-v1|'+expires+'|'+env.STUDIO_ACCESS_KEY).digest('hex');
const secureEqual=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export function verifyStudioCode(code,env){return studioEnabled(env)&&typeof code==='string'&&code.length<=256&&secureEqual(code,env.STUDIO_ACCESS_KEY);}
export function studioAuthorized(request,env,now=Date.now()){
 if(!studioEnabled(env))return false;
 const item=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
 if(!item)return false;
 const parts=item.slice(COOKIE.length+1).split('.');
 if(parts.length!==2||!/^[0-9]{13}$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]))return false;
 const expires=Number(parts[0]);if(expires<=now||expires>now+LIFE+60000)return false;
 return secureEqual(parts[1],sign(parts[0],env));
}
export function issueStudioCookie(env,now=Date.now()){const expires=String(now+LIFE);return COOKIE+'='+expires+'.'+sign(expires,env)+'; Path=/; Max-Age=7200; HttpOnly; Secure; SameSite=Strict';}
export const clearStudioCookie=()=>COOKIE+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
