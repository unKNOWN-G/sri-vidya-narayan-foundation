(() => {
  'use strict';
  function bindScrubber(shell,{onSelect,onFinish=()=>{}}={}) {
    const ribbon=shell.querySelector('.moment-ribbon'),links=[...ribbon.querySelectorAll('a')];
    if(!links.length)return ()=>{};
    const controller=new AbortController(),listen=(node,name,fn,options={})=>node.addEventListener(name,fn,{...options,signal:controller.signal});
    ribbon.setAttribute('role','navigation');
    ribbon.setAttribute('aria-label','Browse photos and recordings');
    ribbon.setAttribute('aria-description','Hold and slide to change the main photo. Hover for a preview. Arrow keys, Home and End also select.');
    const peek=document.createElement('div'),image=document.createElement('img'),label=document.createElement('span');
    peek.className='ribbon-peek';peek.setAttribute('aria-hidden','true');image.alt='';peek.append(image,label);shell.append(peek);
    let press=null,holdTimer=0,frame=0,lastTime=0,highlighted=null,lastTouchAt=-Infinity,blockClickUntil=0;
    links.forEach(link=>{link.draggable=false;link.querySelectorAll('img').forEach(img=>img.draggable=false);});
    function hide(){highlighted?.classList.remove('scrub-target');highlighted=null;peek.classList.remove('is-visible','is-hover-preview');}
    function preview(link,select=false){
      if(highlighted!==link){
        highlighted?.classList.remove('scrub-target');highlighted=link;link.classList.add('scrub-target');
        const thumb=link.querySelector('img'),kind=link.dataset.mediaKind;
        image.hidden=!thumb;
        if(thumb)image.src=link.dataset.preview||thumb.currentSrc||thumb.src;
        label.textContent=`${kind==='photo'?'Photo':kind==='audio'?'Audio':kind==='document'?'Document':'Video'} ${link.dataset.mediaNumber} / ${link.dataset.mediaTotal}`;
      }
      peek.classList.add('is-visible');
      // Read the actual responsive preview width instead of assuming a phone-sized box.
      const rect=link.getBoundingClientRect(),bounds=ribbon.getBoundingClientRect(),width=peek.offsetWidth;
      peek.style.left=Math.max(10,Math.min(innerWidth-width-10,rect.left+rect.width/2-width/2))+'px';
      peek.style.top=Math.max(10,bounds.top-peek.offsetHeight-12)+'px';
      if(select&&link.getAttribute('aria-current')!=='true')onSelect(link,links.indexOf(link)<links.findIndex(x=>x.hasAttribute('aria-current'))?-1:1);
    }
    function pick(){
      if(!press?.active)return;
      const rect=ribbon.getBoundingClientRect(),x=Math.max(rect.left+4,Math.min(rect.right-4,press.x));
      let nearest=links[0],distance=Infinity;
      for(const link of links){const r=link.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-x);if(d<distance){distance=d;nearest=link;}}
      preview(nearest,true);
    }
    function tick(now){
      if(!press?.active)return;
      const rect=ribbon.getBoundingClientRect(),edge=42;
      const velocity=press.x<rect.left+edge?-Math.min(1,(rect.left+edge-press.x)/edge):press.x>rect.right-edge?Math.min(1,(press.x-rect.right+edge)/edge):0;
      ribbon.scrollLeft+=velocity*360*Math.min(32,now-(lastTime||now))/1000;
      lastTime=now;pick();frame=requestAnimationFrame(tick);
    }
    function capture(){if(press?.input==='pointer')try{ribbon.setPointerCapture(press.id);}catch(_){}}
    function activate(){
      if(!press||press.dragged)return;
      press.active=true;ribbon.classList.add('is-scrubbing');peek.classList.remove('is-hover-preview');capture();pick();lastTime=0;frame=requestAnimationFrame(tick);
    }
    function finish(point,cancelled=false){
      if(!press){hide();return;}
      clearTimeout(holdTimer);cancelAnimationFrame(frame);
      if(press.active&&!cancelled&&point){press.x=point.clientX;pick();}
      if(press.active||press.dragged){blockClickUntil=performance.now()+550;onFinish();}
      const state=press;press=null;ribbon.classList.remove('is-scrubbing');hide();
      if(state.input==='pointer')try{if(ribbon.hasPointerCapture(state.id))ribbon.releasePointerCapture(state.id);}catch(_){}
    }
    function start(point,input,id){
      finish(null,true);
      press={input,id,startX:point.clientX,startY:point.clientY,x:point.clientX,lastX:point.clientX,active:false,dragged:false};
      holdTimer=setTimeout(activate,300);
    }
    function move(point,event){
      const dx=point.clientX-press.startX,dy=point.clientY-press.startY;press.x=point.clientX;
      if(press.active){if(event.cancelable)event.preventDefault();pick();return;}
      if(!press.dragged&&Math.max(Math.abs(dx),Math.abs(dy))>9){
        clearTimeout(holdTimer);
        if(Math.abs(dy)>Math.abs(dx)*1.3){finish(point,true);return;}
        press.dragged=true;capture();
      }
      if(press.dragged){if(event.cancelable)event.preventDefault();ribbon.scrollLeft+=press.lastX-point.clientX;}
      press.lastX=point.clientX;
    }
    // Touch is independent of the compatibility pointer stream that phones may cancel.
    listen(ribbon,'touchstart',event=>{
      lastTouchAt=performance.now();if(event.touches.length!==1){finish(null,true);return;}
      if(!event.target.closest('a'))return;
      start(event.touches[0],'touch',event.touches[0].identifier);
    },{passive:true,capture:true});
    listen(ribbon,'touchmove',event=>{
      if(press?.input!=='touch')return;
      if(event.touches.length!==1){finish(null,true);return;}
      const point=Array.from(event.touches).find(t=>t.identifier===press.id);if(point)move(point,event);
    },{passive:false,capture:true});
    listen(document,'touchend',event=>{if(press?.input==='touch'){const point=Array.from(event.changedTouches).find(t=>t.identifier===press.id);if(point){lastTouchAt=performance.now();finish(point);}}},{passive:true,capture:true});
    listen(document,'touchcancel',()=>{if(press?.input==='touch')finish(null,true);},{passive:true,capture:true});
    listen(ribbon,'pointerdown',event=>{
      if(event.pointerType==='touch'||performance.now()-lastTouchAt<800||event.button!==0||!event.isPrimary||press||!event.target.closest('a'))return;
      start(event,'pointer',event.pointerId);
    });
    listen(ribbon,'pointermove',event=>{
      if(press?.input==='pointer'&&press.id===event.pointerId){move(event,event);return;}
      if(press||event.pointerType==='touch'||performance.now()-lastTouchAt<800||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
      const link=event.target.closest('a');if(!link){hide();return;}
      peek.classList.add('is-hover-preview');preview(link);
    });
    listen(ribbon,'pointerleave',()=>{if(!press)hide();});
    listen(document,'pointerup',event=>{if(press?.input==='pointer'&&press.id===event.pointerId)finish(event);});
    listen(document,'pointercancel',event=>{if(press?.input==='pointer'&&press.id===event.pointerId)finish(event,true);});
    listen(ribbon,'lostpointercapture',event=>{if(press?.input==='pointer'&&press.id===event.pointerId)finish(event,true);});
    listen(ribbon,'click',event=>{if(performance.now()<blockClickUntil){blockClickUntil=0;event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
    listen(ribbon,'contextmenu',event=>{if(press||performance.now()-lastTouchAt<800)event.preventDefault();});
    listen(ribbon,'dragstart',event=>event.preventDefault());
    listen(window,'blur',()=>finish(null,true));
    listen(window,'resize',()=>finish(null,true));
    listen(document,'visibilitychange',()=>{if(document.hidden)finish(null,true);});
    listen(ribbon,'keydown',event=>{
      if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const at=links.indexOf(event.target.closest('a'));if(at<0)return;
      event.preventDefault();event.stopPropagation();finish(null,true);
      const next=event.key==='Home'?0:event.key==='End'?links.length-1:Math.max(0,Math.min(links.length-1,at+(event.key==='ArrowRight'?1:-1)));
      links[next].focus({preventScroll:true});onSelect(links[next],next<at?-1:1);
    });
    return ()=>{finish(null,true);controller.abort();peek.remove();};
  }
  window.foundationMedia={bindScrubber};
})();
