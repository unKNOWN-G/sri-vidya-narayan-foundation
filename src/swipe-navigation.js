(() => {
  'use strict';
  function bindSwipe(root, {onSwipe, surface = root, ignore = ''} = {}) {
    const controller = new AbortController();
    const listen = (target,name,handler,options={}) => target.addEventListener(name,handler,{...options,signal:controller.signal});
    const ignored = target => target?.closest?.('input,select,textarea,video,audio,iframe,dialog,summary,[contenteditable="true"],a:not(.cinema-photo)'+(ignore?','+ignore:''));
    let press=null,blockClickUntil=0,wheelTotal=0,wheelAt=0,wheelUsed=false,lastTouchAt=-Infinity;
    root.classList.add('swipe-surface');surface.classList.add('swipe-visual');
    function finish(point,cancelled=false) {
      if(!press)return;
      const state=press;press=null;
      const dx=point?point.clientX-state.x:state.dx,dy=point?point.clientY-state.y:state.dy;
      root.classList.remove('is-swiping');surface.style.removeProperty('--swipe-x');
      if(state.input==='pointer')try{if(root.hasPointerCapture(state.id))root.releasePointerCapture(state.id);}catch(_){}
      if(!state.dragging)return;
      blockClickUntil=performance.now()+550;
      const distance=state.input==='touch'?28:Math.min(60,Math.max(32,root.clientWidth*.12));
      const flick=Math.abs(dx)>20&&Math.abs(dx)/Math.max(1,performance.now()-state.time)>.4;
      if(!cancelled&&Math.abs(dx)>=Math.abs(dy)*.65&&(Math.abs(dx)>=distance||flick))onSwipe(dx<0?1:-1);
    }
    function start(point,input,id) {
      press={input,id,x:point.clientX,y:point.clientY,dx:0,dy:0,time:performance.now(),dragging:false};
    }
    function move(point,event) {
      if(!press)return;
      const dx=point.clientX-press.x,dy=point.clientY-press.y;press.dx=dx;press.dy=dy;
      if(!press.dragging){
        if(Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx)*1.8){blockClickUntil=performance.now()+550;finish(point,true);return;}
        if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.1)return;
        press.dragging=true;root.classList.add('is-swiping');
        if(press.input==='pointer')try{root.setPointerCapture(press.id);}catch(_){}
      }
      if(event.cancelable)event.preventDefault();
      surface.style.setProperty('--swipe-x',Math.max(-110,Math.min(110,dx*.55))+'px');
    }
    // Touch remains authoritative even if the browser cancels its compatibility pointer stream.
    listen(root,'touchstart',event=>{
      lastTouchAt=performance.now();
      if(event.touches.length!==1){finish(null,true);return;}
      if(ignored(event.target))return;
      if(press)finish(null,true);
      const touch=event.touches[0];start(touch,'touch',touch.identifier);
    },{passive:true,capture:true});
    listen(root,'touchmove',event=>{
      if(press?.input!=='touch')return;
      if(event.touches.length!==1){finish(null,true);return;}
      const touch=Array.from(event.touches).find(t=>t.identifier===press.id);if(touch)move(touch,event);
    },{passive:false,capture:true});
    listen(document,'touchend',event=>{
      if(press?.input!=='touch')return;
      const touch=Array.from(event.changedTouches).find(t=>t.identifier===press.id);if(touch){lastTouchAt=performance.now();finish(touch);}
    },{passive:true,capture:true});
    listen(document,'touchcancel',()=>{if(press?.input==='touch'){lastTouchAt=performance.now();finish(null,true);}},{passive:true,capture:true});
    listen(root,'pointerdown',event=>{
      if(event.pointerType==='touch'||performance.now()-lastTouchAt<800||event.button!==0||!event.isPrimary||press||ignored(event.target))return;
      start(event,'pointer',event.pointerId);
    });
    listen(root,'pointermove',event=>{if(press?.input==='pointer'&&press.id===event.pointerId)move(event,event);},{passive:false});
    listen(document,'pointerup',event=>{if(press?.input==='pointer'&&press.id===event.pointerId)finish(event);});
    listen(document,'pointercancel',event=>{if(press?.input==='pointer'&&press.id===event.pointerId)finish(event,true);});
    listen(root,'lostpointercapture',event=>{if(press?.input==='pointer'&&press.id===event.pointerId)finish(event,true);});
    listen(root,'click',event=>{if(performance.now()<blockClickUntil){blockClickUntil=0;event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
    listen(root,'dragstart',event=>{if(!ignored(event.target))event.preventDefault();});
    listen(root,'wheel',event=>{
      if(event.ctrlKey||ignored(event.target)||Math.abs(event.deltaX)<=Math.abs(event.deltaY)*1.2||Math.abs(event.deltaX)<1)return;
      event.preventDefault();const now=performance.now();if(now-wheelAt>180){wheelTotal=0;wheelUsed=false;}wheelAt=now;
      if(wheelUsed)return;wheelTotal+=event.deltaX*(event.deltaMode===1?18:1);
      if(Math.abs(wheelTotal)>65){wheelUsed=true;onSwipe(wheelTotal>0?1:-1);}
    },{passive:false});
    listen(window,'blur',()=>finish(null,true));
    listen(document,'visibilitychange',()=>{if(document.hidden)finish(null,true);});
    return ()=>{finish(null,true);controller.abort();root.classList.remove('swipe-surface');surface.classList.remove('swipe-visual');};
  }
  window.foundationGestures={bindSwipe};
})();
