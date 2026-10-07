import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server.js";
import { getSupabaseConfig } from "./config.ts";

export async function updateSession(request: NextRequest, clientFactory: typeof createServerClient = createServerClient) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = clientFactory(url, publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  // Validates claims and triggers expired-session refresh before SSR.
  // The landing page and request form stay public; no login redirect is needed.
  await supabase.auth.getClaims();
  return response;
}

export { updateSession as createClient };