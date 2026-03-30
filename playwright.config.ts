import { defineConfig, devices } from '@playwright/test';
import path from 'path';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CI?: string;
      /** Override the proxy server port if 3000 is occupied locally. */
      TEST_BASE_URL?: string;
      /** HTTP Basic username for the CDS backend (default: admin). */
      CDS_AUTH_USERNAME?: string;
      /** HTTP Basic password for the CDS backend (default: password). */
      CDS_AUTH_PASSWORD?: string;
      /** URL of the real CDS backend, used by the proxy server (default: http://localhost:8080). */
      CDS_API_BASE?: string;
    }
  }
}

/**
 * The URL the proxy test-server listens on.
 * Override with TEST_BASE_URL if port 3000 is occupied on your machine.
 */
const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

/**
 * Port extracted from BASE_URL so the webServer command uses the same port.
 */
const proxyPort = (() => {
  try { return new URL(BASE_URL).port || '3000'; }
  catch { return '3000'; }
})();

export default defineConfig({
  testDir: './tests',

  /**
   * Global setup writes website/.test/index.html with __API_BASE__ replaced
   * by BASE_URL so the browser calls the proxy (same origin → no CORS).
   */
  globalSetup: path.resolve(__dirname, 'tests/global-setup.ts'),

  /* Fail the build on CI if test.only is accidentally left in source */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker on CI to avoid Docker resource contention */
  workers: process.env.CI ? 1 : undefined,

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Reporters */
  reporter: [['html'], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  /**
   * Proxy web server:
   *   • Serves website/.test/index.html (globalSetup writes this)
   *   • Proxies /suggestions /languages /distance /health_check → real backend
   *
   * reuseExistingServer: true  — if something is already listening on the
   * port (e.g. the CI workflow pre-starts the server), reuse it instead of
   * trying to start a second one.  On a fresh machine Playwright starts it.
   *
   * The proxy reads CDS_API_BASE to know where the real backend is.
   * Pass TEST_BASE_URL to override the port if 3000 is occupied locally.
   */
  webServer: {
    command: `node scripts/test-server.js ${proxyPort}`,
    url: BASE_URL,
    reuseExistingServer: true,
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
