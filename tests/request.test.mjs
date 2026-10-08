import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { validateRequest, SERVICES } from "../lib/request-validation.ts";
import { handleRequest } from "../lib/request-handler.ts";
import { isConfirmedSave } from "../lib/request-response.ts";
import { RequestConflictError } from "../lib/request-store.ts";

const migration = readFileSync(new URL("../drizzle/0000_worried_ultragirl.sql", import.meta.url), "utf8");
const valid = () => ({ name: "Deniz Örnek", email: "deniz@example.com", service: "attack-surface", description: "Kurgusal kurumun internete açık test varlıklarını değerlendirmek istiyoruz.", requestId: randomUUID() });
let sqlite;
let database;
// Historical SQLite fixture exercises the RequestStore/HTTP contract.
// Production PostgreSQL concurrency and durability have separate live evidence.
const adapt = db => ({ async save(data) {
  const inserted = db.prepare(`INSERT INTO service_requests (id, name, email, service, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING id`)
    .get(data.requestId, data.name, data.email, data.service, data.description, new Date().toISOString());
  if (inserted) return { id: inserted.id, replayed: false };
  const existing = db.prepare("SELECT id, name, email, service, description FROM service_requests WHERE id = ?").get(data.requestId);
  if (!existing) throw new Error("Persisted fixture record not confirmed");
  if (["name", "email", "service", "description"].some(field => existing[field] !== data[field])) throw new RequestConflictError();
  return { id: existing.id, replayed: true };
} });
const req = (data, headers = {}) => new Request("http://localhost/api/requests", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(data) });
beforeEach(() => { sqlite = new DatabaseSync(":memory:"); sqlite.exec(migration); database = adapt(sqlite); });
afterEach(() => sqlite.close());
const count = () => sqlite.prepare("SELECT count(*) AS count FROM service_requests").get().count;

test("normalizes whitespace and email; accepts every defined service", () => {
  for (const { value } of SERVICES) {
    const { data, errors } = validateRequest({ ...valid(), name: " Deniz Örnek ", email: " DENIZ@EXAMPLE.COM ", service: value });
    assert.deepEqual(errors, {}); assert.equal(data.name, "Deniz Örnek"); assert.equal(data.email, "deniz@example.com");
  }
});
for (const [label, patch, key] of [
  ["blank name", { name: "   " }, "name"], ["long name", { name: "A".repeat(101) }, "name"],
  ["invalid email", { email: "deniz@" }, "email"], ["long email", { email: "a".repeat(250) + "@example.com" }, "email"],
  ["NUL email", { email: "deniz\u0000@example.com" }, "email"],
  ["unknown service", { service: "admin" }, "service"], ["short description", { description: "kısa" }, "description"],
  ["long description", { description: "A".repeat(2001) }, "description"], ["control character", { name: "Deniz\u0000Örnek" }, "name"],
  ["wrong field type", { description: 42 }, "description"], ["invalid request id", { requestId: "123" }, "requestId"],
  ["one emoji name", { name: "😀" }, "name"], ["ten emoji description", { description: "😀".repeat(10) }, "description"],
]) test(`server rejects ${label} before opening database`, async () => {
  const response = await handleRequest(req({ ...valid(), ...patch }), () => { throw new Error("Database must not be opened"); });
  assert.equal(response.status, 422); assert.ok((await response.json()).errors[key]); assert.equal(count(), 0);
});
test("single-part names and blank surname cannot pass client or server validation", async () => {
  for (const name of ["Deniz", " Deniz   ", "Deniz\u00a0", "😀😀", "A".repeat(100)]) {
    const payload = { ...valid(), name };
    const client = validateRequest(payload);
    assert.equal(client.data, null);
    assert.equal(client.errors.name, "Adınızı ve soyadınızı birlikte girin.");
    const response = await handleRequest(req(payload), () => { throw new Error("Database must not be opened"); });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.errors.name, "Adınızı ve soyadınızı birlikte girin.");
    assert.equal(body.id, undefined);
    assert.equal(count(), 0);
  }
  for (const name of ["Deniz Örnek", "Deniz   Örnek", "Deniz Ali Örnek", "Deniz\u00a0Örnek"]) {
    assert.deepEqual(validateRequest({ ...valid(), name }).errors, {});
  }
});
test("exact character boundaries including astral Unicode reach database", async () => {
  const payload = { ...valid(), name: "😀 😀", description: "😀".repeat(20) };
  assert.equal((await handleRequest(req(payload), () => database)).status, 201);
  assert.equal((await handleRequest(req({ ...valid(), name: "A".repeat(98) + " B", description: "A".repeat(2000) }), () => database)).status, 201);
});
test("missing fields and non-object payloads are rejected", async () => {
  for (const payload of [null, [], "text", {}, { name: "Deniz" }]) assert.equal((await handleRequest(req(payload), () => database)).status, 422);
  assert.equal(count(), 0);
});
test("created response matches committed row and four visitor fields", async () => {
  const payload = valid(); const response = await handleRequest(req(payload), () => database);
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), { id: payload.requestId, replayed: false });
  const row = sqlite.prepare("SELECT * FROM service_requests WHERE id = ?").get(payload.requestId);
  for (const field of ["name", "email", "service", "description"]) assert.equal(row[field], payload[field]);
  assert.ok(!Number.isNaN(Date.parse(row.created_at))); assert.equal(count(), 1);
});
test("success waits for the store's confirmed persistence result", async () => {
  let commit;
  const payload = valid(); let completed = false;
  const pending = handleRequest(req(payload), () => ({ save() { return new Promise(resolve => { commit = resolve; }); } })).then(value => { completed = true; return value; });
  while (!commit) await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false); commit({ id: payload.requestId, replayed: false }); assert.equal((await pending).status, 201);
});
test("unconfirmed store results cannot create an API success response", async () => {
  const payload = valid(); const previous = console.error; console.error = () => {};
  try {
    for (const result of [null, {}, { id: randomUUID(), replayed: false }, { id: payload.requestId }, { id: payload.requestId, replayed: "false" }]) {
      const response = await handleRequest(req(payload), () => ({ async save() { return result; } }));
      assert.equal(response.status, 503); assert.equal((await response.json()).id, undefined);
    }
  } finally { console.error = previous; }
});
test("same submission retried concurrently creates exactly one row", async () => {
  const payload = valid(); const responses = await Promise.all([handleRequest(req(payload), () => database), handleRequest(req(payload), () => database), handleRequest(req(payload), () => database)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 200, 201]); assert.equal(count(), 1);
});
test("idempotency key cannot be reused for changed content", async () => {
  const payload = valid(); await handleRequest(req(payload), () => database);
  assert.equal((await handleRequest(req({ ...payload, name: "Başka Örnek" }), () => database)).status, 409); assert.equal(count(), 1);
});
test("SQL and HTML-like input is literal data", async () => {
  const payload = { ...valid(), description: "Kurgusal test: '); DROP TABLE service_requests; -- <script>alert('test')</script>" };
  assert.equal((await handleRequest(req(payload), () => database)).status, 201);
  assert.equal(sqlite.prepare("SELECT description FROM service_requests WHERE id = ?").get(payload.requestId).description, payload.description); assert.equal(count(), 1);
});
test("storage failure has no success or leaked internal error", async () => {
  const previous = console.error; const diagnostics = []; console.error = (...args) => diagnostics.push(args);
  try {
    const response = await handleRequest(req(valid()), () => { throw new Error("SECRET_DATABASE_DETAIL"); });
    assert.equal(response.status, 503); const body = await response.json(); assert.equal(body.id, undefined); assert.ok(!JSON.stringify(body).includes("SECRET_DATABASE_DETAIL")); assert.equal(diagnostics.length, 1);
  } finally { console.error = previous; }
});
test("malformed JSON returns 400 without a write", async () => {
  const response = await handleRequest(new Request("http://localhost/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: "{broken" }), () => database);
  assert.equal(response.status, 400); assert.equal(count(), 0);
});
test("wrong content type returns 415", async () => assert.equal((await handleRequest(req(valid(), { "content-type": "text/plain" }), () => database)).status, 415));
test("cross-origin request is rejected", async () => {
  assert.equal((await handleRequest(req(valid(), { origin: "https://example.net" }), () => database)).status, 403);
  assert.equal((await handleRequest(req(valid(), { "sec-fetch-site": "cross-site" }), () => database)).status, 403);
  assert.equal(count(), 0);
});
test("body limit uses actual bytes even without Content-Length", async () => {
  assert.equal((await handleRequest(req({ ...valid(), description: "😀".repeat(5000) }), () => database)).status, 413);
  assert.equal((await handleRequest(req(valid(), { "content-length": "20000" }), () => database)).status, 413); assert.equal(count(), 0);
});
test("GET cannot read submitted personal data", async () => assert.equal((await handleRequest(new Request("http://localhost/api/requests"), () => database)).status, 405));
test("success gate rejects HTTP errors, missing identity, and mismatched identity", () => {
  const id = randomUUID(); assert.equal(isConfirmedSave(201, { id, replayed: false }, id), true);
  for (const [status, body] of [[503, { id, replayed: false }], [200, {}], [201, { id: randomUUID(), replayed: false }], [200, null], [200, { id }]]) assert.equal(isConfirmedSave(status, body, id), false);
});
test("record survives closing and reopening the historical SQLite fixture", async () => {
  mkdirSync(".test-results", { recursive: true }); const file = path.resolve(".test-results", `${randomUUID()}.sqlite`);
  let disk = new DatabaseSync(file); disk.exec(migration); const payload = valid();
  try {
    assert.equal((await handleRequest(req(payload), () => adapt(disk))).status, 201); disk.close(); disk = new DatabaseSync(file);
    assert.equal(disk.prepare("SELECT email FROM service_requests WHERE id = ?").get(payload.requestId).email, payload.email);
  } finally { disk.close(); unlinkSync(file); }
});
test("public Host and forwarded HTTPS origin work behind Next.js proxy; foreign origin stays blocked", async () => {
  const payload = valid();
  const store = () => ({ async save(data) { return { id: data.requestId, replayed: false }; } });
  assert.equal((await handleRequest(req(payload, { host: "127.0.0.1:5173", origin: "http://127.0.0.1:5173" }), store)).status, 201);
  assert.equal((await handleRequest(req(payload, { host: "vanta.example.com", origin: "https://vanta.example.com", "x-forwarded-proto": "https" }), store)).status, 201);
  assert.equal((await handleRequest(req(payload, { host: "vanta.example.com", origin: "https://attacker.example.com", "x-forwarded-proto": "https" }), store)).status, 403);
});