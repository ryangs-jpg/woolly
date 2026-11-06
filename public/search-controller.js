// Invalidates at input time, including during Korean IME composition.
export function createSearchController({run,delay=700,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer,version=0,controller;
 function cancel(){clearTimer(timer);controller?.abort();controller=null;return ++version;}
 function start(value){const revision=cancel();controller=new AbortController();return Promise.resolve(run(value,{signal:controller.signal,isCurrent:()=>revision===version}));}
 return {cancel,now:start,schedule(value){cancel();timer=setTimer(()=>{void start(value);},delay);}};
}
