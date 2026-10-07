import { createSupabaseStore } from "../lib/supabase-store";
export function getRequestDatabase() {
  return createSupabaseStore(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_PUBLISHABLE_KEY ?? "");
}