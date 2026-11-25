/* Private photo inbox. No Meta SDK, browser GitHub credentials, or paid AI. */
export const CATEGORIES = [
  "his-holiness",
  "education",
  "spiritual-life",
  "vedic-learning",
  "annadanam",
  "healthcare",
];
export const MAX_PHOTO = 500000;
export const MAX_PHOTOS = 20;
const MAX_BATCH = 8000000,
  MAX_INBOX = 100000000;
const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const now = () => Math.floor(Date.now() / 1000);
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export const sha = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
export function isWebP(bytes) {
  const b = new Uint8Array(bytes);
  return (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  );
}
export function metadata(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("The occasion details could not be read.");
  const clean = (v, max, required = false) => {
    if (
      typeof v !== "string" ||
      v.length > max ||
      /[\u0000-\u0008\u000b-\u001f]/.test(v)
    )
      fail("Check the title and caption.");
    v = v.trim();
    if (required && !v) fail("A title and caption are required.");
    if (/(?:\/Users\/|\/home\/|file:\/\/)/.test(v))
      fail("Use a public caption, without private file paths.");
    return v;
  };
  if (!CATEGORIES.includes(input.category)) fail("Choose a photo section.");
  const date = input.date || null;
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + "T12:00:00Z")) ||
      new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date)
  )
    fail("Check the occasion date.");
  const target = input.target || null;
  if (target && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target))
    fail("Choose an existing occasion from the list.");
  return {
    category: input.category,
    title: clean(input.title, 150, true),
    caption: clean(input.caption, 1500, true),
    location: clean(input.location || "", 150),
    date,
    target,
  };
}
async function bounded(request, limit) {
  if (Number(request.headers.get("Content-Length")) > limit)
    fail("This file is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      fail("This file is too large.", 413);
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let i = 0;
  for (const c of chunks) {
    data.set(c, i);
    i += c.length;
  }
  return data;
}
async function body(request) {
  try {
    return JSON.parse(new TextDecoder().decode(await bounded(request, 10000)));
  } catch (e) {
    if (e.status) throw e;
    fail("The request could not be read.");
  }
}
async function session(request, env) {
  const token = (request.headers.get("Cookie") || "").match(
    /(?:^|;\s*)publisher=([a-f0-9]{64})(?:;|$)/,
  )?.[1];
  if (!token) fail("Please unlock the upload page.", 401);
  const id = await sha(new TextEncoder().encode(token));
  const found = await env.DB.prepare(
    "SELECT id FROM sessions WHERE id=? AND expires>?",
  )
    .bind(id, now())
    .first();
  if (!found) fail("Please unlock the upload page again.", 401);
  return id;
}
async function getBatch(env, id) {
  if (!UUID.test(id)) fail("Update not found.", 404);
  const b = await env.DB.prepare("SELECT * FROM batches WHERE id=?")
    .bind(id)
    .first();
  if (!b) fail("Update not found.", 404);
  if (["queued", "processing"].includes(b.state) && b.updated < now() - 1800) {
    const lock = await env.DB.prepare(
      "SELECT expires FROM publish_lock WHERE batch_id=?",
    )
      .bind(id)
      .first();
    if (!lock || lock.expires < now()) {
      await env.DB.prepare(
        "UPDATE batches SET state='failed',error=?,updated=? WHERE id=? AND state IN ('queued','processing')",
      )
        .bind(
          "Publishing timed out. Your photographs are saved; please retry.",
          now(),
          id,
        )
        .run();
      await env.DB.prepare("DELETE FROM publish_lock WHERE batch_id=?")
        .bind(id)
        .run();
      b.state = "failed";
      b.error =
        "Publishing timed out. Your photographs are saved; please retry.";
    }
  }
  return b;
}
async function listPhotos(env, id) {
  return (
    await env.DB.prepare(
      "SELECT id,position,length(data) AS bytes FROM photos WHERE batch_id=? ORDER BY position,id",
    )
      .bind(id)
      .all()
  ).results;
}
async function catalogue(env) {
  const base = new URL(env.SITE_URL);
  if (base.protocol !== "https:")
    fail("The website address needs configuration.", 503);
  const r = await fetch(new URL("content/site.json", base), {
    cf: { cacheTtl: 60 },
  });
  if (!r.ok) fail("The website is unavailable. Try again shortly.", 503);
  const s = await r.json();
  return {
    categories: s.categories
      .filter((c) => CATEGORIES.includes(c.id) && c.published !== false)
      .map((c) => ({ id: c.id, title: c.title })),
    events: s.events
      .filter(
        (e) =>
          e.published !== false &&
          CATEGORIES.includes(e.category) &&
          e.presentation !== "service-story",
      )
      .map((e) => ({ id: e.id, category: e.category, title: e.title })),
  };
}
async function internal(request, env, url) {
  if (
    !env.INTERNAL_TOKEN ||
    !same(
      request.headers.get("Authorization") || "",
      "Bearer " + env.INTERNAL_TOKEN,
    )
  )
    fail("Not authorised.", 401);
  const match = url.pathname.match(
    /^\/internal\/batches\/([^/]+)(?:\/(claim|complete|photos)(?:\/([^/]+))?)?$/,
  );
  if (!match) fail("Not found.", 404);
  const [, id, action, photoId] = match,
    b = await getBatch(env, id);
  if (request.method === "POST" && action === "claim") {
    const { run_id } = await body(request);
    if (!/^\d+$/.test(String(run_id || "")))
      fail("A workflow run is required.");
    const lock = await env.DB.prepare(
      "SELECT batch_id FROM publish_lock WHERE id=1 AND expires>?",
    )
      .bind(now())
      .first();
    if (lock?.batch_id !== id)
      fail("This update no longer owns the publishing slot.", 409);
    const result = await env.DB.prepare(
      "UPDATE batches SET state='processing',run_id=?,updated=? WHERE id=? AND (state='queued' OR (state='processing' AND run_id=?))",
    )
      .bind(String(run_id), now(), id, String(run_id))
      .run();
    if (!result.meta.changes)
      fail("This update is not available for this workflow.", 409);
    return json({ ok: true });
  }
  if (request.method === "POST" && action === "complete") {
    const data = await body(request);
    if (b.run_id !== String(data.run_id || "")) fail("Workflow mismatch.", 409);
    const successful = data.success === true;
    if (successful && !/^[a-f0-9]{40}$/.test(data.commit || ""))
      fail("A published commit is required.");
    if (!["processing", "queued"].includes(b.state)) return json({ ok: true });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE batches SET state=?,commit_sha=?,error=?,updated=? WHERE id=?",
      ).bind(
        successful ? "published" : "failed",
        successful ? data.commit : null,
        successful
          ? null
          : "Publishing did not finish. Your previous website is still available.",
        now(),
        id,
      ),
      env.DB.prepare("DELETE FROM publish_lock WHERE batch_id=?").bind(id),
      ...(successful
        ? [env.DB.prepare("DELETE FROM photos WHERE batch_id=?").bind(id)]
        : []),
    ]);
    return json({ ok: true });
  }
  if (request.method !== "GET" || b.state !== "processing")
    fail("This update is not being processed.", 409);
  if (action === "photos") {
    if (!HASH.test(photoId || "")) fail("Photo not found.", 404);
    const p = await env.DB.prepare(
      "SELECT data FROM photos WHERE batch_id=? AND id=?",
    )
      .bind(id, photoId)
      .first();
    if (!p) fail("Photo not found.", 404);
    return new Response(new Uint8Array(p.data), {
      headers: { "Content-Type": "image/webp" },
    });
  }
  if (action) fail("Not found.", 404);
  return json({
    id: b.id,
    category: b.category,
    title: b.title,
    caption: b.caption,
    location: b.location,
    date: b.event_date,
    target: b.target,
    cover: b.cover,
    confirmed: true,
    photos: await listPhotos(env, id),
  });
}
async function route(request, env) {
  const url = new URL(request.url),
    path = url.pathname;
  if (url.protocol !== "https:" && env.LOCAL_DEVELOPMENT !== "true")
    fail("HTTPS is required.", 400);
  if (path.startsWith("/internal/")) return internal(request, env, url);
  if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!env.DB || !HASH.test(env.PUBLISHER_PASSWORD_HASH || ""))
    fail("The upload page is being connected. Please try again later.", 503);
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("Origin") !== url.origin
  )
    fail("Open this page directly to continue.", 403);
  if (path === "/api/session" && request.method === "POST") {
    const bucket = Math.floor(now() / 3600),
      ip = request.headers.get("CF-Connecting-IP") || "local";
    const key = await sha(new TextEncoder().encode(ip + ":" + bucket));
    await env.DB.prepare(
      "INSERT INTO attempts(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1",
    )
      .bind(key, now() + 7200)
      .run();
    const attempt = await env.DB.prepare(
      "SELECT count FROM attempts WHERE id=?",
    )
      .bind(key)
      .first();
    if (attempt.count > 8)
      fail("Too many attempts. Please try again in an hour.", 429);
    const { password } = await body(request);
    if (
      typeof password !== "string" ||
      !same(
        await sha(new TextEncoder().encode(password)),
        env.PUBLISHER_PASSWORD_HASH,
      )
    )
      fail("That access code is not correct.", 401);
    await env.DB.prepare("DELETE FROM attempts WHERE id=?").bind(key).run();
    const bytes = crypto.getRandomValues(new Uint8Array(32)),
      token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare("INSERT INTO sessions(id,expires) VALUES(?,?)")
      .bind(await sha(new TextEncoder().encode(token)), now() + 21600)
      .run();
    return new Response('{"ok":true}', {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `publisher=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=21600${url.protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  }
  const sid = await session(request, env);
  if (path === "/api/session" && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(sid).run();
    return new Response('{"ok":true}', {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie":
          "publisher=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      },
    });
  }
  if (path === "/api/catalog" && request.method === "GET")
    return json({
      ...(await catalogue(env)),
      publishEnabled: env.PUBLISH_ENABLED === "true",
      siteUrl: env.SITE_URL,
    });
  if (path === "/api/batches" && request.method === "GET")
    return json({
      batches: (
        await env.DB.prepare(
          "SELECT id,title,category,state,created,updated,error FROM batches ORDER BY created DESC LIMIT 10",
        ).all()
      ).results,
    });
  if (path === "/api/batches" && request.method === "POST") {
    const m = metadata(await body(request)),
      c = await catalogue(env);
    if (!c.categories.some((x) => x.id === m.category))
      fail("This section is not available.");
    if (
      m.target &&
      !c.events.some((e) => e.id === m.target && e.category === m.category)
    )
      fail("The occasion does not belong to this section.");
    if (
      !m.target &&
      c.events.some(
        (e) =>
          e.category === m.category &&
          e.title.trim().toLocaleLowerCase() === m.title.toLocaleLowerCase(),
      )
    )
      fail(
        "An occasion with this title already exists. Choose Add to the existing occasion, or give the new occasion a more specific title.",
      );
    const recent = await env.DB.prepare(
      "SELECT count(*) AS n FROM batches WHERE created>?",
    )
      .bind(now() - 86400)
      .first();
    if (recent.n >= 20)
      fail(
        "The daily update limit has been reached. Please try tomorrow.",
        429,
      );
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO batches(id,category,title,caption,location,event_date,target,created,updated) VALUES(?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        m.category,
        m.title,
        m.caption,
        m.location,
        m.date,
        m.target,
        now(),
        now(),
      )
      .run();
    return json({ id }, 201);
  }
  const match = path.match(
    /^\/api\/batches\/([^/]+)(?:\/(photos|publish)(?:\/([^/]+))?)?$/,
  );
  if (!match) fail("Not found.", 404);
  const [, id, action, pid] = match,
    b = await getBatch(env, id);
  if (request.method === "GET" && !action)
    return json({
      ...b,
      photos: await listPhotos(env, id),
      siteUrl: env.SITE_URL,
    });
  if (request.method === "DELETE" && !action) {
    if (!["draft", "failed"].includes(b.state))
      fail("This update is already publishing.", 409);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM photos WHERE batch_id=?").bind(id),
      env.DB.prepare("DELETE FROM batches WHERE id=?").bind(id),
    ]);
    return json({ ok: true });
  }
  if (action === "photos" && request.method === "POST") {
    if (b.state !== "draft")
      fail("This update is already being published.", 409);
    const data = await bounded(request, MAX_PHOTO);
    if (!isWebP(data)) fail("Please choose a supported photograph.");
    const digest = await sha(data);
    const duplicate = await env.DB.prepare(
      "SELECT id FROM photos WHERE batch_id=? AND id=?",
    )
      .bind(id, digest)
      .first();
    if (duplicate) return json({ id: digest, duplicate: true });
    const position = Number(url.searchParams.get("position"));
    if (!Number.isInteger(position) || position < 0 || position >= MAX_PHOTOS)
      fail("Choose at most 20 photographs.");
    const result = await env.DB.prepare(
      "INSERT INTO photos(batch_id,id,position,data) SELECT ?,?,?,? WHERE (SELECT state FROM batches WHERE id=?)='draft' AND (SELECT count(*) FROM photos WHERE batch_id=?)<? AND COALESCE((SELECT sum(length(data)) FROM photos WHERE batch_id=?),0)+?<=? AND COALESCE((SELECT sum(length(data)) FROM photos),0)+?<=?",
    )
      .bind(
        id,
        digest,
        position,
        data.buffer,
        id,
        id,
        MAX_PHOTOS,
        id,
        data.length,
        MAX_BATCH,
        data.length,
        MAX_INBOX,
      )
      .run();
    if (!result.meta.changes)
      fail(
        "The photo inbox is full, or this update is already publishing.",
        409,
      );
    return json({ id: digest }, 201);
  }
  if (action === "photos" && request.method === "GET" && HASH.test(pid || "")) {
    const p = await env.DB.prepare(
      "SELECT data FROM photos WHERE batch_id=? AND id=?",
    )
      .bind(id, pid)
      .first();
    if (!p) fail("Photo not found.", 404);
    return new Response(new Uint8Array(p.data), {
      headers: { "Content-Type": "image/webp" },
    });
  }
  if (action === "publish" && request.method === "POST") {
    if (b.state === "published" || ["queued", "processing"].includes(b.state))
      return json({ id, state: b.state });
    if (
      env.PUBLISH_ENABLED !== "true" ||
      !env.GITHUB_ACTIONS_TOKEN ||
      !env.INTERNAL_TOKEN
    )
      fail(
        "Publishing is not connected yet. Your photographs remain private.",
        503,
      );
    const { cover, confirmed } = await body(request);
    if (confirmed !== true) fail("Please review and confirm the update.");
    const photos = await listPhotos(env, id);
    if (!photos.length) fail("Add photographs first.");
    if (!photos.some((p) => p.id === cover)) fail("Choose a cover photograph.");
    if (!["draft", "failed"].includes(b.state))
      fail("This update cannot be published.", 409);
    const slot = await env.DB.prepare(
      "INSERT INTO publish_lock(id,batch_id,expires) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET batch_id=excluded.batch_id,expires=excluded.expires WHERE publish_lock.expires<?",
    )
      .bind(id, now() + 1800, now())
      .run();
    if (!slot.meta.changes)
      fail("Another update is publishing. Please wait for it to finish.", 409);
    await env.DB.prepare(
      "UPDATE batches SET state='queued',cover=?,error=NULL,run_id=NULL,updated=? WHERE id=? AND state IN ('draft','failed')",
    )
      .bind(cover, now(), id)
      .run();
    let r;
    try {
      r = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/upload-photos.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env.GITHUB_ACTIONS_TOKEN,
            Accept: "application/vnd.github+json",
            "User-Agent": "foundation-photo-publisher",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({ ref: "main", inputs: { batch_id: id } }),
        },
      );
    } catch {
      // Ambiguous delivery: keep the lease and queued state, rather than dispatch twice.
      await env.DB.prepare("UPDATE batches SET error=? WHERE id=?")
        .bind(
          "The publishing request is being checked. Refresh its status shortly.",
          id,
        )
        .run();
      return json({ id, state: "queued" }, 202);
    }
    if (!r.ok) {
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE batches SET state='failed',error=? WHERE id=?",
        ).bind(
          "The publishing connection needs attention. Your photographs are saved.",
          id,
        ),
        env.DB.prepare("DELETE FROM publish_lock WHERE batch_id=?").bind(id),
      ]);
      fail(
        "The publishing connection needs attention. Please retry later.",
        502,
      );
    }
    return json({ id, state: "queued" }, 202);
  }
  fail("Not found.", 404);
}
export default {
  async fetch(request, env) {
    let response;
    try {
      response = await route(request, env);
    } catch (e) {
      response = json(
        {
          error: e.status
            ? e.message
            : "Something went wrong. Please try again.",
        },
        e.status || 500,
      );
      if (!e.status) console.error("uploader_request_failed", e.name);
    }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
    );
    return new Response(response.body, { status: response.status, headers });
  },
  async scheduled(_event, env) {
    const expired = now() - 86400 * 3;
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE batches SET state='failed',error=?,updated=? WHERE state IN ('queued','processing') AND updated<? AND id NOT IN (SELECT batch_id FROM publish_lock WHERE expires>?)",
      ).bind(
        "Publishing timed out. Your photographs are saved; please retry.",
        now(),
        now() - 1800,
        now(),
      ),
      env.DB.prepare("DELETE FROM publish_lock WHERE expires<?").bind(now()),
      env.DB.prepare("DELETE FROM sessions WHERE expires<?").bind(now()),
      env.DB.prepare("DELETE FROM attempts WHERE expires<?").bind(now()),
      env.DB.prepare(
        "DELETE FROM photos WHERE batch_id IN (SELECT id FROM batches WHERE updated<? AND state IN ('draft','failed','published'))",
      ).bind(expired),
      env.DB.prepare(
        "DELETE FROM batches WHERE updated<? AND state IN ('draft','failed','published')",
      ).bind(expired),
    ]);
  },
};
