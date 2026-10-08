import { appendFileSync, mkdirSync } from "node:fs";
export function recordFixture(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return;
  mkdirSync(".test-results", { recursive: true });
  appendFileSync(".test-results/created-fixtures.jsonl", JSON.stringify({ id, source: "automated-fictional-test" }) + "\n");
}