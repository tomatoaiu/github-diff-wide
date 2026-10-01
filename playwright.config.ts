import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: { viewport: { width: 1280, height: 900 } },
})
