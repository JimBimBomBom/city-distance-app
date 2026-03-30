import { defineConfig, devices } from '@playwright/test';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CI?: string;
      /** Override the proxy server base URL if port 3000 is occupied locally. */
      TEST_BASE_URL?: string;
      /** HTTP Basic username passed to test-server.js for HTML substitution. */
      CDS_AUTH_USERNAME?: string;
      /** HTTP Basic password passed to test-server.js for HTML substitution. */
      CDS_AUTH_PASSWORD?: string;
      /** URL of the real CDS backend — test-server.js proxies API calls here. */
      CDS_API_BASE?: string;
    }
  }
}

/**
 * The URL the proxy test-server listens on.
 * Set TEST_BASE_URL to override if port 3000 is occupied on your machine.
 */
const BASE_URL = (process.env.TEST_BASE_URL ?? 'http://localhost:3000').trim();

/** Port extracted from BASE_URL for the webServer command. */
const proxyPort = (() => {
  try { return new URL(BASE_URL).port || '3000'; }
  catch { return '3000'; }
})();

export default defineConfig({
  testDir: './tests',

  /* Fail the build on CI if test.only is accidentally left in source */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker on CI to avoid Docker resource contention */
  workers: process.env.CI ? 1 : undefined,

  /* Run tests in files in parallel */
  fullyParallel: true,

  reporter: [['html'], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  /**
   * Proxy web server — Playwright starts this before running any tests.
   *
   * test-server.js does the following synchronously at startup (before
   * the HTTP server begins listening):
   *   1. Reads website/index.html
   *   2. Substitutes __API_BASE__ → BASE_URL, __AUTH_USERNAME/PASSWORD__
   *   3. Writes website/.test/index.html
   *   4. Starts the HTTP server on proxyPort
   *
   * It then serves that HTML for all non-API routes and proxies
   * /suggestions, /languages, /distance, /health_check to CDS_API_BASE.
   *
   * Doing the substitution inside the server startup (not in globalSetup)
   * is essential: Playwright starts webServer BEFORE globalSetup, so any
   * file-writing that needs to happen before the server serves requests
   * must live in the server process itself.
   *
   * Same-origin proxying means no CORS in any environment.
   *
   * reuseExistingServer: true — if BASE_URL is already responding (developer
   * pre-started the proxy manually) Playwright reuses it.  In CI the port is
   * free so Playwright starts the proxy fresh.
   *
   * All env vars (TEST_BASE_URL, CDS_API_BASE, CDS_AUTH_USERNAME/PASSWORD)
   * are inherited by the child process from the Playwright process environment.
   */
  webServer: {
    command: `node scripts/test-server.js ${proxyPort}`,
    url: BASE_URL,
    // Never reuse an existing server — always start our proxy fresh.
    // If port 3000 is occupied locally by something else, override with:
    //   TEST_BASE_URL=http://localhost:3001 npx playwright test
    reuseExistingServer: false,
    timeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
