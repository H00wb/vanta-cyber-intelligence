import { getSupabaseConfig } from "@/utils/supabase/config";
import { createAdminStore } from "./admin-store";
export function getAdminDatabase() {
  const { url, publishableKey } = getSupabaseConfig();
  const token = process.env.ADMIN_DB_READ_TOKEN;
  if (!token) throw new Error("Admin database configuration unavailable");
  return createAdminStore(url, publishableKey, token);
}