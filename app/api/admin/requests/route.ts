import { handleAdminRequests } from "@/lib/admin-handlers";
import { getAdminDatabase } from "@/lib/admin-database";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) { return handleAdminRequests(request, getAdminDatabase); }