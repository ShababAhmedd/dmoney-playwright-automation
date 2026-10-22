import { defineConfig, devices } from "@playwright/test";
import "./utils/env";

function journey(name: string, file: string, dependsOn?: string) {
  return {
    name,
    testMatch: `${file}.spec.ts`,
    dependencies: dependsOn ? [dependsOn] : [],
    use: { ...devices["Desktop Chrome"] },
  };
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  // the journey waits ~20s for each OTP / reset email
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // tests create real accounts and consume OTP emails, so never retry blindly
  retries: 0,
  workers: 1,
  // filter by tag here rather than with --grep, which doesn't apply to dependency projects
  grep: process.env.TAG ? new RegExp(process.env.TAG) : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "https://dmoneyportal.roadtocareer.net",
    headless: !!process.env.CI || process.env.HEADLESS === "true",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // VIDEO=true records every journey (used for the README recording); the journeys
    // open their own page in beforeAll, which the plain `video` option doesn't cover
    contextOptions: process.env.VIDEO === "true" ? { recordVideo: { dir: "videos/", size: { width: 1280, height: 720 } } } : {},
  },
  // each journey is its own project; dependencies run them in order and pass data
  // forward through .state/ (see utils/journeyState.ts)
  projects: [
    journey("registration", "01-registration"),
    journey("admin", "02-admin", "registration"),
    journey("system", "03-system", "admin"),
    journey("agent", "04-agent", "system"),
    journey("password-reset", "05-password-reset", "agent"),
    journey("self-statement", "06-self-statement", "password-reset"),
  ],
});
