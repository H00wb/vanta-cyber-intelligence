import { test, expect, type Page, type Response } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { recordFixture } from "./fixture-log";

const production = process.env.TEST_BASE_URL?.startsWith("https://") ?? false;
const environment = production ? "Vercel production / real Supabase Postgres" : "Next.js local / real Supabase Postgres";
const fixture = {
  name: "İnceleme Testi",
  email: "inceleme@example.com",
  service: "risk-mapping",
  description: "Kurgusal test kurumunun dijital varlıklarını ve güvenlik risklerini değerlendirmek istiyoruz.",
};
const serviceLabel = "Dijital varlık ve risk haritalama";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SavedRow = {
  id: string;
  name: string;
  email: string;
  service: string;
  description: string;
  created_at: string;
};
type ListResult = { rows: SavedRow[]; total: number; page: number; pageSize: number };

// Explicit screenshots below contain only the login screen or this test's own UUID-filtered row.
// Disable automatic captures so a failing unfiltered panel cannot persist an existing user's data or a session.
test.use({ screenshot: "off", trace: "off" });

test.beforeAll(() => {
  mkdirSync("evidence", { recursive: true });
  mkdirSync(".test-results", { recursive: true });
});

function apiResponse(response: Response, pathname: string, method = "GET") {
  return new URL(response.url()).pathname === pathname && response.request().method() === method;
}

async function login(page: Page, password = "admin123") {
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill("admin");
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  const response = page.waitForResponse(item => apiResponse(item, "/api/admin/login", "POST"));
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  return response;
}

async function expectPanel(page: Page) {
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Talep kayıtları", exact: true })).toBeVisible();
}

async function filterOwnRecord(page: Page, id: string) {
  await expect(page.getByRole("button", { name: "Ara", exact: true })).toBeEnabled();
  await page.getByPlaceholder("Kayıtlarda ara…", { exact: true }).fill(id);
  const responsePromise = page.waitForResponse(response => apiResponse(response, "/api/admin/requests") && new URL(response.url()).searchParams.get("q") === id);
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json() as ListResult;
  expect(Array.isArray(body.rows)).toBe(true);
  expect(body.rows.length).toBe(1);
  expect(body.total).toBe(1);
  expect(body.page).toBe(1);
  expect(body.pageSize).toBe(50);
  const ownRow = body.rows.find(row => row.id === id);
  expect(Boolean(ownRow)).toBe(true);
  if (!ownRow) throw new Error("The filtered response did not contain the test fixture.");

  expect(ownRow.name).toBe(fixture.name);
  expect(ownRow.email).toBe(fixture.email);
  expect(ownRow.service).toBe(fixture.service);
  expect(ownRow.description).toBe(fixture.description);
  expect(typeof ownRow.created_at).toBe("string");
  expect(Number.isNaN(Date.parse(ownRow.created_at))).toBe(false);

  await expect(page.locator("tbody tr")).toHaveCount(1);
  const visibleRow = page.locator("tbody tr").filter({ hasText: id });
  await expect(visibleRow).toHaveCount(1);
  const cells = visibleRow.getByRole("cell");
  await expect(cells).toHaveCount(6);
  await expect(cells.nth(0)).toHaveText(id);
  await expect(cells.nth(1)).toHaveText(fixture.name);
  await expect(cells.nth(2)).toHaveText(fixture.email);
  await expect(cells.nth(3)).toHaveText(serviceLabel);
  await expect(cells.nth(4)).toHaveText(fixture.description);
  await expect(visibleRow.locator("time")).toHaveAttribute("datetime", ownRow.created_at);
  const timestamp = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC",
  }).format(new Date(ownRow.created_at));
  await expect(cells.nth(5)).toHaveText(timestamp);
  await expect(page.getByRole("columnheader", { name: "Kayıt zamanı UTC", exact: true })).toBeVisible();
  await expect(page.getByText("1 kayıt", { exact: true })).toBeVisible();

  return { status: response.status(), total: body.total, page: body.page, pageSize: body.pageSize, row: ownRow };
}

test("anonymous requests are denied and direct /admin opens the private login entry", async ({ page, request }) => {
  const response = await request.get("/api/admin/requests?page=1");
  expect(response.status()).toBe(401);
  await page.goto("/");
  const landingHasAdminLink = await page.locator("a").evaluateAll(links => links.some(link => new URL((link as HTMLAnchorElement).href).pathname === "/admin"));
  expect(landingHasAdminLink).toBe(false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page).toHaveTitle("VANTA Admin");
  await expect(page.getByRole("heading", { name: "Yönetici girişi", exact: true })).toBeVisible();
  await expect(page.getByLabel("Kullanıcı adı", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Şifre", { exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.screenshot({ path: "evidence/admin-login.png", fullPage: true });
});

test("wrong password is rejected, the signed cookie survives refresh, and logout removes access", async ({ page }) => {
  await page.goto("/admin");
  const rejected = await login(page, "incorrect-test-password");
  expect(rejected.status()).toBe(401);
  await expect(page.locator("p[role='alert']")).toContainText(/yanlış|hatalı/);
  await expect(page.getByRole("heading", { name: "Yönetici girişi", exact: true })).toBeVisible();

  const signedIn = await login(page);
  expect(signedIn.status()).toBe(200);
  await expectPanel(page);
  const cookieFlags = (await page.context().cookies()).filter(cookie => cookie.name === "vanta_admin").map(cookie => ({
    name: cookie.name, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite, path: cookie.path,
  }));
  expect(cookieFlags).toHaveLength(1);
  expect(cookieFlags[0].httpOnly).toBe(true);
  expect(cookieFlags[0].sameSite).toBe("Strict");
  expect(cookieFlags[0].path).toBe("/");
  expect(await page.evaluate(() => document.cookie.includes("vanta_admin="))).toBe(false);

  const refreshed = page.waitForResponse(response => apiResponse(response, "/api/admin/requests"));
  await page.reload();
  await expectPanel(page);
  expect((await refreshed).status()).toBe(200);

  const loggedOut = page.waitForResponse(response => apiResponse(response, "/api/admin/logout", "POST"));
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  expect((await loggedOut).status()).toBe(204);
  await expect(page.getByRole("heading", { name: "Yönetici girişi", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  const denied = await page.request.get("/api/admin/requests?page=1");
  expect(denied.status()).toBe(401);
  expect((await page.context().cookies()).some(cookie => cookie.name === "vanta_admin")).toBe(false);
});

test("a real fictional form submission is read back by its UUID and remains after reload", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByLabel(/Ad soyad/).fill(fixture.name);
  await page.getByLabel(/E-posta/).fill(fixture.email);
  await page.getByLabel(/İlgilendiğiniz hizmet/).selectOption(fixture.service);
  await page.getByLabel(/İhtiyacınızdan bahsedin/).fill(fixture.description);
  const savedResponse = page.waitForResponse(response => apiResponse(response, "/api/requests", "POST"));
  await page.getByRole("button", { name: "Talep gönder", exact: true }).click();
  const saved = await savedResponse;
  expect(saved.status()).toBe(201);
  const savedBody = await saved.json() as { id: string; replayed: boolean };
  expect(typeof savedBody.id).toBe("string");
  expect(savedBody.id).toMatch(uuidPattern);
  await recordFixture(savedBody.id);
  const payload = saved.request().postDataJSON() as typeof fixture & { requestId: string };
  expect(payload.requestId).toBe(savedBody.id);
  expect(savedBody.replayed).toBe(false);
  await expect(page.getByText("Talebiniz kaydedildi.", { exact: true })).toBeVisible();

  await page.goto("/admin");
  expect((await login(page)).status()).toBe(200);
  await expectPanel(page);
  const readback = await filterOwnRecord(page, savedBody.id);
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);

  await page.reload();
  await expectPanel(page);
  const afterReload = await filterOwnRecord(page, savedBody.id);
  expect(afterReload.row.created_at).toBe(readback.row.created_at);

  // Both count and UUID checks complete before this screenshot, so no pre-existing row is included.
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").getByRole("cell", { name: savedBody.id, exact: true })).toBeVisible();
  await page.screenshot({ path: "evidence/admin-record.png", fullPage: true });
  writeFileSync(".test-results/admin-proof-" + (production ? "production" : "local") + ".json", JSON.stringify({
    environment,
    recordedAt: new Date().toISOString(),
    id: savedBody.id,
    submitStatus: saved.status(),
    payload,
    readback,
    afterReload,
    accessibility: { violations: scan.violations.length },
  }, null, 2));
});

test("a simulated 503 list response is a focused error and cannot look like an empty success", async ({ page }) => {
  await page.route("**/api/admin/requests**", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ message: "Kayıtlar okunamadı. Lütfen yeniden deneyin." }),
  }));
  await page.goto("/admin");
  expect((await login(page)).status()).toBe(200);
  await expectPanel(page);
  await expect(page.locator("p[role='alert']")).toContainText("Kayıtlar okunamadı");
  await expect(page.locator("p[role='alert']")).toBeFocused();
  await expect(page.getByText("Kayıtlar görüntülenemedi. Yenile ile tekrar deneyin.", { exact: true })).toBeVisible();
  await expect(page.getByText("Henüz talep kaydı bulunmuyor.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Aramanızla eşleşen kayıt bulunamadı.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0 kayıt", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yenile", exact: true })).toBeEnabled();
});

test("390px login and admin panel keep horizontal scrolling inside the table region", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Yönetici girişi", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.route("**/api/admin/requests**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      rows: [{
        id: "00000000-0000-4000-8000-000000000001",
        name: "Mobil İnceleme",
        email: "mobil@example.com",
        service: fixture.service,
        description: "Kurgusal mobil görünüm için uzun bir talep açıklaması ve dijital varlık değerlendirme ihtiyacı.",
        created_at: "2026-10-08T00:00:00.000Z",
      }],
      total: 1, page: 1, pageSize: 50,
    }),
  }));
  expect((await login(page)).status()).toBe(200);
  await expectPanel(page);
  await expect(page.getByRole("cell", { name: "Mobil İnceleme", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const region = page.locator('div[role="region"][tabindex="0"]');
  const metrics = await region.evaluate(element => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(["auto", "scroll"]).toContain(metrics.overflowX);
  await region.focus();
  await expect(region).toBeFocused();
});

test("login labels and keyboard sequence are accessible under WCAG A/AA scanning", async ({ page }) => {
  await page.goto("/admin");
  const username = page.getByLabel("Kullanıcı adı", { exact: true });
  const password = page.getByLabel("Şifre", { exact: true });
  await expect(username).toHaveAttribute("autocomplete", "username");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(password).toHaveAttribute("type", "password");
  await page.keyboard.press("Tab");
  await expect(username).toBeFocused();
  await page.keyboard.type("admin");
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.type("admin123");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Giriş yap", exact: true })).toBeFocused();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);
});
