import { handleAdminLogin } from "@/lib/admin-handlers";
import { getAdminDatabase } from "@/lib/admin-database";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) { return handleAdminLogin(request, getAdminDatabase); }