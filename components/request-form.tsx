"use client";
import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { SERVICES, LIMITS, validateRequest, type FieldErrors } from "@/lib/request-validation";
import { isConfirmedSave } from "@/lib/request-response";
type Status = "idle" | "submitting" | "success" | "error";
export default function RequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const lock = useRef(false);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const fingerprint = JSON.stringify(values);
    if (!retry.current || retry.current.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
    const { data, errors: nextErrors } = validateRequest({ ...values, requestId: retry.current.id });
    setErrors(nextErrors); setMessage("");
    if (!data) {
      setStatus("error"); setMessage("Lütfen işaretlenen alanları kontrol edin.");
      const first = Object.keys(nextErrors)[0];
      (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    lock.current = true; setStatus("submitting"); setMessage("Talebiniz gönderiliyor…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: controller.signal });
      const body: unknown = await response.json().catch(() => { throw new Error("Gönderim doğrulanamadı. Aynı bilgilerle tekrar deneyebilirsiniz."); });
      if (!isConfirmedSave(response.status, body, data.requestId)) {
        const failure = body as { message?: string; errors?: FieldErrors } | null;
        setErrors(failure?.errors ?? {});
        throw new Error(typeof failure?.message === "string" ? failure.message : "Gönderim doğrulanamadı. Aynı bilgilerle tekrar deneyebilirsiniz.");
      }
      setConfirmation(data.requestId); setStatus("success"); setMessage("Talebiniz kaydedildi.");
      retry.current = null; form.reset();
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.name !== "AbortError" && error.name !== "TypeError" ? error.message : "Gönderim doğrulanamadı. Bağlantınızı kontrol edip aynı bilgilerle tekrar deneyin.");
    } finally { window.clearTimeout(timeout); lock.current = false; }
  }
  const submitting = status === "submitting";
  return (
    <form method="post" action="/api/requests" onSubmit={submit} noValidate className="request-form" aria-busy={submitting}>
      <div className="form-heading"><span className="eyebrow">TALEP FORMU</span><ShieldCheck size={22} aria-hidden="true" /></div>
      <h3>İlk adımı birlikte atalım.</h3><p className="form-intro">İhtiyacınızı anlatın, doğru hizmeti birlikte belirleyelim.</p>
      <fieldset disabled={submitting}><legend className="sr-only">Hizmet talebiniz</legend>
        <div className="form-row">
          <div className="field"><label htmlFor="name">Ad soyad <span aria-hidden="true">*</span></label><input id="name" name="name" autoComplete="name" placeholder="Deniz Örnek" required minLength={2} maxLength={LIMITS.name} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} />{errors.name ? <p className="field-error" id="name-error">{errors.name}</p> : null}</div>
          <div className="field"><label htmlFor="email">E-posta <span aria-hidden="true">*</span></label><input id="email" name="email" type="email" autoComplete="email" placeholder="deniz@example.com" required maxLength={LIMITS.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{errors.email ? <p className="field-error" id="email-error">{errors.email}</p> : null}</div>
        </div>
        <div className="field"><label htmlFor="service">İlgilendiğiniz hizmet <span aria-hidden="true">*</span></label><select id="service" name="service" required defaultValue="" aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? "service-error" : undefined}><option value="" disabled>Bir hizmet seçin</option>{SERVICES.map(service => <option key={service.value} value={service.value}>{service.label}</option>)}</select>{errors.service ? <p className="field-error" id="service-error">{errors.service}</p> : null}</div>
        <div className="field"><label htmlFor="description">İhtiyacınızdan bahsedin <span aria-hidden="true">*</span></label><textarea id="description" name="description" rows={4} required minLength={LIMITS.descriptionMin} maxLength={LIMITS.description} placeholder="Hangi dijital varlıklarınızı korumak, hangi riskleri anlamak istiyorsunuz?" aria-invalid={Boolean(errors.description)} aria-describedby={`description-hint${errors.description ? " description-error" : ""}`} /><p className="field-hint" id="description-hint">20–2000 karakter. Tüm alanlar zorunludur.</p>{errors.description ? <p className="field-error" id="description-error">{errors.description}</p> : null}</div>
        <p className="privacy-note">Bu demo için yalnız kurgusal bilgiler kullanın. Gerçek erişim bilgisi veya hassas veri paylaşmayın.</p>
        <button type="submit" className="button primary submit-button" disabled={submitting}>{submitting ? <><LoaderCircle size={18} className="spinner" aria-hidden="true" />Gönderiliyor…</> : "Talep gönder"}</button>
      </fieldset>
      <div ref={resultRef} tabIndex={-1} className={`form-result ${status}`} role={status === "error" ? "alert" : "status"} aria-live={status === "error" ? "assertive" : "polite"} aria-atomic="true">{status === "success" ? <CheckCircle2 size={20} aria-hidden="true" /> : null}<div>{message ? <p>{message}</p> : null}{status === "success" ? <p className="confirmation-id">Kayıt no: <span>{confirmation}</span></p> : null}</div></div>
    </form>
  );
}