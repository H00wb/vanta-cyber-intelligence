import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
const production = process.env.TEST_BASE_URL?.startsWith("https://") ?? false;
const environment = production ? "Vercel production / real Supabase Postgres" : "Next.js local / real Supabase Postgres";
const description = "Kurgusal test kurumunun internete açık dijital varlıklarını değerlendirmek istiyoruz.";
async function open(page: Page) { await page.goto("/"); await page.waitForLoadState("networkidle"); }
async function fill(page: Page) {
  await page.getByLabel(/Ad soyad/).fill("Deniz Örnek");
  await page.getByLabel(/E-posta/).fill("deniz@example.com");
  await page.getByLabel(/İlgilendiğiniz hizmet/).selectOption("attack-surface");
  await page.getByLabel(/İhtiyacınızdan bahsedin/).fill(description);
}
for (const width of [320, 390, 768, 1440]) test(`responsive layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await open(page);
  await expect(page).toHaveTitle("VANTA — Cyber Intelligence Platform");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tehdidi, sizi");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "İletişime geç" }).click();
  await expect(page.getByRole("button", { name: "Talep gönder" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (width === 390 || width === 1440) await page.screenshot({ path: `evidence/${production ? "vercel-" : ""}${width === 390 ? "mobile" : "desktop"}.png`, fullPage: true });
});
test("client validation blocks network request and focuses first invalid field", async ({ page }) => {
  await open(page); let posts = 0; page.on("request", req => { if (req.url().includes("/api/requests")) posts++; });
  await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.getByLabel(/Ad soyad/)).toBeFocused();
  await expect(page.locator("#name-error")).toContainText("2–100");
  await expect(page.locator("#email-error")).toBeVisible();
  expect(posts).toBe(0); await expect(page.getByText("Talebiniz kaydedildi.")).toHaveCount(0);
});
test("loading state locks resubmission and success follows real API response", async ({ page }) => {
  await open(page); await fill(page); let posts = 0;
  page.on("request", req => { if (req.url().endsWith("/api/requests")) posts++; });
  await page.route("**/api/requests", async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
  const saved = page.waitForResponse(response => response.url().endsWith("/api/requests") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.getByRole("button", { name: "Gönderiliyor…" })).toBeDisabled();
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
  await page.locator("form").evaluate(form => (form as HTMLFormElement).requestSubmit());
  const response = await saved; expect(response.status()).toBe(201); const body = await response.json();
  const payload = response.request().postDataJSON(); expect(body.id).toBe(payload.requestId);
  await expect(page.getByText("Talebiniz kaydedildi.", { exact: true })).toBeVisible(); expect(posts).toBe(1);
  await expect(page.getByLabel(/Ad soyad/)).toHaveValue("");
  writeFileSync(production ? "evidence/vercel-submit.json" : "evidence/local-submit.json", JSON.stringify({ environment, id: body.id, status: response.status(), payload }, null, 2));
  await page.screenshot({ path: "evidence/form-success.png", fullPage: false });
});
test("503 response preserves input and cannot display success", async ({ page }) => {
  await open(page); await fill(page);
  await page.route("**/api/requests", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Kaydın tamamlandığı doğrulanamadı. Aynı bilgilerle tekrar deneyin." }) }));
  await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("doğrulanamadı");
  await expect(page.getByLabel(/Ad soyad/)).toHaveValue("Deniz Örnek");
  await expect(page.getByLabel(/İhtiyacınızdan bahsedin/)).toHaveValue(description);
  await expect(page.getByText("Talebiniz kaydedildi.")).toHaveCount(0);
});
test("offline failure preserves form; same unchanged request reuses id", async ({ page }) => {
  await open(page); await fill(page); const ids: string[] = [];
  page.on("request", req => { if (req.url().endsWith("/api/requests")) ids.push(req.postDataJSON().requestId); });
  await page.context().setOffline(true); await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Gönderim doğrulanamadı");
  await expect(page.getByLabel(/E-posta/)).toHaveValue("deniz@example.com");
  await page.context().setOffline(false); await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.getByText("Talebiniz kaydedildi.", { exact: true })).toBeVisible();
  expect(ids.length).toBe(2); expect(ids[0]).toBe(ids[1]);
});
test("HTML response is a readable error without technical parser details", async ({ page }) => {
  await open(page); await fill(page);
  await page.route("**/api/requests", route => route.fulfill({ status: 502, contentType: "text/html", body: "<html>upstream test error</html>" }));
  await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Gönderim doğrulanamadı");
  await expect(page.locator("form").getByRole("alert")).not.toContainText("Unexpected");
  await expect(page.getByText("Talebiniz kaydedildi.")).toHaveCount(0);
});
test("an HTTP 200 with the wrong id cannot trigger success", async ({ page }) => {
  await open(page); await fill(page);
  await page.route("**/api/requests", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "wrong-id", replayed: false }) }));
  await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Gönderim doğrulanamadı");
  await expect(page.getByText("Talebiniz kaydedildi.")).toHaveCount(0);
});
test("server rejects invalid input independently of browser validation", async ({ request }) => {
  const response = await request.post("/api/requests", { data: { name: "Deniz Örnek", email: "invalid", service: "unknown", description: "kısa", requestId: "invalid" } });
  expect(response.status()).toBe(422); const body = await response.json(); expect(body.errors.email).toBeTruthy(); expect(body.errors.service).toBeTruthy();
  const get = await request.get("/api/requests"); expect(get.status()).toBe(405);
});
test("keyboard skip link and form labels; WCAG A/AA automated scan", async ({ page }) => {
  await open(page); await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "İçeriğe geç" })).toBeFocused();
  await expect(page.getByLabel(/Ad soyad/)).toHaveAttribute("id", "name");
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);
});
test("200 percent text enlargement keeps desktop content within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Talep gönder" })).toBeVisible();
});
test("lost response after real commit retries as one persisted request", async ({ page }) => {
  await open(page); await fill(page); let first = true; let savedId = "";
  await page.route("**/api/requests", async route => {
    if (first) { first = false; const response = await route.fetch(); expect(response.status()).toBe(201); savedId = (await response.json()).id; await route.abort("failed"); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Gönderim doğrulanamadı");
  await expect(page.getByText("Talebiniz kaydedildi.")).toHaveCount(0);
  const retried = page.waitForResponse(response => response.url().endsWith("/api/requests"));
  await page.getByRole("button", { name: "Talep gönder" }).click();
  const response = await retried; expect(response.status()).toBe(200);
  const body = await response.json(); expect(body).toEqual({ id: savedId, replayed: true });
  await expect(page.getByText("Talebiniz kaydedildi.", { exact: true })).toBeVisible();
  writeFileSync(production ? "evidence/vercel-lost-response.json" : "evidence/lost-response.json", JSON.stringify({ environment, id: savedId, retryStatus: response.status(), replayed: body.replayed }, null, 2));
});
test("15 second timeout reports uncertainty and preserves user input", async ({ page }) => {
  await open(page); await fill(page);
  await page.route("**/api/requests", async route => { await new Promise(resolve => setTimeout(resolve, 17_000)); await route.abort().catch(() => {}); });
  await page.getByRole("button", { name: "Talep gönder" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Gönderim doğrulanamadı", { timeout: 20_000 });
  await expect(page.getByLabel(/Ad soyad/)).toHaveValue("Deniz Örnek");
  await expect(page.getByRole("button", { name: "Talep gönder" })).toBeEnabled();
  await expect(page.getByText("Talebiniz kaydedildi.")).toHaveCount(0);
});
