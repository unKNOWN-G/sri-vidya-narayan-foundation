(() => {
  'use strict';
  const get = (key, fallback) => { try { const value=JSON.parse(localStorage.getItem(key)); return value && typeof value==='object' && !Array.isArray(value) ? value : fallback; } catch (_) { return fallback; } };
  const put = (key, value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch (_) {} };
  const progressKey='svnf-satsang-progress', settingsKey='svnf-satsang-display', savedKey='svnf-satsang-saved';
  function minutes(item) {
    const text=[item.title,item.lead,...(item.essence||[]),...(item.summary||[]),...(item.practices||[]).flatMap(p=>[p.title,p.text]),item.question].filter(Boolean).join(' ');
    return Math.max(1,Math.ceil(text.split(/\s+/).length/200));
  }
  function mount({root,item,entries,escape:esc,dateLabel,editorialNote}) {
    const storage=get(settingsKey,{}), positions=get(progressKey,{}), saved=get(savedKey,{});
    const settings={size:Math.max(18,Math.min(28,Number(storage.size)||20)),font:storage.font==='sans'?'sans':'serif',spacing:storage.spacing==='airy'?'airy':'normal',paper:['paper','warm','night'].includes(storage.paper)?storage.paper:'paper'};
    let fraction=Math.max(0,Math.min(1,Number(positions[item.id])||0)), page=0, pages=1, stride=0, frame=0, alive=true, ready=false;
    const at=entries.findIndex(e=>e.id===item.id), controller=new AbortController();
    const paras=values=>(Array.isArray(values)?values:[values]).filter(Boolean).map(text=>`<p>${esc(text)}</p>`).join('');
    const bookmark='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    root.innerHTML=`<section class="view satsang-reading" data-reading-paper="${settings.paper}"><header class="satsang-reading-top"><div><span class="reading-series">Satsang</span><time datetime="${esc(item.date)}">${dateLabel(item.date)}</time></div><div class="reading-tools"><button type="button" class="reading-save" aria-label="Save this Satsang" aria-pressed="false">${bookmark}</button><details class="reading-display"><summary aria-label="Reading appearance">Aa</summary><div class="reading-display-panel"><div class="reading-setting-title"><strong>Make it yours</strong><button type="button" data-close-appearance aria-label="Close reading appearance">×</button></div><div class="reading-size-control"><button type="button" data-size="-1" aria-label="Smaller reading text">A−</button><output class="reading-size-value"></output><button type="button" data-size="1" aria-label="Larger reading text">A+</button></div><fieldset><legend>Typeface</legend><button type="button" data-font="serif">Serif</button><button type="button" data-font="sans">Sans</button></fieldset><fieldset><legend>Line spacing</legend><button type="button" data-spacing="normal">Comfortable</button><button type="button" data-spacing="airy">Airy</button></fieldset><fieldset><legend>Paper</legend><button type="button" data-paper="paper">Light</button><button type="button" data-paper="warm">Warm</button><button type="button" data-paper="night">Night</button></fieldset><p>Your preferences and reading place stay on this device.</p></div></details></div></header><div class="satsang-paper"><div class="satsang-page-window" tabindex="0" role="region" aria-label="Satsang reading pages"><article class="satsang-flow"><section><p class="reading-edition" data-chapter="begin">AN EDITED SATSANG REFLECTION</p><h1>${esc(item.title)}</h1><p class="reading-deck">${esc(item.lead||'')}</p>${item.essence?.length?`<h2>The essence</h2><ul>${item.essence.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:''}</section><section class="satsang-reading-chapter"><h2 data-chapter="reflection">The reflection</h2>${paras(item.summary)}</section><section class="satsang-reading-chapter"><h2 data-chapter="practice">Bring it into your day</h2>${(item.practices||[]).map(p=>`<h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>`).join('')}${item.question?`<div class="reading-question"><h3>A moment to reflect</h3><p>${esc(item.question)}</p></div>`:''}<p class="reading-source">${esc(editorialNote||'An edited reflection from the Satsang collection; not a verbatim transcript.')}</p><nav class="reading-other-satsangs" aria-label="Continue with another Satsang">${at>0?`<a href="#/read/readings/${esc(entries[at-1].id)}">Previous Satsang · ${dateLabel(entries[at-1].date)}</a>`:''}${at<entries.length-1?`<a href="#/read/readings/${esc(entries[at+1].id)}">Next Satsang · ${dateLabel(entries[at+1].date)}</a>`:''}<a href="#/library/readings/${esc(item.id)}">Back to Satsangs</a></nav></section></article></div></div><div class="satsang-reading-bottom"><nav class="reading-chapters" aria-label="Parts of this Satsang"><button type="button" data-go-chapter="begin">Begin</button><button type="button" data-go-chapter="reflection">Reflection</button><button type="button" data-go-chapter="practice">Practice</button></nav><label class="reading-progress-label"><span class="sr-only">Reading progress</span><input class="reading-page-range" type="range" min="0" max="0" value="0" step="1" aria-label="Reading progress"></label><div class="reading-position"><span class="reading-page-number" aria-live="polite"></span><span class="reading-time-left"></span></div><p class="sr-only" id="satsang-page-help">Swipe or drag to turn a page. Use the progress bar, chapter labels, arrow keys or Page Up and Page Down.</p></div></section>`;
    const view=root.querySelector('.satsang-reading'), viewport=view.querySelector('.satsang-page-window'), flow=view.querySelector('.satsang-flow'), range=view.querySelector('.reading-page-range'), appearance=view.querySelector('.reading-display'), save=view.querySelector('.reading-save');
    viewport.setAttribute('aria-describedby','satsang-page-help');
    const listen=(target,name,fn,options={})=>target.addEventListener(name,fn,{...options,signal:controller.signal});
    function bookmarkState() { const active=!!saved[item.id];save.setAttribute('aria-pressed',String(active));save.setAttribute('aria-label',active?'Remove saved Satsang':'Save this Satsang');save.title=active?'Saved Satsang':'Save this Satsang'; }
    function chapterPage(name) { const node=flow.querySelector(`[data-chapter="${name}"]`);return Math.max(0,Math.min(pages-1,Math.floor((node.getBoundingClientRect().left-flow.getBoundingClientRect().left+1)/stride))); }
    function remember() { put(progressKey,{...get(progressKey,{}),[item.id]:fraction}); }
    function go(next,animate=true,persist=true) {
      const before=page;page=Math.max(0,Math.min(pages-1,Number(next)||0));fraction=pages>1?page/(pages-1):0;
      flow.style.transform=`translateX(${-page*stride}px)`;
      range.value=String(page);range.style.setProperty('--reading-progress',`${fraction*100}%`);range.setAttribute('aria-valuetext',`Page ${page+1} of ${pages}`);
      view.querySelector('.reading-page-number').textContent=`Page ${page+1} of ${pages} · ${Math.round(fraction*100)}%`;
      view.querySelector('.reading-time-left').textContent=page===pages-1?'Last page':`${Math.max(1,Math.ceil(minutes(item)*(1-fraction)))} min left`;
      const chapter=page>=chapterPage('practice')?'practice':page>=chapterPage('reflection')?'reflection':'begin';
      view.querySelectorAll('[data-go-chapter]').forEach(button=>button.setAttribute('aria-current',button.dataset.goChapter===chapter?'page':'false'));
      if(animate&&before!==page&&!matchMedia('(prefers-reduced-motion: reduce)').matches)viewport.animate([{opacity:.5,translate:`${page>before?'12px':'-12px'} 0`},{opacity:1,translate:'0 0'}],{duration:250,easing:'ease-out'});
      const bounds=viewport.getBoundingClientRect();
      flow.querySelectorAll('a').forEach(link=>{const rect=link.getBoundingClientRect();link.tabIndex=rect.left>=bounds.left-1 && rect.right<=bounds.right+1 ? 0 : -1;});
      if(persist)remember();
    }
    function layout() {
      if(!alive||viewport.clientWidth<1||viewport.clientHeight<1)return;
      const keep=fraction,width=viewport.clientWidth;view.style.setProperty('--satsang-page-width',`${width}px`);flow.style.transform='none';
      stride=width+48;pages=Math.max(1,Math.ceil((flow.scrollWidth+48-1)/stride));range.max=String(pages-1);
      go(Math.round(keep*Math.max(0,pages-1)),false,false);ready=true;view.classList.add('reading-ready');
    }
    function queueLayout() {cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
    function apply() {
      view.dataset.readingPaper=settings.paper;view.style.setProperty('--satsang-reading-size',`${settings.size}px`);view.style.setProperty('--satsang-reading-leading',settings.spacing==='airy'?'1.95':'1.7');view.style.setProperty('--satsang-reading-font',settings.font==='sans'?'var(--sans)':'Georgia, "Times New Roman", serif');
      view.querySelector('.reading-size-value').textContent=`${settings.size} px`;
      view.querySelectorAll('[data-font],[data-spacing],[data-paper]').forEach(button=>{const key=button.hasAttribute('data-font')?'font':button.hasAttribute('data-spacing')?'spacing':'paper';button.setAttribute('aria-pressed',String(button.dataset[key]===settings[key]));});
      view.querySelector('[data-size="-1"]').disabled=settings.size<=18;view.querySelector('[data-size="1"]').disabled=settings.size>=28;
      put(settingsKey,settings);queueLayout();
    }
    listen(range,'input',()=>go(Number(range.value)));
    listen(view,'click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button===save){if(saved[item.id])delete saved[item.id];else saved[item.id]=true;put(savedKey,saved);bookmarkState();return;}
      if(button.hasAttribute('data-go-chapter')){go(chapterPage(button.dataset.goChapter));return;}
      if(button.hasAttribute('data-close-appearance')){appearance.open=false;appearance.querySelector('summary').focus();return;}
      if(button.dataset.size)settings.size=Math.max(18,Math.min(28,settings.size+Number(button.dataset.size)));
      if(button.dataset.font)settings.font=button.dataset.font;
      if(button.dataset.spacing)settings.spacing=button.dataset.spacing;
      if(button.dataset.paper)settings.paper=button.dataset.paper;
      apply();
    });
    listen(document,'pointerdown',event=>{if(appearance.open&&!appearance.contains(event.target))appearance.open=false;});
    listen(document,'keydown',event=>{
      if(!view.contains(event.target))return;
      if(event.key==='Escape'&&appearance.open){event.preventDefault();event.stopImmediatePropagation();appearance.open=false;appearance.querySelector('summary').focus();return;}
      if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,button,summary,.reading-display'))return;
      if(event.key==='Home'||event.key==='End'){event.preventDefault();go(event.key==='Home'?0:pages-1);return;}
      const direction=['ArrowRight','PageDown',' '].includes(event.key)?1:['ArrowLeft','PageUp'].includes(event.key)?-1:0;
      if(direction){event.preventDefault();go(page+direction);}
    },{capture:true});
    const releaseSwipe=window.foundationGestures.bindSwipe(viewport,{surface:flow,onSwipe:direction=>go(page+direction)});
    const observer=new ResizeObserver(queueLayout);observer.observe(viewport);
    document.fonts?.ready.then(()=>{if(alive)queueLayout();});
    bookmarkState();apply();
    return ()=>{if(ready)remember();alive=false;cancelAnimationFrame(frame);observer.disconnect();releaseSwipe();controller.abort();};
  }
  window.foundationSatsangReader={mount,minutes,isSaved:id=>!!get(savedKey,{})[id],position:id=>Math.max(0,Math.min(1,Number(get(progressKey,{})[id])||0))};
})();
