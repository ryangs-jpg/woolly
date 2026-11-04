import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const cookieName='__Host-jeju_visitor';
export function visitorSession(cookieHeader,secret,now=Date.now()){
 if(!secret||secret.length<32)throw Error('SESSION_SECRET is not configured');
 const sign=payload=>createHmac('sha256',secret).update(payload).digest('base64url');
 const value=(cookieHeader||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(value){const [payload,signature]=value.split('.');try{const expected=sign(payload),a=Buffer.from(expected),b=Buffer.from(signature||'');const info=JSON.parse(Buffer.from(payload,'base64url').toString());if(a.length===b.length&&timingSafeEqual(a,b)&&/^[\da-f]{48}$/.test(info.id)&&info.expires>now)return {id:info.id,cookie:null};}catch{}}
 const id=randomBytes(24).toString('hex'),payload=Buffer.from(JSON.stringify({id,expires:now+2592000000})).toString('base64url');return {id,cookie:`${cookieName}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`};
}
