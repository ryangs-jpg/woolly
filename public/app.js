import {searchIntent} from './intent.js';
import {createSearchController} from './search-controller.js';
import {buildReviewBundle} from './review.js';
import {catalog} from './catalog.js';
import {apiRequest,RemoteStore} from './network.js';
import {labels,escapeHtml as e,safeUrl,canDisplay,search,parseIntent,validateImport,draftPrompt,chatGptPrompt} from './core.js';
const $=id=>document.getElementById(id);
const uid=()=>globalThis.crypto?.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const key='jeju-ref-v2';
let storageAvailable=true,loaded={};
try{loaded=JSON.parse(localStorage.getItem(key)||localStorage.getItem('jeju-ref-v1')||'{}')||{};}catch{storageAvailable=false;}
const state={saved:Array.isArray(loaded.saved)?loaded.saved:[],feedback:Array.isArray(loaded.feedback)?loaded.feedback:[],imports:Array.isArray(loaded.imports)?loaded.imports:[],title:typeof loaded.title==='string'?loaded.title:'첫 번째 제주 프로젝트',query:'',type:'all',relation:'all',includeDemos:true,view:'explore',draft:'',searchId:uid(),impressions:[],detailId:null};
Object.assign(state,{assets:Array.isArray(loaded.assets)?loaded.assets:[],live:[],mode:'live',hasSearched:false,loading:false,searchError:'',effectiveQuery:'',nextOffset:null});
const legacy=JSON.parse(JSON.stringify(loaded));
const relationLabel={verified:'제주 확인',reference:'연출 참고',proposal:'자체 제작 예제',unknown:'제주 관계 미검수'};
const all=()=>[...new Map([...catalog,...state.imports,...state.assets,...state.live].map(a=>[a.id,a])).values()];
const isLive=a=>['commons_live','openverse_live','tourapi_live'].includes(a.origin);
state.provider='auto';
let cloudReady=false,searchSequence=0,composing=false,studioReady=false,studioLoading=false;
const searchControl=createSearchController({run:(append,context)=>runSearch(append,context)});
const remote=new RemoteStore((kind,message)=>{const node=$('cloud-status');if(node){node.textContent=message;node.dataset.status=kind;}document.querySelector('.local-status').textContent='● '+message;});
function snapshot(){return {title:state.title,saved:state.saved,imports:state.imports,assets:all().filter(a=>isLive(a)&&(state.saved.includes(a.id)||state.feedback.some(f=>f.asset_id===a.id))).sort((a,b)=>Number(state.saved.includes(b.id))-Number(state.saved.includes(a.id))).slice(0,300),feedback:state.feedback};}
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3300);}
function persist(){const data=snapshot();state.assets=data.assets;try{localStorage.setItem(key,JSON.stringify(data));storageAvailable=true;}catch{storageAvailable=false;toast('브라우저 백업을 저장하지 못했습니다.');}if(cloudReady)remote.schedule(data);}
function visual(a){
 if(!canDisplay(a))return '<div class="visual fallback-visual">표시 권한 미확인<span>원본 링크로 확인하세요</span></div>';
 if(a.image&&safeUrl(a.image))return `<img src="${e(a.image)}" alt="${e(a.title)}" loading="lazy" referrerpolicy="no-referrer"><div class="visual fallback-visual image-fallback" hidden>이미지를 불러오지 못했습니다<span>출처에서 원본을 확인해 주세요</span></div>`;
 if(a.visual==='sans'||a.visual==='serif')return `<div class="visual font-visual ${a.visual}"><div><small>TYPE SPECIMEN / KR</small><strong>제주에서<br>시작된 문장.</strong><span>${e(a.title.toUpperCase())}</span></div></div>`;
 if(a.visual==='wave')return '<div class="visual wave-visual"><i class="wave-ring"></i><i class="wave-ring"></i><i class="wave-ring"></i><strong>잔물결</strong><span class="motion-label">ORIGINAL DEMO / 5.0s LOOP</span></div>';
 if(a.visual==='type')return '<div class="visual type-visual"><div class="kinetic"><span>제</span><span>주</span><span>바</span><span>람</span></div><span class="motion-label">ORIGINAL DEMO / STAGGER 160ms</span></div>';
 if(a.visual==='wipe')return '<div class="visual wipe-visual"><strong>LAND / FORM</strong><span class="motion-label">ORIGINAL DEMO / CIRCULAR WIPE</span></div>';
 return '<div class="visual fallback-visual">출처 링크 레퍼런스<span>미리보기 미등록</span></div>';
}
function card(a){const saved=state.saved.includes(a.id);return `<article class="card"><div class="card-visual"><button class="open-card" data-detail="${e(a.id)}" aria-label="${e(a.title)} 상세 보기">${visual(a)}</button><span class="media-badge">${e(labels[a.type])}</span><button class="save-button ${saved?'saved':''}" data-save="${e(a.id)}" aria-label="${e(a.title)} ${saved?'저장 해제':'저장'}" aria-pressed="${saved}">${saved?'✓ 담았어요':'담기'}</button></div><div class="card-info"><div class="card-topline"><span>${e(a.source)}</span><span class="relation ${e(a.jeju)}">${e(relationLabel[a.jeju])}</span></div><button class="card-title" data-detail="${e(a.id)}"><h3>${e(a.title)}</h3></button><div class="tag-row">${a.tags.slice(0,3).map(t=>`<span class="tag">${e(t)}</span>`).join('')}</div>${a.matches?.length?`<p class="match-reason">연결된 키워드 · ${e(a.matches.join(', '))}</p>`:''}<div class="credit-line">${e(a.origin==='original_demo'?'직접 만든 모션 예제':a.creator+' · '+a.license)}</div></div></article>`;}
function imageErrors(){document.querySelectorAll('img').forEach(img=>{img.onerror=()=>{img.hidden=true;const fallback=img.nextElementSibling;if(fallback?.classList.contains('image-fallback'))fallback.hidden=false;};if(img.complete&&img.naturalWidth===0)img.onerror();});}
function empty(title,body){return `<div class="empty"><h3>${e(title)}</h3><p>${e(body)}</p><button class="button" data-reset>전체 레퍼런스 보기 ↗</button></div>`;}
function basicResults(filters=state){
 const library=all().filter(a=>!isLive(a)||state.saved.includes(a.id));
 const matched=search(library,filters);
 return matched.length||state.mode==='library'?matched:search(library,{...filters,query:''});
}
function results(filters=state){
 if(state.mode!=='live'||!state.hasSearched||!state.live.length)return basicResults(filters);
 const extras=search(all().filter(a=>!isLive(a)&&a.type!=='image'),filters);
 return [...search(state.live,{...filters,query:''}),...extras];
}
function renderTabs(){const items=results({...state,type:'all'});$('type-tabs').innerHTML=Object.entries(labels).filter(([type])=>type==='all'||type===state.type||items.some(a=>a.type===type)).map(([type,label])=>`<button data-type="${type}" class="${type===state.type?'active':''}" aria-pressed="${type===state.type}">${label}</button>`).join('');}
function renderResults(){
 const items=results(),live=state.mode==='live'&&state.hasSearched&&state.live.length>0;
 $('result-count').textContent=String(items.length);
 $('results-title').firstChild.textContent=live?(state.broadened?'함께 살펴볼 제주 자료 ':'찾은 참고자료 '):state.query?'먼저 살펴볼 참고자료 ':'이런 제주 자료가 있어요 ';
 $('results').innerHTML=items.length?items.map(card).join(''):empty('이 조건의 자료는 아직 없어요','다른 종류를 선택하거나 아래 버튼으로 전체 자료를 볼 수 있어요.');
 $('more-results').hidden=state.mode!=='live'||state.nextOffset===null||state.loading||!!state.searchError;
 $('search-status').textContent=state.loading?'새 자료를 찾고 있어요. 아래 자료부터 살펴보세요.':state.searchError?'새 자료를 가져오지 못했어요. 기본 자료는 계속 볼 수 있어요.':live?(state.broadened?'정확히 맞는 자료가 적어 제주 자료로 범위를 넓혔어요.':state.searchCached?'최근 5분 안에 찾은 자료예요. 사진을 누르면 자세히 볼 수 있어요.':'새 자료를 찾았어요. 마음에 드는 자료를 담아보세요.')+(state.partial?' 일부 출처는 응답하지 않았어요.':''):state.query?'기본 참고자료예요. 원하는 사진을 눌러 살펴보세요.':'짧게 적어도 괜찮아요. 입력하면 자동으로 찾아드려요.';
 $('retry-search').hidden=!state.searchError;
 $('search-technical').textContent=state.effectiveQuery?'실제 검색어: '+state.effectiveQuery+' · 제주 관련성은 원본에서 확인해 주세요.':'공개 이미지·관광 자료를 검색합니다. 영상 분석은 아직 지원하지 않습니다.';
 renderTabs();renderIntent();imageErrors();
}
function renderIntent(){const intent=searchIntent(state.query);$('intent').hidden=!state.query||!intent.recognized;$('intent').textContent=intent.inferred.length?'이런 방향으로 찾아볼게요: 제주 '+intent.inferred.join(' · ')+(intent.media.length?' · '+intent.media.join(' · '):''):'찾는 내용: '+[...intent.subjects,...intent.media,...intent.styles].join(' · ');}
function recordImpressions(){state.searchId=uid();state.impressions=results().map((a,i)=>({search_id:state.searchId,asset_id:a.id,query:state.query,filters:{type:state.type,relation:state.relation,include_demos:state.includeDemos},rank:i+1,retrieval_version:isLive(a)&&state.mode==='live'&&state.hasSearched?state.provider+'-simple-v1':'purpose-tags-v2',effective_query:state.effectiveQuery,shown_at:new Date().toISOString()}));}
function renderBoard(){const items=all().filter(a=>state.saved.includes(a.id)&&a.status==='published');$('board-results').innerHTML=items.length?items.map(card).join(''):empty('첫 번째 레퍼런스를 담아보세요','마음에 드는 카드의 + 버튼을 누르면 이 보드에 저장됩니다.');$('saved-summary').textContent=`${items.length}개의 자료를 담았어요 · ${remote.ready?'이 브라우저에서 다시 볼 수 있어요':'이 브라우저에 임시로 보관 중'}`;$('chatgpt-copy').disabled=!items.length;$('chatgpt-copy').textContent=items.length?'ChatGPT용 내용 복사':'자료를 먼저 담아주세요';$('board-title').value=state.title;$('board-count').textContent=items.length;imageErrors();}
function renderData(){if(!studioReady)return;renderReview();const items=all();const stats=[['등록 자료',items.length],['검수 대기',items.filter(a=>a.status==='review').length],['명시적 피드백',state.feedback.length],['모델 학습 실행',0]];$('data-stats').innerHTML=stats.map(([label,value])=>`<div class="stat"><small>${label}</small><strong>${value}</strong></div>`).join('');$('source-rows').innerHTML=items.map(a=>`<tr><td>${a.url&&safeUrl(a.url)?`<a href="${e(a.url)}" target="_blank" rel="noopener noreferrer">${e(a.title)} ↗</a>`:e(a.title)}</td><td>${e(labels[a.type])}</td><td>${a.rights.display==='allowed'?'확인':'미확인'}</td><td>미확인</td><td>${a.status==='published'?'탐색 가능':'검수 대기'}</td><td>${a.origin==='user_import'?`<button class="button small" data-delete="${e(a.id)}">삭제</button>`:'기본 자료'}</td></tr>`).join('');}
function render(){renderResults();renderBoard();renderData();}
function view(name){if(name==='data'&&!studioReady)return;state.view=name;if(name==='board'&&!$('plan-query').value.trim()&&state.query)$('plan-query').value=state.query;for(const v of ['explore','board','data'])$(v+'-view').hidden=v!==name;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('breadcrumb').textContent={explore:'자료 찾기',board:'담은 자료',data:'데이터 스튜디오'}[name];window.scrollTo({top:0});}
function toggleSave(id){$('chatgpt-transfer').hidden=true;if(!all().some(a=>a.id===id&&a.status==='published'))return;const present=state.saved.includes(id);state.saved=present?state.saved.filter(x=>x!==id):[...state.saved,id];persist();render();if(state.detailId===id&&$('detail-dialog').open)detail(id);toast(present?'보드에서 제거했습니다.':'나의 보드에 저장했습니다.');}
function detail(id){const a=all().find(x=>x.id===id);if(!a)return;state.detailId=id;const previous=state.feedback.findLast(x=>x.asset_id===id&&x.query===(state.query||$('plan-query').value.trim()));$('detail-content').innerHTML=`<div class="detail-body"><div class="detail-preview">${visual(a)}</div><div class="palette">${(a.colors||[]).map(c=>`<i style="background:${/^#[\da-f]{6}$/i.test(c)?c:'#ddd'}" title="${e(c)}"></i>`).join('')}</div><span class="tag">${e(labels[a.type])} · ${e(relationLabel[a.jeju])}</span><h2>${e(a.title)}</h2><p class="detail-note">${e(a.note)}</p>${a.description?`<p><strong>원본 메타데이터 설명</strong><br>${e(a.description)}</p>`:''}<dl class="detail-meta"><dt>원본 제목</dt><dd>${e(a.originalTitle||a.title)}</dd><dt>제작자·출처</dt><dd>${e(a.creator)} / ${e(a.source)}</dd><dt>이용 조건</dt><dd>${a.licenseUrl&&safeUrl(a.licenseUrl)?`<a href="${e(a.licenseUrl)}" target="_blank" rel="noopener noreferrer">${e(a.license)} ↗</a>`:e(a.license)}</dd><dt>확인 기록</dt><dd>${e(a.checkedAt)} · ${e(a.provenance)}</dd><dt>학습 권한</dt><dd>미확인 · 모델 학습에 사용하지 않음</dd><dt>분석 상태</dt><dd>${isLive(a)?'메타데이터 자동 수집 / 시각 분석·사람 검수 미실행':'검수 태그·기획 제안 / AI 자동 분석 미연결'}</dd></dl>${a.type==='font'?'<p class="font-status" id="font-status">서체 로드 상태 확인 중…</p>':''}<div class="detail-action">${a.url&&safeUrl(a.url)?`<a class="button dark" href="${e(a.url)}" target="_blank" rel="noopener noreferrer">원본 출처 보기 ↗</a>`:''}<button class="button" data-save="${e(a.id)}">${state.saved.includes(a.id)?'보드에서 제거':'나의 보드에 저장'}</button></div><div class="feedback"><span>이 자료가 목적에 맞나요?</span><p>평가 목적: ${e(state.query||$('plan-query').value.trim()||'제작 목적을 먼저 입력해 주세요')}</p><button class="button small ${previous?.kind==='explicit_relevant'?'selected':''}" data-feedback="explicit_relevant" data-id="${e(id)}">관련 있음</button><button class="button small ${previous?.kind==='explicit_irrelevant'?'selected':''}" data-feedback="explicit_irrelevant" data-id="${e(id)}">관련 없음</button><label class="sr-only" for="feedback-dimension">평가 기준</label><select id="feedback-dimension" class="button small"><option value="purpose">목적 전체</option><option value="jeju">제주 소재</option><option value="color">색감</option><option value="motion">움직임</option><option value="typography">글자</option></select></div></div>`;if(!$('detail-dialog').open)$('detail-dialog').showModal();imageErrors();if(a.type==='font'){const family=a.visual==='serif'?'Noto Serif KR':'Noto Sans KR';document.fonts.load(`16px "${family}"`,'제주').then(faces=>{if(state.detailId===id&&$('font-status'))$('font-status').textContent=faces.length?'미리보기 서체 로드됨 · 전체 한글 글리프 검증은 별도 필요':'서체 미로드 · 시스템 대체 서체로 표시 중';}).catch(()=>{if($('font-status'))$('font-status').textContent='외부 서체 미로드 · 시스템 대체 서체로 표시 중';});}}
function download(name,data,mime='application/json;charset=utf-8'){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function submitSearch(append=false){return searchControl.now(append);}
async function runSearch(append=false,{signal,isCurrent}){
 const query=$('query').value.trim();state.query=query;state.searchError='';
 if(state.mode==='library'||!query){state.hasSearched=false;state.loading=false;state.live=[];state.nextOffset=null;state.effectiveQuery='';recordImpressions();renderResults();return;}
 state.loading=true;state.hasSearched=true;const offset=append?state.nextOffset:0;
 if(!append){state.live=[];state.nextOffset=null;state.effectiveQuery='';state.broadened=false;state.partial=false;}
 renderResults();
 try{const result=await apiRequest('/api/search?q='+encodeURIComponent(query)+'&offset='+(offset||0)+'&provider='+state.provider,{signal});
  if(!isCurrent())return;
  state.live=[...new Map([...(append?state.live:[]),...result.results].map(a=>[a.id,a])).values()];state.effectiveQuery=result.effectiveQuery;state.nextOffset=result.nextOffset;state.searchCached=result.cached;state.broadened=result.broadened;state.partial=result.partial;
 }catch(error){if(!isCurrent())return;state.searchError=error.message;}
 finally{if(isCurrent()){state.loading=false;recordImpressions();renderResults();}}
}
function onQueryInput(){
 searchControl.cancel();state.query=$('query').value.trim();state.live=[];state.hasSearched=false;state.loading=false;state.searchError='';state.nextOffset=null;state.effectiveQuery='';state.type='all';
 recordImpressions();renderResults();
 if(!composing&&state.query)searchControl.schedule(false);
}
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
 if(b.dataset.view)view(b.dataset.view);
 if(b.dataset.preset){view('explore');$('query').value=b.dataset.preset;state.type='all';state.relation='all';$('relation').value='all';submitSearch();}
 if(b.dataset.type){state.type=b.dataset.type;recordImpressions();renderResults();}
 if(b.dataset.detail)detail(b.dataset.detail);
 if(b.dataset.save){state.draft='';$('draft-text').value='';$('draft-section').hidden=true;toggleSave(b.dataset.save);}
 if(b.dataset.close)$(b.dataset.close).close();
 if(b.hasAttribute('data-reset')){searchControl.cancel();searchSequence++;state.loading=false;state.searchError='';state.hasSearched=false;state.nextOffset=null;state.query='';state.type='all';state.relation='all';state.includeDemos=true;$('query').value='';$('relation').value='all';$('include-demos').checked=true;recordImpressions();renderResults();view('explore');}
 if(b.dataset.feedback){const feedbackQuery=state.query||$('plan-query').value.trim();if(!feedbackQuery){toast('검색 목적 또는 보드의 제작 목적을 먼저 입력해 주세요.');return;}const id=b.dataset.id,impression=state.impressions.find(x=>x.asset_id===id&&x.query===feedbackQuery)||{search_id:state.searchId,asset_id:id,query:feedbackQuery,rank:null,retrieval_version:'tags-v1',context:state.view};state.feedback=state.feedback.filter(x=>!(x.search_id===impression.search_id&&x.asset_id===id));state.feedback.push({...impression,id:uid(),kind:b.dataset.feedback,dimension:$('feedback-dimension').value,created_at:new Date().toISOString(),label_review_status:'pending',global_learning_consent:false});persist();renderData();detail(id);toast('평가를 저장했습니다. 학습에는 자동 사용하지 않습니다.');}
 if(b.dataset.delete){const id=b.dataset.delete;state.imports=state.imports.filter(x=>x.id!==id);state.saved=state.saved.filter(x=>x!==id);state.feedback=state.feedback.filter(x=>x.asset_id!==id);state.draft='';$('draft-text').value='';$('draft-section').hidden=true;persist();render();toast('등록 자료와 연결된 로컬 기록을 삭제했습니다.');}
});
$('search-form').addEventListener('submit',ev=>{ev.preventDefault();if(!composing)submitSearch();});
$('query').addEventListener('input',onQueryInput);
$('query').addEventListener('compositionstart',()=>{composing=true;searchControl.cancel();});
$('query').addEventListener('compositionend',()=>{composing=false;onQueryInput();});
$('retry-search').onclick=()=>submitSearch();
$('relation').addEventListener('change',ev=>{state.relation=ev.target.value;recordImpressions();renderResults();});$('include-demos').addEventListener('change',ev=>{state.includeDemos=ev.target.checked;recordImpressions();renderResults();});$('layout').onclick=()=>{$('results').classList.toggle('large');};
$('board-title').addEventListener('input',ev=>{state.title=ev.target.value;persist();});
$('export-board').onclick=()=>download('jeju-reference-board.json',{schema_version:'1.0',title:state.title,exported_at:new Date().toISOString(),assets:all().filter(a=>state.saved.includes(a.id)),draft:state.draft,training_executed:false});
$('create-draft').onclick=()=>{const items=all().filter(a=>state.saved.includes(a.id)&&a.status==='published');if(!items.length){toast('레퍼런스를 먼저 저장해 주세요.');return;}$('draft-origin').textContent='규칙 기반 초안 · 모델 호출 없음.';state.draft=draftPrompt(items,$('plan-query').value.trim()||state.query);$('draft-text').value=state.draft;$('draft-section').hidden=false;$('draft-section').scrollIntoView({behavior:'smooth',block:'start'});};$('draft-text').addEventListener('input',ev=>state.draft=ev.target.value);
$('copy-draft').onclick=async()=>{try{await navigator.clipboard.writeText($('draft-text').value);toast('초안을 복사했습니다.');}catch{$('draft-text').select();toast('텍스트를 선택했습니다. Ctrl/⌘ + C로 복사하세요.');}};
$('add-source').onclick=()=>{$('source-error').textContent='';$('source-dialog').showModal();};
$('source-form').addEventListener('submit',ev=>{ev.preventDefault();try{const form=Object.fromEntries(new FormData(ev.target));const item=validateImport({...form,id:uid(),displayAllowed:form.displayAllowed==='on'});state.imports.push(item);persist();render();$('source-dialog').close();ev.target.reset();toast(item.status==='review'?'검수 대기로 등록했습니다. 운영자가 검수 상태를 확인할 수 있어요.':'표시 권한 확인 기록과 함께 등록했습니다.');}catch(error){$('source-error').textContent=error.message;}});
for(const id of ['detail-dialog','source-dialog'])$(id).addEventListener('click',ev=>{if(ev.target===$(id)){const r=$(id).getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)$(id).close();}});
recordImpressions();render();
$('more-results').onclick=()=>submitSearch(true);
$('retry-sync').onclick=()=>remote.retry();
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{state.mode=button.dataset.mode;searchControl.cancel();searchSequence++;state.loading=false;state.hasSearched=false;state.searchError='';state.nextOffset=null;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});submitSearch();});
$('migrate-local').onclick=()=>{state.saved=[...new Set([...state.saved,...(legacy.saved||[])])];state.imports=[...new Map([...state.imports,...(legacy.imports||[])].map(a=>[a.id,a])).values()];state.assets=[...new Map([...state.assets,...(legacy.assets||[])].map(a=>[a.id,a])).values()];state.feedback=[...new Map([...state.feedback,...(legacy.feedback||[])].map(a=>[a.id,a])).values()];if(!state.title||state.title==='첫 번째 제주 프로젝트')state.title=legacy.title||state.title;$('migration-notice').hidden=true;persist();render();toast('브라우저 자료를 보드에 합쳤습니다. 서버 저장 상태를 확인하세요.');};
$('main').inert=true;$('add-source').disabled=true;
const bootstrap=remote.initialize();
bootstrap.then(result=>{if(result){const saved=result.state;if(saved){Object.assign(state,{title:saved.title,saved:saved.saved,imports:saved.imports,assets:saved.assets,feedback:saved.feedback});}else{Object.assign(state,{title:'첫 번째 제주 프로젝트',saved:[],imports:[],assets:[],feedback:[]});}const legacyIds=(legacy.saved||[]).filter(id=>!state.saved.includes(id));$('migration-notice').hidden=!(legacyIds.length||(legacy.imports||[]).some(a=>!state.imports.some(b=>b.id===a.id))||(legacy.feedback||[]).some(a=>!state.feedback.some(b=>b.id===a.id)));}cloudReady=true;$('main').inert=false;$('add-source').disabled=false;render();});

$('provider').onchange=()=>{state.provider=$('provider').value;state.type='all';state.relation='all';$('relation').value='all';if($('query').value.trim())submitSearch();else renderResults();};

let generatingPlan=false;
bootstrap.then(()=>apiRequest('/api/inference')).then(info=>{$('inference-status').textContent=info.configured?'추론 서버 설정됨 · 선택한 자료의 제목·태그·메모·출처를 서버로 전송합니다. 이미지 파일과 피드백은 전송하지 않습니다.':'추론 서버 미연결 · 서버 주소·모델명·인증키 설정 후 AI 생성이 활성화됩니다.';$('generate-plan').disabled=!info.configured;}).catch(()=>{$('inference-status').textContent='추론 서버 설정을 확인하지 못했습니다.';});
$('generate-plan').onclick=async()=>{if(generatingPlan)return;const query=$('plan-query').value.trim()||state.query;const assets=all().filter(a=>state.saved.includes(a.id)&&a.status==='published'&&safeUrl(a.url));if(!query||!assets.length||assets.length>12){toast('목적을 입력하고 원본 출처가 있는 자료 1~12개를 저장해 주세요.');return;}generatingPlan=true;$('generate-plan').disabled=true;$('inference-status').textContent='기획안 생성 중…';try{const result=await apiRequest('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,assets})});state.draft=result.text+'\n\n참고 출처\n'+result.references.map(r=>'['+r.number+'] '+r.title+' '+r.url).join('\n');$('draft-text').value=state.draft;$('draft-origin').textContent='AI 생성 · '+result.model+' · 메타데이터 참고 / 시각 분석·모델 학습 미실행';$('draft-section').hidden=false;$('draft-section').scrollIntoView({behavior:'smooth',block:'start'});$('inference-status').textContent=result.incomplete?'응답 길이 제한으로 초안이 일부만 작성됐습니다. 제작 목적을 줄여 다시 생성해 주세요.':'AI 기획안 생성 완료 · 출처별 사실과 제안을 검수해 주세요.';}catch(error){$('inference-status').textContent=error.message;}finally{generatingPlan=false;$('generate-plan').disabled=false;}};

function renderReview(){const bundle=buildReviewBundle(all(),state.feedback),s=bundle.summary;$('review-summary').innerHTML=[['검수 행',s.rows],['관련 있음',s.positive],['관련 없음',s.negative],['양쪽 평가가 있는 목적',s.comparable_queries]].map(([label,value])=>'<div class="stat"><small>'+e(label)+'</small><strong>'+value+'</strong></div>').join('');$('review-quality').textContent='출처 누락 '+s.missing_sources+'건 · 상충 평가 '+s.conflicts+'건 · 연결 그룹 '+s.groups+'개 · 학습 준비 완료 0건';$('review-queries').innerHTML=bundle.queries.length?'<div class="table-wrap"><table><thead><tr><th>평가 목적</th><th>기준</th><th>관련 있음</th><th>관련 없음</th><th>상태</th></tr></thead><tbody>'+bundle.queries.slice(0,10).map(q=>'<tr><td>'+e(q.query||'목적 미입력')+'</td><td>'+e(({purpose:'목적 전체',jeju:'제주 소재',color:'색감',motion:'움직임',typography:'글자'})[q.dimension]||q.dimension)+'</td><td>'+q.positive+'</td><td>'+q.negative+'</td><td>'+(q.conflicts?'상충 검토':q.positive&&q.negative&&q.query?'라벨 검수 대기':'비교 자료 보강')+'</td></tr>').join('')+'</tbody></table></div><p class="form-note">최대 10개 목적 표시 · 전체 기록은 내보내기에 포함됩니다.</p>':'<p>제작 목적을 입력하고 자료 상세에서 관련 있음·없음을 평가하면 검수 목록이 만들어집니다.</p>';}

$('chatgpt-copy').onclick=async()=>{
 const items=all().filter(a=>state.saved.includes(a.id)&&a.status==='published');if(!items.length){toast('마음에 드는 자료의 담기를 눌러주세요.');return;}
 const prompt=chatGptPrompt(items,$('plan-query').value.trim()||state.query);
 $('chatgpt-text').value=prompt;$('chatgpt-transfer').hidden=false;
 try{await navigator.clipboard.writeText(prompt);$('chatgpt-help').textContent='복사했어요. ChatGPT를 열고 입력창에 붙여넣으세요.';}catch{$('chatgpt-help').textContent='자동 복사가 안 되었어요. 아래 내용을 선택해 복사해 주세요.';$('chatgpt-text').focus();$('chatgpt-text').select();}
 if(items.length>12)$('chatgpt-help').textContent+=' 먼저 담은 12개 자료가 포함됐어요.';
 $('chatgpt-transfer').scrollIntoView({behavior:'smooth',block:'nearest'});
};

$('plan-query').addEventListener('input',()=>{$('chatgpt-transfer').hidden=true;});

function setupStudioActions(){
$('export-feedback').onclick=()=>download('jeju-feedback-review.json',{schema_version:'1.0',exported_at:new Date().toISOString(),training_ready:false,training_executed:false,notes:'명시적 피드백의 검수 대기 자료. 학습 권한·동의·중복 그룹 분할 검증 필요.',feedback:state.feedback});
$('export-review').onclick=()=>{const b=buildReviewBundle(all(),state.feedback);if(!b.rows.length){toast('목적을 입력하고 자료를 평가해 주세요.');return;}download('jeju-training-review.json',{...b,exported_at:new Date().toISOString()});};
$('export-review-jsonl').onclick=()=>{const b=buildReviewBundle(all(),state.feedback);if(!b.rows.length){toast('목적을 입력하고 자료를 평가해 주세요.');return;}download('jeju-training-review.jsonl',b.rows.map(r=>JSON.stringify(r)).join('\n')+'\n','application/x-ndjson;charset=utf-8');};
}
async function loadStudio(){
 if(studioReady||studioLoading)return;
 studioLoading=true;
 try{
  const response=await apiRequest('/api/studio/view');
  const placeholder=$('data-view');
  if(!placeholder||typeof response.html!=='string'||!response.html.startsWith('<section id="data-view"'))throw Error('운영자 화면을 불러오지 못했습니다.');
  placeholder.outerHTML=response.html;
  studioReady=true;
  const nav=document.querySelector('nav[aria-label="주 메뉴"]');
  if(!nav.querySelector('[data-view="data"]'))nav.insertAdjacentHTML('beforeend','<button class="nav-item" type="button" data-view="data"><span>⌘</span> 데이터 스튜디오</button>');
  $('studio-access').textContent='운영자 · 로그아웃';
  setupStudioActions();renderData();
  apiRequest('/api/providers').then(({providers})=>{$('provider-cards').innerHTML=providers.map(p=>'<article class="provider-card"><h3>'+e(p.name)+'</h3><span class="pill">'+(p.configured?(p.keyRequired?'키 등록됨':'키 없이 사용'):'키 등록 필요')+'</span><p>'+e(p.description)+'</p>'+(p.envName?'<code>'+e(p.envName)+'</code>':'')+'<a href="'+e(p.signup)+'" target="_blank" rel="noopener noreferrer">공식 서비스·활용 신청 ↗</a></article>').join('');}).catch(()=>{$('provider-cards').textContent='서버 연결 후 공개 API 설정 상태를 확인할 수 있습니다.';});
 }finally{studioLoading=false;}
}
$('studio-access').onclick=async()=>{
 if(!studioReady){$('studio-error').textContent='';$('studio-login').showModal();return;}
 try{
  await apiRequest('/api/studio/logout',{method:'POST'});
  view('explore');document.querySelector('[data-view="data"]')?.remove();
  $('data-view').outerHTML='<section id="data-view" hidden></section>';
  studioReady=false;$('studio-access').textContent='운영자';
  toast('운영자 공간에서 로그아웃했습니다.');
 }catch(error){toast(error.message);}
};
$('studio-login-cancel').onclick=()=>$('studio-login').close();
$('studio-login-form').onsubmit=async event=>{
 event.preventDefault();
 const button=$('studio-login-submit');if(button.disabled)return;
 button.disabled=true;$('studio-error').textContent='';
 try{
  await apiRequest('/api/studio/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('studio-code').value})});
  await loadStudio();$('studio-code').value='';$('studio-login').close();view('data');
 }catch(error){$('studio-error').textContent=error.message;}
 finally{button.disabled=false;}
};
const studioQuery=new URL(location.href).searchParams.get('studio')==='login';
apiRequest('/api/studio/session').then(async status=>{
 if(status.authenticated){await loadStudio();if(studioQuery)view('data');}
 else if(studioQuery)$('studio-login').showModal();
}).catch(()=>{if(studioQuery)$('studio-login').showModal();});

// Motion fades in only once and does not trap keyboard navigation.
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
 const sidebar=document.querySelector('.sidebar');
 const sidebarObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');sidebarObserver.unobserve(entry.target);}
 },{root:matchMedia('(max-width: 760px)').matches?null:sidebar,threshold:.12});
 for(const [i,node] of [...sidebar.querySelectorAll('.brand,.workspace,.nav-caption,.nav-item,.collection,.sidebar-bottom')].entries()){
  node.classList.add('scroll-reveal');node.style.setProperty('--reveal-delay',Math.min(i*50,350)+'ms');sidebarObserver.observe(node);
 }
 const contentObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');contentObserver.unobserve(entry.target);}
 },{threshold:.08,rootMargin:'0px 0px -30px 0px'});
 const observe=()=>{
  document.querySelectorAll('.hero .eyebrow,.hero h1,.hero-description,.palette-rail,.results-heading,.card,.section-top').forEach(node=>{
   if(!node.classList.contains('scroll-reveal')){node.classList.add('scroll-reveal');contentObserver.observe(node);}
  });
 };
 observe();
 for(const parent of ['results','board-results']){
  const target=$(parent);
  if(target)new MutationObserver(observe).observe(target,{childList:true});
 }
}
