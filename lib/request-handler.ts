import { validateRequest, type RequestData } from "./request-validation.ts";
const MAX_BODY_BYTES = 16_384;
type Database = Pick<D1Database, "prepare">;
type StoredRequest = Omit<RequestData, "requestId"> & { id: string };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError("Body too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}
export async function handleRequest(request: Request, getDatabase: () => Database): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Bu uç nokta yalnız POST kabul eder." }, 405);
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return json({ message: "Bu kaynaktan gönderim kabul edilmiyor." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ message: "JSON biçiminde gönderim gerekli." }, 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return json({ message: "Gönderim boyutu sınırı aşıldı." }, 413);
  let input: unknown;
  try { input = await boundedJson(request); }
  catch (error) { return json({ message: error instanceof RangeError ? "Gönderim boyutu sınırı aşıldı." : "Gönderim verisi okunamadı." }, error instanceof RangeError ? 413 : 400); }
  const { data, errors } = validateRequest(input);
  if (!data) return json({ message: "Lütfen işaretlenen alanları kontrol edin.", errors }, 422);
  try {
    const database = getDatabase();
    // A committed INSERT is the only path to a new-request success response.
    const inserted = await database.prepare(`INSERT INTO service_requests (id, name, email, service, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING id`)
      .bind(data.requestId, data.name, data.email, data.service, data.description, new Date().toISOString()).first<{ id: string }>();
    if (inserted) return json({ id: inserted.id, replayed: false }, 201);
    const existing = await database.prepare("SELECT id, name, email, service, description FROM service_requests WHERE id = ?").bind(data.requestId).first<StoredRequest>();
    if (!existing) throw new Error("Persisted record not confirmed");
    if (existing.name !== data.name || existing.email !== data.email || existing.service !== data.service || existing.description !== data.description) return json({ message: "Gönderim kimliği farklı bir talep için kullanılmış. Sayfayı yenileyip tekrar deneyin." }, 409);
    return json({ id: existing.id, replayed: true }, 200);
  } catch (error) {
    console.error("request_persistence_failed", { requestId: data.requestId, kind: error instanceof Error ? error.name : "UnknownError" });
    return json({ message: "Kaydın tamamlandığı doğrulanamadı. Bilgileriniz formda duruyor; aynı bilgilerle tekrar deneyebilirsiniz." }, 503);
  }
}