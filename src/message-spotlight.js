(() => {
  const samples = window.foundationEventCards || [];
  const stage = document.querySelector('#spotlight-stage');
  const collection = document.querySelector('#spotlight-cards');
  const dialog = document.querySelector('#event-card-reader');
  if (!samples.length || !stage || !dialog) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paper = document.querySelector('#event-reader-paper');
  const viewport = document.querySelector('#event-reader-viewport');
  const accessible = document.createElement('p'); accessible.className='event-reader-accessible'; accessible.setAttribute('aria-live','polite'); viewport.append(accessible); paper.setAttribute('aria-hidden','true');
  const previous = document.querySelector('#event-reader-previous');
  const next = document.querySelector('#event-reader-next');
  const rotation = document.querySelector('#spotlight-rotation');
  const chooser = document.querySelector('#message-occasions');
  const coverChooser = document.querySelector('#event-reader-cover');
  const coverField = document.querySelector('#event-reader-cover-field');
  const zoomButton = document.querySelector('#event-reader-zoom');
  let enlarged = false;
  let selected = 0, step = 0, busy = false, returnFocus = null, hovered = false;
  let storedRotation = true; try { storedRotation = sessionStorage.getItem('svnf-message-rotation') !== 'paused'; } catch (_) {}
  let rotating = storedRotation && !reduced.matches, timer = null, turnTimer = null;
  function el(tag, text, className) {
    const n = document.createElement(tag); if (text) n.textContent = text;
    if (className) n.className = className; return n;
  }
  function page(card, number, extra = '') {
    const data = card.pages[number - 1] || {};
    const panel = el('div', '', `greeting-paper theme-${card.theme} ${extra}`);
    panel.setAttribute('aria-label', `Page ${number}: ${data.title || card.title}`);
    if (extra.includes('spotlight-card-front') && card.cover) {
      panel.classList.add('original-page');
      const image=el('img','','original-card-page gallery-original-cover');image.src=card.cover;image.alt=data.alt||card.title;image.loading='lazy';panel.append(image);return panel;
    }
    if (card.sheets && card.type === 'folded') {
      panel.classList.add('original-page');
      const mapping = {1:['outside','right'],2:['inside','left'],3:['inside','right'],4:['outside','left']};
      const [sheet, half] = mapping[number]; const crop = el('div', '', `imposed-source half-${half}`);
      const img = el('img'); img.src = card.sheets[sheet]; img.alt = data.alt || `Page ${number} of ${card.title}`;
      crop.append(img); panel.append(crop); return panel;
    }
    if (data.image) {
      panel.classList.add('original-page');
      const image = el('img', '', 'original-card-page'); image.src = data.image;
      image.alt = data.alt || `Page ${number} of ${card.title}`; panel.append(image); return panel;
    }
    panel.append(el('span', 'SAMPLE GREETING', 'greeting-sample'));
    const mark = el('span', '', 'greeting-lotus'); mark.setAttribute('aria-hidden', 'true');
    panel.append(mark, el('p', data.kicker, 'greeting-kicker'), el('h3', data.title, 'greeting-title'));
    const body = el('div', '', 'greeting-body');
    (data.body || '').split('\n\n').forEach(t => body.append(el('p', t)));
    panel.append(body, el('p', data.footer, 'greeting-footer'), el('span', String(number), 'greeting-page-number'));
    return panel;
  }
  samples.forEach((card, i) => {
    const button = el('button', '', `spotlight-entry theme-${card.theme}`); button.type = 'button';
    const back = el('span', '', 'spotlight-card-back'); back.setAttribute('aria-hidden','true');
    button.append(back, page(card, 1, 'spotlight-card-front'));
    const hint=el('span','Open →','card-open-hint');hint.setAttribute('aria-hidden','true');button.append(hint);
    const choice=el('button','','message-occasion-stop');choice.type='button';choice.setAttribute('aria-label',`${i+1}. ${card.title}`);choice.append(el('span',String(i+1).padStart(2,'0'),'message-occasion-number'),el('span',card.title,'message-occasion-title'));choice.addEventListener('click',()=>{setRotation(false);select(i);});chooser.append(choice);
    button.addEventListener('click', () => {
      setRotation(false);
      if (selected === i) openReader(button); else select(i);
    }); collection.append(button);
  });
  function select(index) {
    selected = (index + samples.length) % samples.length;
    [...collection.children].forEach((button, i) => {
      let offset = (i - selected + samples.length) % samples.length;
      if (offset > Math.floor(samples.length / 2)) offset -= samples.length;
      button.hidden = Math.abs(offset) > 1;
      button.dataset.position = offset === 0 ? 'center' : offset < 0 ? 'left' : 'right';
      button.setAttribute('aria-label', (offset === 0 ? 'Open ' : 'Spotlight ') + samples[i].title);
      button.tabIndex = offset === 0 ? 0 : -1;
    });
    [...chooser.children].forEach((choice,i)=>choice.setAttribute('aria-pressed',String(i===selected)));
    const activeChoice=chooser.children[selected];if(activeChoice.offsetLeft<chooser.scrollLeft||activeChoice.offsetLeft+activeChoice.offsetWidth>chooser.scrollLeft+chooser.clientWidth)chooser.scrollTo({left:activeChoice.offsetLeft-(chooser.clientWidth-activeChoice.offsetWidth)/2,behavior:reduced.matches?'instant':'smooth'});
    stage.setAttribute('aria-labelledby','spotlight-title');
    document.querySelector('#spotlight-count').textContent = `${String(selected+1).padStart(2,'0')} / ${String(samples.length).padStart(2,'0')}`;
    document.querySelector('#spotlight-title').textContent = samples[selected].title;
    document.querySelector('#spotlight-description').textContent = samples[selected].description || '';
    fitSpotlight();
  }
  function fitSpotlight() {
    const caption = stage.querySelector('.spotlight-caption');
    const height=Math.max(110,Math.min(385,stage.clientHeight-caption.offsetHeight-40));
    stage.style.setProperty('--card-height',`${height}px`);
    stage.style.setProperty('--card-top',`${Math.max(12,(stage.clientHeight-height-caption.offsetHeight-24)/2)}px`);
  }
  const spotlightLayout = new ResizeObserver(fitSpotlight);
  spotlightLayout.observe(stage);spotlightLayout.observe(stage.querySelector('.spotlight-caption'));
  function setRotation(enabled) {
    rotating = enabled && !reduced.matches; if (rotating) hovered = false; clearInterval(timer); timer = null;
    try { sessionStorage.setItem('svnf-message-rotation', rotating ? 'playing' : 'paused'); } catch (_) {}
    rotation.setAttribute('aria-pressed', String(rotating));
    rotation.textContent = rotating ? 'Ⅱ' : '▷';
    rotation.setAttribute('aria-label',rotating?'Pause message rotation':'Resume message rotation');
    if (rotating) timer = setInterval(() => {if (!hovered && !dialog.open && !document.hidden) select(selected+1);}, 10000);
  }
  chooser.addEventListener('wheel',event=>{if(!event.ctrlKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX)&&chooser.scrollWidth>chooser.clientWidth){event.preventDefault();chooser.scrollLeft+=event.deltaY*(event.deltaMode===1?18:1);}},{passive:false});
  chooser.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const index=[...chooser.children].indexOf(document.activeElement),target=event.key==='Home'?0:event.key==='End'?samples.length-1:Math.max(0,Math.min(samples.length-1,index+(event.key==='ArrowRight'?1:-1)));event.preventDefault();const choice=chooser.children[target];choice.focus({preventScroll:true});chooser.scrollTo({left:choice.offsetLeft-(chooser.clientWidth-choice.offsetWidth)/2,behavior:reduced.matches?'instant':'smooth'});});
  chooser.addEventListener('pointerenter',()=>{hovered=true;});chooser.addEventListener('pointerleave',()=>{hovered=false;});chooser.addEventListener('focusin',()=>{hovered=true;});chooser.addEventListener('focusout',()=>{hovered=false;});
  document.querySelector('#spotlight-next').addEventListener('click',()=>{setRotation(false);select(selected+1);});
  document.querySelector('#spotlight-previous').addEventListener('click',()=>{setRotation(false);select(selected-1);});
  rotation.addEventListener('click',()=>setRotation(!rotating));
  collection.addEventListener('pointerenter',()=>{hovered=true;});
  collection.addEventListener('pointerleave',()=>{hovered=false;});
  collection.addEventListener('focusin',()=>{hovered=true;});
  collection.addEventListener('focusout',()=>{hovered=false;});
  const scene = document.querySelector('#message-spotlight');
  scene.addEventListener('focusin',()=>{hovered=true;});
  scene.addEventListener('focusout',event=>{hovered=scene.contains(event.relatedTarget);});
  document.querySelector('#message-spotlight').addEventListener('pointerdown',event=>{if(!event.target.closest('#spotlight-rotation'))setRotation(false);});
  reduced.addEventListener('change',()=>{if(reduced.matches)setRotation(false);});
  function lastStep() {return samples[selected].type==='folded'?2:samples[selected].pages.length-1;}
  function controls() {
    const card=samples[selected]; let label;
    if(card.type==='folded') label=['Front cover · page 1 of 4','Inside · pages 2–3 of 4','Back cover · page 4 of 4'][step];
    else if(card.type==='duplex') label=step===0?'Front · page 1 of 2':'Back · page 2 of 2';
    else label=`Page ${step+1} of ${card.pages.length}`;
    document.querySelector('#event-reader-position').textContent=label;
    const pages=card.type==='folded'?(step===0?[1]:step===1?[2,3]:[4]):[step+1];
    accessible.textContent=pages.map(n=>{const p=card.pages[n-1];return `Page ${n}. ${p.title||card.title}. ${p.body||p.alt||''}`;}).join(' ');
    previous.disabled=busy||step===0;next.disabled=busy||step===lastStep();
    const single=lastStep()===0;previous.hidden=single;next.hidden=single;
    document.querySelector('.event-reader-controls').classList.toggle('is-single-page',single);
    document.querySelector('.event-reader-footer span').textContent=enlarged?'Scroll or pan to read · use Next / Previous to turn':single?'Single-page card · Enlarge to read':'Click a page · scroll · swipe · arrows';
  }
  function render() {
    const card=samples[selected];paper.replaceChildren();paper.className=`event-reader-paper format-${card.type}`;
    paper.style.setProperty('--page-aspect',String(card.aspect||210/297));paper.style.setProperty('--spread-aspect',String((card.aspect||210/297)*2));
    paper.classList.toggle('landscape-card',card.aspect>1);viewport.scrollTop=0;viewport.scrollLeft=0;
    if(card.type==='folded' && step<2) {
      const book=el('div','','folded-greeting');book.dataset.open=String(step===1);
      book.append(page(card,2,'fold-base-left'),page(card,3,'fold-base-right'));
      const leaf=el('div','','fold-cover-leaf');leaf.setAttribute('aria-hidden','true');
      leaf.append(page(card,1,'fold-leaf-front'),page(card,2,'fold-leaf-back'));book.append(leaf);paper.append(book);
      book.setAttribute('aria-label',step===1?'Open card, pages 2 and 3':'Closed card, front cover page 1');
      if(step===0)book.querySelector('.fold-base-left').setAttribute('aria-hidden','true');
    } else if(card.type==='duplex') {
      const flip=el('div','','duplex-greeting');flip.dataset.back=String(step===1);
      const front=page(card,1,'duplex-front'),back=page(card,2,'duplex-back');
      front.setAttribute('aria-hidden',String(step!==0));back.setAttribute('aria-hidden',String(step!==1));
      flip.append(front,back);paper.append(flip);
    } else paper.append(page(card,card.type==='folded'?4:step+1,'single-greeting'));
    controls();
  }
  function settle() {busy=false;paper.classList.remove('turn-out-next','turn-out-previous','turn-arrive-next','turn-arrive-previous');controls();}
  function turn(direction) {
    if(busy||step+direction<0||step+direction>lastStep())return;
    const card=samples[selected];busy=true;controls();
    if(reduced.matches){step+=direction;render();settle();return;}
    if(card.type==='duplex') {
      step+=direction;const flip=paper.querySelector('.duplex-greeting');flip.dataset.back=String(step===1);
      flip.querySelector('.duplex-front').setAttribute('aria-hidden',String(step!==0));
      flip.querySelector('.duplex-back').setAttribute('aria-hidden',String(step!==1));
      controls();turnTimer=setTimeout(settle,760);return;
    }
    if(card.type==='folded' && ((step===0&&direction===1)||(step===1&&direction===-1))) {
      step+=direction;const book=paper.querySelector('.folded-greeting');book.dataset.open=String(step===1);
      book.setAttribute('aria-label',step===1?'Open card, pages 2 and 3':'Closed card, front cover page 1');
      book.querySelector('.fold-base-left').setAttribute('aria-hidden',String(step===0));
      controls();turnTimer=setTimeout(settle,950);return;
    }
    paper.classList.add(direction>0?'turn-out-next':'turn-out-previous');
    turnTimer=setTimeout(()=>{
      step+=direction;render();paper.classList.add(direction>0?'turn-arrive-next':'turn-arrive-previous');
      turnTimer=setTimeout(settle,400);
    },300);
  }
  function openReader(button) {
    returnFocus=button;busy=false;step=0;clearTimeout(turnTimer);
    const card=samples[selected];document.querySelector('#event-reader-title').textContent=card.title;
    document.querySelector('#event-reader-format').textContent=card.occasion;
    enlarged=false;viewport.classList.remove('is-enlarged');zoomButton.setAttribute('aria-pressed','false');zoomButton.textContent='Enlarge card ⊕';
    const original=document.querySelector('#event-reader-original');original.href=card.originalUrl;original.hidden=!card.originalUrl;
    document.querySelector('.event-reader-demo').textContent=card.original?'Original card shared by the foundation team':'Sample greeting · not an original message from Swamiji';
    coverChooser.replaceChildren();coverField.hidden=!card.coverOptions?.length;
    (card.coverOptions||[]).forEach((c,i)=>{const option=el('option',c.label);option.value=String(i);coverChooser.append(option);});coverChooser.value=String(card.coverIndex||0);
    render();dialog.showModal();document.body.classList.add('event-reader-open');
    if(card.type==='folded') {
      if(reduced.matches){step=1;render();}
      else turnTimer=setTimeout(()=>turn(1),180);
    }
  }
  function closeReader(){clearTimeout(turnTimer);dialog.close();}
  document.querySelector('#event-reader-close').addEventListener('click',closeReader);
  document.querySelector('#event-reader-back').addEventListener('click',closeReader);
  previous.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));
  paper.addEventListener('click',e=>{if(!enlarged&&e.target.closest('.greeting-paper'))turn(1);});
  coverChooser.addEventListener('change',()=>{const card=samples[selected],index=Number(coverChooser.value),choice=card.coverOptions[index];if(!choice)return;clearTimeout(turnTimer);busy=false;card.coverIndex=index;card.sheets=choice.sheets;card.cover=choice.cover;const preview=collection.children[selected].querySelector('.gallery-original-cover');if(preview)preview.src=choice.cover;step=0;render();});
  zoomButton.addEventListener('click',()=>{enlarged=!enlarged;viewport.classList.toggle('is-enlarged',enlarged);zoomButton.setAttribute('aria-pressed',String(enlarged));zoomButton.textContent=enlarged?'Fit card ⊖':'Enlarge card ⊕';controls();});
  dialog.addEventListener('close',()=>{clearTimeout(turnTimer);busy=false;document.body.classList.remove('event-reader-open');returnFocus?.focus({preventScroll:true});hovered=collection.matches(':hover')||!!collection.querySelector(':focus-visible');setRotation(rotating);});
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeReader();});
  dialog.addEventListener('keydown',e=>{
    if(['ArrowRight','ArrowLeft','PageDown','PageUp',' '].includes(e.key)){
      if(e.key===' '&&e.target.tagName==='BUTTON')return;
      e.preventDefault();turn(['ArrowLeft','PageUp'].includes(e.key)?-1:1);
    }
  });
  let wheelTotal=0,wheelTime=0;
  viewport.addEventListener('wheel',e=>{
    if(enlarged||Math.abs(e.deltaY)<Math.abs(e.deltaX)||e.ctrlKey)return;
    e.preventDefault();if(busy)return;
    const now=Date.now();if(now-wheelTime>220)wheelTotal=0;wheelTime=now;wheelTotal+=e.deltaY;
    if(Math.abs(wheelTotal)>65){turn(wheelTotal>0?1:-1);wheelTotal=0;}
  },{passive:false});
  let touch=null;
  viewport.addEventListener('touchstart',e=>{if(!enlarged&&e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  viewport.addEventListener('touchend',e=>{
    if(enlarged||!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))>45)turn(Math.abs(dx)>Math.abs(dy)?(dx<0?1:-1):(dy<0?1:-1));touch=null;
  },{passive:true});
  setRotation(rotating);
  const requested = new URLSearchParams(location.search).get('open');
  const initial=samples.findIndex(card=>card.id===requested || '#'+card.id===location.hash);
  select(initial>=0?initial:0);setRotation(rotating);
  if (requested && initial >= 0) { setRotation(false); openReader(collection.children[initial]); }
})();
