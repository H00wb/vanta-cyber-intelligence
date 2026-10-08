import { createAdminSession, getAdminConfig, loginAttemptKey, requestSession, sameOrigin, secureCookie, sessionCookie, verifyAdminCredentials, type AdminConfig } from "./admin-auth.ts";
import type { createAdminStore } from "./admin-store.ts";
type Store = ReturnType<typeof createAdminStore>;
const json = (data: unknown, status: number, headers: Record<string, string> = {}) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow", ...headers } });
async function readLogin(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing body");
  const parts: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024) { await reader.cancel(); throw new RangeError("Body too large"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(bytes); let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}
export async function handleAdminLogin(request: Request, getStore: () => Store, configProvider: () => AdminConfig = getAdminConfig, now = Date.now()) {
  if (request.method !== "POST") return json({ message: "POST isteği gerekli." }, 405);
  if (!sameOrigin(request)) return json({ message: "Bu kaynaktan giriş yapılamıyor." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ message: "JSON biçiminde giriş gerekli." }, 415);
  let input: unknown;
  try { input = await readLogin(request); }
  catch (error) { return json({ message: "Giriş bilgileri okunamadı." }, error instanceof RangeError ? 413 : 400); }
  const data = input as { username?: unknown; password?: unknown } | null;
  if (typeof data?.username !== "string" || typeof data.password !== "string" || data.username.length > 100 || data.password.length > 256) return json({ message: "Kullanıcı adı ve şifre gerekli." }, 422);
  try {
    const config = configProvider();
    const attempt = await getStore().consumeLoginAttempt(loginAttemptKey(request, config));
    if (!attempt.allowed) return json({ message: "Çok fazla giriş denemesi yapıldı. Birkaç dakika sonra tekrar deneyin.", retryAfter: attempt.retryAfter }, 429, { "Retry-After": String(attempt.retryAfter) });
    if (!await verifyAdminCredentials(data.username, data.password, config)) return json({ message: "Kullanıcı adı veya şifre yanlış." }, 401);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(createAdminSession(config, now), secureCookie(request)) });
  } catch { return json({ message: "Giriş şu anda doğrulanamıyor. Lütfen tekrar deneyin." }, 503); }
}
export async function handleAdminRequests(request: Request, getStore: () => Store, configProvider: () => AdminConfig = getAdminConfig, now = Date.now()) {
  if (request.method !== "GET") return json({ message: "GET isteği gerekli." }, 405);
  if (!request.headers.get("cookie")) return json({ message: "Kayıtları görmek için giriş yapın." }, 401);
  try {
    if (!requestSession(request, configProvider(), now)) return json({ message: "Oturumunuz sona erdi. Tekrar giriş yapın." }, 401);
    const url = new URL(request.url);
    const pageText = url.searchParams.get("page") ?? "1";
    const query = (url.searchParams.get("q") ?? "").trim();
    if (!/^[1-9][0-9]{0,4}$/.test(pageText) || Number(pageText) > 10000 || Array.from(query).length > 100 || /[\u0000-\u001f\u007f]/u.test(query)) return json({ message: "Arama veya sayfa numarası geçersiz." }, 422);
    const result = await getStore().list({ page: Number(pageText), query });
    return json(result, 200);
  } catch { return json({ message: "Kayıtlar okunamadı. Lütfen yeniden deneyin." }, 503); }
}
export function handleAdminLogout(request: Request) {
  if (request.method !== "POST") return json({ message: "POST isteği gerekli." }, 405);
  if (!sameOrigin(request)) return json({ message: "Bu kaynaktan çıkış yapılamıyor." }, 403);
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store", "Set-Cookie": sessionCookie("", secureCookie(request), true) } });
}