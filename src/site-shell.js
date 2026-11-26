(() => {
  'use strict';
  const header = document.querySelector('.masthead,.reader-header,.experience-header');
  if (!header) return;
  const main = header.classList.contains('masthead');
  const spotlight=document.querySelector('#spotlight-stage');
  if(spotlight) for(const [id,side] of [['spotlight-previous','previous'],['spotlight-next','next']]) {const button=document.getElementById(id);if(button){button.classList.add('shell-carousel-arrow','shell-carousel-'+side);spotlight.append(button);}}
  header.classList.add('site-shell');
  const brand = header.querySelector('.brand,.reader-brand,.experience-brand');
  brand?.classList.add('shell-brand');
  const back = header.querySelector('#back-view,.back-books,.experience-back');
  back?.classList.add('shell-back');
  if(back?.classList.contains('back-books')) {back.textContent='← Books';back.setAttribute('aria-label','Back to books');}
  const home = header.querySelector('.start-link,.reader-home,.experience-home');
  home?.classList.add('shell-home');
  let actions = main ? header.querySelector('.wayfinding') : null;
  if (!actions) {
    actions = document.createElement('div');
    home.replaceWith(actions); actions.append(home);
  }
  actions.classList.add('shell-actions');
  let toggle = header.querySelector('.mobile-menu');
  if (!toggle) { toggle = document.createElement('button'); toggle.type='button'; actions.append(toggle); }
  toggle.classList.add('shell-toggle'); toggle.setAttribute('aria-label','More options');
  toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-controls','shell-navigation');
  toggle.innerHTML='<span aria-hidden="true">⋯</span>';
  let nav = header.querySelector('nav');
  if (!nav) {
    nav=document.createElement('nav'); nav.setAttribute('aria-label','Site navigation'); header.append(nav);
    nav.innerHTML='<a href="index.html">Home</a><a href="index.html#/learn">Teachings</a><a href="index.html#/foundation/connect">Contact the foundation</a><a href="index.html#/about">About this tribute</a><button type="button" class="shell-share">Copy a link to this page</button>';
    if(document.querySelector('#edition-dialog')) nav.insertAdjacentHTML('beforeend','<button id="about-edition" type="button">About this edition</button>');
  }
  nav.id='shell-navigation'; nav.classList.add('shell-menu');
  function closeMenu(restoreFocus=false) {
    nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false');
    if(restoreFocus) toggle.focus({preventScroll:true});
  }
  toggle.addEventListener('click',()=>{
    const open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open));
  });
  document.addEventListener('pointerdown',event=>{if(!header.contains(event.target))closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){closeMenu(true);event.preventDefault();event.stopImmediatePropagation();}},true);
  header.addEventListener('focusout',event=>{if(event.relatedTarget&&!header.contains(event.relatedTarget))closeMenu();});
  nav.addEventListener('click',event=>{if(event.target.closest('a,#about-edition'))closeMenu();});
  document.querySelector('#edition-dialog')?.addEventListener('close',()=>toggle.focus({preventScroll:true}));
  nav.querySelector('.shell-share')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    try {await navigator.clipboard.writeText(location.href);button.textContent='Link copied';setTimeout(()=>button.textContent='Copy a link to this page',2000);}
    catch (_) {button.textContent='Copy the address from your browser';}
  });
  window.foundationShell={closeMenu};
})();
