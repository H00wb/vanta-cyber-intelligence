import { createSupabaseStore } from "../lib/supabase-store";
import { getSupabaseConfig } from "../utils/supabase/config";
export function getRequestDatabase() {
  const { url, publishableKey } = getSupabaseConfig();
  return createSupabaseStore(url, publishableKey);
}