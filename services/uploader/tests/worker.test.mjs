import test from "node:test";
import assert from "node:assert/strict";
import worker, { metadata, same, isWebP, sha } from "../worker.mjs";
const good = {
  category: "education",
  title: "Air Force School, Yelahanka",
  caption: "Swamiji encouraged the students.",
  location: "Bengaluru",
};
test("school visits remain captions; no financial claims are generated", () => {
  const m = metadata(good);
  assert.equal(m.title, good.title);
  assert.equal(m.caption, good.caption);
  assert.equal(m.date, null);
  assert.equal(m.target, null);
  assert.equal(m.amount, undefined);
});
test("dates are explicit and valid", () => {
  assert.equal(metadata({ ...good, date: "2026-11-26" }).date, "2026-11-26");
  for (const date of ["2026-02-30", "tomorrow", "2026-1-2"])
    assert.throws(() => metadata({ ...good, date }));
});
test("unavailable readers and path traversal are refused", () => {
  assert.throws(() => metadata({ ...good, category: "teachings" }));
  assert.throws(() => metadata({ ...good, target: "../../private" }));
  assert.throws(() => metadata({ ...good, title: "/Users/name/private" }));
});
test("caption text is data, never a shell command", () => {
  const caption = "$(touch /tmp/no-execution) `echo text`";
  assert.equal(metadata({ ...good, caption }).caption, caption);
});
test("only prepared WebP is accepted", () => {
  assert.equal(isWebP(new TextEncoder().encode("RIFF1234WEBPabc")), true);
  assert.equal(isWebP(new TextEncoder().encode("<svg>bad</svg>")), false);
});
test("credential comparison and hashes", async () => {
  assert.equal(same("a", "a"), true);
  assert.equal(same("a", "b"), false);
  assert.equal(same("aa", "a"), false);
  assert.equal((await sha(new TextEncoder().encode("photo"))).length, 64);
});
test("cross-origin mutations are refused before touching the database", async () => {
  const r = await worker.fetch(
    new Request("https://updates.example/api/session", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body: "{}",
    }),
    { DB: {}, PUBLISHER_PASSWORD_HASH: "a".repeat(64) },
  );
  assert.equal(r.status, 403);
});
test("private endpoints require credentials and cannot be cached", async () => {
  const r = await worker.fetch(
    new Request("https://updates.example/internal/batches/anything"),
    { INTERNAL_TOKEN: "private-test-token" },
  );
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.match(
    r.headers.get("Content-Security-Policy"),
    /frame-ancestors 'none'/,
  );
});
test("unconfigured publishing fails closed", async () => {
  const r = await worker.fetch(
    new Request("https://updates.example/api/catalog"),
    {},
  );
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.includes("connected"), true);
});
test("D1 BLOB arrays are returned as photograph bytes, not comma-separated text", async () => {
  const bytes = new TextEncoder().encode("RIFF1234WEBPphoto");
  const DB = {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async first() {
          return sql.includes("SELECT data")
            ? { data: [...bytes] }
            : {
                id: "11111111-1111-4111-8111-111111111111",
                state: "processing",
                updated: Math.floor(Date.now() / 1000),
              };
        },
      };
    },
  };
  const request = new Request(
    "https://updates.example/internal/batches/11111111-1111-4111-8111-111111111111/photos/" +
      "a".repeat(64),
    { headers: { Authorization: "Bearer private-test-token" } },
  );
  const response = await worker.fetch(request, {
    DB,
    INTERNAL_TOKEN: "private-test-token",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});
