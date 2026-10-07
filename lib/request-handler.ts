import { validateRequest } from "./request-validation.ts";
import { RequestConflictError, type RequestStore } from "./request-store.ts";
import { isConfirmedSave } from "./request-response.ts";
const MAX_BODY_BYTES = 16_384;


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
export async function handleRequest(request: Request, getDatabase: () => RequestStore): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Bu uç nokta yalnız POST kabul eder." }, 405);
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next.js may use an internal localhost URL; Host is the public request host.
  const protocol = request.headers.get("x-forwarded-proto");
  const publicOrigin = new URL(`${protocol === "https" || protocol === "http" ? protocol + ":" : requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`).origin;
  if ((origin && origin !== publicOrigin) || request.headers.get("sec-fetch-site") === "cross-site") return json({ message: "Bu kaynaktan gönderim kabul edilmiyor." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ message: "JSON biçiminde gönderim gerekli." }, 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return json({ message: "Gönderim boyutu sınırı aşıldı." }, 413);
  let input: unknown;
  try { input = await boundedJson(request); }
  catch (error) { return json({ message: error instanceof RangeError ? "Gönderim boyutu sınırı aşıldı." : "Gönderim verisi okunamadı." }, error instanceof RangeError ? 413 : 400); }
  const { data, errors } = validateRequest(input);
  if (!data) return json({ message: "Lütfen işaretlenen alanları kontrol edin.", errors }, 422);
  try {
    const saved = await getDatabase().save(data);
    if (!isConfirmedSave(200, saved, data.requestId)) throw new Error("Persisted record not confirmed");
    return json(saved, saved.replayed ? 200 : 201);
  } catch (error) {
    if (error instanceof RequestConflictError) return json({ message: "Gönderim kimliği farklı bir talep için kullanılmış. Sayfayı yenileyip tekrar deneyin." }, 409);
    console.error("request_persistence_failed", { requestId: data.requestId, kind: error instanceof Error ? error.name : "UnknownError" });
    return json({ message: "Kaydın tamamlandığı doğrulanamadı. Bilgileriniz formda duruyor; aynı bilgilerle tekrar deneyebilirsiniz." }, 503);
  }
}