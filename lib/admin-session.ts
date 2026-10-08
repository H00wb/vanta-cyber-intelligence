import { cookies } from "next/headers";
import { ADMIN_COOKIE, getAdminConfig, verifyAdminSession } from "./admin-auth";
export async function getAdminSession() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminSession(token, getAdminConfig()) : null;
}