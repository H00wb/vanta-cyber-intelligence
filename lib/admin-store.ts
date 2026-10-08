import { validateRequest, type Service } from "./request-validation.ts";

export type AdminRecord = {
  id: string; name: string; email: string; service: Service; description: string; created_at: string;
};
export type AdminPage = { rows: AdminRecord[]; total: number; page: number; pageSize: 50 };
export type AdminLoginAttempt = { allowed: boolean; retryAfter: number };
export type AdminStore = {
  list(input: { page: number; query: string }): Promise<AdminPage>;
  consumeLoginAttempt(keyHash: string): Promise<AdminLoginAttempt>;
};
const HASH = /^[0-9a-f]{64}$/u;
const UNAVAILABLE = "Admin storage unavailable";
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const keysMatch = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!parts || Number.isNaN(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate() && hour <= 23 && minute <= 59 && second <= 59;
}
function record(value: unknown): AdminRecord {
  if (!object(value) || !keysMatch(value, ["id", "name", "email", "service", "description", "created_at"])) throw new Error(UNAVAILABLE);
  const { data } = validateRequest({
    requestId: value.id, name: value.name, email: value.email, service: value.service, description: value.description,
  });
  if (!data || data.requestId !== value.id || data.name !== value.name || data.email !== value.email ||
    data.service !== value.service || data.description !== value.description) throw new Error(UNAVAILABLE);
  const timestamp = value.created_at;
  if (!validTimestamp(timestamp)) throw new Error(UNAVAILABLE);
  return { id: data.requestId, name: data.name, email: data.email, service: data.service, description: data.description, created_at: timestamp };
}
function pageResult(value: unknown, requestedPage: number): AdminPage {
  if (!object(value) || !keysMatch(value, ["rows", "total", "page", "pageSize"]) ||
    !Array.isArray(value.rows) || value.rows.length > 50 || value.page !== requestedPage || value.pageSize !== 50 ||
    typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0) throw new Error(UNAVAILABLE);
  const expectedRows = Math.max(0, Math.min(50, value.total - (requestedPage - 1) * 50));
  if (value.rows.length !== expectedRows) throw new Error(UNAVAILABLE);
  return { rows: value.rows.map(record), total: value.total, page: requestedPage, pageSize: 50 };
}
function attemptResult(value: unknown): AdminLoginAttempt {
  if (!object(value) || !keysMatch(value, ["allowed", "retryAfter"]) || typeof value.allowed !== "boolean" ||
    typeof value.retryAfter !== "number" || !Number.isInteger(value.retryAfter) ||
    (value.allowed ? value.retryAfter !== 0 : value.retryAfter < 1 || value.retryAfter > 300)) throw new Error(UNAVAILABLE);
  return { allowed: value.allowed, retryAfter: value.retryAfter };
}
export function createAdminStore(url: string, publishableKey: string, readToken: string, transport: typeof fetch = fetch): AdminStore {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new Error("Admin storage configuration unavailable"); }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co") || parsed.username || parsed.password ||
    typeof publishableKey !== "string" || !publishableKey || typeof readToken !== "string" || !HASH.test(readToken)) {
    throw new Error("Admin storage configuration unavailable");
  }
  const rpc = async (name: string, parameters: Record<string, unknown>): Promise<unknown> => {
    try {
      const response = await transport(new URL("/rest/v1/rpc/" + name, parsed), {
        method: "POST", headers: { apikey: publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: readToken, ...parameters }),
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(UNAVAILABLE);
      return await response.json();
    } catch {
      // Neither upstream diagnostics nor credentials/visitor data escape here.
      throw new Error(UNAVAILABLE);
    }
  };
  return {
    async list(input) {
      if (!object(input) || !Number.isInteger(input.page) || input.page < 1 || input.page > 10_000 ||
        typeof input.query !== "string" || Array.from(input.query).length > 100 ||
        /[\u0000-\u001f\u007f]/u.test(input.query)) throw new Error("Admin request invalid");
      return pageResult(await rpc("vanta_admin_requests", { p_page: input.page, p_query: input.query }), input.page);
    },
    async consumeLoginAttempt(keyHash) {
      if (typeof keyHash !== "string" || !HASH.test(keyHash)) throw new Error("Admin request invalid");
      return attemptResult(await rpc("vanta_admin_login_attempt", { p_key: keyHash }));
    },
  };
}
