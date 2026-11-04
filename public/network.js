export async function apiRequest(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 let body;try{body=await response.json();}catch{throw Error('서버 응답을 읽지 못했습니다.');}
 if(!response.ok){const error=Error(body.error||'서버 요청에 실패했습니다.');error.status=response.status;throw error;}
 return body;
}
export class RemoteStore{
 constructor(onStatus){this.revision=0;this.ready=false;this.blocked=false;this.pending=null;this.running=false;this.onStatus=onStatus;this.timer=null;}
 async initialize(){try{const result=await apiRequest('/api/state');this.revision=result.revision;this.ready=true;this.onStatus('saved','서버 저장 연결됨');return result;}catch(error){this.onStatus('error',error.status===401?'로그인 후 서버 저장 가능':'서버 연결 실패 · 브라우저에만 보관');return null;}}
 schedule(snapshot){this.pending=JSON.parse(JSON.stringify(snapshot));if(!this.ready||this.blocked){this.onStatus('error',this.blocked?'충돌 발생 · 내보내기 후 새로고침 필요':'서버 미연결 · 브라우저에만 보관');return;}this.onStatus('saving','서버 저장 대기');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),600);}
 async flush(){if(this.running||!this.pending||!this.ready||this.blocked)return;this.running=true;let failed=false;const snapshot=this.pending;this.pending=null;this.onStatus('saving','서버에 저장 중');try{const result=await apiRequest('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:this.revision,state:snapshot})});this.revision=result.revision;this.onStatus('saved','서버에 저장됨');}catch(error){failed=true;this.pending=this.pending||snapshot;this.blocked=error.status===409;if(this.blocked)this.onStatus('conflict','다른 탭에서 변경됨 · 내보낸 뒤 새로고침');else this.onStatus('error','서버 저장 실패 · 다시 저장을 눌러 주세요');}finally{this.running=false;if(this.pending&&!this.blocked&&!failed)this.flush();}}
 retry(){if(!this.ready){this.onStatus('error','서버 연결을 위해 페이지를 새로고침해 주세요.');return;}if(!this.blocked)this.flush();}
}
