import { RequestConflictError, type RequestStore } from "./request-store.ts";
import { isConfirmedSave } from "./request-response.ts";
export function createSupabaseStore(url: string, publishableKey: string, transport: typeof fetch = fetch): RequestStore {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) throw new Error("Invalid Supabase URL");
  if (!publishableKey) throw new Error("Supabase publishable key unavailable");
  return { async save(data) {
    const response = await transport(new URL("/rest/v1/rpc/vanta_submit_request", parsed), {
      method: "POST", headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: data.requestId, p_name: data.name, p_email: data.email, p_service: data.service, p_description: data.description }),
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 409) throw new RequestConflictError();
    if (!response.ok) throw new Error("Supabase persistence unavailable");
    const result: unknown = await response.json();
    if (!isConfirmedSave(200, result, data.requestId)) throw new Error("Persistence response not confirmed");
    return result as { id: string; replayed: boolean };
  } };
}