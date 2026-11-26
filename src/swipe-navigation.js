(() => {
  'use strict';
  // Shared pointer handling for touch, pen, mouse dragging and horizontal trackpads.
  function bindSwipe(root, {onSwipe, surface = root, ignore = ''} = {}) {
    const controller = new AbortController();
    const listen = (target, name, handler, options = {}) => target.addEventListener(name, handler, {...options,signal:controller.signal});
    const ignored = target => target.closest('input,select,textarea,video,audio,iframe,dialog,summary,[contenteditable="true"],a:not(.cinema-photo)'+(ignore ? ','+ignore : ''));
    let press = null, blockClickUntil = 0, wheelTotal = 0, wheelAt = 0, wheelUsed = false;
    root.classList.add('swipe-surface'); surface.classList.add('swipe-visual');
    function finish(event, cancelled = false) {
      if (!press || (event?.pointerId !== undefined && press.id !== event.pointerId)) return;
      const state = press; press = null;
      const dx = event?.clientX === undefined ? state.dx : event.clientX-state.x;
      root.classList.remove('is-swiping'); surface.style.removeProperty('--swipe-x');
      try { if(root.hasPointerCapture(state.id))root.releasePointerCapture(state.id); } catch (_) {}
      if (!state.dragging) return;
      blockClickUntil = performance.now()+500;
      const distance = Math.min(60,Math.max(32,root.clientWidth*.12));
      const flick = Math.abs(dx)>22 && Math.abs(dx)/Math.max(1,performance.now()-state.time)>.45;
      if (!cancelled && (Math.abs(dx)>=distance || flick)) onSwipe(dx<0?1:-1);
    }
    listen(root,'pointerdown',event => {
      if (event.button!==0 || !event.isPrimary || press || ignored(event.target)) return;
      press = {id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,time:performance.now(),dragging:false};
    });
    listen(root,'pointermove',event => {
      if (!press || event.pointerId!==press.id) return;
      const dx=event.clientX-press.x,dy=event.clientY-press.y; press.dx=dx;
      if (!press.dragging && Math.max(Math.abs(dx),Math.abs(dy))>8) {
        if (Math.abs(dy)>Math.abs(dx)*.9) { blockClickUntil=performance.now()+500; finish(event,true); return; }
        press.dragging=true; root.classList.add('is-swiping');
        try { root.setPointerCapture(event.pointerId); } catch (_) {}
      }
      if(press?.dragging){event.preventDefault();surface.style.setProperty('--swipe-x',Math.max(-110,Math.min(110,dx*.55))+'px');}
    },{passive:false});
    listen(document,'pointerup',event=>finish(event));
    listen(document,'pointercancel',event=>finish(event,true));
    listen(root,'lostpointercapture',event=>finish(event,true));
    listen(root,'click',event=>{if(performance.now()<blockClickUntil){blockClickUntil=0;event.preventDefault();event.stopImmediatePropagation();}}, {capture:true});
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
