import { defineConfig, devices } from '@playwright/test';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CI?: string;
      /** Override the server base URL if port 3000 is occupied locally. */
      TEST_BASE_URL?: string;
      /** HTTP Basic username injected into the test HTML (default: admin). */
      CDS_AUTH_USERNAME?: string;
      /** HTTP Basic password injected into the test HTML (default: password). */
      CDS_AUTH_PASSWORD?: string;
    }
  }
}

/**
 * The URL the test server listens on.
 * Set TEST_BASE_URL to override if port 3000 is occupied on your machine.
 */
const BASE_URL = (process.env.TEST_BASE_URL ?? 'http://localhost:3000').trim();

/** Port extracted from BASE_URL for the webServer command. */
const serverPort = (() => {
  try { return new URL(BASE_URL).port || '3000'; }
  catch { return '3000'; }
})();

export default defineConfig({
  testDir: './tests',

  /* Fail the build on CI if test.only is accidentally left in source */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker on CI */
  workers: process.env.CI ? 1 : undefined,

  fullyParallel: true,

  reporter: [['html'], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  /**
   * Static test server — substitutes __API_BASE__ / credentials into
   * website/index.html and serves the result.  API calls (/languages,
   * /suggestions, /distance) are intercepted by Playwright's page.route()
   * mocks in each test; no real backend is required.
   *
   * reuseExistingServer: false — always start fresh so the substituted HTML
   * reflects the current TEST_BASE_URL.  If port 3000 is occupied locally:
   *   TEST_BASE_URL=http://localhost:3001 npx playwright test
   */
  webServer: {
    command: `node scripts/test-server.js ${serverPort}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60000,
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
