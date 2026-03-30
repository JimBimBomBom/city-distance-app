import { defineConfig, devices } from '@playwright/test';
import path from 'path';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CDS_BACKEND_URL?: string;
      CDS_API_BASE?: string;
      CDS_AUTH_USERNAME?: string;
      CDS_AUTH_PASSWORD?: string;
      CI?: string;
    }
  }
}

/**
 * Playwright configuration for E2E testing of the CDS website.
 *
 * globalSetup writes website/.test/index.html with placeholders substituted.
 * The webServer then serves that directory on port 3000.
 *
 * In CI, the GitHub Actions workflow substitutes the real website/index.html
 * via sed before running Playwright, so globalSetup becomes a no-op there
 * (it re-substitutes already-real values).  The CI workflow's "Start web
 * server" step also pre-starts a server, so reuseExistingServer keeps it.
 *
 * Locally: run `npm run backend:start` first, then `npm run test:e2e`.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  /* Global setup: writes website/.test/index.html with substituted values */
  globalSetup: path.resolve(__dirname, 'tests/global-setup.ts'),

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if test.only is accidentally left in source */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker on CI to avoid resource contention */
  workers: process.env.CI ? 1 : undefined,

  /* Reporters */
  reporter: [['html'], ['list']],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.CI ? 'http://localhost:3000' : 'http://localhost:3001',

    /* Collect trace on first retry */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on first retry */
    video: 'on-first-retry',
  },

  /*
   * Web server — starts our proxy server that:
   *   • Serves website/.test/index.html (placeholder-substituted copy)
   *   • Proxies /suggestions, /languages, /distance, /health_check → backend
   *
   * Same-origin proxying eliminates CORS issues in local test runs.
   * reuseExistingServer: true so CI's pre-started server is reused.
   */
  webServer: {
    command: process.env.CI
      ? 'node scripts/test-server.js 3000'
      : 'node scripts/test-server.js 3001',
    url: process.env.CI ? 'http://localhost:3000' : 'http://localhost:3001',
    // In CI the workflow pre-starts the server; reuse it.
    // Locally always start fresh so stale servers don't mask the proxy.
    reuseExistingServer: !!process.env.CI,
    timeout: 30000,
  },

  /* Browser projects */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
  ],
});
