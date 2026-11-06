// JEJU REF decorative motion. All effects are nonblocking and respect user preferences.
export const shouldFollowCursor=({fine,hover,reducedMotion})=>Boolean(fine&&hover&&!reducedMotion);
export function approach(current,target,ratio=0.22){
 if(!Number.isFinite(current)||!Number.isFinite(target))return target;
 return current+(target-current)*ratio;
}
export function initMenuIndicator(doc,win){
 const nav=doc.querySelector('.sidebar nav[aria-label="주 메뉴"]');
 if(!nav||!('MutationObserver' in win)||!('requestAnimationFrame' in win))return null;
 const indicator=doc.createElement('span');
 indicator.className='nav-highlight';
 indicator.setAttribute('aria-hidden','true');
 nav.prepend(indicator);
 nav.classList.add('menu-motion');
 let frame=0;
 const measure=()=>{
  frame=0;
  const item=nav.querySelector('button.nav-item.active');
  if(!item){indicator.classList.remove('ready');return;}
  const parent=nav.getBoundingClientRect();
  const rect=item.getBoundingClientRect();
  indicator.style.setProperty('--menu-x',Math.round(rect.left-parent.left)+'px');
  indicator.style.setProperty('--menu-y',Math.round(rect.top-parent.top)+'px');
  indicator.style.setProperty('--menu-width',Math.round(rect.width)+'px');
  indicator.style.setProperty('--menu-height',Math.round(rect.height)+'px');
  indicator.classList.add('ready');
 };
 const queue=()=>{if(!frame)frame=win.requestAnimationFrame(measure);};
 const observe=new win.MutationObserver(mutations=>{
  if(mutations.some(m=>m.type==='childList'||m.attributeName==='class'))queue();
 });
 observe.observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
 win.addEventListener('resize',queue,{passive:true});
 queue();
 return ()=>{observe.disconnect();win.removeEventListener('resize',queue);if(frame)win.cancelAnimationFrame(frame);indicator.remove();nav.classList.remove('menu-motion');};
}
export function initTangerineFollower(doc,win){
 if(!shouldFollowCursor({
  fine:win.matchMedia('(pointer: fine)').matches,
  hover:win.matchMedia('(hover: hover)').matches,
  reducedMotion:win.matchMedia('(prefers-reduced-motion: reduce)').matches
 }))return null;
 const icon=doc.getElementById('tangerine-cursor');
 if(!icon||!('requestAnimationFrame' in win))return null;
 let x=0,y=0,targetX=0,targetY=0,frame=0,visible=false;
 const tick=()=>{
  frame=0;
  x=approach(x,targetX);y=approach(y,targetY);
  icon.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
  if(Math.abs(targetX-x)+Math.abs(targetY-y)>0.5)frame=win.requestAnimationFrame(tick);
 };
 const hide=()=>{
  icon.classList.remove('is-visible','is-curious');
  visible=false;
  if(frame){win.cancelAnimationFrame(frame);frame=0;}
 };
 const move=event=>{
  if(event.pointerType!=='mouse')return;
  targetX=Math.max(0,Math.min(win.innerWidth-52,event.clientX+20));
  targetY=Math.max(0,Math.min(win.innerHeight-55,event.clientY+17));
  if(!visible){x=targetX;y=targetY;visible=true;icon.classList.add('is-visible');}
  icon.classList.toggle('is-curious',Boolean(event.target?.closest?.('button,a,summary,[role="button"]')));
  if(!frame)frame=win.requestAnimationFrame(tick);
 };
 const out=event=>{if(!event.relatedTarget)hide();};
 const visibility=()=>{if(doc.visibilityState==='hidden')hide();};
 doc.addEventListener('pointermove',move,{passive:true});
 doc.addEventListener('pointerout',out,{passive:true});
 doc.addEventListener('visibilitychange',visibility);
 win.addEventListener('blur',hide);
 return ()=>{hide();doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerout',out);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',hide);};
}
export function initializeJejuMotion({doc,win}){
 if(!doc||!win?.matchMedia)return ()=>{};
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const stops=[...(!reduced?[initMenuIndicator(doc,win)]:[]),initTangerineFollower(doc,win)].filter(Boolean);
 return ()=>stops.forEach(stop=>stop());
}
