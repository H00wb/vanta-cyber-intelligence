import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSupabaseStore } from "../lib/supabase-store.ts";
import { RequestConflictError } from "../lib/request-store.ts";

// Transport is mocked here: live PostgreSQL persistence is verified separately.
const endpoint = "https://vanta-test.supabase.co";
const publishableKey = "sb_publishable_fictional_test_key";
const valid = () => ({
  name: "Deniz Örnek", email: "deniz@example.com", service: "attack-surface",
  description: "Yalnız kurgusal test kurumunun dijital varlıklarını değerlendirmek istiyoruz.",
  requestId: randomUUID(),
});

test("Supabase transport sends one bounded POST with the five RPC arguments", async () => {
  const payload = valid(); let requests = 0;
  const store = createSupabaseStore(endpoint + "/ignored-path", publishableKey, async (url, options) => {
    requests++;
    assert.equal(String(url), endpoint + "/rest/v1/rpc/vanta_submit_request");
    assert.equal(options.method, "POST");
    const headers = new Headers(options.headers);
    assert.equal(headers.get("apikey"), publishableKey);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.has("authorization"), false);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    assert.deepEqual(JSON.parse(options.body), {
      p_id: payload.requestId, p_name: payload.name, p_email: payload.email,
      p_service: payload.service, p_description: payload.description,
    });
    return Response.json({ id: payload.requestId, replayed: false });
  });
  assert.deepEqual(await store.save(payload), { id: payload.requestId, replayed: false });
  assert.equal(requests, 1);
});

test("identical RPC replay remains a replay rather than a new request", async () => {
  const payload = valid();
  const store = createSupabaseStore(endpoint, publishableKey, async () => Response.json({ id: payload.requestId, replayed: true }));
  assert.deepEqual(await store.save(payload), { id: payload.requestId, replayed: true });
});

test("HTTP 409 maps to the typed identity conflict", async () => {
  const store = createSupabaseStore(endpoint, publishableKey, async () => Response.json({ code: "PT409", message: "submission_conflict" }, { status: 409 }));
  await assert.rejects(store.save(valid()), RequestConflictError);
});

test("upstream HTTP failures do not expose database diagnostics", async () => {
  for (const status of [400, 401, 403, 503]) {
    const store = createSupabaseStore(endpoint, publishableKey, async () => Response.json({ message: "SECRET_DATABASE_DETAIL" }, { status }));
    await assert.rejects(store.save(valid()), error => {
      assert.equal(error instanceof RequestConflictError, false);
      assert.equal(error.message, "Supabase persistence unavailable");
      assert.equal(error.message.includes("SECRET_DATABASE_DETAIL"), false);
      return true;
    });
  }
});

test("wrong or incomplete RPC identity cannot confirm persistence", async () => {
  const payload = valid();
  for (const body of [null, {}, { id: randomUUID(), replayed: false }, { id: payload.requestId }, { id: payload.requestId, replayed: "false" }]) {
    const store = createSupabaseStore(endpoint, publishableKey, async () => Response.json(body));
    await assert.rejects(store.save(payload), /Persistence response not confirmed/);
  }
});

test("empty or malformed successful responses cannot confirm persistence", async () => {
  for (const body of ["", "{broken", "<html>upstream error</html>"]) {
    const store = createSupabaseStore(endpoint, publishableKey, async () => new Response(body, { status: 200 }));
    await assert.rejects(store.save(valid()), SyntaxError);
  }
});

test("a successful response without a body is not a save confirmation", async () => {
  const store = createSupabaseStore(endpoint, publishableKey, async () => new Response(null, { status: 204 }));
  await assert.rejects(store.save(valid()), SyntaxError);
});

test("transport rejection cannot become a successful store result", async () => {
  const store = createSupabaseStore(endpoint, publishableKey, async () => { throw new TypeError("Fictional network failure"); });
  await assert.rejects(store.save(valid()), TypeError);
});

test("an aborted persistence request cannot become a successful store result", async () => {
  const store = createSupabaseStore(endpoint, publishableKey, async () => { throw new DOMException("Fictional timeout", "TimeoutError"); });
  await assert.rejects(store.save(valid()), { name: "TimeoutError" });
});

test("invalid endpoint configuration fails before any network call", () => {
  let requests = 0; const transport = async () => { requests++; throw new Error("Must not be called"); };
  for (const url of ["http://vanta-test.supabase.co", "https://example.com", "https://supabase.co.evil.example", "invalid-url"]) {
    assert.throws(() => createSupabaseStore(url, publishableKey, transport));
  }
  assert.throws(() => createSupabaseStore(endpoint, "", transport), /key unavailable/);
  assert.equal(requests, 0);
});
