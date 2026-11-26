(() => {
  "use strict";
  const app = document.querySelector("#app"),
    announce = document.querySelector("#announcement");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const sessionValue = key => { try { return sessionStorage.getItem(key); } catch (_) { return null; } };
  const cache = new Map();
  let site,
    routeToken = 0,
    cleanup = () => {},
    activeTheme = "",
    washSide = 0,
    readerSize = 17,
    activeMedia = null,
    mediaRequest = 0;
  const defaultState = {
    page: 0,
    tab: "moments",
    search: "",
    month: "",
    topic: "",
    savedOnly: false,
  };
  const state = { ...defaultState },
    viewStates = new Map();
  let activeScope = "",
    homeCategory = sessionValue("svnf-home-category") || "",
    homePlaying = sessionValue("svnf-home-rotation") !== "paused" && !reduced.matches,
    transitionDirection = 1,
    swipeDeadline = 0;
  const collectionEntries = (data) =>
    Array.isArray(data)
      ? data
      : data.entries ||
        data.readings ||
        data.messages ||
        data.books ||
        data.teachings ||
        data.pearls ||
        [];
  const routeParts = () =>
    location.hash
      .replace(/^#\/?/, "")
      .split("/")
      .filter(Boolean)
      .map((value) => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      });
  function scopeFor(parts) {
    if (parts[0] === "read") return "library/" + parts[1];
    if (
      parts[0] === "message" ||
      (parts[0] === "event" && parts[1]?.startsWith("message-"))
    )
      return "library/messages";
    if (parts[0] === "record") return "category/foundation/records";
    if (parts[0] === "event") {
      const event = site.events.find((e) => e.id === parts[1]);
      return event
        ? "category/" + event.category + "/moments"
        : parts.join("/");
    }
    if (parts[0] === "category")
      return "category/" + parts[1] + "/" + (parts[2] || "moments");
    if (parts[0] === "library") return "library/" + (parts[1] || "readings");
    return parts.join("/") || "home";
  }
  function restoreScope(parts) {
    const key = scopeFor(parts);
    if (key === activeScope) return;
    if (activeScope) viewStates.set(activeScope, { ...state });
    Object.assign(state, defaultState, viewStates.get(key) || {});
    activeScope = key;
  }
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const href = (value) =>
    /^(https?:\/\/|mailto:|tel:|assets\/|#\/|(?:reading-room|message-cards)\.html(?:[?#]|$))/.test(String(value))
      ? esc(value)
      : "#";
  const photo = (src, alt = "", cls = "", position = "") => {
    if (!src) return "";
    const image = site?.imageVariants?.[src], priority = cls.includes("priority");
    return `<img src="${href(src)}" alt="${esc(alt)}" class="${cls}" ${position ? `style="object-position:${esc(position)}"` : ""} ${image ? `width="${image.width}" height="${image.height}" srcset="${image.sources.map(v => href(v.src) + ' ' + v.width + 'w').join(', ')}" sizes="(max-width: 750px) 90vw, 46vw"` : ""} loading="${priority ? "eager" : "lazy"}" ${priority ? 'fetchpriority="high"' : ""} decoding="async">`;
  };
  const getCategory = (id) => site.categories.find((c) => c.id === id);
  const featuredCategories = () =>
    site.homeCards
      ? site.homeCards
          .map(getCategory)
          .filter((c) => c && c.published !== false && c.cover)
      : site.categories.filter((c) => c.published !== false && c.cover);
  const getEvent = (id) => site.events.find((e) => e.id === id);
  const dateLabel = (d) =>
    d
      ? new Date(d + "T12:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
  const formatMoney = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  const paragraphs = (values) =>
    (Array.isArray(values) ? values : [values])
      .filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`)
      .join("");
  function theme(category) {
    const t = category?.theme || site.categories[0].theme;
    if (activeTheme === t.key) return;
    activeTheme = t.key;
    Object.entries({
      paper: t.paper,
      ink: t.ink,
      muted: t.muted,
      accent: t.accent,
      line: t.line,
    }).forEach(([k, v]) => document.body.style.setProperty("--" + k, v));
    washSide = 1 - washSide;
    const layers = document.querySelectorAll(".wash"),
      layer = layers[washSide];
    layer.style.setProperty("--layer-paper", t.paper);
    layer.style.setProperty("--layer-wash", t.wash);
    layer.style.opacity = "1";
    layers[1 - washSide].style.opacity = "0";
    document.body.dataset.theme = t.key;
  }
  async function collection(name) {
    const url = site.collections[name];
    if (!url) throw Error("This collection is not available.");
    if (!cache.has(name)) {
      const request = fetch(url, { cache: "no-cache" })
        .then((r) => {
          if (!r.ok) throw Error("This collection could not be loaded.");
          return r.json();
        })
        .catch((error) => {
          if (cache.get(name) === request) cache.delete(name);
          throw error;
        });
      cache.set(name, request);
    }
    return cache.get(name);
  }
  function heading(title, crumb = "", summary = "") {
    return `<div class="view-heading"><div><h1>${esc(title)}</h1></div>${summary ? `<p class="summary">${esc(summary)}</p>` : ""}</div>`;
  }
  function showError(error) {
    app.innerHTML = `<section class="view"><div class="empty"><div><h1>A moment, please.</h1><p>${esc(error.message || error)}</p><a class="text-link" href="#/">Return to Swamiji’s portraits →</a></div></div></section>`;
  }
  function home() {
    const cats = featuredCategories();
    let current = Math.max(
        0,
        cats.findIndex((c) => c.id === homeCategory),
      ),
      elapsed = 0,
      last = performance.now(),
      playing = homePlaying && !reduced.matches,
      hoverPaused = false,
      idleUntil = 0,
      pointer = null,
      suppress = false;
    app.innerHTML = `<section class="home"><div class="home-intro"><p class="eyebrow">HIS HOLINESS SRI VIDYANARAYANA THIRTHA SWAMIJI</p><h1>A life of wisdom. <em>A world of care.</em></h1></div><div class="portrait-carousel" aria-label="The many sides of Swamiji" aria-roledescription="carousel">${cats.map((c, i) => `<button class="portrait" data-category="${esc(c.id)}" data-index="${i}" aria-label="${esc(c.title + (c.homeMilestone ? " · " + c.homeMilestone : "") + (c.homeContributionTotal ? ` · ${c.homeContributionTotal.approximate ? "approximately " : ""}${formatMoney(c.homeContributionTotal.amount)} recorded support` : ""))}" aria-pressed="${i === 0}" style="--card-accent:${c.theme.accent};--card-paper:${c.theme.surface || "#fffaf1"};--position:${esc(c.position || "50% 35%")}"><div class="portrait-image">${photo(c.cover, c.coverAlt || c.title, i === current ? "priority" : "")}${c.homeContributionTotal ? `<b class="portrait-contribution">${c.homeContributionTotal.approximate ? "≈ " : ""}${formatMoney(c.homeContributionTotal.amount)}<small>recorded support</small></b>` : ""}<span class="portrait-open" aria-hidden="true">Explore →</span></div><div class="portrait-copy"><strong>${esc(c.title)}</strong>${c.homeMilestone ? `<b class="portrait-milestone">${esc(c.homeMilestone)}</b>` : ""}</div></button>`).join("")}</div><div class="home-note"><p id="home-caption"></p><a id="chapter-link" class="home-explore" href="#/">Explore this side <span aria-hidden="true">→</span></a></div><div class="carousel-controls"><button data-home="previous" aria-label="Previous portrait">←</button><nav class="dots" aria-label="Choose a side of Swamiji’s life">${cats.map((c, i) => `<button data-home-index="${i}" aria-label="Show ${esc(c.title)}" aria-pressed="${i === 0}"><span>${esc(c.shortTitle || c.title)}</span></button>`).join("")}</nav><button data-home="next" aria-label="Next portrait">→</button><button class="play" aria-label="Pause automatic rotation" data-home="play">Ⅱ</button></div></section>`;
    const stage = app.querySelector(".portrait-carousel"),
      cards = [...app.querySelectorAll(".portrait")],
      dots = [...app.querySelectorAll(".dots button")],
      play = app.querySelector(".play");
    for (const direction of ["previous","next"]) {
      const arrow=app.querySelector(`[data-home="${direction}"]`); arrow.classList.add("home-arrow", "home-arrow-"+direction); stage.append(arrow);
    }
    let step = 240,
      raf;
    function label() {
      play.setAttribute(
        "aria-label",
        playing ? "Pause automatic rotation" : "Resume automatic rotation",
      );
      play.textContent = playing ? "Ⅱ" : "▷";
    }
    function position() {
      const mobile = innerWidth <= 750;
      cards.forEach((card, i) => {
        let slot = (i - current + cards.length) % cards.length;
        if (slot > cards.length / 2) slot -= cards.length;
        const d = Math.abs(slot),
          visible = d <= (mobile ? 1 : 2);
        card.style.setProperty("--x", `${slot * step}px`);
        card.style.setProperty("--y", `${d ? d * 8 : -5}px`);
        card.style.setProperty("--z", `${d ? -82 * d : 60}px`);
        card.style.setProperty(
          "--ry",
          `${slot ? -Math.sign(slot) * 17 : 0}deg`,
        );
        card.style.setProperty("--rz", `${slot * 3.7}deg`);
        card.style.setProperty(
          "--scale",
          String(d ? Math.max(0.5, 1 - 0.12 * d) : 1),
        );
        card.style.opacity = visible
          ? d === 0
            ? "1"
            : d === 1
              ? ".88"
              : ".47"
          : "0";
        card.style.zIndex = String(12 - d);
        card.style.pointerEvents = visible ? "auto" : "none";
        card.inert = !visible;
        card.tabIndex = i === current ? 0 : -1;
        card.setAttribute("aria-pressed", String(i === current));
        card.classList.toggle("active", i === current);
        dots[i].setAttribute("aria-pressed", String(i === current));
      });
    }
    function revealChoice(animate = false) {
      const choice = dots[current], nav = choice.parentElement;
      if (choice.offsetLeft < nav.scrollLeft || choice.offsetLeft + choice.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollTo({left:choice.offsetLeft-(nav.clientWidth-choice.offsetWidth)/2,behavior:animate&&!reduced.matches?"smooth":"instant"});
    }
    function resize() {
      const mobile = innerWidth <= 750;
      const width = Math.max(
        105,
        Math.min(
          330,
          stage.clientWidth * (mobile ? 0.74 : 0.27),
          (stage.clientHeight - 38) / 1.3,
        ),
      );
      stage.style.setProperty("--portrait-width", width + "px");
      step = width * (mobile ? 0.82 : 0.96);
      position();
      revealChoice();
    }
    function select(index, manual = false) {
      current = (index + cats.length) % cats.length;
      elapsed = 0;
      const c = cats[current];
      homeCategory = c.id;
      try { sessionStorage.setItem("svnf-home-category", c.id); } catch (_) {}
      if (manual) idleUntil = performance.now() + 15000;
      theme(c);
      app.querySelector("#home-caption").textContent = c.caption;
      const entry = app.querySelector("#chapter-link");
      entry.href = c.id === "teachings" ? "#/learn" : "#/category/" + c.id;
      entry.innerHTML = `Explore ${esc(c.shortTitle || c.title)} <span aria-hidden="true">→</span>`;
      position();
      revealChoice(manual);
      if (manual) announce.textContent = c.title + ". " + c.caption;
    }
    cards.forEach((card, i) =>
      card.addEventListener("click", () => {
        if (suppress) {
          suppress = false;
          return;
        }
        if (i === current) {
          location.hash =
            cats[i].id === "teachings" ? "/learn" : "/category/" + cats[i].id;
        } else select(i, true);
      }),
    );
    dots.forEach((dot, i) =>
      dot.addEventListener("click", () => select(i, true)),
    );
    app.querySelector("[data-home=previous]").onclick = () =>
      select(current - 1, true);
    app.querySelector("[data-home=next]").onclick = () =>
      select(current + 1, true);
    play.onclick = () => {
      playing = !playing;
      homePlaying = playing;
      if (playing) { hoverPaused = false; idleUntil = 0; }
      try { sessionStorage.setItem("svnf-home-rotation", playing ? "playing" : "paused"); } catch (_) {}
      elapsed = 0;
      label();
    };
    const key = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        select(current + 1, true);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        select(current - 1, true);
      }
    };
    document.addEventListener("keydown", key);
    stage.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType !== "mouse") pointer = { x: e.clientX, y: e.clientY };
      },
      { passive: true },
    );
    stage.addEventListener("pointercancel", () => (pointer = null));
    stage.addEventListener("pointerup", (e) => {
      if (!pointer) return;
      const x = e.clientX - pointer.x,
        y = e.clientY - pointer.y;
      pointer = null;
      if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.3) {
        suppress = true;
        setTimeout(() => (suppress = false), 400);
        select(current + (x < 0 ? 1 : -1), true);
        e.preventDefault();
      }
    });
    const interaction = app.querySelector(".home");
    interaction.addEventListener("pointerenter", () => { hoverPaused = true; });
    interaction.addEventListener("pointerleave", () => { hoverPaused = false; idleUntil = performance.now() + 4000; });
    interaction.addEventListener("focusin", () => { hoverPaused = true; });
    interaction.addEventListener("focusout", (e) => { hoverPaused = interaction.contains(e.relatedTarget); idleUntil = performance.now() + 4000; });
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    select(current);
    resize();
    label();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => stage.classList.add("ready")),
    );
    function tick(now) {
      const delta = Math.min(100, now - last);
      last = now;
      if (playing && !reduced.matches && !hoverPaused && performance.now() > idleUntil && !document.hidden) {
        elapsed += delta;
        if (elapsed >= 8000) select(current + 1);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    cleanup = () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("keydown", key);
    };
  }

  const deckMemory = {
    get: key => sessionValue("svnf-choice-" + key),
    set: (key, value) => { try { sessionStorage.setItem("svnf-choice-" + key, value); } catch (_) {} },
  };
  const short = (text, n = 210) =>
    String(text || "").length > n
      ? String(text)
          .slice(0, n)
          .replace(/\s+\S*$/, "") + "…"
      : String(text || "");
  const experienceLinks = () =>
    featuredCategories().map((c) => ({
      title: c.title,
      href: c.id === "teachings" ? "#/learn" : "#/category/" + c.id,
    }));
  const stripPositions = new Map();
  function sceneNavigation(title, links, index) {
    return `<div class="scene-navigation"><nav class="occasion-track" aria-label="${esc(title)}" tabindex="0">${links.map((item, i) => `<a class="occasion-stop" href="${href(item.href)}" ${i === index ? 'aria-current="page"' : ""} aria-label="${esc(`${i + 1}. ${item.title}`)}" title="${esc(item.title)}"><span class="occasion-number">${String(i + 1).padStart(2, "0")}</span><span class="occasion-title">${esc(item.title)}</span></a>`).join("")}</nav><span class="strip-count sr-only">${index + 1} / ${links.length}</span></div>`;
  }
  function bindSceneNavigation() {
    const track = app.querySelector(".occasion-track");
    if (!track) return () => {};
    const key = track.getAttribute("aria-label"),
      active = track.querySelector('[aria-current="page"]');
    track.scrollLeft = stripPositions.get(key) || 0;
    const revealActive = () => {
      if (active && (active.offsetLeft < track.scrollLeft || active.offsetLeft + active.offsetWidth > track.scrollLeft + track.clientWidth))
        track.scrollLeft = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
    };
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(track);
    const wheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || track.scrollWidth <= track.clientWidth) return;
      event.preventDefault();
      track.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 18 : 1);
    };
    const keyboard = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const links = [...track.querySelectorAll("a")],
        current = Math.max(0, links.indexOf(document.activeElement)),
        target = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : Math.max(0, Math.min(links.length - 1, current + (event.key === "ArrowRight" ? 1 : -1)));
      event.preventDefault();
      event.stopPropagation();
      links[target].focus({ preventScroll: true });
      track.scrollTo({ left: links[target].offsetLeft - (track.clientWidth - links[target].offsetWidth) / 2, behavior: reduced.matches ? "instant" : "smooth" });
    };
    track.addEventListener("wheel", wheel, { passive: false });
    track.addEventListener("keydown", keyboard);
    return () => {
      stripPositions.set(key, track.scrollLeft);
      observer.disconnect();
      track.removeEventListener("wheel", wheel);
      track.removeEventListener("keydown", keyboard);
    };
  }
  function goTo(value) {
    const hash = value.startsWith("#") ? value : "#" + value;
    if (activeSpotlight && app.contains(activeSpotlight.root) && activeSpotlight.routes.has(hash)) {
      history.replaceState(history.state, "", hash);
      render();
    } else if (activeMedia && hash.startsWith("#/event/" + activeMedia.id + "/")) {
      history.replaceState(history.state, "", hash);
      render();
    } else location.hash = hash;
  }
  function parentRoute() {
    const parts = routeParts();
    if (parts[0] === "event") {
      const e = getEvent(parts[1]);
      return e ? "#/category/" + e.category + "/moments/" + e.id : "#/explore";
    }
    if (parts[0] === "read") return "#/library/" + parts[1] + (parts[1] === "readings" ? "/" + parts[2] : "");
    if (parts[0] === "library") return "#/learn";
    if (parts[0] === "explore") return "#/";
    if (parts[0] === "category") return "#/";
    if (
      parts[0] === "record" ||
      (parts[0] === "foundation" && parts[1] === "support")
    )
      return app.firstElementChild?.dataset.back || "#/foundation";
    if (parts[0] === "foundation" && parts[1]) return "#/foundation";
    return "#/";
  }
  function bindSequence(previous, next, back) {
    const releaseStrip = bindSceneNavigation();
    const resolve = (value) => (typeof value === "function" ? value() : value);
    const ignored = (e) =>
      e.target.closest?.(
        "input,select,textarea,video,audio,iframe,dialog,.scene-navigation,.moment-ribbon,.satsang-tools,[contenteditable=true]",
      );
    const key = (e) => {
      if (ignored(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        transitionDirection = 1; goTo(resolve(next));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        transitionDirection = -1; goTo(resolve(previous));
      }
      if (e.key === "Escape" && back && !document.querySelector("dialog[open]"))
        location.hash = back;
    };
    const scene = app.querySelector('.deck-scene,.cinema-body') || app;
    const releaseSwipe = window.foundationGestures.bindSwipe(scene, {
      surface:scene.querySelector('.deck-stage,.cinema-stage') || scene,
      ignore:'.scene-navigation,.moment-ribbon,.satsang-tools,.deck-actions',
      onSwipe:direction=>{ transitionDirection=direction; goTo(resolve(direction>0?next:previous)); },
    });
    document.addEventListener("keydown", key);
    cleanup = () => {
      releaseStrip();
      document.removeEventListener("keydown", key);
      releaseSwipe();
      app.querySelectorAll("video,audio").forEach((x) => x.pause());
    };
  }
  // All inner discovery pages share this portrait-and-caption experience.
  let activeSpotlight = null;
  const deckSignature = () => JSON.stringify([state.search, state.month, state.topic, state.savedOnly]);
  function deckEvidence(receipts) {
    const files = receipts.filter(receipt => receipt.src);
    if (!files.length) return "";
    return `<details class="deck-evidence"><summary>Receipts (${files.length})</summary><div class="deck-evidence-content">${files.map(receipt => `<a href="${href(receipt.src)}" target="_blank" rel="noopener"><strong>${formatMoney(receipt.amount)}</strong><span>${esc(receipt.displayDonor || receipt.donor || receipt.publicEvidenceLabel || receipt.evidenceLabel)}${receipt.date ? `<br>${esc(dateLabel(receipt.date))}` : ""} ↗</span></a>`).join("")}</div></details>`;
  }

  // Purposeful line illustrations for practical teachings, rather than repeated portraits.
  function teachingArtwork(visual = "compass", label = "Self-inquiry") {
    const paths = {
      compass:'<circle cx="60" cy="60" r="39"/><path d="m75 42-9 25-24 11 10-26Z"/><circle cx="60" cy="60" r="3"/>',
      people:'<circle cx="44" cy="40" r="11"/><circle cx="79" cy="44" r="9"/><path d="M21 88v-9c0-26 46-26 46 0v9m7-23c16-5 25 5 25 18v5M54 99h38"/>',
      heart:'<path d="M60 91 25 58C3 35 38 10 60 37c22-27 57-2 35 21Z"/>',
      hand:'<path d="M17 88h19l18 9 45-24c8-5 2-14-5-11L68 73H51m-15 15V61h14l12 9c7 6 14-3 7-9L52 47H34m-17 9h17v38H17Z"/><path d="M77 43c-19-13-9-30 0-20 10-10 20 7 0 20Z"/>',
      flame:'<path d="M62 17c7 20 35 31 35 53a37 37 0 0 1-74 0c0-17 10-28 20-39 0 17 8 22 13 25 9-11 9-24 6-39Z"/><path d="M61 63c-27 24-13 39 0 39 16 0 24-16 0-39Z"/>',
      sunrise:'<path d="M17 83h86M32 76a28 28 0 0 1 56 0M60 17v15m-37 3 11 11m63-11L86 46M12 62l15 4m81-4-15 4M32 98h56"/>',
      leaf:'<path d="M30 88C-1 35 68 11 99 21c-1 54-23 88-69 67ZM24 101l51-54M46 78l-4-20m18 5 20 2"/>',
      clock:'<circle cx="60" cy="60" r="39"/><path d="M60 35v28l20 12m-20-54v6m39 33h-6M60 99v-6M21 60h6"/>',
      balance:'<path d="M60 20v78m-22 0h44M25 41l70-9M29 41 14 73h30ZM91 33 76 66h30Z"/><circle cx="60" cy="24" r="5"/>',
      book:'<path d="M60 35c-14-11-29-14-44-10v65c17-4 31-1 44 10 13-11 27-14 44-10V25c-15-4-30-1-44 10Zm0 0v65M28 42c8 0 14 2 21 5m-21 9c8 0 14 2 21 5m22-14c7-3 13-5 21-5m-21 19c7-3 13-5 21-5"/>',
      speech:'<path d="M23 26h74v54H57L33 98V80H23Zm16 18h42M39 60h28"/>',
      steps:'<path d="M16 100h22V77h22V54h22V31h22M31 49l8-16 16 8m-16-8L23 64"/>',
      lotus:'<path d="M60 20C36 43 36 66 60 86c24-20 24-43 0-66Zm-3 66C26 87 17 64 19 43c18 2 29 10 35 23m9 20c31 1 40-22 38-43-18 2-29 10-35 23M29 99h62"/>',
      knot:'<path d="m51 74-9 9a20 20 0 0 1-28-28l21-21a20 20 0 0 1 28 0m6 12 9-9a20 20 0 0 1 28 28L85 86a20 20 0 0 1-28 0M42 76l36-36"/>',
      waves:'<path d="M17 36c14-16 29 16 43 0s29 16 43 0M17 60c14-16 29 16 43 0s29 16 43 0M17 84c14-16 29 16 43 0s29 16 43 0"/>',
    };
    return `<div class="teaching-art art-${esc(visual)}"><span>EVERYDAY WISDOM</span><svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[visual] || paths.compass}</svg><em>${esc(label)}</em></div>`;
  }

  function satsangEdition(item) {
    const resume=window.foundationSatsangReader.position(item.id),cover=getCategory('teachings').cover;
    const portrait=site.imageVariants?.[cover]?.sources?.[0]?.src || cover;
    return `<div class="satsang-edition ${item.title.length>65?'long-title':''}"><div class="satsang-edition-top"><time datetime="${esc(item.date)}">${dateLabel(item.date)}</time><span>${item.readMinutes} min</span></div><h3>${esc(item.title)}</h3><div class="satsang-edition-author"><img src="${href(portrait)}" alt="" loading="lazy"><span>Reflections from<br>Swamiji’s Satsangs</span></div><span class="satsang-edition-action">${resume>0?'Continue reading · '+Math.round(resume*100)+'%':'Begin reading'} →</span></div>`;
  }

  function sectionSpotlight({ key, title, items, index = 0, back = "#/", header = "", className = "", wrap = true, onSelect = () => {} }) {
    if (!items.length) return;
    let current = Math.max(0, Math.min(index, items.length - 1));
    let rotating = items.length > 1 && sessionValue("svnf-deck-motion-" + key) !== "paused" && !reduced.matches;
    let interacting = false, timer;
    const routeAt = (delta) => {
      const at = current + delta;
      return wrap ? items[(at + items.length) % items.length].route : items[Math.max(0, Math.min(items.length - 1, at))].route;
    };
    const picture = (item, at) => item.kind === "satsang" ? satsangEdition(item) : item.visual ? teachingArtwork(item.visual, item.visualLabel) : item.cover ? photo(item.cover, item.alt || item.title, at === current ? "priority" : "") : `<div class="deck-thought"><span>${esc(item.kicker || "A MOMENT TO REFLECT")}</span><strong>${esc(item.title)}</strong></div>`;
    app.innerHTML = `<section class="view section-spotlight ${className}" data-back="${esc(back)}" data-deck-session="${performance.now()}"><div class="deck-header">${header || `<h1>${esc(title)}</h1>`}<button class="deck-rotation" type="button"></button></div><div class="deck-scene"><div class="deck-stage" aria-label="${esc(title)}" aria-roledescription="carousel">${items.map((item, at) => `<button type="button" class="deck-card" data-deck-index="${at}" style="--image-ratio:${item.kind === "satsang" ? .8 : item.visual ? .84 : item.kind === "book" || !item.cover ? .72 : site.imageVariants?.[item.cover] ? Math.max(.52, Math.min(2.5, site.imageVariants[item.cover].width / site.imageVariants[item.cover].height)) : .78}"><div class="deck-picture">${Math.abs(at-current) <= 1 || (current === 0 && at === items.length-1) ? picture(item, at) : ""}</div>${item.badge ? `<span class="deck-date">${esc(item.badge)}</span>` : ""}<span class="deck-preview-label">${esc(item.title)}</span><span class="deck-card-open" aria-hidden="true"></span></button>`).join("")}</div><div class="deck-caption spotlight-caption"></div></div>${sceneNavigation(title, items.map(item => ({title:item.title, href:item.route})), current)}</section>`;
    const root = app.querySelector(".section-spotlight"), stage = root.querySelector(".deck-stage"), cards = [...root.querySelectorAll(".deck-card")], caption = root.querySelector(".deck-caption"), rotation = root.querySelector(".deck-rotation");
    root.classList.toggle("deck-single", items.length === 1);
    root.querySelector(".scene-navigation").append(rotation);
    root.querySelector(".strip-count").classList.add("sr-only");
    function controls() {
      rotation.hidden = items.length < 2;
      rotation.textContent = rotating ? "Ⅱ" : "▷";
      rotation.setAttribute("aria-label", rotating ? "Pause section rotation" : "Resume section rotation");
      rotation.setAttribute("aria-pressed", String(rotating));
    }
    function setRotation(value) {
      rotating = value && !reduced.matches;
      try { sessionStorage.setItem("svnf-deck-motion-" + key, rotating ? "playing" : "paused"); } catch (_) {}
      if (rotating) interacting = false;
      controls(); schedule();
    }
    function schedule() {
      clearInterval(timer);
      if(rotating) timer=setInterval(()=>{if(interacting||document.hidden||root.querySelector("details[open]")||document.querySelector("dialog[open]"))return;if(!wrap&&current===items.length-1){setRotation(false);return;}goTo(routeAt(1));},11000);
    }
    function resize() { stage.style.setProperty("--card-height", Math.max(110, Math.min(350, stage.clientHeight - 24)) + "px"); }
    function show(at, initial = false) {
      const focusCard = document.activeElement?.matches(".deck-card:focus-visible");
      current = at;
      const item = items[current];
      if (item.theme) theme(item.theme);
      onSelect(item, current);
      root.style.setProperty("--active-ratio", cards[current].style.getPropertyValue("--image-ratio"));
      cards.forEach((card, i) => {
        let offset = (i - current + items.length) % items.length;
        if (offset > items.length / 2) offset -= items.length;
        const position = offset === 0 ? "front" : offset === -1 ? "left" : offset === 1 ? "right" : "hidden";
        card.dataset.position = position;
        card.querySelector(".deck-card-open").textContent = i===current ? (item.action?.startsWith("Read") ? "Read →" : item.target ? "Open →" : "Receipts →") : "";
        card.inert = position === "hidden";
        card.tabIndex = position === "front" ? 0 : -1;
        card.setAttribute("aria-pressed", String(i === current));
        card.setAttribute("aria-label", (i === current ? (item.action || "Open") + ": " : "Show ") + items[i].title);
        if (position !== "hidden" && !card.querySelector(".deck-picture").children.length) card.querySelector(".deck-picture").innerHTML = picture(items[i], i);
      });
      if (focusCard) cards[current].focus({preventScroll:true});
      caption.innerHTML = `${item.kicker ? `<p class="deck-kicker">${esc(item.kicker)}</p>` : ""}<h2>${esc(item.title)}</h2>${item.description ? `<p class="deck-description">${esc(item.description)}</p>` : ""}${item.fact ? `<strong class="deck-fact ${item.cash ? "cash-fact" : ""}">${esc(item.fact)}</strong>` : ""}${item.meta ? `<p class="deck-meta">${esc(item.meta)}</p>` : ""}<div class="deck-actions">${item.evidence || ""}</div>${item.note ? `<p class="deck-source-note">${esc(item.note)}</p>` : ""}`;
      const choices = [...root.querySelectorAll(".occasion-stop")];
      choices.forEach((choice, i) => { if (i === current) choice.setAttribute("aria-current", "page"); else choice.removeAttribute("aria-current"); });
      const active = choices[current], track = root.querySelector(".occasion-track");
      if (active && (active.offsetLeft < track.scrollLeft || active.offsetLeft + active.offsetWidth > track.scrollLeft + track.clientWidth)) track.scrollTo({left:active.offsetLeft-(track.clientWidth-active.offsetWidth)/2,behavior:initial||reduced.matches?"instant":"smooth"});
      root.querySelector(".strip-count").textContent = `${current+1} / ${items.length}`;
      if (!initial && !reduced.matches) caption.animate([{opacity:.35,transform:"translateY(5px)"},{opacity:1,transform:"translateY(0)"}],{duration:280,easing:"ease-out"});
      resize();
    }
    root.addEventListener("click", event => {
      const choice = event.target.closest(".occasion-stop");
      if (choice) { event.preventDefault(); setRotation(false); goTo(choice.getAttribute("href")); return; }
      const card = event.target.closest(".deck-card");
      if (card) {
        setRotation(false);
        const at = Number(card.dataset.deckIndex), item = items[at];
        if (at !== current) goTo(item.route);
        else if (item.target) { if (item.target.startsWith("#")) goTo(item.target); else location.href = item.target; }
        else { const details=caption.querySelector("details"); if(details) {details.open=!details.open;details.querySelector("summary").focus();} }
      } else if (event.target.closest(".occasion-stop,.deck-open,details")) setRotation(false);
    });
    root.addEventListener("pointerdown", event => { if (!event.target.closest(".deck-rotation")) setRotation(false); });
    rotation.addEventListener("click", () => setRotation(!rotating));
    root.addEventListener("pointerenter", () => { interacting = true; });
    root.addEventListener("pointerleave", () => { interacting = false; });
    root.addEventListener("focusin", event => { if(event.target!==rotation && event.target.closest("button,a,input,select,summary")) interacting=true; });
    root.addEventListener("focusout", event => { interacting=root.contains(event.relatedTarget); });
    const observer = new ResizeObserver(resize); observer.observe(stage);
    const motion = () => { if(reduced.matches) setRotation(false); }; reduced.addEventListener("change", motion);
    show(current, true); controls(); requestAnimationFrame(() => root.classList.add("deck-ready"));
    schedule();
    bindSequence(()=>routeAt(-1),()=>routeAt(1),back);
    const release=cleanup, deck={root,signature:deckSignature(),routes:new Map(items.map((item,i)=>[item.route,i])),show};
    activeSpotlight=deck;
    cleanup=()=>{release();clearInterval(timer);observer.disconnect();reduced.removeEventListener("change",motion);if(activeSpotlight===deck)activeSpotlight=null;};
  }

  function explore(selected) {
    const cats = featuredCategories();
    let index = Math.max(
      0,
      cats.findIndex((c) => c.id === (selected || deckMemory.get("explore"))),
    );
    const c = cats[index],
      after = cats[(index + 1) % cats.length];
    deckMemory.set("explore", c.id);
    theme(c);
    const prev =
        "#/explore/" + cats[(index - 1 + cats.length) % cats.length].id,
      next = "#/explore/" + after.id,
      target = c.id === "teachings" ? "#/learn" : "#/category/" + c.id;
    sectionSpotlight({key:"explore",title:"His Life in Action",back:"#/",index,items:cats.map(c=>({id:c.id,title:c.title,description:c.caption,cover:c.cover,alt:c.coverAlt,route:"#/explore/"+c.id,target:c.id==="teachings"?"#/learn":"#/category/"+c.id,action:c.id==="teachings"?"Learn from Swamiji":"Explore this side",fact:c.homeMilestone||"",theme:c})),onSelect:item=>deckMemory.set("explore",item.id)});
  }

  async function category(id, selectedTab, selectedId) {
    const c = getCategory(id);
    if (!c) throw Error("This part of his life is not available.");
    if (id === "teachings") {
      location.replace("#/learn");
      return;
    }
    if (id === "foundation" && selectedTab === "records") {
      await supportView();
      return;
    }
    if (id === "foundation" && selectedTab === "about") {
      foundationView();
      return;
    }
    theme(c);
    if (id === "education") {
      await educationView(selectedId);
      return;
    }
    const events = site.events
      .filter((e) => e.category === id && e.published !== false)
      .sort(
        (a, b) =>
          (c.eventIds?.indexOf(a.id) ?? 1000) -
          (c.eventIds?.indexOf(b.id) ?? 1000),
      );
    if (!events.length) {
      app.innerHTML = `<section class="view">${heading(c.title)}<p>This story is being prepared.</p></section>`;
      return;
    }
    let index = Math.max(
      0,
      events.findIndex((e) => e.id === (selectedId || deckMemory.get(id))),
    );
    const base = "#/category/" + id + "/moments/";
    const token=routeToken, ledger=events.some(e=>e.presentation==="service-story")?await collection("contributions"):null;
    if(token!==routeToken)return;
    sectionSpotlight({key:"category/"+id,title:c.title,back:"#/",index,items:events.map(e=>{
      const first=ledger?.records.find(r=>e.supportRecordIds?.includes(r.id)),support=first?contributionScenes(ledger,first.category).find(r=>r.receipts.some(receipt=>receipt.id===first.id)):null;
      return {id:e.id,title:e.frontTitle||e.title,description:e.cardDescription||e.description.split(/(?<=[.!?])\s/)[0],cover:e.cover,alt:e.coverAlt||e.title,route:base+e.id,
        target:support?"":"#/event/"+e.id,action:e.id==="swamiji-stuti"?"Read the Stuti":support?"View receipts":"View photographs",
        meta:e.cardMeta||[e.location,e.date?dateLabel(e.date):e.year].filter(Boolean).join(" · "),
        fact:support?(support.approximate?"≈ ":"")+formatMoney(support.amount):e.id==="portrait-and-journey"?"52 Chaturmasyas completed":"",cash:!!support,evidence:support?deckEvidence(support.receipts):"",
      };
    }),onSelect:item=>deckMemory.set(id,item.id)});
  }

  async function educationView(selected) {
    const token = routeToken;
    const [profiles, ledger] = await Promise.all([
      collection("educationProfiles"),
      collection("contributions"),
    ]);
    if (token !== routeToken) return;
    const c = getCategory("education");
    theme(c);
    const requested = selected || deckMemory.get("education");
    let index = Math.max(
      0,
      profiles.findIndex((p) => p.id === requested || p.eventId === requested),
    );
    const base = "#/category/education/schools/";
    sectionSpotlight({key:"education",title:c.title,back:"#/",index,items:profiles.map(p=>{
      const e=getEvent(p.eventId),rs=p.recordIds.map(id=>ledger.records.find(r=>r.id===id)).filter(Boolean),cash=rs.reduce((n,r)=>n+r.amount,0);
      return {id:p.id,title:p.title,description:p.intro||p.description,cover:p.cover||e?.cover,alt:p.coverAlt||p.title,route:base+p.id,
        target:e?.presentation!=="service-story"?"#/event/"+e.id:"",action:e?.presentation!=="service-story"?"View photographs":"View receipts",
        fact:rs.length?(rs.some(r=>r.approximate||r.reported)?"≈ ":"")+formatMoney(cash):p.contributionText,cash:rs.length>0,
        meta:p.id==="gollapalli"?"Land donated in 2004":p.id==="sgdc-college"?"Madanapalle":"",
        evidence:deckEvidence(rs),
        note:p.photoCaption||"",
      };
    }),onSelect:item=>deckMemory.set("education",item.id)});
  }

  function foundationView(connect = false) {
    const c = getCategory("foundation");
    theme(c);
    if (connect) { contactView(c); return; }
    sectionSpotlight({key:"foundation",title:"The Foundation",back:"#/",items:[{id:"foundation",title:"Sri Vidya Narayan Foundation",description:"Spiritual learning and service, inspired by Swamiji’s life and guidance.",cover:c.cover,route:"#/foundation",target:"#/foundation/connect",action:"Contact the foundation",meta:"Inspired by Swamiji’s example",evidence:'<a class="deck-open" href="#/explore">Service and contributions →</a>'}]});

  }


  function contactView(c) {
    const photos = (site.foundation.contactPhotoCategories || ["education","annadanam","healthcare","vedic-learning"]).map(getCategory).filter(category => category?.published !== false && category?.cover);
    if (!photos.length) photos.push(c);
    const photoScene = `<figure class="contact-portrait contact-slideshow" role="group" aria-roledescription="carousel" aria-label="Swamiji’s life and service in photographs"><div class="contact-photo-stage">${photos.map((category,index) => `<div class="contact-service-slide ${index === 0 ? "is-current" : ""}" aria-hidden="${index !== 0}">${photo(category.cover,category.coverAlt || category.title,index === 0 ? "priority" : "")}</div>`).join("")}</div><figcaption class="contact-photo-caption"><span><strong class="contact-photo-name">${esc(photos[0].shortTitle || photos[0].title)}</strong><small class="contact-photo-count">1 / ${photos.length}</small></span><div class="contact-photo-controls"><button type="button" data-contact-photo="pause" aria-label="Pause service photographs" title="Pause service photographs">Ⅱ</button><button type="button" data-contact-photo="next" aria-label="Next service photograph" title="Next service photograph">→</button></div></figcaption></figure>`;
    app.innerHTML = `<section class="view contact-view"><div class="deck-header"><h1>Connect with the Foundation</h1></div><div class="contact-scene">${photoScene}<article class="contact-copy" aria-labelledby="contact-title"><h2 id="contact-title">Let’s serve together.</h2><p class="contact-intro">For volunteering, current needs or contribution guidance, speak with the foundation team.</p><div class="contact-methods"><a class="contact-method" href="mailto:${esc(site.foundation.email)}"><span>Email</span><strong>${esc(site.foundation.email)}</strong><span class="contact-method-arrow" aria-hidden="true">↗</span></a><a class="contact-method" href="tel:${esc(site.foundation.phone.replace(/[^+\d]/g,""))}"><span>Call the office</span><strong>${esc(site.foundation.phone)}</strong><span class="contact-method-arrow" aria-hidden="true">↗</span></a></div><address class="contact-office"><span>Guruashraya office</span><p>${esc(site.foundation.office.replace(/^Guruashraya office\s*·\s*/,""))}</p></address></article></div></section>`;
    const escape = event => { if(event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); goTo("#/foundation"); } };
    document.addEventListener("keydown",escape);
    const figure = app.querySelector('.contact-slideshow'), panels = [...figure.querySelectorAll('.contact-service-slide')], pause = figure.querySelector('[data-contact-photo="pause"]');
    const controller = new AbortController();
    let current = 0, requested = 0, request = 0, hovered = false, timer;
    let playing = photos.length > 1 && !reduced.matches && sessionValue('svnf-contact-photos') !== 'paused';
    function controls() {
      pause.hidden = photos.length < 2 || reduced.matches;
      pause.textContent = playing ? 'Ⅱ' : '▷';
      pause.setAttribute('aria-label',playing ? 'Pause service photographs' : 'Resume service photographs');
      pause.title = pause.getAttribute('aria-label');
    }
    function schedule() {
      clearInterval(timer); controls();
      if (playing) timer = setInterval(() => {
        if (document.hidden || hovered || (figure.contains(document.activeElement) && document.activeElement !== pause && document.activeElement.matches(':focus-visible'))) return;
        show((requested+1)%photos.length);
      },5500);
    }
    async function show(index, manual = false) {
      requested = index; const token = ++request, image = panels[index].querySelector('img');
      try { if (!image.complete || !image.naturalWidth) await image.decode(); }
      catch (_) { return; }
      if (token !== request || !figure.isConnected) return;
      current = index;
      panels.forEach((panel,at) => { panel.classList.toggle('is-current',at === current); panel.setAttribute('aria-hidden',String(at !== current)); });
      const category = photos[current];
      figure.querySelector('.contact-photo-name').textContent = category.shortTitle || category.title;
      figure.querySelector('.contact-photo-count').textContent = `${current+1} / ${photos.length}`;
      if (manual) announce.textContent = `${category.title} · photograph ${current+1} of ${photos.length}`;
    }
    figure.addEventListener('click',event => {
      const button = event.target.closest('[data-contact-photo]'); if (!button) return;
      if (button.dataset.contactPhoto === 'next') { show((requested+1)%photos.length,true); schedule(); }
      else {
        playing = !playing && !reduced.matches; hovered = false;
        try { sessionStorage.setItem('svnf-contact-photos',playing ? 'playing' : 'paused'); } catch (_) {}
        schedule();
      }
    },{signal:controller.signal});
    figure.addEventListener('pointerenter',event => { if (event.pointerType === 'mouse') hovered = true; },{signal:controller.signal});
    figure.addEventListener('pointerleave',() => { hovered = false; },{signal:controller.signal});
    const motion = () => { playing = photos.length > 1 && !reduced.matches && sessionValue('svnf-contact-photos') !== 'paused'; schedule(); };
    reduced.addEventListener('change',motion); schedule();
    cleanup = () => { ++request; clearInterval(timer); controller.abort(); reduced.removeEventListener('change',motion); document.removeEventListener("keydown",escape); };
  }

  async function supportView(category) {
    const token = routeToken;
    const data = await collection("contributions");
    if (token !== routeToken) return;
    const first = data.records?.find(
      (r) => !category || r.category === category,
    );
    if (first) await recordView(first.id);
  }
  const mediaNames = { photo: "Photographs", video: "Videos", youtube: "YouTube videos", audio: "Audio", document: "Supporting documents" };
  const mediaPhrase = type => type === "youtube" ? mediaNames[type] : (mediaNames[type] || type).toLowerCase();
  function mediaTypes(event) {
    const present = [...new Set(event.media.map(m => m.type))];
    return ["photo", "video", "youtube", "audio", "document", ...present.filter(t => !["photo", "video", "youtube", "audio", "document"].includes(t))].filter(t => present.includes(t));
  }
  function mediaTabs(event, selected) {
    const types = mediaTypes(event);
    return `<div class="tabs media-tabs" aria-label="Ways to experience this occasion">${types.map((t) => `<button data-action="media-type" data-event="${esc(event.id)}" data-type="${t}" aria-pressed="${t === selected}">${mediaNames[t] || t}<small>${event.media.filter((m) => m.type === t).length}</small></button>`).join("")}</div>`;
  }
  function bindMediaScrubber(shell) {
    const ribbon = shell.querySelector('.moment-ribbon'), links = [...ribbon.querySelectorAll('a')];
    if (!links.length) return () => {};
    ribbon.setAttribute('role','navigation');
    ribbon.setAttribute('aria-label','Browse photos and recordings');
    ribbon.setAttribute('aria-description','Hold a thumbnail and slide to preview. Use arrow keys, Home or End to select with a keyboard.');
    const controller = new AbortController();
    const listen = (node, name, action, options = {}) => node.addEventListener(name, action, {...options, signal:controller.signal});
    const peek = document.createElement('div');
    peek.className = 'ribbon-peek'; peek.setAttribute('aria-hidden','true');
    const image = document.createElement('img'), label = document.createElement('span'); image.alt = '';
    peek.append(image, label); shell.append(peek);
    let press = null, holdTimer = 0, frame = 0, lastTime = 0, highlighted = null;
    links.forEach(link => { link.draggable = false; link.querySelectorAll('img').forEach(img => img.draggable = false); });
    function capture() { try { ribbon.setPointerCapture(press.id); } catch (_) {} }
    function pick() {
      if (!press?.active) return;
      const bounds = ribbon.getBoundingClientRect();
      const x = Math.max(bounds.left+4,Math.min(bounds.right-4,press.x));
      let nearest = links[0], distance = Infinity;
      for (const link of links) {
        const rect = link.getBoundingClientRect(), delta = Math.abs(rect.left+rect.width/2-x);
        if (delta < distance) { distance = delta; nearest = link; }
      }
      if (highlighted !== nearest) {
        highlighted?.classList.remove('scrub-target'); highlighted = nearest; highlighted.classList.add('scrub-target');
        const thumb = nearest.querySelector('img'), kind = nearest.dataset.mediaKind;
        image.hidden = !thumb;
        if (thumb) image.src = thumb.currentSrc || thumb.src;
        label.textContent = `${kind === 'photo' ? 'Photo' : kind === 'audio' ? 'Audio' : kind === 'document' ? 'Document' : 'Video'} ${nearest.dataset.mediaNumber} / ${nearest.dataset.mediaTotal}`;
        if (nearest.getAttribute('aria-current') !== 'true') {
          const current = links.findIndex(link => link.hasAttribute('aria-current'));
          transitionDirection = links.indexOf(nearest) < current ? -1 : 1;
          goTo(nearest.getAttribute('href'));
        }
      }
      const rect = nearest.getBoundingClientRect(), width = 132;
      peek.style.left = Math.max(10,Math.min(innerWidth-width-10,rect.left+rect.width/2-width/2))+'px';
      peek.style.top = Math.max(10,bounds.top-peek.offsetHeight-10)+'px';
    }
    function tick(now) {
      if (!press?.active) return;
      const rect = ribbon.getBoundingClientRect(), edge = 42;
      const velocity = press.x < rect.left+edge ? -Math.min(1,(rect.left+edge-press.x)/edge) : press.x > rect.right-edge ? Math.min(1,(press.x-rect.right+edge)/edge) : 0;
      ribbon.scrollLeft += velocity * 360 * Math.min(32, now-(lastTime||now))/1000;
      lastTime = now; pick(); frame = requestAnimationFrame(tick);
    }
    function activate() {
      if (!press || press.dragged) return;
      press.active = true; ribbon.classList.add('is-scrubbing'); peek.classList.add('is-visible');
      capture(); pick(); lastTime = 0; frame = requestAnimationFrame(tick);
    }
    function finish(event, cancelled = false) {
      if (!press || (event?.pointerId !== undefined && event.pointerId !== press.id)) return;
      clearTimeout(holdTimer); cancelAnimationFrame(frame);
      if (press.active && !cancelled && event?.clientX !== undefined) { press.x = event.clientX; pick(); }
      if (press.active || press.dragged) swipeDeadline = performance.now()+450;
      const pointerId = press.id; press = null;
      ribbon.classList.remove('is-scrubbing'); peek.classList.remove('is-visible');
      highlighted?.classList.remove('scrub-target'); highlighted = null;
      try { if (ribbon.hasPointerCapture(pointerId)) ribbon.releasePointerCapture(pointerId); } catch (_) {}
    }
    listen(ribbon,'pointerdown',event => {
      if (event.button !== 0 || !event.isPrimary || press || !event.target.closest('a')) return;
      press = {id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,lastX:event.clientX,active:false,dragged:false};
      holdTimer = setTimeout(activate,320);
    });
    listen(ribbon,'pointermove',event => {
      if (!press || press.id !== event.pointerId) return;
      const dx = event.clientX-press.startX, dy = event.clientY-press.startY;
      press.x = event.clientX;
      if (press.active) { event.preventDefault(); pick(); return; }
      if (!press.dragged && Math.max(Math.abs(dx),Math.abs(dy)) > 8) {
        clearTimeout(holdTimer);
        if (Math.abs(dy) > Math.abs(dx)) { finish(event,true); return; }
        press.dragged = true; capture();
      }
      if (press.dragged) { event.preventDefault(); ribbon.scrollLeft += press.lastX-event.clientX; }
      press.lastX = event.clientX;
    },{passive:false});
    listen(document,'pointerup',event => finish(event));
    listen(document,'pointercancel',event => finish(event,true));
    listen(ribbon,'lostpointercapture',event => finish(event,true));
    listen(ribbon,'contextmenu',event => { if (press) event.preventDefault(); });
    listen(ribbon,'dragstart',event => event.preventDefault());
    listen(window,'blur',() => finish(null,true));
    listen(document,'visibilitychange',() => { if(document.hidden) finish(null,true); });
    listen(ribbon,'keydown',event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const at = links.indexOf(event.target.closest('a')); if (at < 0) return;
      event.preventDefault(); event.stopPropagation(); finish(null,true);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length-1 : Math.max(0,Math.min(links.length-1,at+(event.key === 'ArrowRight' ? 1 : -1)));
      links[next].focus({preventScroll:true}); transitionDirection = next < at ? -1 : 1; goTo(links[next].getAttribute('href'));
    });
    return () => { finish(null,true); controller.abort(); peek.remove(); };
  }

  function eventView(id, type, index = 0) {
    const event = getEvent(id);
    if (!event) throw Error("This moment is not available.");
    event.media = Array.isArray(event.media) ? event.media : [];
    theme(getCategory(event.category));
    type = type || mediaTypes(event)[0] || "photo";
    let media = event.media.filter((m) => m.type === type);
    if (!media.length) {
      type = mediaTypes(event)[0];
      media = event.media.filter((m) => m.type === type);
    }
    index = Math.max(0, Math.min(Number(index) || 0, media.length - 1));
    const item = media[index];
    const parent =
      event.backHref || "#/category/" + event.category + "/moments/" + id;
    // Keep per-type URLs stable while Next/Previous follows the whole occasion.
    const sequence = mediaTypes(event).flatMap(kind => event.media.filter(m => m.type === kind).map((m, at) => ({item:m,type:kind,index:at,route:`/event/${id}/${kind}/${at}`})));
    const position = sequence.findIndex(m => m.type === type && m.index === index),
      before = sequence[position-1], after = sequence[position+1],
      currentRoute = `/event/${id}/${type}/${index}`,
      prev = before?.route || currentRoute, next = after?.route || currentRoute,
      nextLabel = after && after.type !== type ? `Continue to ${mediaPhrase(after.type)}` : "Next moment",
      previousLabel = before && before.type !== type ? `Back to ${mediaPhrase(before.type)}` : "Previous moment";
    const frame = !item
      ? "<p>No media is published for this moment.</p>"
      : type === "photo"
        ? `<a class="cinema-photo" href="${href(item.src)}" target="_blank" rel="noopener" aria-label="Enlarge photograph">${photo(item.src, item.alt || item.caption || event.title)}</a>`
        : type === "video"
          ? `<video controls playsinline preload="metadata" ${item.poster ? `poster="${href(item.poster)}"` : ""} src="${href(item.src)}"></video>`
          : type === "audio"
            ? `<div class="listen-stage">${photo(item.poster || event.cover, event.title)}<audio controls preload="metadata" src="${href(item.src)}"></audio></div>`
            : type === "document"
              ? `<a class="document-preview" href="${href(item.src)}" target="_blank" rel="noopener" aria-label="Open full document">${item.poster ? photo(item.poster, item.title || event.title) : '<span class="document-label">Read the original document</span>'}<span class="button">Open full document ↗</span></a>`
              : `<div class="listen-stage">${photo(item.poster || event.cover, event.title)}<a class="button" href="${href(item.url || item.src)}" target="_blank" rel="noopener">Watch this recording on YouTube ↗</a></div>`;
    const duration = item?.durationSeconds ? `${Math.floor(item.durationSeconds / 60)}:${String(Math.floor(item.durationSeconds % 60)).padStart(2, "0")}` : "";
    const caption = `${after && after.type !== type ? `<a class="media-continue" href="#${next}">${esc(nextLabel)} <span aria-hidden="true">→</span></a>` : ""}<span class="eyebrow">${esc(mediaNames[type] || "FROM THE OCCASION")} · ${index + 1} / ${media.length}${duration ? " · " + duration : ""}</span><h2>${esc(item?.title || event.title)}</h2><p>${esc(short(item?.caption || event.description, 320))}</p><details><summary>About this occasion</summary><p>${esc(event.description)}</p><p>${esc(event.credit)} ${esc(event.note)}</p></details><a class="text-link" href="${href(item?.src || item?.url || parent)}" target="_blank" rel="noopener">${type === "photo" ? "View full photograph" : type === "document" ? "Read original document" : "Open recording"} ↗</a>`;
    const ribbon = sequence.map(({item:m,type:kind,index:at,route},i) =>
      `<a href="#${route}" data-media-kind="${kind}" data-media-number="${at+1}" data-media-total="${event.media.filter(item => item.type === kind).length}" ${kind === type && at === index ? 'aria-current="true"' : ""} ${i === 0 || sequence[i-1].type !== kind ? 'class="media-group-start"' : ""} aria-label="${esc((mediaNames[kind] || kind) + ' ' + (at+1) + ': ' + (m.title || event.title) + (m.durationSeconds ? ' · ' + Math.floor(m.durationSeconds/60) + ':' + String(Math.floor(m.durationSeconds%60)).padStart(2,'0') : ''))}">${kind === "photo" ? photo(m.thumb || m.src, "") : m.poster ? photo(m.poster, "") : ""}${kind !== "photo" ? `<span class="media-kind">${kind === "audio" ? "Listen" : kind === "video" || kind === "youtube" ? "Watch" : "Read"} ${at+1}</span>` : ""}</a>`
    ).join("");
    const shell = app.querySelector(".cinema-view");
    const updating = activeMedia?.id === id && shell?.dataset.event === id;
    const oldType = activeMedia?.type;
    activeMedia = { id, type, index, previous: prev, next, parent };
    if (updating) {
      const stage = shell.querySelector(".cinema-stage");
      stage.removeAttribute("aria-busy");
      const current = Array.from(stage.children).find(
        (el) => !el.matches(".cinema-backdrop,.cinema-arrows"),
      );
      const request = ++mediaRequest;
      if (
        type === "photo" &&
        oldType === "photo" &&
        current?.matches(".cinema-photo")
      ) {
        const img = current.querySelector("img");
        current.href = item.src;
        img.alt = item.alt || item.caption || event.title;
        if (img.getAttribute("src") !== item.src) {
          stage.setAttribute("aria-busy", "true");
          const nextImage = new Image();
          nextImage.onload = () => {
            if (
              request !== mediaRequest ||
              activeMedia?.id !== id ||
              activeMedia.index !== index
            )
              return;
            img.removeAttribute("srcset"); img.removeAttribute("sizes"); img.removeAttribute("width"); img.removeAttribute("height");
            img.src = item.src;
            stage.removeAttribute("aria-busy");
            if (!reduced.matches)
              img.animate([{ opacity: 0.65, transform: `translateX(${6 * transitionDirection}px)` }, { opacity: 1, transform: "translateX(0)" }], {
                duration: 220,
              });
          };
          nextImage.onerror = () => {
            if (request === mediaRequest) {
              stage.removeAttribute("aria-busy");
              announce.textContent =
                "This photograph could not be loaded. Try the next moment.";
            }
          };
          nextImage.src = item.src;
        }
      } else if (
        type === "video" &&
        oldType === "video" &&
        current?.matches("video")
      ) {
        if (current.getAttribute("src") !== item.src) {
          current.pause();
          current.src = item.src;
          if (item.poster) current.poster = item.poster;
          else current.removeAttribute("poster");
          current.load();
        }
      } else if (
        type === "audio" &&
        oldType === "audio" &&
        current?.matches(".listen-stage")
      ) {
        const player = current.querySelector("audio");
        if (player?.getAttribute("src") !== item.src) {
          player.pause();
          player.src = item.src;
          player.load();
        }
        const image = current.querySelector("img");
        if (image) image.src = item.poster || event.cover;
      } else {
        current?.querySelectorAll("audio,video").forEach((x) => x.pause());
        if (current?.matches("video,audio")) current.pause();
        if (current) current.outerHTML = frame;
      }
      shell.querySelector(".cinema-caption").innerHTML = caption;
      if (oldType !== type && !reduced.matches) {
        const incoming = Array.from(stage.children).find(el => !el.matches(".cinema-backdrop,.cinema-arrows"));
        incoming?.animate([{opacity:.4,transform:`translateX(${10*transitionDirection}px)`},{opacity:1,transform:"translateX(0)"}],{duration:280,easing:"ease-out"});
      }
      shell
        .querySelectorAll('[data-action="media-type"]')
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.type === type)),
        );
      shell.querySelectorAll(".moment-ribbon a").forEach(a => {
        if (a.getAttribute("href") === "#" + currentRoute) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    } else {
      ++mediaRequest;
      app.innerHTML = `<section class="view cinema-view" data-event="${esc(id)}" data-gallery-session="${performance.now()}"><div class="cinema-heading"><p>${esc([event.location, event.date ? dateLabel(event.date) : event.year].filter(Boolean).join(" · "))}</p><h1>${esc(event.title)}</h1></div>${mediaTabs(event, type)}<div class="cinema-body"><div class="cinema-stage"><div class="cinema-backdrop" style="background-image:url('${href(item?.poster || event.cover)}')"></div>${frame}</div><aside class="cinema-caption">${caption}</aside></div><div class="moment-ribbon" aria-label="Choose a moment">${ribbon}</div><dialog class="full-moment" id="full-moment" aria-label="Full photograph"><div><button type="button" data-action="close-full-moment">← Back to photographs</button><button type="button" data-action="close-full-moment" aria-label="Close full photograph">×</button></div><img alt=""></dialog></section>`;
      bindSequence(
        () => activeMedia.previous,
        () => activeMedia.next,
        parent,
      );
      const releaseSequence = cleanup, releaseScrubber = bindMediaScrubber(app.querySelector('.cinema-view'));
      cleanup = () => { releaseScrubber(); releaseSequence(); };
    }
    if (updating) announce.textContent = `${mediaNames[type]} · ${index+1} of ${media.length}`;
    if (!app.querySelector('.moment-ribbon.is-scrubbing')) app.querySelector(".moment-ribbon [aria-current]")?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduced.matches ? "instant" : "smooth",
    });
    [index - 1, index + 1]
      .filter((i) => i >= 0 && i < media.length)
      .forEach((i) => {
        if (media[i].type === "photo") {
          const adjacent = new Image();
          adjacent.src = media[i].src;
        }
      });
  }

  const libNames = {
    readings: "Satsangs",
    pearls: "Pearls of Wisdom",
    teachings: "Practical teachings",
    books: "Books",
    messages: "Anugraha Bhashanams",
  };
  function teachingGateway(selectedId) {
    theme(getCategory("teachings"));
    const choices = [
      {
        id: "readings",
        eyebrow: "A THOUGHT FOR TODAY",
        title: "Satsangs",
        description:
          "Pause with a reflection. Bring a little of it into your day.",
        cover: getCategory("teachings").cover,
        href: "#/library/readings",
      },
      {
        id: "books",
        eyebrow: "OPEN A QUIET COMPANION",
        title: "Books",
        description: "Eight books. Teachings to return to, one page at a time.",
        cover: "assets/media/teachings/books/pearls-of-wisdom.svg",
        href: "#/library/books",
      },
      {
        id: "messages",
        eyebrow: "WORDS, SHARED WITH LOVE",
        title: "Anugraha Bhashanams",
        description:
          "Words of guidance and blessings, shared on special occasions.",
        cover:
          site.teachingMessageCover ||
          "assets/media/messages/new-year-2026/cover-01.webp",
        href: "message-cards.html",
      },
      {
        id: "teachings",
        eyebrow: "UNDERSTAND · PUT INTO PRACTICE",
        title: "Everyday Teachings",
        description:
          "Simple ways to live with awareness, kindness and responsibility.",
        cover: getCategory("his-holiness").cover,
        href: "#/library/teachings",
      },
    ];
    const selected=choices.findIndex(c=>c.id===(selectedId||deckMemory.get("learn")));
    sectionSpotlight({key:"learn",title:"Learn Swamiji’s Teachings",back:"#/",index:Math.max(0,selected),items:choices.map(c=>({
      id:c.id,title:c.title,description:c.description,cover:c.cover,visual:c.id==="teachings"?"compass":"",visualLabel:"Wisdom in daily life",route:"#/learn/"+c.id,target:c.href,
      action:c.id==="books"?"Choose a book":c.id==="messages"?"Open the cards":c.id==="readings"?"Read a Satsang":"Read a teaching",
      fact:c.id==="books"?"8 spiritual books published":"",meta:c.id==="readings"?"A reflection for your day":c.id==="messages"?"Messages and blessings":"",
    })),onSelect:item=>deckMemory.set("learn",item.id)});
  }

  async function library(name = "readings", selected) {
    if (!libNames[name]) name = "readings";
    if (name === "messages") {
      location.replace("message-cards.html");
      return;
    }
    if (name === "pearls") {
      location.replace("reading-room.html");
      return;
    }
    const token = routeToken,
      data = await collection(name);
    if (token !== routeToken) return;
    theme(getCategory("teachings"));
    let entries = collectionEntries(data);
    if (name === "books") {
      bookShelf(entries, selected);
      return;
    }
    if (name === "teachings") {
      const selectedIndex=entries.findIndex(e=>String(e.id) === (selected||deckMemory.get("teachings")));
      sectionSpotlight({key:"practical-teachings",title:"Everyday Teachings",index:Math.max(0,selectedIndex),back:"#/learn",items:entries.map(e=>({id:e.id,title:e.title||e.caption,description:e.meaning.split(/(?<=[.!?])\s/)[0],visual:e.visual,visualLabel:e.visualLabel,route:"#/library/teachings/"+e.id,target:"#/read/teachings/"+e.id,action:"Read this teaching",meta:"An edited practical reflection"})),onSelect:item=>deckMemory.set("teachings",item.id)});
      return;
    }
    const all = entries.slice();
    if (name === "readings")
      all.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (name === "readings") {
      satsangView(all, selected);
      return;
    }
  }

  function satsangView(all, selected) {
    const matches = all.filter((entry) =>
      (!state.savedOnly || window.foundationSatsangReader.isSaved(entry.id)) &&
      (!state.search || JSON.stringify(entry).toLowerCase().includes(state.search.toLowerCase())) &&
      (!state.month || entry.date.startsWith(state.month)) &&
      (!state.topic || (entry.topics || entry.tags || []).includes(state.topic)),
    );
    const index = Math.max(0, Math.min(selected ? matches.findIndex((e) => e.id === selected) : state.page, matches.length - 1));
    state.page = index;
    const item = matches[index],
      route = (entry) => "#/library/readings/" + entry.id,
      previous = index > 0 ? route(matches[index - 1]) : null,
      next = index + 1 < matches.length ? route(matches[index + 1]) : null,
      byDate = new Map(all.map((entry) => [entry.date, entry])),
      months = [...new Set(all.map((entry) => entry.date.slice(0, 7)))].sort(),
      monthLabel = (month) => new Date(month + "-15T12:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      calendarIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18"/></svg>',
      filters = [state.month ? monthLabel(state.month) : "", state.search ? "Matching: " + state.search : "", state.topic, state.savedOnly ? "Saved Satsangs" : ""].filter(Boolean);
    let calendarMonth = state.month || item?.date.slice(0, 7) || months[months.length - 1];
    app.innerHTML = `<section class="view satsang-view"><div class="satsang-top">${heading("Satsangs", '<a href="#/learn">Learn Swamiji’s Teachings</a>')}<div class="satsang-tools"><form class="satsang-search" role="search"><input type="search" name="thought" aria-label="Search Satsangs" placeholder="Find a thought…" value="${esc(state.search)}"><button type="submit" aria-label="Search messages">↗</button></form><details class="satsang-calendar"><summary aria-label="Calendar">${calendarIcon}<span>Calendar</span>${state.month ? '<i aria-hidden="true"></i>' : ""}</summary><div class="satsang-calendar-panel"><div class="satsang-calendar-head"><button type="button" data-calendar-step="-1" aria-label="Previous month">←</button><h2 id="satsang-calendar-month"></h2><button type="button" data-calendar-step="1" aria-label="Next month">→</button></div><div class="calendar-weekdays" aria-hidden="true">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span>${d}</span>`).join("")}</div><div class="satsang-calendar-days" aria-labelledby="satsang-calendar-month"></div><p class="calendar-hint">Choose a highlighted date to open its Satsang.</p><div class="calendar-actions"><button type="button" data-calendar-month>Read this month</button><button type="button" data-satsang-clear>All dates</button></div></div></details><label class="satsang-topic">A theme to reflect on<select aria-label="Filter Satsangs by theme"><option value="">Every theme</option>${[...new Set(all.flatMap((e) => e.topics || e.tags || []))].sort().map((topic) => `<option value="${esc(topic)}" ${state.topic === topic ? "selected" : ""}>${esc(topic)}</option>`).join("")}</select></label></div></div><div class="satsang-filter-note">${filters.length ? `<span>${esc(filters.join(" · "))}</span><button type="button" data-satsang-clear>Show all Satsangs ×</button>` : '<span>A quiet moment. A little clarity.</span>'}</div><div class="satsang-stage"><article class="satsang-message-card ${item ? "" : "satsang-empty"}"><figure class="satsang-photo">${photo(getCategory("teachings").cover, "His Holiness Sri Vidyanarayana Thirtha Swamiji by the water")}</figure><div class="satsang-copy"><div class="satsang-meta"><p class="satsang-kicker">WORDS FOR EVERYDAY LIFE</p>${item ? `<time datetime="${esc(item.date)}">${dateLabel(item.date)}</time>` : '<span class="satsang-no-date">A moment to begin again</span>'}</div>${item ? `<h2><a href="#/read/readings/${esc(item.id)}">${esc(item.title)}</a></h2><p class="satsang-lead">${esc(item.lead || item.essence || "")}</p><div class="satsang-read"><a class="button" href="#/read/readings/${esc(item.id)}">Read this Satsang <span aria-hidden="true">↗</span></a><span>Edited Satsang reflection</span></div>` : '<h2>No Satsangs match this selection.</h2><p class="satsang-lead">Try another word, choose a highlighted calendar date, or return to all messages.</p><button class="button" type="button" data-satsang-clear>Show all Satsangs ↗</button>'}</div></article></div></section>`;
    if (matches.length) {
      const toolbar=app.querySelector(".satsang-tools"), search=toolbar.querySelector(".satsang-search").outerHTML, topic=toolbar.querySelector(".satsang-topic").outerHTML, dates=toolbar.querySelector(".satsang-calendar").outerHTML;
      toolbar.innerHTML=dates+`<details class="deck-find"><summary aria-label="Find a Satsang"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><span>Find</span></summary><div class="deck-find-panel">${search}${topic}<button type="button" class="satsang-saved-filter" data-satsang-saved aria-pressed="${state.savedOnly}">Saved Satsangs</button></div></details>`;
      const tools=app.querySelector(".satsang-top").outerHTML+app.querySelector(".satsang-filter-note").outerHTML;
      sectionSpotlight({key:"satsangs",title:"Satsangs",className:"satsang-view",header:tools,index,wrap:false,back:"#/learn",items:matches.map(e=>({id:e.id,title:e.title,date:e.date,kind:"satsang",readMinutes:window.foundationSatsangReader.minutes(e),description:e.lead,route:route(e),target:"#/read/readings/"+e.id,action:"Read this Satsang",meta:"Edited Satsang reflection"})),onSelect:(entry,i)=>{state.page=i;}});
    }
    const calendar = app.querySelector(".satsang-calendar"),
      calendarPanel = app.querySelector(".satsang-calendar-panel"),
      grid = app.querySelector(".satsang-calendar-days");
    function paintCalendar() {
      const [year, month] = calendarMonth.split("-").map(Number),
        offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7,
        days = new Date(Date.UTC(year, month, 0)).getUTCDate(),
        monthIndex = months.indexOf(calendarMonth);
      app.querySelector("#satsang-calendar-month").textContent = monthLabel(calendarMonth);
      calendarPanel.querySelector('[data-calendar-step="-1"]').disabled = monthIndex === 0;
      calendarPanel.querySelector('[data-calendar-step="1"]').disabled = monthIndex === months.length - 1;
      grid.innerHTML = '<span aria-hidden="true"></span>'.repeat(offset) + Array.from({ length: days }, (_, i) => {
        const date = `${calendarMonth}-${String(i + 1).padStart(2, "0")}`, entry = byDate.get(date);
        return `<button type="button" data-satsang-date="${date}" aria-label="${esc(dateLabel(date) + (entry ? "" : " — no Satsang available"))}" ${entry ? `class="available" title="${esc(entry.title)}"` : "disabled"} aria-pressed="${(matches[state.page]||item)?.date === date}">${i + 1}</button>`;
      }).join("");
    }
    function refresh() {
      state.page = 0;
      if (location.hash === "#/library/readings") render();
      else location.hash = "/library/readings";
    }
    const section = app.querySelector(".satsang-view");
    section.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-calendar-step")) {
        const i = months.indexOf(calendarMonth) + Number(button.dataset.calendarStep);
        if (months[i]) { calendarMonth = months[i]; paintCalendar(); }
      } else if (button.dataset.satsangDate) {
        const entry = byDate.get(button.dataset.satsangDate);
        if (!entry) return;
        state.month = entry.date.slice(0, 7); state.search = ""; state.topic = ""; state.savedOnly = false; state.page = 0;
        if (location.hash === route(entry)) render(); else location.hash = route(entry);
      } else if (button.hasAttribute("data-calendar-month")) {
        state.month = calendarMonth; state.search = ""; refresh();
      } else if (button.hasAttribute("data-satsang-saved")) {
        state.savedOnly = !state.savedOnly; refresh();
      } else if (button.hasAttribute("data-satsang-clear")) {
        state.month = ""; state.search = ""; state.topic = ""; state.savedOnly = false; refresh();
      }
    });
    app.querySelector(".satsang-search").addEventListener("submit", (event) => {
      event.preventDefault(); state.search = new FormData(event.currentTarget).get("thought").trim(); refresh();
    });
    app.querySelector(".satsang-topic select").addEventListener("change", (event) => {
      state.topic = event.target.value; refresh();
    });
    calendar.addEventListener("toggle", () => { if (calendar.open) {calendarMonth=state.month||(matches[state.page]||item)?.date.slice(0,7)||calendarMonth;paintCalendar();} });
    grid.addEventListener("keydown", (event) => {
      const directions = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
      if (!(event.key in directions)) return;
      const buttons = [...grid.querySelectorAll("button")], index = buttons.indexOf(document.activeElement),
        direction = directions[event.key];
      let target = index + direction;
      while (buttons[target]?.disabled) target += Math.sign(direction);
      if (buttons[target]) buttons[target].focus();
      event.preventDefault(); event.stopPropagation();
    });
    const find = app.querySelector(".deck-find"), outside = (event) => { if (calendar.open && !calendar.contains(event.target)) calendar.open = false; if(find?.open && !find.contains(event.target)) find.open=false; },
      escape = (event) => {
        if ((calendar.open || find?.open) && event.key === "Escape") {
          const control=calendar.open?calendar:find; calendar.open = false; if(find)find.open=false; control.querySelector("summary").focus();
          event.preventDefault(); event.stopImmediatePropagation();
        }
      };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    paintCalendar();
    if (!matches.length) bindSequence(previous || location.hash, next || location.hash, "#/learn");
    const release = cleanup;
    cleanup = () => { release(); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }

  function bookShelf(books, selected) {
    let index = Math.max(
      0,
      books.findIndex((e) => e.id === (selected || deckMemory.get("books"))),
    );
    sectionSpotlight({key:"books",title:"Spiritual Books",back:"#/learn",index,items:books.map(b=>({id:b.id,title:b.title,description:b.reader?"180 teachings to read, reflect upon and bring into everyday life.":b.subtitle||b.attribution,cover:b.cover,kind:"book",route:"#/library/books/"+b.id,target:b.reader?"reading-room.html?open=1":"#/read/books/"+b.id,action:b.reader?"Open the book":"About this book",meta:""})),onSelect:item=>deckMemory.set("books",item.id)});
  }

  async function reader(name, id) {
    const token = routeToken;
    const data = await collection(name);
    if (token !== routeToken) return;
    theme(getCategory("teachings"));
    let list = collectionEntries(data);
    if (name === "readings") {
      const filtered = list.filter(e => (!state.savedOnly || window.foundationSatsangReader.isSaved(e.id)) && (!state.month || e.date.startsWith(state.month)) && (!state.topic || (e.topics || e.tags || []).includes(state.topic)) && (!state.search || JSON.stringify(e).toLowerCase().includes(state.search.toLowerCase())));
      list = (filtered.some(e => e.id === id) ? filtered : list).slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    }
    const item = list.find((e) => String(e.id || e.number) === id);
    if (!item) throw Error("This reading is not available.");
    if (name === "readings") {
      cleanup=window.foundationSatsangReader.mount({root:app,item,entries:list,escape:esc,dateLabel,editorialNote:data.editorialNote,portrait:href(site.imageVariants?.[getCategory("teachings").cover]?.sources?.[0]?.src || getCategory("teachings").cover)});
      return;
    }
    if (name === "pearls") {
      location.replace("reading-room.html#pearl-" + id);
      return;
    }
    let title =
      item.title ||
      item.caption ||
      (name === "pearls" ? "Pearl " + item.number : "A reflection");
    let body = "";
    if (name === "readings")
      body = `<h1>${esc(title)}</h1><p class="lead">${esc(item.lead)}</p>${item.essence?.length ? `<h2>The essence</h2><ul>${item.essence.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<h2>The reflection</h2>${paragraphs(item.summary)}<h2>Bring it into your day</h2>${(item.practices || []).map((p) => `<h2>${esc(p.title)}</h2><p>${esc(p.text)}</p>`).join("")}${item.question ? `<p class="lead">${esc(item.question)}</p>` : ""}<p class="source-note">${esc(data.editorialNote || "An edited, anonymised reading drawn from the satsang collection. This is a summary, not a verbatim transcript.")}</p>`;
    else if (name === "pearls")
      body = `<p class="eyebrow">PEARLS OF WISDOM · ${item.number} / ${list.length}</p><h1>Pearl ${item.number}</h1>${paragraphs(String(item.text || "").split("\n\n"))}<p class="source-note">${esc(data.editorialNote || "From the 2021 Pearls of Wisdom collection. Original order and wording preserved with light spacing and punctuation edits.")} ${item.printed_page ? "Printed page " + item.printed_page + "." : ""}</p>`;
    else if (name === "teachings")
      body = `<h1>${esc(title)}</h1><h2>What it means</h2>${paragraphs(item.meaning)}<h2>Put it into practice</h2><ul>${(item.actions || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="source-note">${esc(data.editorialNote || "A practical paraphrase from the available satsang summaries, including devotees’ reflections. Not a direct quotation.")}</p>`;
    else if (name === "books")
      body = `<h1>${esc(title)}</h1><p class="lead">${esc(item.subtitle || "Teachings to read, reflect upon, and bring into everyday life.")}</p><p>${esc(item.attribution || "A compilation of Swamiji’s teachings.")}</p>${item.coverNote ? `<p class="source-note">${esc(item.coverNote)}</p>` : ""}${item.reader ? `<a class="button" href="#/library/${esc(item.reader)}">Open the reading edition →</a>` : ""}${item.purchaseUrl ? `<a class="button" href="${href(item.purchaseUrl)}" target="_blank" rel="noopener">View the book ↗</a><p class="source-note">Edition and availability depend on the seller and location.</p>` : ""}`;
    app.innerHTML = `<section class="view">${heading(name === "readings" ? dateLabel(item.date) : name === "books" ? "The book collection" : libNames[name], `<a href="#/library/${esc(name)}">${esc(libNames[name])}</a>`)}<div class="reader-layout"><aside class="reader-aside">${name === "teachings" ? teachingArtwork(item.visual,item.visualLabel) : photo(item.cover || getCategory("teachings").cover, title)}<div class="reader-controls"><span>Reading size</span><button data-action="reader-size" data-delta="-1" aria-label="Decrease reading text size">A−</button><button data-action="reader-size" data-delta="1" aria-label="Increase reading text size">A+</button></div><p>A little time to read.<br>A little space to reflect.</p><span class="tag">${name === "readings" ? dateLabel(item.date) : libNames[name]}</span></aside><article class="reader-scroll" tabindex="0" aria-label="Reading"><p class="reader-position">${list.indexOf(item)+1} of ${list.length} · ${name === "readings" ? "Edited Satsang reflection" : esc(libNames[name])}</p>${body}<nav class="reader-next" aria-label="Continue reading">${list.indexOf(item) > 0 ? `<a href="#/read/${name}/${esc(list[list.indexOf(item) - 1].id || list[list.indexOf(item) - 1].number)}">← Previous</a>` : ""}<a href="#/library/${name}${name === "readings" ? "/" + esc(item.id) : ""}">Back to ${esc(libNames[name])}</a>${list.indexOf(item) < list.length - 1 ? `<a href="#/read/${name}/${esc(list[list.indexOf(item) + 1].id || list[list.indexOf(item) + 1].number)}">Next →</a>` : ""}</nav></article></div></section>`;
  }
  async function messageView(id) {
    location.replace("message-cards.html?open=" + encodeURIComponent(id));
  }
  function contributionScenes(data, category) {
    const all = data.records || [], byId = new Map(all.map((r) => [r.id, r])),
      groups = data.displayGroups || [], seen = new Set(), scenes = [];
    for (const raw of all.filter((r) => r.category === category)) {
      const group = groups.find((g) => g.category === category && g.recordIds.includes(raw.id));
      if (!group) {
        scenes.push({ ...raw, receipts: [raw] });
        continue;
      }
      if (seen.has(group.id)) continue;
      seen.add(group.id);
      const receipts = group.recordIds.map((id) => byId.get(id));
      if (receipts.some((r) => !r || r.category !== category))
        throw Error("The supporting receipts could not be matched to this contribution.");
      scenes.push({ ...raw, id: group.id, recipient: group.title,
        summary: group.summary, amountLabel: group.amountLabel,
        evidenceLabel: group.evidenceLabel || group.title, navigationTitle: group.title, receipts,
        amount: receipts.reduce((total, r) => total + r.amount, 0),
        approximate: receipts.some((r) => r.approximate || r.reported),
        donor: undefined, displayDonor: undefined, src: undefined, document: undefined,
      });
    }
    return scenes;
  }
  async function recordView(id) {
    const token = routeToken;
    const [data, links, profiles] = await Promise.all([
      collection("contributions"),
      collection("supportLinks"),
      collection("educationProfiles"),
    ]);
    if (token !== routeToken) return;
    const allRecords = data.records || [];
    const group = (data.displayGroups || []).find((g) => g.id === id || g.recordIds.includes(id)),
      source = allRecords.find((r) => r.id === id || r.id === group?.recordIds[0]);
    if (!source) throw Error("This supporting note is not available.");
    const records = contributionScenes(data, source.category),
      record = records.find((r) => r.id === id || r.receipts.some((receipt) => receipt.id === id)),
      index = records.indexOf(record);
    if (!record) throw Error("This supporting note is not available.");
    const c=getCategory(links.categoryAliases?.[record.category]||record.category)||getCategory("foundation");
    theme(c);
    sectionSpotlight({key:"support/"+source.category,title:c.title,back:source.category==="education"?"#/category/education":"#/",index,items:records.map(r=>{
      const p=profiles.find(p=>p.recordIds.includes(r.receipts[0].id)),e=getEvent(p?.eventId||links.records?.[r.receipts[0].id]?.eventIds?.[0]);
      return {id:r.id,eventId:e?.id,title:p?.title||r.navigationTitle||e?.frontTitle||r.recipient,description:p?.intro||p?.description||e?.cardDescription||e?.description.split(/(?<=[.!?])\s/)[0],cover:p?.cover||e?.cover,route:"#/record/"+r.id,
        target:e&&e.presentation!=="service-story"?"#/event/"+e.id:"",action:e&&e.presentation!=="service-story"?"View photographs":"View receipts",
        fact:(r.approximate?"≈ ":"")+formatMoney(r.amount),cash:true,meta:"",
        evidence:deckEvidence(r.receipts),
      };
    })});
  }

  function about() {
    theme(getCategory("his-holiness"));
    app.innerHTML = `<section class="view">${heading("A tribute, through real moments.", "About the collection")}<article class="about-scroll"><p>This collection brings together the many expressions of His Holiness Sri Vidyanarayana Thirtha Swamiji’s life: spiritual practice, learning, care, service, and everyday wisdom.</p><h2>Begin with a photograph.</h2><p>Choose a portrait, open a collection, and step into an occasion. Photographs, films, audio recordings, messages, and readings stay together with their context.</p><h2>Care for the source.</h2><p>Visit identities and original media were shared by the foundation. An exact date appears only where it was supplied. Historical acknowledgements retain their named donors. Devotee reflections, edited summaries, and practical paraphrases are distinguished from original texts.</p><h2>A growing collection.</h2><p>This is a living collection of moments shared through the foundation: a place to return to for quiet reading, listening, and discovery.</p><p><a href="#/foundation/connect">Connect with the foundation →</a></p></article></section>`;
  }
  function finishNavigation(parts, focusHeading = true) {
    const title = (app.querySelector(".deck-caption h2,.satsang-copy h2,.reader-scroll h1,.satsang-flow h1,.story-copy h2,.book-copy h2") || app.querySelector(".cinema-heading h1,h1"))?.textContent.trim() || site.title;
    document.title = parts.length ? title + " — " + site.title : "Sri Vidyanarayana Thirtha Swamiji — " + site.title;
    const summary = app.querySelector(".satsang-lead,.story-description,.reader-scroll .lead,.reading-deck")?.textContent || "A living tribute to His Holiness Sri Vidyanarayana Thirtha Swamiji, through spiritual practice, teaching and service.";
    document.querySelector('meta[name="description"]').content = summary;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = summary;
    document.querySelector('meta[property="og:url"]').content = location.href;
    document.querySelectorAll(".masthead nav a").forEach(link => {
      const route = link.getAttribute("href"), selected = route === "#/" ? !parts.length : route === "#/learn" ? ["learn","library","read"].includes(parts[0]) : route === "#/explore" ? ["explore","category","event","record"].includes(parts[0]) : route === "#/foundation/connect" ? parts[0] === "foundation" && parts[1] === "connect" : route === "#/foundation" ? parts[0] === "foundation" && parts[1] !== "connect" : route === "#/about" && parts[0] === "about";
      if (selected) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    const back = document.querySelector("#back-view"), parent = parentRoute();
    const parentName = parent === "#/" ? "Home" : parent.startsWith("#/category/") ? getCategory(parent.split('/')[2])?.shortTitle || "section" : parent.startsWith("#/library/") ? libNames[parent.split('/')[2]] : parent === "#/learn" ? "Teachings" : "Foundation";
    back.textContent = "← Back"; back.setAttribute("aria-label", "Back to " + parentName);
    app.querySelectorAll('a[href^="#/"]').forEach(link => {
      const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) walker.currentNode.textContent = walker.currentNode.textContent.replace(/↗/g, "→");
    });
    const focus = app.querySelector("h1");
    if (focus && parts.length && focusHeading) { focus.tabIndex = -1; focus.focus({preventScroll:true}); }
    announce.textContent = title;

  }
  async function render() {
    if (!site) return;
    const token = ++routeToken;
    const nextParts = routeParts();
    document.querySelector("#back-view").hidden = !nextParts.length;
    document.querySelector(".start-link").hidden = !nextParts.length;
    document.body.classList.toggle("inside-experience", nextParts.length > 0);
    document.querySelector("#share-view").hidden = !nextParts.length;
    if (activeSpotlight && !document.querySelector("dialog[open]") && app.contains(activeSpotlight.root) && activeSpotlight.signature === deckSignature() && activeSpotlight.routes.has(location.hash)) {
      activeSpotlight.show(activeSpotlight.routes.get(location.hash));
      finishNavigation(nextParts, false);
      return;
    }
    if (
      nextParts[0] === "event" &&
      activeMedia?.id === nextParts[1] &&
      app.querySelector(".cinema-view")?.dataset.event === nextParts[1]
    ) {
      try {
        eventView(nextParts[1], nextParts[2], nextParts[3]);
      } catch (error) {
        showError(error);
      }
      return;
    }
    activeMedia = null;
    ++mediaRequest;
    cleanup();
    cleanup = () => {};
    app.querySelectorAll("video,audio").forEach((e) => e.pause());
    const parts = routeParts();
    restoreScope(parts);
    window.foundationShell.closeMenu();
    try {
      if (!parts.length) home();
      else if (parts[0] === "explore") explore(parts[1]);
      else if (parts[0] === "category")
        await category(parts[1], parts[2], parts[3]);
      else if (parts[0] === "event") {
        if (!getEvent(parts[1]) && parts[1]?.startsWith("message-"))
          await messageView(parts[1].slice(8), parts[2], parts[3]);
        else if (
          getEvent(parts[1])?.presentation === "service-story" &&
          !parts[2]
        )
          await recordView(getEvent(parts[1]).supportGroupId || getEvent(parts[1]).supportRecordIds[0]);
        else eventView(parts[1], parts[2], parts[3]);
      } else if (parts[0] === "learn") teachingGateway(parts[1]);
      else if (parts[0] === "foundation") {
        if (parts[1] === "support") await supportView(parts[2]);
        else foundationView(parts[1] === "connect");
      } else if (parts[0] === "library") await library(parts[1], parts[2]);
      else if (parts[0] === "read") await reader(parts[1], parts[2]);
      else if (parts[0] === "message") await messageView(parts[1]);
      else if (parts[0] === "record") await recordView(parts[1]);
      else if (parts[0] === "about") about();
      else throw Error("This part of the collection could not be found.");
      if (token === routeToken && !reduced.matches) {
        const calm = parts[0] === "library" && parts[1] === "readings";
        const foreground =
          calm ? app.querySelector(".satsang-copy") : app.querySelector(".scene-navigation") ? app.querySelector(".story-scene,.book-scene") : parts[0] === "library" && parts[2]
            ? app.querySelector(".thought-paper,.physical-book")
            : parts[0] === "category" && parts[3]
              ? app.querySelector(".story-scene")
              : app.firstElementChild;
        foreground?.animate(
          calm ? [
            { opacity: .4, transform: `translateX(${10 * transitionDirection}px)` },
            { opacity: 1, transform: "translateX(0)" },
          ] : [
            { opacity: 0, transform: `translateX(${16 * transitionDirection}px)` },
            { opacity: 1, transform: "translateX(0)" },
          ],
          { duration: calm ? 320 : 600, easing: "cubic-bezier(.2,.65,.2,1)" },
        );
      }
      if (token === routeToken) finishNavigation(parts);

    } catch (error) {
      if (token === routeToken) showError(error);
    }
  }
  app.addEventListener(
    "click",
    (e) => {
      if (performance.now() < swipeDeadline) {
        swipeDeadline = 0;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  app.addEventListener("click", (e) => {
    const zoom = e.target.closest(".cinema-photo,.cinema-caption .text-link");
    if (zoom && activeMedia?.type === "photo" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const item = getEvent(activeMedia.id).media.filter(
        (m) => m.type === "photo",
      )[activeMedia.index];
      const dialog = app.querySelector("#full-moment");
      if (dialog && item) {
        const img = dialog.querySelector("img");
        img.src = item.src;
        img.alt = item.alt || item.title || "Full photograph";
        dialog.showModal();
      }
      return;
    }
    const mediaLink = e.target.closest('.cinema-view a[href^="#/event/"]');
    if (
      mediaLink &&
      activeMedia &&
      mediaLink
        .getAttribute("href")
        .startsWith("#/event/" + activeMedia.id + "/")
    ) {
      e.preventDefault();
      if (mediaLink.getAttribute("aria-disabled") === "true") return;
      transitionDirection = mediaLink.dataset.mediaDirection === "previous" ? -1 : 1;
      goTo(mediaLink.getAttribute("href"));
      return;
    }
    const directionLink = e.target.closest('a[aria-label="Previous story"],a[aria-label="Previous moment"],a[aria-label="Previous Satsang"]');
    transitionDirection = directionLink ? -1 : 1;
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const action = b.dataset.action;
    if (action === "close-full-moment")
      app.querySelector("#full-moment")?.close();
    if (action === "clear-reflection-search") {
      state.search = "";
      state.month = "";
      state.topic = "";
      state.page = 0;
      location.hash = "/library/" + routeParts()[1];
      render();
    }
    if (action === "open-index") app.querySelector("#scene-index")?.showModal();
    if (action === "close-index") app.querySelector("#scene-index")?.close();
    if (action === "page") {
      state.page = Math.max(0, state.page + Number(b.dataset.delta));
      render();
    }
    if (action === "category-tab") {
      const parts = routeParts();
      location.hash = "/category/" + parts[1] + "/" + b.dataset.tab;
    }
    if (action === "library-tab") {
      location.hash = "/library/" + b.dataset.tab;
    }
    if (action === "media-type")
      goTo(`/event/${b.dataset.event}/${b.dataset.type}/0`);
    if (action === "media-index")
      goTo(`/event/${b.dataset.event}/${b.dataset.type}/${b.dataset.index}`);
    if (action === "reader-size") {
      readerSize = Math.max(
        15,
        Math.min(24, readerSize + Number(b.dataset.delta)),
      );
      document.body.style.setProperty("--reader-size", readerSize + "px");
    }
  });
  document.querySelector("#share-view").addEventListener("click", async () => {
    const parts = routeParts();
    let route = location.hash || "#/";
    if (parts[0] === "event") route = "#/event/" + parts[1];
    if (parts[0] === "category" && !site.sharePages?.[route]) route = parts[2] === "moments" && parts[3] ? "#/event/" + parts[3] : "#/category/" + parts[1];
    if (parts[0] === "library" && parts[1] === "readings" && parts[2]) route = "#/read/readings/" + parts[2];
    if (parts[0] === "foundation" && parts[1] !== "connect") route = "#/foundation";
    const url = site.sharePages?.[route] ? new URL(site.sharePages[route], location.href).href : location.href;
    try { await navigator.clipboard.writeText(url); announce.textContent = "Link copied"; document.querySelector("#share-view").textContent = "Copied"; setTimeout(() => { document.querySelector("#share-view").textContent = "Copy a link to this page"; }, 2000); }
    catch (_) { announce.textContent = "Copy this page’s address from your browser to share it."; }
  });
  document.querySelector("#back-view").addEventListener("click", () => {
    location.hash = parentRoute();
  });
  document.querySelector(".skip").addEventListener("click", (e) => {
    e.preventDefault();
    app.focus({ preventScroll: true });
  });
  window.addEventListener("hashchange", render);
  matchMedia("(max-width: 750px)").addEventListener("change", () => {
    if (site && ["explore", "library"].includes(routeParts()[0])) render();
  });
  fetch("content/site.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw Error("The collection could not be loaded.");
      return r.json();
    })
    .then((data) => {
      site = data;
      render();
    })
    .catch(showError);
})();
