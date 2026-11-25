(() => {
  "use strict";
  const app = document.querySelector("#app"),
    announce = document.querySelector("#announcement");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const cache = new Map();
  let site,
    routeToken = 0,
    cleanup = () => {},
    activeTheme = "",
    washSide = 0,
    readerSize = 17;
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
    homeCategory = "",
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
  const photo = (src, alt = "", cls = "", position = "") =>
    src
      ? `<img src="${href(src)}" alt="${esc(alt)}" class="${cls}" ${position ? `style="object-position:${esc(position)}"` : ""} decoding="async">`
      : "";
  const getCategory = (id) => site.categories.find((c) => c.id === id);
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
      const request = fetch(url)
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
    const cats = site.categories.filter(
      (c) => c.published !== false && c.cover,
    );
    let current = Math.max(
        0,
        cats.findIndex((c) => c.id === homeCategory),
      ),
      elapsed = 0,
      last = performance.now(),
      playing = !reduced.matches,
      pointer = null,
      suppress = false;
    app.innerHTML = `<section class="home"><div class="home-intro"><p class="eyebrow">HIS HOLINESS SRI VIDYANARAYANA THIRTHA SWAMIJI</p><h1>A life of wisdom. <em>A world of care.</em></h1></div><div class="portrait-carousel" aria-label="The many sides of Swamiji" aria-roledescription="carousel">${cats.map((c, i) => `<button class="portrait" data-category="${esc(c.id)}" data-index="${i}" aria-label="${esc(c.title)}" aria-pressed="${i === 0}" style="--card-accent:${c.theme.accent};--card-paper:${c.theme.surface || "#fffaf1"};--position:${esc(c.position || "50% 35%")}">${photo(c.cover, c.coverAlt || c.title)}<span><small>${esc(c.eyebrow)}</small><strong>${esc(c.title)}</strong></span></button>`).join("")}</div><div class="home-note"><p id="home-caption"></p><div class="home-actions"><a class="button" id="chapter-link" href="#/">Explore this side <span aria-hidden="true">↗</span></a><a class="text-link" href="#/explore">Discover his life <span aria-hidden="true">↗</span></a></div></div><div class="carousel-controls"><button data-home="previous" aria-label="Previous portrait">←</button><nav class="dots" aria-label="Choose a portrait">${cats.map((c, i) => `<button data-home-index="${i}" aria-label="Show ${esc(c.title)}" aria-pressed="${i === 0}"></button>`).join("")}</nav><button data-home="next" aria-label="Next portrait">→</button><button class="play" aria-label="Pause automatic rotation" data-home="play">Ⅱ</button></div></section>`;
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
      theme(c);
      app.querySelector("#home-caption").textContent = c.caption;
      app.querySelector("#chapter-link").href =
        c.id === "teachings" ? "#/learn" : "#/category/" + c.id;
      position();
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
      if (playing && !document.hidden) {
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

  const deckMemory = new Map();
  const short = (text, n = 210) =>
    String(text || "").length > n
      ? String(text)
          .slice(0, n)
          .replace(/\s+\S*$/, "") + "…"
      : String(text || "");
  const experienceLinks = () =>
    site.categories
      .filter((c) => c.published !== false && c.cover)
      .map((c) => ({
        title: c.title,
        href: c.id === "teachings" ? "#/learn" : "#/category/" + c.id,
      }));
  function choiceDialog(title, links) {
    return `<dialog class="scene-index" id="scene-index"><div class="index-head"><p class="eyebrow">CHOOSE WHAT SPEAKS TO YOU</p><button data-action="close-index" aria-label="Close choices">×</button></div><h2>${esc(title)}</h2><div class="index-links">${links.map((x, i) => `<a href="${href(x.href)}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(x.title)}<b aria-hidden="true">↗</b></a>`).join("")}</div></dialog>`;
  }
  function sceneControls(previous, next, label, button = "Choose a moment") {
    return `<div class="scene-controls"><button class="scene-choice" data-action="open-index">${esc(button)} <span aria-hidden="true">↗</span></button><div class="sequence"><a href="${href(previous)}" aria-label="Previous story">←</a><span>${esc(label)}</span><a href="${href(next)}" aria-label="Next story">→</a></div><span class="gesture-note">Swipe or use ← →</span></div>`;
  }
  function bindSequence(previous, next, back) {
    let startX = 0,
      startY = 0,
      started = false;
    const ignored = (e) =>
      e.target.closest?.(
        "input,select,textarea,video,audio,iframe,dialog,[contenteditable=true]",
      );
    const key = (e) => {
      if (ignored(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        location.hash = next;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        location.hash = previous;
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
        swipeDeadline = performance.now()+350;
        location.hash = dx < 0 ? next : previous;
      }
    };
    document.addEventListener("keydown", key);
    app.addEventListener("pointerdown", down);
    app.addEventListener("pointerup", up);
    cleanup = () => {
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
  ) {
    return `<div class="story-art ${book ? "book-art" : ""}"><div class="art-orbit" aria-hidden="true"></div>${nextCover ? `<a class="next-glimpse" href="${href(nextHref)}" aria-label="Next story">${photo(nextCover, "")}<span>Up next ↗</span></a>` : ""}<a class="story-image" href="${href(openHref || nextHref)}" aria-label="${esc(title)}">${photo(cover, title, "", position)}</a></div>`;
  }
  function chapterNav(current) {
    return `<nav class="chapter-nav" aria-label="Sides of Swamiji’s life">${experienceLinks()
      .map(
        (c) =>
          `<a href="${href(c.href)}" ${c.href.endsWith("/" + current) ? 'aria-current="page"' : ""}>${esc(c.title)}</a>`,
      )
      .join("")}</nav>`;
  }

  function explore(selected) {
    const cats = site.categories.filter(
      (c) => c.published !== false && c.cover,
    );
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
    app.innerHTML = `<section class="view story-view">${heading("His life, in action.", '<a href="#/">Meet Swamiji</a>')}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(c.cover)}')"></div><div class="story-copy"><p class="eyebrow">${esc(c.eyebrow)}</p><h2>${esc(c.headline || c.title)}</h2><p class="story-description">${esc(c.caption)}</p><a class="button" href="${target}">${c.id === "teachings" ? "Learn from Swamiji" : "Meet this side"} <span aria-hidden="true">↗</span></a><span class="scene-kicker">${esc(c.title)}</span></div>${sceneArt(c.cover, c.title, after.cover, next, c.position || "50% 35%", false, target)}</div>${sceneControls(prev, next, `${String(index + 1).padStart(2, "0")} / ${String(cats.length).padStart(2, "0")}`, "All perspectives")}${choiceDialog("A life. Many expressions.", experienceLinks())}</section>`;
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
    const events = site.events.filter(
      (e) => e.category === id && e.published !== false,
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
    deckMemory.set(id, event.id);
    const base = "#/category/" + id + "/moments/",
      prev = base + events[(index - 1 + events.length) % events.length].id,
      next = base + after.id,
      target =
        event.presentation === "service-story" && event.supportRecordIds?.length
          ? "#/record/" + event.supportRecordIds[0]
          : "#/event/" + event.id;
    app.innerHTML = `<section class="view story-view">${heading(c.title, '<a href="#/explore/' + id + '">His life in action</a>')}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(event.cover)}')"></div><div class="story-copy"><p class="eyebrow">${esc([event.location, event.date ? dateLabel(event.date) : event.year].filter(Boolean).join(" · ") || c.eyebrow)}</p><h2>${esc(event.title)}</h2><p class="story-description">${esc(short(event.description || c.caption))}</p><a class="button" href="${target}">${id === "his-holiness" && event.id === "swamiji-stuti" ? "Read the Stuti" : event.presentation === "service-story" ? "Discover this service" : "Step into this moment"} <span aria-hidden="true">↗</span></a><span class="scene-kicker">${
      event.presentation === "service-story"
        ? "A story of support"
        : Object.entries(event.counts || {})
            .map(
              ([k, v]) =>
                `${v} ${v === 1 ? { photos: "photograph", films: "film", recordings: "recording", documents: "document" }[k] || k : k}`,
            )
            .join(" · ")
    }</span></div>${sceneArt(event.cover, event.title, events.length > 1 ? after.cover : "", next, event.coverPosition || "50% 35%", false, target)}</div>${sceneControls(prev, next, `${String(index + 1).padStart(2, "0")} / ${String(events.length).padStart(2, "0")}`, "Choose an occasion")}${chapterNav(id)}${choiceDialog(
      c.title,
      events.map((e) => ({ title: e.title, href: base + e.id })),
    )}</section>`;
    bindSequence(prev, next, "#/explore/" + id);
  }
  function foundationView(connect = false) {
    const c = getCategory("foundation");
    theme(c);
    app.innerHTML = `<section class="view story-view">${heading("Inspired by his example.", "The foundation")}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(c.cover)}')"></div><div class="story-copy"><p class="eyebrow">VIDYA · VAIDYA · VASATHI</p><h2>Kindness.<br><em>Carried forward.</em></h2><p class="story-description">${esc(site.foundation.description)}</p><div class="story-actions"><a class="button" href="#/foundation/connect">Be part of the work ↗</a><a class="text-link" href="#/category/foundation/moments">Moments of service ↗</a></div><a class="quiet-link" href="#/foundation/support">A clear account of historical support ↗</a></div><div class="foundation-image">${photo(c.cover, "Service inspired by Swamiji’s example")}</div></div>${connect ? `<dialog class="scene-index contact-dialog" id="contact-dialog" open><div class="index-head"><p class="eyebrow">A CONVERSATION IS A BEGINNING</p><a href="#/foundation" aria-label="Close contact details">×</a></div><h2>Let’s serve together.</h2><p>For current needs, volunteering and contribution guidance, speak with the foundation team.</p><a class="contact-link" href="mailto:${esc(site.foundation.email)}">${esc(site.foundation.email)}</a><a class="contact-link" href="tel:${esc(site.foundation.phone.replace(/[^+\d]/g, ""))}">${esc(site.foundation.phone)}</a><p>${esc(site.foundation.office)}</p></dialog>` : ""}<div class="foundation-bottom"><a href="#/category/education">Encourage learning ↗</a><a href="#/category/healthcare">Care for wellbeing ↗</a><a href="#/category/annadanam">Share nourishment ↗</a></div></section>`;
  }
  async function supportView() {
    const token = routeToken;
    const data = await collection("contributions");
    if (token !== routeToken) return;
    const first = data.records?.[0];
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
    const related = site.events.filter(
      (e) => e.category === event.category && !e.id.startsWith("message-"),
    );
    const relatedIndex = related.findIndex((e) => e.id === id),
      after = related[(relatedIndex + 1) % related.length];
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
    app.innerHTML = `<section class="view cinema-view"><div class="cinema-heading"><a class="back-story" href="${href(parent)}">← ${esc(event.backLabel || getCategory(event.category)?.title || "Back to the story")}</a><p>${esc([event.location, event.date ? dateLabel(event.date) : event.year].filter(Boolean).join(" · "))}</p><h1>${esc(event.title)}</h1></div>${mediaTabs(event, type)}<div class="cinema-body"><div class="cinema-stage"><div class="cinema-backdrop" style="background-image:url('${href(item?.poster || event.cover)}')"></div>${frame}<div class="cinema-arrows"><a href="#${prev}" aria-label="Previous moment" ${index === 0 ? 'aria-disabled="true" tabindex="-1"' : ""}>←</a><a href="#${next}" aria-label="Next moment" ${index === media.length - 1 ? 'aria-disabled="true" tabindex="-1"' : ""}>→</a></div></div><aside class="cinema-caption"><span class="eyebrow">${type === "photo" ? "A MOMENT TO REMEMBER" : type === "audio" ? "VOICES OF THE OCCASION" : "FROM THE OCCASION"} · ${index + 1} / ${media.length}</span><h2>${esc(item?.title || event.title)}</h2><p>${esc(short(item?.caption || event.description, 320))}</p><details><summary>About this occasion</summary><p>${esc(event.description)}</p><p>${esc(event.credit)} ${esc(event.note)}</p></details><a class="text-link" href="${href(item?.src || item?.url || parent)}" target="_blank" rel="noopener">${type === "photo" ? "View full photograph" : type === "document" ? "Read original document" : "Open recording"} ↗</a>${after && after.id !== id ? `<a class="onward-story" href="#/category/${esc(event.category)}/moments/${esc(after.id)}"><small>ANOTHER MOMENT</small>${esc(after.title)} <span>→</span></a>` : `<a class="onward-story" href="#/learn"><small>STAY A LITTLE LONGER</small>Learn Swamiji’s teachings →</a>`}</aside></div><div class="moment-ribbon" aria-label="Choose a moment">${media.map((m, i) => `<a href="#/event/${esc(id)}/${type}/${i}" ${i === index ? 'aria-current="true"' : ""} aria-label="${esc(m.title || "Moment " + (i + 1))}">${m.type === "photo" ? photo(m.thumb || m.src, "") : m.poster ? photo(m.poster, "") : `<span>${type === "audio" ? "Listen" : type === "video" ? "Film" : "Read"} ${i + 1}</span>`}</a>`).join("")}</div></section>`;
    bindSequence(prev, next, parent);
    app.querySelector(".moment-ribbon [aria-current]")?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduced.matches ? "instant" : "smooth",
    });
  }

  const libNames = {
    readings: "Satsangh Messages",
    pearls: "Pearls of Wisdom",
    teachings: "Practical teachings",
    books: "Books",
    messages: "Messages & blessings",
  };
  function teachingGateway() {
    theme(getCategory("teachings"));
    const choices = [
      {
        id: "readings",
        eyebrow: "A THOUGHT FOR TODAY",
        title: "Satsangh Messages",
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
        title: "Message Cards & Blessings",
        description:
          "Open the card. Unfold a message. Keep its thought with you.",
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
    app.innerHTML = `<section class="view learning-gateway">${heading("Learn Swamiji’s Teachings.", '<a href="#/">Meet Swamiji</a>', "A thought to reflect on. A way to live.")}<div class="learning-doors">${choices.map((c, i) => `<a class="learning-door ${c.id}" href="${c.href}"><span class="door-number">0${i + 1}</span><div class="door-art">${photo(c.cover, c.title)}</div><div class="door-copy"><p class="eyebrow">${c.eyebrow}</p><h2>${c.title}</h2><p>${c.description}</p><span class="door-action">${c.id === "messages" ? "Open a card" : c.id === "books" ? "Find a book" : c.id === "readings" ? "Read a reflection" : "Begin with a teaching"} ↗</span></div></a>`).join("")}</div><a class="gateway-pearl" href="reading-room.html">A quiet moment? Open Pearls of Wisdom →</a></section>`;
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
    app.innerHTML = `<section class="view reflection-view">${heading(name === "readings" ? "Satsangh Messages" : "Everyday Teachings", '<a href="#/learn">Learn Swamiji’s Teachings</a>')}<div class="reflection-scene"><div class="reflection-portrait">${photo(getCategory("teachings").cover, "Sri Swamiji")}</div><div class="reflection-intro"><p class="eyebrow">${name === "readings" ? "PAUSE · REFLECT · BRING IT INTO YOUR DAY" : "UNDERSTAND · PRACTISE · GROW"}</p><h2>${headingText.split(" ").slice(0, 2).join(" ")}<br><em>${headingText.split(" ").slice(2).join(" ")}</em></h2><p>${name === "readings" ? "A few quiet words can change how we meet the day. Begin with a reflection from Swamiji’s satsangh." : "Wisdom takes shape in the way we live. Begin with one teaching, and a small action you can make your own."}</p><a class="text-link" href="#/learn">Other ways to learn ↗</a></div><div class="thought-deck">${item ? `<a class="thought-behind back-left" href="${previous}" aria-label="Previous reflection"><span>${esc(list[(index - 1 + list.length) % list.length].title || "A moment of reflection")}</span></a><a class="thought-behind back-right" href="${next}" aria-label="Next reflection"><span>${esc(list[(index + 1) % list.length].title || "A little everyday wisdom")}</span></a><a class="thought-paper" href="${target(item)}"><span class="paper-date">${name === "readings" ? dateLabel(item.date) : "A TEACHING FOR EVERYDAY LIFE"}</span><span class="paper-rule"></span><h3>${esc(item.title || item.caption || "A reflection")}</h3><p>${esc(short(item.lead || item.meaning || item.text, 245))}</p><span class="paper-action">${name === "readings" ? "Read. Reflect. Carry it with you." : "Understand. Put it into practice."} ↗</span><small>${name === "readings" ? "An edited satsangh reflection" : "A practical paraphrase"} · Sri Swamiji</small></a>` : '<div class="thought-paper empty"><h3>No matching reflection.</h3><p>Try another thought, month or topic.</p><button data-action="open-index" class="button">Find a thought ↗</button></div>'}</div></div><div class="reflection-bottom">${sceneControls(previous, next, item ? `${index + 1} / ${list.length}` : "", "Find a thought")}<span class="reflection-note">${state.search || state.month || state.topic ? `Showing your selection · <button data-action="clear-reflection-search">Show all reflections</button>` : "One reflection at a time. At your own pace."}</span></div><dialog class="scene-index reflection-search" id="scene-index"><div class="index-head"><p class="eyebrow">WHAT IS ON YOUR MIND?</p><button data-action="close-index" aria-label="Close search">×</button></div><h2>Find a thought.</h2><form id="reflection-filter"><label for="library-search">A word or question</label><input type="search" id="library-search" placeholder="Gratitude, duty, love…" value="${esc(state.search)}">${
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
    app.innerHTML = `<section class="view books-experience">${heading("A quiet companion for the journey.", '<a href="#/learn">Learn Swamiji’s Teachings</a>')}<div class="book-scene"><div class="book-copy"><p class="eyebrow">${book.reader ? "A SPECIAL DIGITAL EDITION · READ HERE" : "THE BOOK COLLECTION"}</p><h2>${esc(book.title)}</h2><p>${esc(book.subtitle || "Teachings to read, reflect upon, and bring into everyday life.")}</p><p class="book-attribution">${esc(book.attribution)}</p><div class="story-actions">${book.reader ? '<a class="button" href="reading-room.html">Open the book ↗</a>' : `<a class="button" href="${href(book.purchaseUrl)}" target="_blank" rel="noopener">View the book ↗</a>`}<a class="text-link" href="${book.reader ? "reading-room.html" : "#/read/books/" + esc(book.id)}">${book.reader ? "Enter the reading room" : "About this edition"} →</a></div>${book.reader ? '<span class="scene-kicker">180 pearls · Save your place · Read at your own pace</span>' : '<span class="scene-kicker">Published editions and availability depend on the seller.</span>'}</div><div class="book-display"><a class="physical-book" href="${book.reader ? "reading-room.html" : "#/read/books/" + esc(book.id)}" aria-label="${book.reader ? "Open" : "Explore"} ${esc(book.title)}">${photo(book.cover, book.title)}<span aria-hidden="true"></span></a><p>OPEN · READ · REFLECT</p></div></div><div class="book-shelf" aria-label="Choose a book">${books.map((b, i) => `<a href="#/library/books/${esc(b.id)}" ${i === index ? 'aria-current="true"' : ""} aria-label="Show ${esc(b.title)}">${photo(b.cover, b.title)}<span>${String(i + 1).padStart(2, "0")}</span></a>`).join("")}</div>${sceneControls(previous, next, `${String(index + 1).padStart(2, "0")} / ${String(books.length).padStart(2, "0")}`, "All eight books")}${choiceDialog(
      "Wisdom to read. Values to live.",
      books.map((b) => ({ title: b.title, href: "#/library/books/" + b.id })),
    )}</section>`;
    bindSequence(previous, next, "#/learn");
  }

  async function reader(name, id) {
    const token = routeToken;
    const data = await collection(name);
    if (token !== routeToken) return;
    theme(getCategory("teachings"));
    const list = collectionEntries(data);
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
    app.innerHTML = `<section class="view">${heading(name === "readings" ? dateLabel(item.date) : name === "books" ? "The book collection" : libNames[name], `<a href="#/library/${esc(name)}">${esc(libNames[name])}</a>`)}<div class="reader-layout"><aside class="reader-aside">${photo(item.cover || getCategory("teachings").cover, title)}<div class="reader-controls"><span>Reading size</span><button data-action="reader-size" data-delta="-1" aria-label="Decrease reading text size">A−</button><button data-action="reader-size" data-delta="1" aria-label="Increase reading text size">A+</button></div><p>A little time to read.<br>A little space to reflect.</p><span class="tag">${name === "readings" ? dateLabel(item.date) : libNames[name]}</span></aside><article class="reader-scroll">${body}<nav class="reader-next" aria-label="Continue reading">${list.indexOf(item) > 0 ? `<a href="#/read/${name}/${esc(list[list.indexOf(item) - 1].id || list[list.indexOf(item) - 1].number)}">← Previous</a>` : ""}<a href="#/library/${name}">Back to ${esc(libNames[name])}</a>${list.indexOf(item) < list.length - 1 ? `<a href="#/read/${name}/${esc(list[list.indexOf(item) + 1].id || list[list.indexOf(item) + 1].number)}">Next →</a>` : ""}</nav></article></div></section>`;
  }
  async function messageView(id) {
    location.replace("message-cards.html?open=" + encodeURIComponent(id));
  }
  async function recordView(id) {
    const token = routeToken;
    const [data, links] = await Promise.all([
      collection("contributions"),
      collection("supportLinks"),
    ]);
    if (token !== routeToken) return;
    const records = data.records || [],
      index = records.findIndex((r) => String(r.id) === String(id)),
      record = records[index];
    if (!record) throw Error("This supporting note is not available.");
    const event = getEvent(links.records?.[id]?.eventIds?.[0]),
      c = getCategory(event?.category || "foundation");
    theme(c);
    const previous =
        "#/record/" + records[(index - 1 + records.length) % records.length].id,
      next = "#/record/" + records[(index + 1) % records.length].id;
    app.innerHTML = `<section class="view story-view">${heading("Service, and the support behind it.", '<a href="#/foundation">The foundation</a>')}<div class="story-scene"><div class="scene-backdrop" style="background-image:url('${href(event?.cover || c.cover)}')"></div><div class="story-copy"><p class="eyebrow">${esc(record.evidenceLabel || record.evidenceStatus)}</p><h2>${esc(record.recipient)}</h2><p class="story-description">${esc(record.attributionNote || "Historical support recorded in the supplied acknowledgement.")}</p><span class="record-context">${record.approximate ? "Approximately " : ""}${formatMoney(record.amount)}${record.donor ? " · Named donor: " + esc(record.donor) : ""}</span>${event && event.presentation !== "service-story" ? `<a class="button" href="#/event/${esc(event.id)}">Meet the story behind the support ↗</a>` : `<a class="button" href="#/foundation/connect">Carry this care forward ↗</a>`}<details class="evidence-note"><summary>Read the supporting acknowledgement</summary><p>${esc(record.evidenceLabel)}</p>${record.src ? `<a class="text-link" href="${href(record.src)}" target="_blank" rel="noopener">View the published original ↗</a>` : ""}<p>Historical support retains the donor or trust named in the source. Corpus principal and annual interest are distinct records.</p>${
      event?.media?.length
        ? `<div class="evidence-links">${event.media
            .filter((m) => m.src !== record.src)
            .map(
              (m) =>
                `<a href="${href(m.src)}" target="_blank" rel="noopener">${esc(m.title || "Related supporting document")} ↗</a>`,
            )
            .join("")}</div>`
        : ""
    }</details></div><div class="foundation-image">${photo(event?.cover || c.cover, event?.title || c.title)}</div></div>${sceneControls(previous, next, `${index + 1} / ${records.length}`, "Other service stories")}${choiceDialog(
      "The care behind the giving.",
      records.map((r) => ({ title: r.recipient, href: "#/record/" + r.id })),
    )}</section>`;
    bindSequence(previous, next, "#/foundation");
  }
  function about() {
    theme(getCategory("his-holiness"));
    app.innerHTML = `<section class="view">${heading("A tribute, through real moments.", "About the collection")}<article class="about-scroll"><p>This collection brings together the many expressions of His Holiness Sri Vidyanarayana Thirtha Swamiji’s life: spiritual practice, learning, care, service, and everyday wisdom.</p><h2>Begin with a photograph.</h2><p>Choose a portrait, open a collection, and step into an occasion. Photographs, films, audio recordings, messages, and readings stay together with their context.</p><h2>Care for the source.</h2><p>Visit identities and original media were shared by the foundation. An exact date appears only where it was supplied. Historical acknowledgements retain their named donors. Devotee reflections, edited summaries, and practical paraphrases are distinguished from original texts.</p><h2>A growing collection.</h2><p>This is a living collection of moments shared through the foundation: a place to return to for quiet reading, listening, and discovery.</p><p><a href="#/category/foundation">Connect with the foundation →</a></p></article></section>`;
  }
  async function render() {
    if (!site) return;
    const token = ++routeToken;
    cleanup();
    cleanup = () => {};
    app.querySelectorAll("video,audio").forEach((e) => e.pause());
    const parts = routeParts();
    restoreScope(parts);
    document.querySelector(".masthead nav").classList.remove("open");
    document
      .querySelector(".mobile-menu")
      .setAttribute("aria-expanded", "false");
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
          await recordView(getEvent(parts[1]).supportRecordIds[0]);
        else eventView(parts[1], parts[2], parts[3]);
      } else if (parts[0] === "learn") teachingGateway();
      else if (parts[0] === "foundation") {
        if (parts[1] === "support") await supportView();
        else foundationView(parts[1] === "connect");
      } else if (parts[0] === "library") await library(parts[1], parts[2]);
      else if (parts[0] === "read") await reader(parts[1], parts[2]);
      else if (parts[0] === "message") await messageView(parts[1]);
      else if (parts[0] === "record") await recordView(parts[1]);
      else if (parts[0] === "about") about();
      else throw Error("This part of the collection could not be found.");
      if (token === routeToken && !reduced.matches) {
        const foreground =
          parts[0] === "library" && parts[2]
            ? app.querySelector(".thought-paper,.physical-book")
            : parts[0] === "category" && parts[3]
              ? app.querySelector(".story-scene")
              : app.firstElementChild;
        foreground?.animate(
          [
            { opacity: 0, transform: "translateX(16px) rotateY(-5deg)" },
            { opacity: 1, transform: "translateX(0) rotateY(0)" },
          ],
          { duration: 600, easing: "cubic-bezier(.2,.65,.2,1)" },
        );
      }
      if (token === routeToken)
        document.title =
          (parts.length
            ? (getCategory(parts[1])?.title || "The collection") + " — "
            : "") + site.title;
    } catch (error) {
      if (token === routeToken) showError(error);
    }
  }
  app.addEventListener("click", e=>{if(performance.now()<swipeDeadline){swipeDeadline=0;e.preventDefault();e.stopImmediatePropagation();}},true);
  app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const action = b.dataset.action;
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
      location.hash = `/event/${b.dataset.event}/${b.dataset.type}/0`;
    if (action === "media-index")
      location.hash = `/event/${b.dataset.event}/${b.dataset.type}/${b.dataset.index}`;
    if (action === "reader-size") {
      readerSize = Math.max(
        15,
        Math.min(24, readerSize + Number(b.dataset.delta)),
      );
      document.body.style.setProperty("--reader-size", readerSize + "px");
    }
  });
  document.querySelector(".mobile-menu").addEventListener("click", () => {
    const nav = document.querySelector(".masthead nav"),
      button = document.querySelector(".mobile-menu");
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelector(".masthead nav").classList.remove("open");
      document
        .querySelector(".mobile-menu")
        .setAttribute("aria-expanded", "false");
    }
  });
  window.addEventListener("hashchange", render);
  matchMedia("(max-width: 750px)").addEventListener("change", () => {
    if (site && ["explore", "library"].includes(routeParts()[0])) render();
  });
  fetch("content/site.json")
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
