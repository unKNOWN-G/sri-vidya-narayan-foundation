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
    /^(https?:\/\/|mailto:|tel:|assets\/|#\/)/.test(String(value))
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
    return `<div class="view-heading"><div><div class="breadcrumb"><a href="#/">Meet Swamiji</a>${crumb ? `<span>/</span>${crumb}` : ""}</div><h1>${esc(title)}</h1></div>${summary ? `<p class="summary">${esc(summary)}</p>` : ""}</div>`;
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
    app.innerHTML = `<section class="home"><div class="home-intro"><p class="eyebrow">HIS HOLINESS SRI VIDYANARAYANA THIRTHA SWAMIJI</p><h1>A life of wisdom. <em>A world of care.</em></h1></div><div class="portrait-carousel" aria-label="The many sides of Swamiji" aria-roledescription="carousel">${cats.map((c, i) => `<button class="portrait" data-category="${esc(c.id)}" data-index="${i}" aria-label="${esc(c.title + (c.homeContributionTotal ? ` · ${c.homeContributionTotal.approximate ? "approximately " : ""}${formatMoney(c.homeContributionTotal.amount)} recorded support` : ""))}" aria-pressed="${i === 0}" style="--card-accent:${c.theme.accent};--card-paper:${c.theme.surface || "#fffaf1"};--position:${esc(c.position || "50% 35%")}">${photo(c.cover, c.coverAlt || c.title, i === current ? "priority" : "")}${c.homeContributionTotal ? `<b class="portrait-contribution">${c.homeContributionTotal.approximate ? "≈ " : ""}${formatMoney(c.homeContributionTotal.amount)}<small>recorded support</small></b>` : ""}<span><small>${esc(c.eyebrow)}</small><strong>${esc(c.title)}</strong>${c.homeMilestone ? `<b class="portrait-milestone">${esc(c.homeMilestone)}</b>` : ""}</span></button>`).join("")}</div><div class="home-note"><p id="home-caption"></p><div class="home-actions"><a class="button" id="chapter-link" href="#/">Explore this side <span aria-hidden="true">↗</span></a><span class="home-instruction">Swipe a portrait or choose a side below</span></div></div><div class="carousel-controls"><button data-home="previous" aria-label="Previous portrait">←</button><nav class="dots" aria-label="Choose a side of Swamiji’s life">${cats.map((c, i) => `<button data-home-index="${i}" aria-label="Show ${esc(c.title)}" aria-pressed="${i === 0}"><span>${esc(c.shortTitle || c.title)}</span></button>`).join("")}</nav><button data-home="next" aria-label="Next portrait">→</button><button class="play" aria-label="Pause automatic rotation" data-home="play">Ⅱ</button></div></section>`;
    const stage = app.querySelector(".portrait-carousel"),
      cards = [...app.querySelectorAll(".portrait")],
      dots = [...app.querySelectorAll(".dots button")],
      play = app.querySelector(".play");
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
    function resize() {
      const mobile = innerWidth <= 750;
      const width = Math.max(
        105,
        Math.min(
          315,
          stage.clientWidth * (mobile ? 0.64 : 0.27),
          (stage.clientHeight - 38) / 1.3,
        ),
      );
      stage.style.setProperty("--portrait-width", width + "px");
      step = width * (mobile ? 0.82 : 0.96);
      position();
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
      app.querySelector("#chapter-link").innerHTML = `${esc(c.id === "his-holiness" ? "Meet Swamiji" : c.id === "teachings" ? "Learn from Swamiji" : "Explore " + (c.shortTitle || c.title))} <span aria-hidden="true">→</span>`;
      app.querySelector("#chapter-link").href =
        c.id === "teachings" ? "#/learn" : "#/category/" + c.id;
      position();
      const activeChoice = dots[current], nav = activeChoice.parentElement;
      if (activeChoice.offsetLeft < nav.scrollLeft || activeChoice.offsetLeft + activeChoice.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollTo({left:activeChoice.offsetLeft - (nav.clientWidth - activeChoice.offsetWidth)/2, behavior: reduced.matches ? "instant" : "smooth"});
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
  function sceneNavigation(title, links, index, previous, next) {
    return `<div class="scene-navigation"><nav class="occasion-track" aria-label="${esc(title)}" tabindex="0">${links.map((item, i) => `<a class="occasion-stop" href="${href(item.href)}" ${i === index ? 'aria-current="page"' : ""} aria-label="${esc(`${i + 1}. ${item.title}`)}" title="${esc(item.title)}"><span class="occasion-number">${String(i + 1).padStart(2, "0")}</span><span class="occasion-title">${esc(item.title)}</span></a>`).join("")}</nav><div class="strip-arrows" aria-label="Move between occasions"><a href="${href(previous)}" aria-label="Previous story">←</a><span class="strip-count">${index + 1} / ${links.length}</span><a href="${href(next)}" aria-label="Next story">→</a></div></div>`;
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
  function sceneControls(previous, next, label, button = "") {
    return `<div class="scene-controls">${button === "Find a thought" ? `<button class="scene-choice" data-action="open-index">Find a thought <span aria-hidden="true">↗</span></button>` : `<span class="scene-collection-note">${esc(button)}</span>`}<div class="sequence"><a href="${href(previous)}" aria-label="Previous story">←</a><span>${esc(label)}</span><a href="${href(next)}" aria-label="Next story">→</a></div><span class="gesture-note">Swipe or use ← →</span></div>`;
  }
  function goTo(value) {
    const hash = value.startsWith("#") ? value : "#" + value;
    if (activeMedia && hash.startsWith("#/event/" + activeMedia.id + "/")) {
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
    let startX = 0,
      startY = 0,
      started = false;
    const resolve = (value) => (typeof value === "function" ? value() : value);
    const ignored = (e) =>
      e.target.closest?.(
        "input,select,textarea,video,audio,iframe,dialog,.scene-navigation,.satsang-tools,[contenteditable=true]",
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
    const down = (e) => {
      if (ignored(e)) return;
      started = true;
      startX = e.clientX;
      startY = e.clientY;
    };
    const up = (e) => {
      if (!started) return;
      started = false;
      const dx = e.clientX - startX,
        dy = e.clientY - startY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        swipeDeadline = performance.now() + 350;
        transitionDirection = dx < 0 ? 1 : -1; goTo(resolve(dx < 0 ? next : previous));
      }
    };
    document.addEventListener("keydown", key);
    app.addEventListener("pointerdown", down);
    app.addEventListener("pointerup", up);
    cleanup = () => {
      releaseStrip();
      document.removeEventListener("keydown", key);
      app.removeEventListener("pointerdown", down);
      app.removeEventListener("pointerup", up);
      app.querySelectorAll("video,audio").forEach((x) => x.pause());
    };
  }
  function sceneArt(
    cover,
    title,
    nextCover,
    nextHref,
    position = "50% 38%",
    book = false,
    openHref,
    caption = "",
  ) {
    return `<div class="story-art ${book ? "book-art" : ""}"><div class="art-orbit" aria-hidden="true"></div>${nextCover ? `<a class="next-glimpse" href="${href(nextHref)}" aria-label="Next story">${photo(nextCover, "")}<span>Up next ↗</span></a>` : ""}<a class="story-image" href="${href(openHref || nextHref)}" aria-label="${esc(title)}">${photo(cover, title, "priority", position)}</a>${caption ? `<p class="photo-context">${esc(caption)}</p>` : ""}</div>`;
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
    app.innerHTML = `<section class="view story-view">${heading("His life, in action.", '<a href="#/">Meet Swamiji</a>')}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(c.cover)}')"></div><div class="story-copy"><p class="eyebrow">${esc(c.eyebrow)}</p><h2>${esc(c.headline || c.title)}</h2><p class="story-description">${esc(c.caption)}</p><a class="button" href="${target}">${c.id === "teachings" ? "Learn from Swamiji" : "Meet this side"} <span aria-hidden="true">↗</span></a><span class="scene-kicker">${esc(c.title)}</span></div>${sceneArt(c.cover, c.title, "", next, c.position || "50% 35%", false, target)}</div>${sceneNavigation("A life. Many expressions.", experienceLinks(), index, prev, next)}</section>`;
    bindSequence(prev, next, "#/");
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
    const event = events[index],
      after = events[(index + 1) % events.length];
    if (event.presentation === "service-story" && event.supportRecordIds?.length) {
      deckMemory.set(id, event.id);
      await recordView(event.supportGroupId || event.supportRecordIds[0]);
      return;
    }
    deckMemory.set(id, event.id);
    const base = "#/category/" + id + "/moments/",
      prev = base + events[(index - 1 + events.length) % events.length].id,
      next = base + after.id,
      target =
        event.presentation === "service-story" && event.supportRecordIds?.length
          ? "#/record/" + (event.supportGroupId || event.supportRecordIds[0])
          : "#/event/" + event.id;
    app.innerHTML = `<section class="view story-view">${heading(c.title)}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(event.cover)}')"></div><div class="story-copy"><p class="eyebrow">${esc([event.location, event.date ? dateLabel(event.date) : event.year].filter(Boolean).join(" · ") || c.eyebrow)}</p><h2>${esc(event.title)}</h2><p class="story-description">${esc(event.intro || short(event.description || c.caption))}</p><a class="button" href="${target}">${id === "his-holiness" && event.id === "swamiji-stuti" ? "Read the Stuti" : event.presentation === "service-story" ? "View contribution" : event.counts?.photos ? "View photographs" : event.counts?.recordings ? "Listen to the recordings" : "Explore this occasion"} <span aria-hidden="true">↗</span></a>${event.photoSource ? `<a class="school-photo-credit" href="${esc(event.photoSource)}" target="_blank" rel="noopener">${esc(event.photoCredit)} ↗</a>` : ""}<span class="scene-kicker">${
      event.presentation === "service-story"
        ? "A story of support"
        : Object.entries(event.counts || {})
            .map(
              ([k, v]) =>
                `${v} ${v === 1 ? { photos: "photograph", films: "film", recordings: "recording", documents: "document", youtube: "video" }[k] || k : { youtube: "videos" }[k] || k}`,
            )
            .join(" · ")
    }</span></div>${sceneArt(event.cover, event.coverAlt || event.title, "", next, event.coverPosition || "50% 35%", false, target)}</div>${sceneNavigation(c.title, events.map((e) => ({ title: e.title, href: base + e.id })), index, prev, next)}</section>`;
    bindSequence(prev, next, "#/explore/" + id);
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
    const profile = profiles[index],
      event = getEvent(profile.eventId),
      schoolCover = profile.cover || event?.cover;
    if (!event) throw Error("This school collection is unavailable.");
    deckMemory.set("education", profile.id);
    const records = profile.recordIds
      .map((id) => ledger.records.find((r) => r.id === id))
      .filter(Boolean);
    const amount = records.reduce((n, r) => n + r.amount, 0),
      approximate = records.some((r) => r.approximate || r.reported);
    const amountText = records.length
      ? (approximate ? "≈ " : "") + formatMoney(amount)
      : profile.contributionText;
    const base = "#/category/education/schools/",
      previous =
        base + profiles[(index - 1 + profiles.length) % profiles.length].id,
      next = base + profiles[(index + 1) % profiles.length].id;
    const photographs = event.presentation !== "service-story",
      target = photographs
        ? "#/event/" + event.id
        : "#/record/" + profile.recordIds[0];
    app.innerHTML = `<section class="view story-view education-view">${heading(c.title)}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(schoolCover)}')"></div><div class="story-copy"><p class="eyebrow">${esc(event.location || "DEFENCE SCHOOLS · EDUCATIONAL SUPPORT")}</p><h2>${esc(profile.title)}</h2><div class="school-contribution"><small>${esc(profile.amountLabel)}</small><strong class="${records.length ? "cash-amount" : "contribution-kind"}">${esc(amountText)}</strong></div><p class="story-description">${esc(profile.intro || profile.description)}</p><div class="story-actions"><a class="button" href="${target}">${photographs ? "View school photographs" : "View contribution details"} ↗</a>${records.some((r) => r.src) ? `<details class="school-attachments"><summary>Receipts and acknowledgements</summary><div class="school-attachment-list">${records.filter((r) => r.src).map((r) => `<a class="text-link" href="${href(r.src)}" target="_blank" rel="noopener"><strong class="receipt-contribution">${formatMoney(r.amount)}</strong><span>${esc(r.displayDonor || r.donor || r.evidenceLabel)} ↗</span></a>`).join("")}</div></details>` : ""}</div>${profile.photoSource ? `<a class="school-photo-credit" href="${esc(profile.photoSource)}" target="_blank" rel="noopener">${esc(profile.photoCredit)} ↗</a>` : ""}</div>${sceneArt(schoolCover, profile.title, "", next, event.coverPosition || "50% 30%", false, target, profile.photoCaption)}</div>${sceneNavigation("Schools and colleges", profiles.map((p) => ({ title: p.title, href: base + p.id })), index, previous, next)}</section>`;
    bindSequence(previous, next, "#/explore/education");
  }

  function foundationView(connect = false) {
    const c = getCategory("foundation");
    theme(c);
    app.innerHTML = `<section class="view story-view">${heading("Inspired by his example.", "The foundation")}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(c.cover)}')"></div><div class="story-copy"><p class="eyebrow">VIDYA · VAIDYA · VASATHI</p><h2>Kindness.<br><em>Carried forward.</em></h2><p class="story-description">${esc(site.foundation.description)}</p><div class="story-actions"><a class="button" href="#/foundation/connect">Contact the foundation →</a><a class="text-link" href="#/category/foundation/moments">Moments of service ↗</a></div><a class="quiet-link" href="#/foundation/support">A clear account of historical support ↗</a></div><div class="foundation-image">${photo(c.cover, "Service inspired by Swamiji’s example")}</div></div>${connect ? `<dialog class="scene-index contact-dialog" id="contact-dialog" open><div class="index-head"><p class="eyebrow">A CONVERSATION IS A BEGINNING</p><a href="#/foundation" aria-label="Close contact details">×</a></div><h2>Let’s serve together.</h2><p>For current needs, volunteering and contribution guidance, speak with the foundation team.</p><a class="contact-link" href="mailto:${esc(site.foundation.email)}">${esc(site.foundation.email)}</a><a class="contact-link" href="tel:${esc(site.foundation.phone.replace(/[^+\d]/g, ""))}">${esc(site.foundation.phone)}</a><p>${esc(site.foundation.office)}</p></dialog>` : ""}<div class="foundation-bottom"><a href="#/category/education">Encourage learning ↗</a><a href="#/category/healthcare">Care for wellbeing ↗</a><a href="#/category/annadanam">Share nourishment ↗</a><a href="#/category/compassion">Care for all life ↗</a></div></section>`;
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
  function mediaTabs(event, selected) {
    const types = [...new Set(event.media.map((m) => m.type))];
    return `<div class="tabs media-tabs" aria-label="Ways to experience this occasion">${types.map((t) => `<button data-action="media-type" data-event="${esc(event.id)}" data-type="${t}" aria-pressed="${t === selected}">${{ photo: "Photographs", video: "Film", audio: "Listen", document: "Original document", youtube: "YouTube recordings" }[t] || t}<small>${event.media.filter((m) => m.type === t).length}</small></button>`).join("")}</div>`;
  }
  function eventView(id, type, index = 0) {
    const event = getEvent(id);
    if (!event) throw Error("This moment is not available.");
    event.media = Array.isArray(event.media) ? event.media : [];
    theme(getCategory(event.category));
    type = type || event.media[0]?.type || "photo";
    let media = event.media.filter((m) => m.type === type);
    if (!media.length) {
      type = event.media[0]?.type;
      media = event.media.filter((m) => m.type === type);
    }
    index = Math.max(0, Math.min(Number(index) || 0, media.length - 1));
    const item = media[index];
    const parent =
      event.backHref || "#/category/" + event.category + "/moments/" + id;
    const prev = `/event/${id}/${type}/${Math.max(0, index - 1)}`,
      next = `/event/${id}/${type}/${Math.min(media.length - 1, index + 1)}`;
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
    const duration = item?.durationSeconds ? `${Math.floor(item.durationSeconds / 60)}:${String(item.durationSeconds % 60).padStart(2, "0")}` : "";
    const caption = `<span class="eyebrow">${type === "photo" ? "A MOMENT TO REMEMBER" : type === "audio" ? "VOICES OF THE OCCASION" : "FROM THE OCCASION"} · ${index + 1} / ${media.length}${duration ? " · " + duration : ""}</span><h2>${esc(item?.title || event.title)}</h2><p>${esc(short(item?.caption || event.description, 320))}</p><details><summary>About this occasion</summary><p>${esc(event.description)}</p><p>${esc(event.credit)} ${esc(event.note)}</p></details><a class="text-link" href="${href(item?.src || item?.url || parent)}" target="_blank" rel="noopener">${type === "photo" ? "View full photograph" : type === "document" ? "Read original document" : "Open recording"} ↗</a>`;
    const ribbon = media
      .map(
        (m, i) =>
          `<a href="#/event/${esc(id)}/${type}/${i}" ${i === index ? 'aria-current="true"' : ""} aria-label="${esc((m.title || "Moment " + (i + 1)) + (m.durationSeconds ? " · " + Math.floor(m.durationSeconds / 60) + ":" + String(m.durationSeconds % 60).padStart(2, "0") : ""))}">${m.type === "photo" ? photo(m.thumb || m.src, "") : m.poster ? photo(m.poster, "") : `<span>${type === "audio" ? "Listen" : type === "video" || type === "youtube" ? "Watch" : "Read"} ${i + 1}</span>`}</a>`,
      )
      .join("");
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
      if (oldType !== type)
        shell.querySelector(".moment-ribbon").innerHTML = ribbon;
      shell
        .querySelectorAll('[data-action="media-type"]')
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.type === type)),
        );
      shell.querySelectorAll(".moment-ribbon a").forEach((a, i) => {
        if (i === index) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      const arrows = shell.querySelectorAll(".cinema-arrows a");
      [prev, next].forEach((url, i) => {
        const a = arrows[i];
        a.href = "#" + url;
        const disabled = i === 0 ? index === 0 : index === media.length - 1;
        if (disabled) {
          a.setAttribute("aria-disabled", "true");
          a.tabIndex = -1;
        } else {
          a.removeAttribute("aria-disabled");
          a.removeAttribute("tabindex");
        }
      });
    } else {
      ++mediaRequest;
      app.innerHTML = `<section class="view cinema-view" data-event="${esc(id)}" data-gallery-session="${performance.now()}"><div class="cinema-heading"><a class="back-story" href="${href(parent)}">← ${esc(event.backLabel || getCategory(event.category)?.title || "Back to the story")}</a><p>${esc([event.location, event.date ? dateLabel(event.date) : event.year].filter(Boolean).join(" · "))}</p><h1>${esc(event.title)}</h1></div>${mediaTabs(event, type)}<div class="cinema-body"><div class="cinema-stage"><div class="cinema-backdrop" style="background-image:url('${href(item?.poster || event.cover)}')"></div>${frame}<div class="cinema-arrows"><a href="#${prev}" aria-label="Previous moment" ${index === 0 ? 'aria-disabled="true" tabindex="-1"' : ""}>←</a><a href="#${next}" aria-label="Next moment" ${index === media.length - 1 ? 'aria-disabled="true" tabindex="-1"' : ""}>→</a></div></div><aside class="cinema-caption">${caption}</aside></div><div class="moment-ribbon" aria-label="Choose a moment">${ribbon}</div><dialog class="full-moment" id="full-moment" aria-label="Full photograph"><div><button type="button" data-action="close-full-moment">← Back to photographs</button><button type="button" data-action="close-full-moment" aria-label="Close full photograph">×</button></div><img alt=""></dialog></section>`;
      bindSequence(
        () => activeMedia.previous,
        () => activeMedia.next,
        parent,
      );
    }
    app.querySelector(".moment-ribbon [aria-current]")?.scrollIntoView({
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
  function teachingGateway() {
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
    app.innerHTML = `<section class="view learning-gateway">${heading("Learn Swamiji’s Teachings.", "", "A thought to reflect on. A way to live.")}<nav class="learning-shortcuts" aria-label="Choose a teaching experience">${choices.map(c => `<a href="${c.href}">${esc({readings:"Satsangs",books:"Books",messages:"Blessings",teachings:"Practice"}[c.id])}</a>`).join("")}</nav><div class="learning-doors">${choices.map((c, i) => `<a class="learning-door ${c.id}" href="${c.href}"><span class="door-number">0${i + 1}</span><div class="door-art">${photo(c.cover, c.title)}</div><div class="door-copy"><p class="eyebrow">${c.eyebrow}</p><h2>${c.title}</h2><p>${c.description}</p><span class="door-action">${c.id === "messages" ? "Read the blessings" : c.id === "books" ? "Find a book" : c.id === "readings" ? "Read a reflection" : "Begin with a teaching"} →</span></div></a>`).join("")}</div><a class="gateway-pearl" href="reading-room.html?open=1">A quiet moment? Open Pearls of Wisdom →</a></section>`;
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
    const all = entries.slice();
    if (name === "readings")
      all.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (name === "readings") {
      satsangView(all, selected);
      return;
    }
    const list = all.filter(
      (e) =>
        (!state.search ||
          JSON.stringify(e)
            .toLowerCase()
            .includes(state.search.toLowerCase())) &&
        (!state.month ||
          name !== "readings" ||
          e.date?.startsWith(state.month)) &&
        (!state.topic ||
          name !== "readings" ||
          (e.topics || e.tags || []).includes(state.topic)),
    );
    let index = selected
      ? list.findIndex((e) => String(e.id || e.number) === selected)
      : state.page;
    index = Math.max(0, Math.min(index, list.length - 1));
    state.page = index;
    const item = list[index];
    const route = (e) => "#/library/" + name + "/" + (e.id || e.number),
      target = (e) => "#/read/" + name + "/" + (e.id || e.number);
    const previous = item
        ? route(list[(index - 1 + list.length) % list.length])
        : "#/learn",
      next = item ? route(list[(index + 1) % list.length]) : "#/learn";
    const headingText =
      name === "readings" ? "A thought to carry." : "A way to live.";
    app.innerHTML = `<section class="view reflection-view">${heading(name === "readings" ? "Satsangs" : "Everyday Teachings", '<a href="#/learn">Learn Swamiji’s Teachings</a>')}<div class="reflection-scene"><div class="reflection-portrait">${photo(getCategory("teachings").cover, "Sri Swamiji")}</div><div class="reflection-intro"><p class="eyebrow">${name === "readings" ? "PAUSE · REFLECT · BRING IT INTO YOUR DAY" : "UNDERSTAND · PRACTISE · GROW"}</p><h2>${headingText.split(" ").slice(0, 2).join(" ")}<br><em>${headingText.split(" ").slice(2).join(" ")}</em></h2><p>${name === "readings" ? "A few quiet words can change how we meet the day. Begin with a reflection from Swamiji’s satsangh." : "Wisdom takes shape in the way we live. Begin with one teaching, and a small action you can make your own."}</p><a class="text-link" href="#/learn">Other ways to learn ↗</a></div><div class="thought-deck">${item ? `<a class="thought-behind back-left" href="${previous}" aria-label="Previous reflection"><span>${esc(list[(index - 1 + list.length) % list.length].title || "A moment of reflection")}</span></a><a class="thought-behind back-right" href="${next}" aria-label="Next reflection"><span>${esc(list[(index + 1) % list.length].title || "A little everyday wisdom")}</span></a><a class="thought-paper" href="${target(item)}"><span class="paper-date">${name === "readings" ? dateLabel(item.date) : "A TEACHING FOR EVERYDAY LIFE"}</span><span class="paper-rule"></span><h3>${esc(item.title || item.caption || "A reflection")}</h3><p>${esc(short(item.lead || item.meaning || item.text, 245))}</p><span class="paper-action">${name === "readings" ? "Read. Reflect. Carry it with you." : "Understand. Put it into practice."} ↗</span><small>${name === "readings" ? "An edited satsangh reflection" : "A practical paraphrase"} · Sri Swamiji</small></a>` : '<div class="thought-paper empty"><h3>No matching reflection.</h3><p>Try another thought, month or topic.</p><button data-action="open-index" class="button">Find a thought ↗</button></div>'}</div></div><div class="reflection-bottom">${sceneControls(previous, next, item ? `${index + 1} / ${list.length}` : "", "Find a thought")}<span class="reflection-note">${state.search || state.month || state.topic ? `Showing your selection · <button data-action="clear-reflection-search">Show all reflections</button>` : "One reflection at a time. At your own pace."}</span></div><dialog class="scene-index reflection-search" id="scene-index"><div class="index-head"><p class="eyebrow">WHAT IS ON YOUR MIND?</p><button data-action="close-index" aria-label="Close search">×</button></div><h2>Find a thought.</h2><form id="reflection-filter"><label for="library-search">A word or question</label><input type="search" id="library-search" placeholder="Gratitude, duty, love…" value="${esc(state.search)}">${
      name === "readings"
        ? `<label for="month-filter">A month to return to</label><select id="month-filter"><option value="">Every month</option>${[
            ...new Set(all.map((e) => e.date?.slice(0, 7)).filter(Boolean)),
          ]
            .sort()
            .reverse()
            .map(
              (m) =>
                `<option value="${m}" ${state.month === m ? "selected" : ""}>${new Date(m + "-15").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>`,
            )
            .join(
              "",
            )}</select><label for="topic-filter">A theme to reflect on</label><select id="topic-filter"><option value="">Every topic</option>${[
            ...new Set(all.flatMap((e) => e.topics || e.tags || [])),
          ]
            .sort()
            .map(
              (t) =>
                `<option ${state.topic === t ? "selected" : ""}>${esc(t)}</option>`,
            )
            .join("")}</select>`
        : ""
    }<button class="button" type="submit">Begin with a reflection ↗</button></form></dialog></section>`;
    app.querySelector("#reflection-filter").addEventListener("submit", (e) => {
      e.preventDefault();
      state.search = app.querySelector("#library-search").value;
      state.month = app.querySelector("#month-filter")?.value || "";
      state.topic = app.querySelector("#topic-filter")?.value || "";
      state.page = 0;
      if (location.hash === "#/library/" + name) render();
      else location.hash = "/library/" + name;
    });
    bindSequence(previous, next, "#/learn");
  }

  function satsangView(all, selected) {
    const matches = all.filter((entry) =>
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
      filters = [state.month ? monthLabel(state.month) : "", state.search ? "Matching: " + state.search : "", state.topic].filter(Boolean);
    let calendarMonth = state.month || item?.date.slice(0, 7) || months[months.length - 1];
    app.innerHTML = `<section class="view satsang-view"><div class="satsang-top">${heading("Satsangs", '<a href="#/learn">Learn Swamiji’s Teachings</a>')}<div class="satsang-tools"><form class="satsang-search" role="search"><input type="search" name="thought" aria-label="Search Satsangs" placeholder="Find a thought…" value="${esc(state.search)}"><button type="submit" aria-label="Search messages">↗</button></form><details class="satsang-calendar"><summary>${calendarIcon}<span>Calendar</span>${state.month ? '<i aria-hidden="true"></i>' : ""}</summary><div class="satsang-calendar-panel"><div class="satsang-calendar-head"><button type="button" data-calendar-step="-1" aria-label="Previous month">←</button><h2 id="satsang-calendar-month"></h2><button type="button" data-calendar-step="1" aria-label="Next month">→</button></div><div class="calendar-weekdays" aria-hidden="true">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span>${d}</span>`).join("")}</div><div class="satsang-calendar-days" aria-labelledby="satsang-calendar-month"></div><p class="calendar-hint">Choose a highlighted date to open its Satsang.</p><div class="calendar-actions"><button type="button" data-calendar-month>Read this month</button><button type="button" data-satsang-clear>All dates</button></div></div></details><label class="satsang-topic">A theme to reflect on<select aria-label="Filter Satsangs by theme"><option value="">Every theme</option>${[...new Set(all.flatMap((e) => e.topics || e.tags || []))].sort().map((topic) => `<option value="${esc(topic)}" ${state.topic === topic ? "selected" : ""}>${esc(topic)}</option>`).join("")}</select></label></div></div><div class="satsang-filter-note">${filters.length ? `<span>${esc(filters.join(" · "))}</span><button type="button" data-satsang-clear>Show all Satsangs ×</button>` : '<span>A quiet moment. A little clarity.</span>'}</div><div class="satsang-stage"><article class="satsang-message-card ${item ? "" : "satsang-empty"}"><figure class="satsang-photo">${photo(getCategory("teachings").cover, "His Holiness Sri Vidyanarayana Thirtha Swamiji by the water")}</figure><div class="satsang-copy"><div class="satsang-meta"><p class="satsang-kicker">WORDS FOR EVERYDAY LIFE</p>${item ? `<time datetime="${esc(item.date)}">${dateLabel(item.date)}</time>` : '<span class="satsang-no-date">A moment to begin again</span>'}</div>${item ? `<h2><a href="#/read/readings/${esc(item.id)}">${esc(item.title)}</a></h2><p class="satsang-lead">${esc(item.lead || item.essence || "")}</p><div class="satsang-read"><a class="button" href="#/read/readings/${esc(item.id)}">Read this Satsang <span aria-hidden="true">↗</span></a><span>Edited Satsang reflection</span></div>` : '<h2>No Satsangs match this selection.</h2><p class="satsang-lead">Try another word, choose a highlighted calendar date, or return to all messages.</p><button class="button" type="button" data-satsang-clear>Show all Satsangs ↗</button>'}</div></article></div><nav class="satsang-navigation" aria-label="Browse Satsangs">${previous ? `<a href="${previous}" aria-label="Previous Satsang">← <span>Previous</span></a>` : '<button type="button" disabled aria-label="Previous Satsang">← <span>Previous</span></button>'}<div><strong>${item ? dateLabel(item.date) : "No matching message"}</strong><span>${item ? `${index + 1} of ${matches.length} Satsangs` : "Choose another date or clear your filters"}</span></div>${next ? `<a href="${next}" aria-label="Next Satsang"><span>Next</span> →</a>` : '<button type="button" disabled aria-label="Next Satsang"><span>Next</span> →</button>'}</nav></section>`;
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
        return `<button type="button" data-satsang-date="${date}" aria-label="${esc(dateLabel(date) + (entry ? "" : " — no Satsang available"))}" ${entry ? `class="available" title="${esc(entry.title)}"` : "disabled"} aria-pressed="${item?.date === date}">${i + 1}</button>`;
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
        state.month = entry.date.slice(0, 7); state.search = ""; state.topic = ""; state.page = 0;
        if (location.hash === route(entry)) render(); else location.hash = route(entry);
      } else if (button.hasAttribute("data-calendar-month")) {
        state.month = calendarMonth; state.search = ""; refresh();
      } else if (button.hasAttribute("data-satsang-clear")) {
        state.month = ""; state.search = ""; state.topic = ""; refresh();
      }
    });
    app.querySelector(".satsang-search").addEventListener("submit", (event) => {
      event.preventDefault(); state.search = new FormData(event.currentTarget).get("thought").trim(); refresh();
    });
    app.querySelector(".satsang-topic select").addEventListener("change", (event) => {
      state.topic = event.target.value; refresh();
    });
    calendar.addEventListener("toggle", () => { if (calendar.open) paintCalendar(); });
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
    const outside = (event) => { if (calendar.open && !calendar.contains(event.target)) calendar.open = false; },
      escape = (event) => {
        if (calendar.open && event.key === "Escape") {
          calendar.open = false; calendar.querySelector("summary").focus();
          event.preventDefault(); event.stopImmediatePropagation();
        }
      };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    paintCalendar();
    bindSequence(previous || location.hash, next || location.hash, "#/learn");
    const release = cleanup;
    cleanup = () => { release(); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }

  function bookShelf(books, selected) {
    let index = Math.max(
      0,
      books.findIndex((e) => e.id === (selected || deckMemory.get("books"))),
    );
    const book = books[index],
      after = books[(index + 1) % books.length];
    deckMemory.set("books", book.id);
    const previous =
        "#/library/books/" +
        books[(index - 1 + books.length) % books.length].id,
      next = "#/library/books/" + after.id;
    app.innerHTML = `<section class="view books-experience">${heading("A quiet companion for the journey.", '<a href="#/learn">Learn Swamiji’s Teachings</a>')}<div class="book-scene"><div class="book-copy"><p class="eyebrow">${book.reader ? "A SPECIAL DIGITAL EDITION · READ HERE" : "THE BOOK COLLECTION"}</p><h2>${esc(book.title)}</h2><p>${esc(book.subtitle || "Teachings to read, reflect upon, and bring into everyday life.")}</p><p class="book-attribution">${esc(book.attribution)}</p><div class="story-actions">${book.reader ? '<a class="button" href="reading-room.html?open=1">Open the book →</a>' : `<a class="button" href="${href(book.purchaseUrl)}" target="_blank" rel="noopener">View the book ↗</a>`}${book.reader ? "" : `<a class="text-link" href="#/read/books/${esc(book.id)}">About this edition →</a>`}</div>${book.reader ? '<span class="scene-kicker">180 pearls · Save your place · Read at your own pace</span>' : '<span class="scene-kicker">Published editions and availability depend on the seller.</span>'}</div><div class="book-display"><a class="physical-book" href="${book.reader ? "reading-room.html?open=1" : "#/read/books/" + esc(book.id)}" aria-label="${book.reader ? "Open" : "Explore"} ${esc(book.title)}">${photo(book.cover, book.title)}<span aria-hidden="true"></span></a><p>OPEN · READ · REFLECT</p></div></div><div class="book-shelf" aria-label="Choose a book">${books.map((b, i) => `<a href="#/library/books/${esc(b.id)}" ${i === index ? 'aria-current="true"' : ""} aria-label="Show ${esc(b.title)}">${photo(b.cover, b.title)}<span>${String(i + 1).padStart(2, "0")}</span></a>`).join("")}</div>${sceneControls(previous, next, `${String(index + 1).padStart(2, "0")} / ${String(books.length).padStart(2, "0")}`, "All eight books")}</section>`;
    bindSequence(previous, next, "#/learn");
  }

  async function reader(name, id) {
    const token = routeToken;
    const data = await collection(name);
    if (token !== routeToken) return;
    theme(getCategory("teachings"));
    let list = collectionEntries(data);
    if (name === "readings") {
      const filtered = list.filter(e => (!state.month || e.date.startsWith(state.month)) && (!state.topic || (e.topics || e.tags || []).includes(state.topic)) && (!state.search || JSON.stringify(e).toLowerCase().includes(state.search.toLowerCase())));
      list = (filtered.some(e => e.id === id) ? filtered : list).slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    }
    const item = list.find((e) => String(e.id || e.number) === id);
    if (!item) throw Error("This reading is not available.");
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
    app.innerHTML = `<section class="view">${heading(name === "readings" ? dateLabel(item.date) : name === "books" ? "The book collection" : libNames[name], `<a href="#/library/${esc(name)}">${esc(libNames[name])}</a>`)}<div class="reader-layout"><aside class="reader-aside">${photo(item.cover || getCategory("teachings").cover, title)}<div class="reader-controls"><span>Reading size</span><button data-action="reader-size" data-delta="-1" aria-label="Decrease reading text size">A−</button><button data-action="reader-size" data-delta="1" aria-label="Increase reading text size">A+</button></div><p>A little time to read.<br>A little space to reflect.</p><span class="tag">${name === "readings" ? dateLabel(item.date) : libNames[name]}</span></aside><article class="reader-scroll" tabindex="0" aria-label="Reading"><p class="reader-position">${list.indexOf(item)+1} of ${list.length} · ${name === "readings" ? "Edited Satsang reflection" : esc(libNames[name])}</p>${body}<nav class="reader-next" aria-label="Continue reading">${list.indexOf(item) > 0 ? `<a href="#/read/${name}/${esc(list[list.indexOf(item) - 1].id || list[list.indexOf(item) - 1].number)}">← Previous</a>` : ""}<a href="#/library/${name}${name === "readings" ? "/" + esc(item.id) : ""}">Back to ${esc(libNames[name])}</a>${list.indexOf(item) < list.length - 1 ? `<a href="#/read/${name}/${esc(list[list.indexOf(item) + 1].id || list[list.indexOf(item) + 1].number)}">Next →</a>` : ""}</nav></article></div></section>`;
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
    const primaryId = record.receipts[0].id,
      schoolProfile = profiles.find((p) => p.recordIds.includes(primaryId)),
      event = getEvent(schoolProfile?.eventId || links.records?.[primaryId]?.eventIds?.[0]),
      c =
        getCategory(
          links.categoryAliases?.[record.category] || record.category,
        ) || getCategory("foundation");
    const supportCover = schoolProfile?.cover || event?.cover;
    theme(c);
    const previous =
        "#/record/" + records[(index - 1 + records.length) % records.length].id,
      next = "#/record/" + records[(index + 1) % records.length].id;
    app.innerHTML = `<section class="view story-view support-record-view" data-back="#/category/${esc(c.id)}">${heading(c.title + " · support", '<a href="#/category/' + c.id + '">' + esc(c.title) + "</a>")}<div class="story-scene"><div class="scene-backdrop" style="${supportCover ? `background-image:url('${href(supportCover)}')` : ""}"></div><div class="story-copy"><p class="eyebrow">${esc(record.date ? dateLabel(record.date) : "SERVICE THROUGH GENEROSITY")}</p><h2>${esc(record.recipient)}</h2><p class="story-description">${esc(record.summary || "A contribution to " + record.recipient + ".")}</p><div class="record-context"><small>${esc(record.amountLabel || "Recorded support")}</small><strong class="record-amount">${record.approximate ? "≈ " : ""}${formatMoney(record.amount)}</strong>${record.displayDonor || record.donor ? `<span class="record-donor">${esc(record.displayDonor || record.donor)}</span>` : ""}</div>${event && event.presentation !== "service-story" ? `<a class="button" href="#/event/${esc(event.id)}">View photographs →</a>` : `<a class="button" href="#/foundation/connect">Contact the foundation →</a>`}<details class="evidence-note ${record.receipts.length > 1 ? "grouped-receipts" : ""}"><summary>${record.receipts.length > 1 ? `Receipts (${record.receipts.length}) ↗` : "Read the supporting acknowledgement"}</summary><div class="evidence-content">${record.receipts.length > 1 ? `<div class="contribution-receipts">${record.receipts.map((receipt) => `<a href="${href(receipt.src)}" target="_blank" rel="noopener"><strong>${formatMoney(receipt.amount)}</strong><span>${esc(receipt.date ? dateLabel(receipt.date) : receipt.evidenceLabel)}</span><small>Full-page receipt ↗</small></a>`).join("")}</div>` : `<p>${esc(record.publicEvidenceLabel || record.evidenceLabel)}</p>${record.document ? `<p>Full acknowledgement · ${record.document.pageCount} ${record.document.pageCount === 1 ? "page" : "pages"}.</p>` : ""}${record.src ? `<a class="text-link" href="${href(record.src)}" target="_blank" rel="noopener">View full-page document ↗</a>` : ""}${
      record.src && event?.media?.length
        ? `<div class="evidence-links">${event.media
            .filter((m) => m.src !== record.src && m.id.includes(record.id))
            .map(
              (m) =>
                `<a href="${href(m.src)}" target="_blank" rel="noopener">${esc(m.title || "Related supporting document")} ↗</a>`,
            )
            .join("")}</div>`
        : ""
    }`}</div></details>${event?.photoSource ? `<a class="school-photo-credit" href="${esc(event.photoSource)}" target="_blank" rel="noopener">${esc(event.photoCredit)} ↗</a>` : ""}</div><div class="foundation-image recipient-image">${supportCover ? photo(supportCover, schoolProfile?.title || event?.coverAlt || event?.title || c.title) : ""}</div></div>${sceneNavigation(c.title + " support", records.map((r) => ({ title: r.navigationTitle || r.recipient, href: "#/record/" + r.id })), index, previous, next)}</section>`;
    bindSequence(previous, next, "#/category/" + c.id);
  }
  function about() {
    theme(getCategory("his-holiness"));
    app.innerHTML = `<section class="view">${heading("A tribute, through real moments.", "About the collection")}<article class="about-scroll"><p>This collection brings together the many expressions of His Holiness Sri Vidyanarayana Thirtha Swamiji’s life: spiritual practice, learning, care, service, and everyday wisdom.</p><h2>Begin with a photograph.</h2><p>Choose a portrait, open a collection, and step into an occasion. Photographs, films, audio recordings, messages, and readings stay together with their context.</p><h2>Care for the source.</h2><p>Visit identities and original media were shared by the foundation. An exact date appears only where it was supplied. Historical acknowledgements retain their named donors. Devotee reflections, edited summaries, and practical paraphrases are distinguished from original texts.</p><h2>A growing collection.</h2><p>This is a living collection of moments shared through the foundation: a place to return to for quiet reading, listening, and discovery.</p><p><a href="#/foundation/connect">Connect with the foundation →</a></p></article></section>`;
  }
  function finishNavigation(parts) {
    const title = app.querySelector(".satsang-copy h2,.reader-scroll h1,.story-copy h2,.book-copy h2,.cinema-heading h1,h1")?.textContent.trim() || site.title;
    document.title = parts.length ? title + " — " + site.title : "Sri Vidyanarayana Thirtha Swamiji — " + site.title;
    const summary = app.querySelector(".satsang-lead,.story-description,.reader-scroll .lead")?.textContent || "A living tribute to His Holiness Sri Vidyanarayana Thirtha Swamiji, through spiritual practice, teaching and service.";
    document.querySelector('meta[name="description"]').content = summary;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = summary;
    document.querySelector('meta[property="og:url"]').content = location.href;
    document.querySelectorAll(".masthead nav a").forEach(link => {
      const route = link.getAttribute("href"), selected = route === "#/" ? !parts.length : route === "#/learn" ? ["learn","library","read"].includes(parts[0]) : route === "#/explore" ? ["explore","category","event","record"].includes(parts[0]) : parts[0] === "foundation";
      if (selected) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    const back = document.querySelector("#back-view"), parent = parentRoute();
    const parentName = parent === "#/" ? "Home" : parent.startsWith("#/category/") ? getCategory(parent.split('/')[2])?.shortTitle || "section" : parent.startsWith("#/library/") ? libNames[parent.split('/')[2]] : parent === "#/learn" ? "Teachings" : "Foundation";
    back.textContent = parentName === "Home" ? "← Back" : "← " + parentName; back.setAttribute("aria-label", "Back to " + parentName);
    app.querySelectorAll('a[href^="#/"]').forEach(link => {
      const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) walker.currentNode.textContent = walker.currentNode.textContent.replace(/↗/g, "→");
    });
    const focus = app.querySelector("h1");
    if (focus && parts.length) { focus.tabIndex = -1; focus.focus({preventScroll:true}); }
    announce.textContent = title;
    if (parts[0] === "foundation" && parts[1] === "connect") {
      const dialog = app.querySelector("#contact-dialog");
      if (dialog) { dialog.removeAttribute("open"); dialog.showModal(); dialog.addEventListener("close", () => { if (location.hash === "#/foundation/connect") location.hash = "#/foundation"; }); }
    }
  }
  async function render() {
    if (!site) return;
    const token = ++routeToken;
    const nextParts = routeParts();
    document.querySelector("#back-view").hidden = !nextParts.length;
    document.querySelector(".start-link").hidden = !nextParts.length;
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
    document.querySelector(".masthead nav").classList.remove("open");
    document
      .querySelector(".mobile-menu")
      .setAttribute("aria-expanded", "false");
    document.querySelector(".mobile-menu").setAttribute("aria-label", "Open navigation");
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
      } else if (parts[0] === "learn") teachingGateway();
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
      transitionDirection = mediaLink.getAttribute("aria-label") === "Previous moment" ? -1 : 1;
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
    if (parts[0] === "foundation") route = "#/foundation";
    const url = site.sharePages?.[route] ? new URL(site.sharePages[route], location.href).href : location.href;
    try { await navigator.clipboard.writeText(url); announce.textContent = "Link copied"; document.querySelector("#share-view").textContent = "Copied"; setTimeout(() => { document.querySelector("#share-view").textContent = "Share"; }, 2000); }
    catch (_) { announce.textContent = "Copy this page’s address from your browser to share it."; }
  });
  document.querySelector("#back-view").addEventListener("click", () => {
    location.hash = parentRoute();
  });
  document.querySelector(".skip").addEventListener("click", (e) => {
    e.preventDefault();
    app.focus({ preventScroll: true });
  });
  document.querySelector(".mobile-menu").addEventListener("click", () => {
    const nav = document.querySelector(".masthead nav"),
      button = document.querySelector(".mobile-menu");
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelector(".masthead nav").classList.remove("open");
      document
        .querySelector(".mobile-menu")
        .setAttribute("aria-expanded", "false");
    document.querySelector(".mobile-menu").setAttribute("aria-label", "Open navigation");
    }
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
