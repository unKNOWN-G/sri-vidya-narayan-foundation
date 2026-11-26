(() => {
  'use strict';
  const turns = new WeakMap();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function open(cover, reveal, {animate = true} = {}) {
    let timer;
    cover.classList.remove('opening');
    if (!animate || reduced()) reveal();
    else { cover.classList.add('opening'); timer=setTimeout(reveal,500); }
    return () => { clearTimeout(timer);cover.classList.remove('opening'); };
  }
  function turn(page,direction) {
    turns.get(page)?.cancel();
    if (!direction || reduced()) return;
    page.style.transformOrigin='left center';
    const animation=page.animate([
      {transform:`rotateY(${direction>0?-13:13}deg) translateX(${direction>0?14:-14}px)`,opacity:.25},
      {transform:'none',opacity:1},
    ],{duration:500,easing:'ease'});
    turns.set(page,animation);
    animation.addEventListener('finish',()=>{if(turns.get(page)===animation)turns.delete(page);},{once:true});
  }
  function stop(page) { turns.get(page)?.cancel();turns.delete(page); }
  window.foundationBookMotion={open,turn,stop};
})();
