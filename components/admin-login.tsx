"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "@/app/admin/admin.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failureMessage(body: unknown, fallback: string): string {
  if (!isRecord(body) || typeof body.message !== "string") return fallback;
  const message = body.message.trim();
  return message && message.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(message) ? message : fallback;
}

export default function AdminLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitLock = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const username = String(values.get("username") ?? "").trim();
    const password = String(values.get("password") ?? "");

    if (!username || !password) {
      setError("Kullanıcı adı ve şifrenizi girin.");
      (form.elements.namedItem(!username ? "username" : "password") as HTMLInputElement | null)?.focus();
      return;
    }

    submitLock.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.status === 200 && isRecord(body) && body.ok === true) {
        router.refresh();
        return;
      }

      if (response.status === 401) {
        showError(failureMessage(body, "Kullanıcı adı veya şifre hatalı."));
      } else if (response.status === 429) {
        const retryAfter = isRecord(body) && typeof body.retryAfter === "number" && Number.isInteger(body.retryAfter) && body.retryAfter > 0 && body.retryAfter <= 86_400 ? body.retryAfter : null;
        const suffix = retryAfter ? " " + retryAfter + " saniye sonra tekrar deneyin." : " Lütfen bir süre sonra tekrar deneyin.";
        showError(failureMessage(body, "Çok fazla giriş denemesi yapıldı.") + suffix);
      } else if (response.status === 503) {
        showError(failureMessage(body, "Giriş hizmeti şu anda kullanılamıyor. Lütfen tekrar deneyin."));
      } else {
        showError("Giriş doğrulanamadı. Lütfen tekrar deneyin.");
      }
    } catch {
      showError("Giriş doğrulanamadı. Bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      window.clearTimeout(timeout);
      submitLock.current = false;
      setPending(false);
    }
  }

  return (
    <div className={styles.page + " " + styles.loginPage}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">V</span>
            <span>VANTA<span className={styles.brandSub}>CYBER INTELLIGENCE</span></span>
          </div>
          <span className={styles.headerLabel}>YÖNETİM</span>
        </header>
      </div>
      <main className={styles.loginMain}>
        <section className={styles.loginCard} aria-labelledby="admin-login-title">
          <div className={styles.loginIcon}><LockKeyhole size={24} strokeWidth={1.5} aria-hidden="true" /></div>
          <p className={styles.eyebrow}>VANTA / ADMIN</p>
          <h1 className={styles.loginTitle} id="admin-login-title">Yönetici girişi</h1>
          <p className={styles.loginIntro}>Talep kayıtlarını görüntülemek için giriş yapın.</p>
          <form onSubmit={submit} method="post" action="/api/admin/login" noValidate aria-busy={pending}>
            <fieldset className={styles.loginFields} disabled={pending}>
              <legend className={styles.srOnly}>Yönetici giriş bilgileri</legend>
              <div className={styles.field}>
                <label htmlFor="admin-username">Kullanıcı adı</label>
                <input id="admin-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} aria-describedby={error ? "admin-login-error" : undefined} />
              </div>
              <div className={styles.field}>
                <label htmlFor="admin-password">Şifre</label>
                <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={200} aria-describedby={error ? "admin-login-error" : undefined} />
              </div>
              <button className={styles.button + " " + styles.primaryButton + " " + styles.loginButton} type="submit" disabled={pending}>
                {pending ? <><LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />Giriş yapılıyor…</> : <>Giriş yap<ArrowRight size={18} aria-hidden="true" /></>}
              </button>
            </fieldset>
            {error ? <p className={styles.error} id="admin-login-error" ref={errorRef} tabIndex={-1} role="alert">{error}</p> : null}
            <span className={styles.srOnly} role="status" aria-live="polite">{pending ? "Giriş yapılıyor." : ""}</span>
          </form>
        </section>
      </main>
    </div>
  );
}
