(() => {
  'use strict';
  const lessons = window.pearlsOfWisdom;
  if (!Array.isArray(lessons) || !lessons.length) return;
  const $ = id => document.getElementById(id);
  const storageKey = 'svnf-pearls-reader-v1';
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) {}
  let index = 0, opened = false, onlySaved = false, turnTimer, toastTimer;
  let size = Math.min(1.35, Math.max(.85, Number(stored.size) || 1));
  let theme = ['paper', 'sepia', 'night'].includes(stored.theme) ? stored.theme : 'paper';
  const saved = new Set((Array.isArray(stored.saved) ? stored.saved : []).filter(n => Number.isInteger(n) && n >= 1 && n <= lessons.length));
  const last = Number.isInteger(stored.index) ? Math.min(lessons.length - 1, Math.max(0, stored.index)) : null;
  let resumeAt = last;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify({index, size, theme, saved: [...saved]})); } catch (_) {} };
  function toast(message) { $('reader-toast').textContent = message; $('reader-toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('reader-toast').classList.remove('visible'), 2200); }
  function appearance() {
    document.body.dataset.theme = theme;
    document.documentElement.style.setProperty('--type-scale', size);
    $('text-size').value = Math.round(size * 100) + '%';
    $('text-smaller').disabled = size <= .85;
    $('text-larger').disabled = size >= 1.35;
    document.querySelectorAll('[data-theme-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === theme)));
  }
  function render(direction = 0) {
    const lesson = lessons[index], number = index + 1;
    $('pearl-label').textContent = 'PEARL ' + String(number).padStart(3, '0');
    $('paper-position').textContent = String(number).padStart(3, '0') + ' / ' + lessons.length;
    $('printed-page').textContent = number;
    const text = $('pearl-text'); text.replaceChildren();
    lesson.text.split('\n\n').forEach(paragraph => {
      const p = document.createElement('p');
      paragraph.split('\n').forEach((line, i) => { if (i) p.append(document.createElement('br')); p.append(document.createTextNode(line)); });
      text.append(p);
    });
    text.classList.toggle('long', lesson.text.split(/\s+/).length > 32 || lesson.text.split('\n').length > 6);
    $('reading-position').textContent = 'Lesson ' + number + ' of ' + lessons.length;
    $('reading-progress').value = number;
    $('reading-progress').setAttribute('aria-valuetext', 'Lesson ' + number + ' of ' + lessons.length);
    $('previous-pearl').disabled = index === 0;
    $('next-pearl').disabled = index === lessons.length - 1;
    const isSaved = saved.has(number);
    $('save-pearl').setAttribute('aria-pressed', String(isSaved));
    $('save-pearl').setAttribute('aria-label', isSaved ? 'Remove lesson bookmark' : 'Bookmark this lesson');
    $('save-pearl').querySelector('span').textContent = isSaved ? 'Saved' : 'Save';
    $('end-note').hidden = index !== lessons.length - 1;
    const page = $('pearl-page'); page.classList.remove('page-enter-next', 'page-enter-prev');
    clearTimeout(turnTimer);
    if (direction && !reduced) { requestAnimationFrame(() => page.classList.add(direction > 0 ? 'page-enter-next' : 'page-enter-prev')); turnTimer = setTimeout(() => page.classList.remove('page-enter-next', 'page-enter-prev'), 550); }
    try { history.replaceState(null, '', '#pearl-' + number); } catch (_) {}
    persist();
  }
  function openBook(at = 0, animate = false) {
    index = Math.max(0, Math.min(lessons.length - 1, at));
    const reveal = () => { $('book-welcome').hidden = true; $('reading-room').hidden = false; opened = true; render(); $('pearl-page').focus({preventScroll: true}); window.scrollTo({top: 0, behavior: 'instant'}); };
    if (animate && !reduced) { $('cover-open').classList.add('opening'); setTimeout(reveal, 500); } else reveal();
  }
  function go(at) { if (at < 0 || at >= lessons.length || at === index) return; const direction = at - index; index = at; render(direction); }
  function contents() {
    const query = $('lesson-search').value.trim().toLocaleLowerCase();
    const matches = lessons.filter((l, i) => (!onlySaved || saved.has(i + 1)) && (!query || (l.text + ' ' + (i + 1)).toLocaleLowerCase().includes(query)));
    const list = $('contents-list'); list.replaceChildren();
    matches.forEach(lesson => {
      const li = document.createElement('li'), button = document.createElement('button'), number = document.createElement('span');
      number.textContent = String(lesson.number).padStart(3, '0');
      button.append(number, document.createTextNode(lesson.text.replace(/\n/g, ' ').slice(0, 110) + (lesson.text.length > 110 ? '…' : '')));
      button.type = 'button'; button.setAttribute('aria-current', String(index === lesson.number - 1));
      button.addEventListener('click', () => { $('contents-dialog').close(); go(lesson.number - 1); $('pearl-page').focus({preventScroll:true}); });
      li.append(button); list.append(li);
    });
    $('result-count').textContent = matches.length + (matches.length === 1 ? ' lesson' : ' lessons');
    $('no-results').hidden = matches.length !== 0;
    if (!matches.length && onlySaved && !query) $('no-results').textContent = 'No saved pearls yet. Use Save on a lesson to keep it here.';
    else $('no-results').textContent = 'No matching lessons. Try another word.';
  }
  $('begin-reading').addEventListener('click', () => openBook(0, true));
  $('cover-open').addEventListener('click', () => openBook(0, true));
  if (last !== null) { $('resume-reading').hidden = false; $('resume-reading').textContent = 'Continue from pearl ' + (last + 1) + ' →'; }
  $('resume-reading').addEventListener('click', () => openBook(resumeAt ?? 0, true));
  $('close-book').addEventListener('click', () => {
    opened = false; $('reading-room').hidden = true; $('book-welcome').hidden = false; $('cover-open').classList.remove('opening');
    $('resume-reading').hidden = false; $('resume-reading').textContent = 'Continue from pearl ' + (index + 1) + ' →';
    resumeAt = index;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    $('begin-reading').focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
  });
  $('next-pearl').addEventListener('click', () => go(index + 1));
  $('previous-pearl').addEventListener('click', () => go(index - 1));
  $('read-again').addEventListener('click', () => go(0));
  $('reading-progress').addEventListener('input', e => go(Number(e.target.value) - 1));
  $('save-pearl').addEventListener('click', () => { const n = index + 1; if (saved.has(n)) saved.delete(n); else saved.add(n); render(); toast(saved.has(n) ? 'Pearl saved to your collection' : 'Bookmark removed'); });
  $('open-contents').addEventListener('click', () => { contents(); $('contents-dialog').showModal(); $('lesson-search').focus(); });
  $('lesson-search').addEventListener('input', contents);
  $('all-lessons').addEventListener('click', () => { onlySaved = false; $('all-lessons').setAttribute('aria-pressed', 'true'); $('saved-lessons').setAttribute('aria-pressed', 'false'); contents(); });
  $('saved-lessons').addEventListener('click', () => { onlySaved = true; $('all-lessons').setAttribute('aria-pressed', 'false'); $('saved-lessons').setAttribute('aria-pressed', 'true'); contents(); });
  $('text-smaller').addEventListener('click', () => { size = Math.max(.85, Math.round((size - .1) * 100) / 100); appearance(); persist(); });
  $('text-larger').addEventListener('click', () => { size = Math.min(1.35, Math.round((size + .1) * 100) / 100); appearance(); persist(); });
  document.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => { theme = b.dataset.themeChoice; appearance(); persist(); }));
  document.querySelectorAll('.dialog-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $('about-edition').addEventListener('click', () => $('edition-dialog').showModal());
  $('share-pearl').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('Lesson link copied'); } catch (_) { toast('Copy the address from your browser to share this lesson'); } });
  document.addEventListener('keydown', e => {
    if (!opened || document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest('input, textarea, select, summary, details')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(index - 1); }
  });
  let start = null;
  $('pearl-page').addEventListener('touchstart', e => { const t = e.changedTouches[0]; start = {x:t.clientX,y:t.clientY}; }, {passive:true});
  $('pearl-page').addEventListener('touchend', e => { if (!start || window.getSelection()?.toString()) return; const t = e.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1)); start = null; }, {passive:true});
  window.addEventListener('hashchange', () => { const match = location.hash.match(/^#pearl-(\d+)$/); if (match && Number(match[1]) >= 1 && Number(match[1]) <= lessons.length) openBook(Number(match[1]) - 1); });
  appearance();
  const match = location.hash.match(/^#pearl-(\d+)$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= lessons.length) openBook(Number(match[1]) - 1);
})();
