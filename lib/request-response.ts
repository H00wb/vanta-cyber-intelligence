export function isConfirmedSave(status: number, body: unknown, requestId: string): boolean {
  if ((status !== 200 && status !== 201) || !body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return record.id === requestId && typeof record.replayed === "boolean";
}