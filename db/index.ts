import { env } from "cloudflare:workers";
export function getRequestDatabase(): D1Database {
  if (!env.DB) throw new Error("D1 database binding unavailable");
  return env.DB;
}