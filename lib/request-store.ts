import type { RequestData } from "./request-validation.ts";
export type SavedRequest = { id: string; replayed: boolean };
export type RequestStore = { save(data: RequestData): Promise<SavedRequest> };
export class RequestConflictError extends Error { constructor() { super("Request identity conflict"); this.name = "RequestConflictError"; } }