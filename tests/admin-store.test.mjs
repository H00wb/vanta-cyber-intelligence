import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAdminStore } from "../lib/admin-store.ts";

// Transport is mocked; token rejection, SQL pagination and durable concurrency
// need separate checks against the real Supabase project.
const url = "https://vanta-admin-test.supabase.co";
const publishableKey = "sb_publishable_fictional_admin_test";
const readToken = "a".repeat(64);
const keyHash = "b".repeat(64);
const row = () => ({
  id: randomUUID(), name: "Deniz Örnek", email: "deniz@example.com", service: "attack-surface",
  description: "Tamamen kurgusal kurumun dijital varlıklarını değerlendirmek istiyoruz.",
  created_at: "2026-10-08T00:05:00.123456+00:00",
});
const page = rows => ({ rows, total: rows.length, page: 1, pageSize: 50 });
const failure = promise => assert.rejects(promise, error => {
  assert.equal(error.message, "Admin storage unavailable");
  assert.equal(error.message.includes(readToken), false);
  assert.equal(error.message.includes("SECRET_DATABASE_DETAIL"), false);
  return true;
});

test("admin list uses only the public API key and bounded token-gated POST payload", async () => {
  const saved = row(); let calls = 0; const query = "100%_\\ kurgusal";
  const store = createAdminStore(url, publishableKey, readToken, async (endpoint, options) => {
    calls++;
    assert.equal(String(endpoint), url + "/rest/v1/rpc/vanta_admin_requests");
    assert.equal(String(endpoint).includes(readToken), false);
    assert.equal(options.method, "POST");
    const headers = new Headers(options.headers);
    assert.equal(headers.get("apikey"), publishableKey);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.has("authorization"), false);
    assert.equal(headers.has("cookie"), false);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    assert.deepEqual(JSON.parse(options.body), { p_token: readToken, p_page: 1, p_query: query });
    return Response.json(page([saved]));
  });
  assert.deepEqual(await store.list({ page: 1, query }), page([saved]));
  assert.equal(calls, 1);
});

test("pagination accepts full, final and empty pages but rejects inconsistent totals", async () => {
  const fullRows = Array.from({ length: 50 }, row);
  for (const [requestedPage, result] of [
    [1, { rows: fullRows, total: 51, page: 1, pageSize: 50 }],
    [2, { rows: [row()], total: 51, page: 2, pageSize: 50 }],
    [2, { rows: [], total: 1, page: 2, pageSize: 50 }],
  ]) {
    const store = createAdminStore(url, publishableKey, readToken, async () => Response.json(result));
    assert.deepEqual(await store.list({ page: requestedPage, query: "" }), result);
  }
  for (const result of [
    { ...page([row()]), total: -1 }, { ...page([row()]), total: "1" },
    { ...page([row()]), total: 0 }, { ...page([row()]), total: 2 },
    { ...page([row()]), page: 2 }, { ...page([row()]), pageSize: 100 },
    page(Array.from({ length: 51 }, row)), { ...page([]), private: "unexpected" },
  ]) {
    const store = createAdminStore(url, publishableKey, readToken, async () => Response.json(result));
    await failure(store.list({ page: 1, query: "" }));
  }
});

test("upstream rows require canonical visitor fields, known service, UUID and real timestamp", async () => {
  for (const patch of [
    { id: "123" }, { name: 42 }, { name: " Deniz Örnek " },
    { email: "invalid" }, { email: "DENIZ@EXAMPLE.COM" }, { service: "admin" },
    { description: "kısa" }, { created_at: "0" }, { created_at: "2026-02-31T00:00:00Z" },
    { created_at: "2026-10-08T24:00:00Z" }, { secret: readToken },
  ]) {
    const store = createAdminStore(url, publishableKey, readToken, async () => Response.json(page([{ ...row(), ...patch }])));
    await failure(store.list({ page: 1, query: "" }));
  }
});

test("invalid list input fails before contacting Supabase", async () => {
  let calls = 0;
  const store = createAdminStore(url, publishableKey, readToken, async (_endpoint, options) => { calls++; return Response.json({ rows: [], total: 0, page: JSON.parse(options.body).p_page, pageSize: 50 }); });
  for (const input of [
    null, {}, { page: 0, query: "" }, { page: 1.5, query: "" }, { page: 10001, query: "" },
    { page: 1, query: 42 }, { page: 1, query: "A".repeat(101) }, { page: 1, query: "a\u0000b" },
  ]) await assert.rejects(store.list(input), /Admin request invalid/);
  assert.equal(calls, 0);
  assert.deepEqual(await store.list({ page: 10000, query: "😀".repeat(100) }), { rows: [], total: 0, page: 10000, pageSize: 50 });
});

test("HTTP failures never expose upstream database diagnostics or token values", async () => {
  for (const status of [400, 401, 403, 500, 503]) {
    const store = createAdminStore(url, publishableKey, readToken, async () =>
      Response.json({ message: "SECRET_DATABASE_DETAIL " + readToken, name: "Deniz Örnek" }, { status }));
    await failure(store.list({ page: 1, query: "" }));
    await failure(store.consumeLoginAttempt(keyHash));
  }
});

test("empty, malformed or non-object success bodies cannot become admin data", async () => {
  for (const body of ["", "{broken", "<html>upstream error</html>", "null", "[]"]) {
    const store = createAdminStore(url, publishableKey, readToken, async () => new Response(body, { status: 200 }));
    await failure(store.list({ page: 1, query: "" }));
  }
  const store = createAdminStore(url, publishableKey, readToken, async () => new Response(null, { status: 204 }));
  await failure(store.list({ page: 1, query: "" }));
});

test("network and timeout failures remain generic for both RPC methods", async () => {
  for (const error of [new Error("SECRET_DATABASE_DETAIL " + readToken), new DOMException("Fictional timeout", "TimeoutError")]) {
    const store = createAdminStore(url, publishableKey, readToken, async () => { throw error; });
    await failure(store.list({ page: 1, query: "" }));
    await failure(store.consumeLoginAttempt(keyHash));
  }
});

test("durable limiter transport preserves allowed and denied outcomes", async () => {
  let calls = 0;
  for (const result of [{ allowed: true, retryAfter: 0 }, { allowed: false, retryAfter: 300 }, { allowed: false, retryAfter: 1 }]) {
    const store = createAdminStore(url, publishableKey, readToken, async (endpoint, options) => {
      calls++;
      assert.equal(String(endpoint), url + "/rest/v1/rpc/vanta_admin_login_attempt");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { p_token: readToken, p_key: keyHash });
      assert.equal(new Headers(options.headers).get("apikey"), publishableKey);
      assert.equal(new Headers(options.headers).has("authorization"), false);
      assert.equal(options.cache, "no-store");
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(result);
    });
    assert.deepEqual(await store.consumeLoginAttempt(keyHash), result);
  }
  assert.equal(calls, 3);
});

test("malformed limiter results and untrusted key shapes cannot grant a login attempt", async () => {
  let calls = 0;
  const store = createAdminStore(url, publishableKey, readToken, async () => { calls++; return Response.json({ allowed: true, retryAfter: 0 }); });
  for (const invalid of ["", "123", "B".repeat(64), null, 42]) await assert.rejects(store.consumeLoginAttempt(invalid), /Admin request invalid/);
  assert.equal(calls, 0);
  for (const result of [
    {}, { allowed: "true", retryAfter: 0 }, { allowed: true, retryAfter: 1 },
    { allowed: false, retryAfter: 0 }, { allowed: false, retryAfter: 301 },
    { allowed: false, retryAfter: 1.5 }, { allowed: true, retryAfter: 0, secret: readToken },
  ]) {
    const malformed = createAdminStore(url, publishableKey, readToken, async () => Response.json(result));
    await failure(malformed.consumeLoginAttempt(keyHash));
  }
});

test("invalid admin configuration fails without making a network call", () => {
  let calls = 0; const transport = async () => { calls++; throw new Error("Must not be called"); };
  for (const [endpoint, key, token] of [
    ["http://vanta-admin-test.supabase.co", publishableKey, readToken],
    ["https://example.com", publishableKey, readToken],
    ["https://user:pass@vanta-admin-test.supabase.co", publishableKey, readToken],
    [url, "", readToken], [url, publishableKey, "not-a-token"], [url, publishableKey, "A".repeat(64)],
  ]) assert.throws(() => createAdminStore(endpoint, key, token, transport), /Admin storage configuration unavailable/);
  assert.equal(calls, 0);
});
