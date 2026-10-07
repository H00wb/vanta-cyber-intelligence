import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, retries: 0, timeout: 30_000,
  outputDir: ".test-results/browser",
  reporter: [["list"], ["json", { outputFile: process.env.TEST_REPORT_FILE ?? "evidence/browser-results.json" }]],
  use: { baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173", browserName: "chromium", headless: true, screenshot: "only-on-failure", trace: "retain-on-failure" },
});