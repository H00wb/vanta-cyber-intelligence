import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { updateSession } from "../utils/supabase/middleware.ts";

// SDK factories are mocked: these tests verify the request/cookie/cache bridge,
// not a real Supabase Auth sign-in or refresh.
const url = "https://vanta-session-test.supabase.co";
const publishableKey = "sb_publishable_fictional_session_test";
const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
let previous;
beforeEach(() => {
  previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey;
});
afterEach(() => {
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
});
const request = cookie => new NextRequest("https://vanta.example.com/", {
  headers: cookie ? { cookie } : {},
});
const deferred = () => {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
};
const refreshedCookies = [
  { name: "sb-vanta-auth-token.0", value: "refreshed-chunk-zero", options: { path: "/", secure: true, httpOnly: true, sameSite: "lax", maxAge: 3600 } },
  { name: "sb-vanta-auth-token.1", value: "refreshed-chunk-one", options: { path: "/", secure: true, httpOnly: true, sameSite: "lax", maxAge: 3600 } },
];
const cacheHeaders = { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" };

test("session proxy creates the SDK client from public config and calls getClaims", async () => {
  const incoming = request("sb-vanta-auth-token.0=expired; other=preserved");
  let claimsCalls = 0;
  const factory = (configuredUrl, configuredKey, options) => {
    assert.equal(configuredUrl, url);
    assert.equal(configuredKey, publishableKey);
    assert.deepEqual(options.cookies.getAll(), [
      { name: "sb-vanta-auth-token.0", value: "expired" }, { name: "other", value: "preserved" },
    ]);
    return { auth: { async getClaims() { claimsCalls++; return { data: { claims: { sub: "fictional-test-user" } }, error: null }; } } };
  };
  const response = await updateSession(incoming, factory);
  assert.equal(claimsCalls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.has("location"), false);
});

test("proxy awaits refresh before returning the updated cookie response", async () => {
  const incoming = request("sb-vanta-auth-token.0=expired");
  const completion = deferred(); let started = false; let returned = false;
  const factory = (_url, _key, options) => ({
    auth: { async getClaims() {
      started = true;
      await completion.promise;
      options.cookies.setAll(refreshedCookies, cacheHeaders);
      return { data: { claims: { sub: "fictional-test-user" } }, error: null };
    } },
  });
  const pending = updateSession(incoming, factory).then(value => { returned = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started, true);
  assert.equal(returned, false);
  assert.equal(incoming.cookies.get("sb-vanta-auth-token.0").value, "expired");
  completion.resolve();
  const response = await pending;
  assert.equal(returned, true);
  assert.equal(incoming.cookies.get("sb-vanta-auth-token.0").value, refreshedCookies[0].value);
  assert.equal(response.cookies.get("sb-vanta-auth-token.0").value, refreshedCookies[0].value);
});

test("refresh preserves every cookie chunk and its browser options", async () => {
  const incoming = request("sb-vanta-auth-token.0=expired-zero; sb-vanta-auth-token.1=expired-one; other=preserved");
  const factory = (_url, _key, options) => ({
    auth: { async getClaims() {
      options.cookies.setAll(refreshedCookies, cacheHeaders);
      return { data: { claims: { sub: "fictional-test-user" } }, error: null };
    } },
  });
  const response = await updateSession(incoming, factory);
  for (const { name, value, options } of refreshedCookies) {
    assert.equal(incoming.cookies.get(name).value, value);
    const cookie = response.cookies.get(name);
    assert.equal(cookie.value, value);
    for (const option of ["path", "secure", "httpOnly", "sameSite", "maxAge"]) assert.equal(cookie[option], options[option]);
  }
  assert.equal(incoming.cookies.get("other").value, "preserved");
  assert.equal(response.cookies.has("other"), false);
  assert.match(response.headers.get("x-middleware-request-cookie"), /refreshed-chunk-zero/);
  assert.match(response.headers.get("x-middleware-request-cookie"), /refreshed-chunk-one/);
});

test("SDK cache headers survive on the same returned response as refreshed cookies", async () => {
  const factory = (_url, _key, options) => ({
    auth: { async getClaims() {
      options.cookies.setAll(refreshedCookies, cacheHeaders);
      return { data: { claims: { sub: "fictional-test-user" } }, error: null };
    } },
  });
  const response = await updateSession(request("sb-vanta-auth-token.0=expired"), factory);
  for (const [name, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(name), value);
  assert.ok(response.headers.get("set-cookie"));
  assert.equal(response.cookies.getAll().length, 2);
});

test("a missing session keeps the landing page public without a login redirect", async () => {
  let claimsCalls = 0;
  const factory = (_url, _key, options) => {
    assert.deepEqual(options.cookies.getAll(), []);
    return { auth: { async getClaims() {
      claimsCalls++;
      return { data: null, error: { name: "AuthSessionMissingError", message: "Fictional missing session" } };
    } } };
  };
  const response = await updateSession(request(), factory);
  assert.equal(claimsCalls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.has("location"), false);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.deepEqual(response.cookies.getAll(), []);
});

test("concurrent requests get separate clients and cannot exchange cookies", async () => {
  const first = request("sb-vanta-auth-token.0=first-expired");
  const second = request("sb-vanta-auth-token.0=second-expired");
  const firstCompletion = deferred(); const secondCompletion = deferred();
  const clients = []; const originalCookies = [];
  const factory = (_url, _key, options) => {
    const incomingValue = options.cookies.getAll()[0].value;
    originalCookies.push(incomingValue);
    const isFirst = incomingValue === "first-expired";
    const client = {
      auth: { async getClaims() {
        await (isFirst ? firstCompletion.promise : secondCompletion.promise);
        options.cookies.setAll([
          { name: "sb-vanta-auth-token.0", value: isFirst ? "first-refreshed" : "second-refreshed", options: { path: "/", sameSite: "lax" } },
        ], { "Cache-Control": "private, no-store" });
        return { data: { claims: { sub: isFirst ? "first-fictional-user" : "second-fictional-user" } }, error: null };
      } },
    };
    clients.push(client);
    return client;
  };
  const firstPending = updateSession(first, factory);
  const secondPending = updateSession(second, factory);
  assert.equal(clients.length, 2);
  assert.notEqual(clients[0], clients[1]);
  assert.deepEqual(originalCookies, ["first-expired", "second-expired"]);
  secondCompletion.resolve();
  const secondResponse = await secondPending;
  assert.equal(second.cookies.get("sb-vanta-auth-token.0").value, "second-refreshed");
  assert.equal(secondResponse.cookies.get("sb-vanta-auth-token.0").value, "second-refreshed");
  assert.equal(first.cookies.get("sb-vanta-auth-token.0").value, "first-expired");
  firstCompletion.resolve();
  const firstResponse = await firstPending;
  assert.equal(first.cookies.get("sb-vanta-auth-token.0").value, "first-refreshed");
  assert.equal(firstResponse.cookies.get("sb-vanta-auth-token.0").value, "first-refreshed");
  assert.equal(secondResponse.cookies.get("sb-vanta-auth-token.0").value, "second-refreshed");
});
