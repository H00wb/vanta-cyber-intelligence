import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { validateRequest, SERVICES } from "../lib/request-validation.ts";
import { handleRequest } from "../lib/request-handler.ts";
import { isConfirmedSave } from "../lib/request-response.ts";

const migration = readFileSync(new URL("../drizzle/0000_worried_ultragirl.sql", import.meta.url), "utf8");
const valid = () => ({ name: "Deniz Örnek", email: "deniz@example.com", service: "attack-surface", description: "Kurgusal kurumun internete açık test varlıklarını değerlendirmek istiyoruz.", requestId: randomUUID() });
let sqlite;
let database;
const adapt = db => ({ prepare(sql) { return { bind(...parameters) { return { async first() { return db.prepare(sql).get(...parameters) ?? null; } }; } }; } });
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
  ["unknown service", { service: "admin" }, "service"], ["short description", { description: "kısa" }, "description"],
  ["long description", { description: "A".repeat(2001) }, "description"], ["control character", { name: "Deniz\u0000Örnek" }, "name"],
  ["wrong field type", { description: 42 }, "description"], ["invalid request id", { requestId: "123" }, "requestId"],
  ["one emoji name", { name: "😀" }, "name"], ["ten emoji description", { description: "😀".repeat(10) }, "description"],
]) test(`server rejects ${label} before opening database`, async () => {
  const response = await handleRequest(req({ ...valid(), ...patch }), () => { throw new Error("Database must not be opened"); });
  assert.equal(response.status, 422); assert.ok((await response.json()).errors[key]); assert.equal(count(), 0);
});
test("exact character boundaries including astral Unicode reach database", async () => {
  const payload = { ...valid(), name: "😀😀", description: "😀".repeat(20) };
  assert.equal((await handleRequest(req(payload), () => database)).status, 201);
  assert.equal((await handleRequest(req({ ...valid(), name: "A".repeat(100), description: "A".repeat(2000) }), () => database)).status, 201);
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
test("success waits for committed INSERT", async () => {
  let commit;
  const payload = valid(); let completed = false;
  const pending = handleRequest(req(payload), () => ({ prepare() { return { bind() { return { first() { return new Promise(resolve => { commit = resolve; }); } }; } }; } })).then(value => { completed = true; return value; });
  while (!commit) await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false); commit({ id: payload.requestId }); assert.equal((await pending).status, 201);
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
test("record survives closing and reopening a file-backed server database", async () => {
  mkdirSync(".test-results", { recursive: true }); const file = path.resolve(".test-results", `${randomUUID()}.sqlite`);
  let disk = new DatabaseSync(file); disk.exec(migration); const payload = valid();
  try {
    assert.equal((await handleRequest(req(payload), () => adapt(disk))).status, 201); disk.close(); disk = new DatabaseSync(file);
    assert.equal(disk.prepare("SELECT email FROM service_requests WHERE id = ?").get(payload.requestId).email, payload.email);
  } finally { disk.close(); unlinkSync(file); }
});