import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "vanta_admin";
export const SESSION_SECONDS = 3600;
export type AdminConfig = { username: string; passwordHash: string; sessionSecret: string };
export type AdminSession = { username: string };

export function getAdminConfig(): AdminConfig {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!username || !/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(passwordHash ?? "") || !/^[0-9a-f]{64}$/.test(sessionSecret ?? "")) {
    throw new Error("Admin configuration unavailable");
  }
  return { username, passwordHash: passwordHash!, sessionSecret: sessionSecret! };
}
function equalText(left: string, right: string) {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashAdminPassword(password: string, salt = randomBytes(16)) {
  const derived = await derive(password, salt);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}
export async function verifyAdminCredentials(username: string, password: string, config: AdminConfig) {
  if (username.length > 100 || password.length > 256) return false;
  const [, salt, expected] = config.passwordHash.split(":");
  const actual = await derive(password, Buffer.from(salt, "hex"));
  return timingSafeEqual(actual, Buffer.from(expected, "hex")) && equalText(username, config.username);
}
export function createAdminSession(config: AdminConfig, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, username: config.username, issuedAt, expiresAt: issuedAt + SESSION_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", Buffer.from(config.sessionSecret, "hex")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function verifyAdminSession(token: string | undefined, config: AdminConfig, now = Date.now()): AdminSession | null {
  if (!token || token.length > 1000) return null;
  const [payload, signature, extra] = token.split(".");
  if (extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(payload ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(signature ?? "")) return null;
  const expected = createHmac("sha256", Buffer.from(config.sessionSecret, "hex")).update(payload).digest("base64url");
  if (!equalText(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const timestamp = Math.floor(now / 1000);
    if (data?.v !== 1 || typeof data.username !== "string" || !equalText(data.username, config.username)
      || !Number.isInteger(data.issuedAt) || !Number.isInteger(data.expiresAt)
      || data.issuedAt > timestamp || data.expiresAt <= timestamp || data.expiresAt - data.issuedAt !== SESSION_SECONDS) return null;
    return { username: data.username };
  } catch { return null; }
}
export function requestSession(request: Request, config: AdminConfig, now = Date.now()) {
  const cookie = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  return verifyAdminSession(cookie, config, now);
}
export function sessionCookie(token: string, secure: boolean, clear = false) {
  return `${ADMIN_COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}
export function sameOrigin(request: Request) {
  try {
    const url = new URL(request.url);
    const forwarded = request.headers.get("x-forwarded-proto");
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : url.protocol;
    const publicOrigin = new URL(`${protocol}//${request.headers.get("host") ?? url.host}`).origin;
    return request.headers.get("origin") === publicOrigin && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch { return false; }
}
export function secureCookie(request: Request) {
  return process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}
export function loginAttemptKey(request: Request, config: AdminConfig) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  return createHmac("sha256", Buffer.from(config.sessionSecret, "hex")).update(`admin-login:${address}`).digest("hex");
}