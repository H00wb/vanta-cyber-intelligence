"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, LogOut, RefreshCw, Search, X } from "lucide-react";
import { SERVICES } from "@/lib/request-validation";
import { useRouter } from "next/navigation";
import styles from "@/app/admin/admin.module.css";

type RequestRow = {
  id: string;
  name: string;
  email: string;
  service: string;
  description: string;
  created_at: string;
};

type RequestResult = { rows: RequestRow[]; total: number; page: number; pageSize: 50 };
type Query = { page: number; q: string; revision: number };
type Status = "loading" | "ready" | "error";

const serviceLabels = new Map<string, string>(SERVICES.map(service => [service.value, service.label]));
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isResult(value: unknown): value is RequestResult {
  if (!isRecord(value) || !Array.isArray(value.rows) || value.rows.length > 50 || typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 || typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 || value.pageSize !== 50) return false;
  return value.rows.every(row => isRecord(row) && ["id", "name", "email", "service", "description", "created_at"].every(key => typeof row[key] === "string"));
}

function failureMessage(body: unknown, fallback: string): string {
  if (!isRecord(body) || typeof body.message !== "string") return fallback;
  const message = body.message.trim();
  return message && message.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(message) ? message : fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export default function AdminPanel({ username }: { username: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<Query>({ page: 1, q: "", revision: 0 });
  const [result, setResult] = useState<RequestResult | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [logoutPending, setLogoutPending] = useState(false);
  const logoutLock = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let active = true;

    async function load() {
      try {
        const params = new URLSearchParams({ page: String(query.page) });
        if (query.q) params.set("q", query.q);
        const response = await fetch("/api/admin/requests?" + params, { cache: "no-store", signal: controller.signal });

        if (response.status === 401) {
          if (active) router.refresh();
          return;
        }

        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(failureMessage(body, "Kayıtlar yüklenemedi. Lütfen tekrar deneyin."));
        if (!isResult(body)) throw new Error("Kayıtlar doğrulanamadı. Lütfen tekrar deneyin.");

        if (active) {
          setResult(body);
          setStatus("ready");
        }
      } catch (failure) {
        if (active) {
          setStatus("error");
          setError(failure instanceof Error && failure.name !== "AbortError" && failure.name !== "TypeError" ? failure.message : "Kayıtlar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.");
          requestAnimationFrame(() => errorRef.current?.focus());
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query.page, query.q, query.revision, router]);

  function loadPage(page: number, q = query.q) {
    setResult(null);
    setError("");
    setStatus("loading");
    setQuery(previous => ({ page, q, revision: previous.revision + 1 }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading" || logoutPending) return;
    loadPage(1, search.trim());
  }

  function clearSearch() {
    setSearch("");
    loadPage(1, "");
    searchRef.current?.focus();
  }

  async function logout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setLogoutPending(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/admin/logout", { method: "POST", signal: controller.signal });
      if (response.status === 204 || response.status === 401) {
        router.refresh();
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      setError(failureMessage(body, "Çıkış yapılamadı. Lütfen tekrar deneyin."));
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setError("Çıkış yapılamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      window.clearTimeout(timeout);
      logoutLock.current = false;
      setLogoutPending(false);
    }
  }

  const loading = status === "loading";
  const controlsDisabled = loading || logoutPending;
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const firstRecord = result && result.rows.length ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastRecord = result && firstRecord ? firstRecord + result.rows.length - 1 : 0;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">V</span>
            <span>VANTA<span className={styles.brandSub}>CYBER INTELLIGENCE</span></span>
          </div>
          <div className={styles.session}>
            <span className={styles.username}>Oturum: <strong>{username}</strong></span>
            <button type="button" onClick={logout} className={styles.button + " " + styles.logoutButton} disabled={logoutPending}>
              {logoutPending ? <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}
              {logoutPending ? "Çıkış yapılıyor…" : "Çıkış yap"}
            </button>
          </div>
        </header>
        <main className={styles.panelMain}>
          <div className={styles.pageHeading}>
            <div><p className={styles.eyebrow}>VANTA / YÖNETİM</p><h1 className={styles.panelTitle}>Talep kayıtları</h1></div>
            <p className={styles.panelIntro}>İletişim formundan gönderilen hizmet talepleri.</p>
          </div>
          <div className={styles.toolbar}>
            <form className={styles.searchForm} onSubmit={submitSearch} role="search" aria-label="Talep kayıtlarında ara">
              <label className={styles.searchLabel} htmlFor="admin-search">Kayıt no, ad soyad veya e-posta</label>
              <fieldset className={styles.searchFields} disabled={controlsDisabled}>
                <legend className={styles.srOnly}>Talep araması</legend>
                <div className={styles.searchInput}>
                  <Search size={18} aria-hidden="true" />
                  <input id="admin-search" ref={searchRef} name="q" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Kayıtlarda ara…" maxLength={100} autoComplete="off" />
                </div>
                <button type="submit" className={styles.button + " " + styles.primaryButton}>Ara</button>
                {search || query.q ? <button className={styles.button} type="button" onClick={clearSearch}><X size={16} aria-hidden="true" />Temizle</button> : null}
              </fieldset>
            </form>
            <button className={styles.button + " " + styles.refreshButton} type="button" onClick={() => loadPage(query.page)} disabled={controlsDisabled}>
              <RefreshCw size={16} className={loading ? styles.spinner : undefined} aria-hidden="true" />Yenile
            </button>
          </div>
          {error ? <p className={styles.error} ref={errorRef} tabIndex={-1} role="alert">{error}</p> : null}
          <section className={styles.tableCard} aria-labelledby="admin-records-title">
            <div className={styles.tableHeading}>
              <h2 id="admin-records-title">{query.q ? "Arama sonuçları" : "Tüm talepler"}</h2>
              <span className={styles.recordCount}>{result ? result.total + " kayıt" : loading ? "Yükleniyor…" : "Kayıtlar yüklenemedi"}</span>
            </div>
            <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{loading ? "Kayıtlar yükleniyor." : result ? result.total + " kayıt. " + firstRecord + "–" + lastRecord + " arası gösteriliyor." : ""}</p>
            <div className={styles.tableRegion} role="region" aria-labelledby="admin-records-title" tabIndex={0} aria-busy={loading}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>İletişim formundan gelen talepler. Kayıt zamanı UTC olarak gösterilir.</caption>
                <thead><tr><th scope="col">Kayıt no</th><th scope="col">Ad soyad</th><th scope="col">E-posta</th><th scope="col">Hizmet</th><th scope="col">Açıklama</th><th scope="col">Kayıt zamanı <span className={styles.utcLabel}>UTC</span></th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className={styles.stateCell}><span className={styles.loadingMessage}><LoaderCircle size={20} className={styles.spinner} aria-hidden="true" />Kayıtlar yükleniyor…</span></td></tr> : result ? result.rows.length ? result.rows.map(row => (
                    <tr key={row.id}>
                      <td className={styles.idCell}>{row.id}</td>
                      <td className={styles.nameCell}>{row.name}</td>
                      <td className={styles.emailCell}>{row.email}</td>
                      <td className={styles.serviceCell}><span className={styles.serviceLabel}>{serviceLabels.get(row.service) ?? row.service}</span></td>
                      <td className={styles.descriptionCell}>{row.description}</td>
                      <td className={styles.dateCell}><time dateTime={row.created_at}>{formatDate(row.created_at)}</time></td>
                    </tr>
                  )) : <tr><td colSpan={6} className={styles.stateCell}>{query.q ? "Aramanızla eşleşen kayıt bulunamadı." : "Henüz talep kaydı bulunmuyor."}</td></tr> : <tr><td colSpan={6} className={styles.stateCell}>Kayıtlar görüntülenemedi. Yenile ile tekrar deneyin.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <span className={styles.range}>{result ? result.total ? firstRecord + "–" + lastRecord + " / " + result.total + " kayıt" : "0 kayıt" : loading ? "Kayıtlar yükleniyor…" : "Kayıtlar yüklenemedi"}</span>
              <div className={styles.pageControls}>
                <button type="button" className={styles.button + " " + styles.pageButton} aria-label="Önceki sayfa" onClick={() => loadPage((result?.page ?? query.page) - 1)} disabled={controlsDisabled || !result || result.page <= 1}><ChevronLeft size={18} aria-hidden="true" /></button>
                <span className={styles.pageNumber}>{result ? "Sayfa " + result.page + " / " + totalPages : "Sayfa " + query.page}</span>
                <button type="button" className={styles.button + " " + styles.pageButton} aria-label="Sonraki sayfa" onClick={() => loadPage((result?.page ?? query.page) + 1)} disabled={controlsDisabled || !result || result.page >= totalPages}><ChevronRight size={18} aria-hidden="true" /></button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
