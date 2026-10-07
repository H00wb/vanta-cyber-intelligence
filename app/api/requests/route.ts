import { getRequestDatabase } from "@/db";
import { handleRequest } from "@/lib/request-handler";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return handleRequest(request, getRequestDatabase); }