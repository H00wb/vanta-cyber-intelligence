export const SERVICES = [
  { value: "threat-intelligence", label: "AI destekli tehdit analizi" },
  { value: "attack-surface", label: "Attack Surface Management" },
  { value: "incident-correlation", label: "Güvenlik olaylarının korelasyonu" },
  { value: "risk-mapping", label: "Dijital varlık ve risk haritalama" },
] as const;
export type Service = (typeof SERVICES)[number]["value"];
export type RequestData = { name: string; email: string; service: Service; description: string; requestId: string };
export type FieldErrors = Partial<Record<keyof RequestData, string>>;
export const LIMITS = { name: 100, email: 254, description: 2000, descriptionMin: 20 };
export function validateRequest(input: unknown): { data: RequestData | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const record = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const field = (key: string) => typeof record[key] === "string" ? (record[key] as string).trim() : "";
  const name = field("name"), email = field("email").toLowerCase(), service = field("service"), description = field("description"), requestId = field("requestId").toLowerCase();
  if (Array.from(name).length < 2 || Array.from(name).length > LIMITS.name || /[\u0000-\u001f\u007f]/u.test(name)) errors.name = "İsim 2–100 karakter olmalı.";
  else if (name.split(/\s+/u).filter(Boolean).length < 2) errors.name = "Adınızı ve soyadınızı birlikte girin.";
  if (/[\u0000-\u001f\u007f]/u.test(email) || Array.from(email).length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) errors.email = "Geçerli bir e-posta adresi girin.";
  if (!SERVICES.some(item => item.value === service)) errors.service = "Bir hizmet seçin.";
  if (Array.from(description).length < LIMITS.descriptionMin || Array.from(description).length > LIMITS.description || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(description)) errors.description = "Açıklama 20–2000 karakter olmalı.";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(requestId)) errors.requestId = "Gönderim kimliği geçersiz. Sayfayı yenileyip tekrar deneyin.";
  return { data: Object.keys(errors).length ? null : { name, email, service: service as Service, description, requestId }, errors };
}