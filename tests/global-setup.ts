import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright global setup — runs once before all tests.
 *
 * Reads website/index.html (which contains __API_BASE__, __AUTH_USERNAME__,
 * __AUTH_PASSWORD__ placeholders) and writes website/.test/index.html with
 * those placeholders replaced by real values.
 *
 * API_BASE is ALWAYS set to the proxy server's own origin (TEST_BASE_URL),
 * never directly to the backend.  This means the browser page and its API
 * calls share the same origin, eliminating CORS in every environment —
 * local, CI, or otherwise.
 *
 * The proxy server (scripts/test-server.js) then forwards the API calls to
 * the real backend using the CDS_API_BASE env var it receives at startup.
 *
 * Environment variables (all optional — sensible defaults used if absent):
 *   TEST_BASE_URL      URL the proxy server is listening on  (default: http://localhost:3000)
 *   CDS_AUTH_USERNAME  HTTP Basic username                   (default: admin)
 *   CDS_AUTH_PASSWORD  HTTP Basic password                   (default: password)
 */
export default async function globalSetup() {
  // The proxy URL is the same value as baseURL in playwright.config.ts.
  // Override with TEST_BASE_URL if the default port is occupied locally.
  const proxyUrl    = process.env.TEST_BASE_URL      ?? 'http://localhost:3000';
  const authUsername = process.env.CDS_AUTH_USERNAME ?? 'admin';
  const authPassword = process.env.CDS_AUTH_PASSWORD ?? 'password';

  const srcPath  = path.resolve(__dirname, '..', 'website', 'index.html');
  const testDir  = path.resolve(__dirname, '..', 'website', '.test');
  const destPath = path.join(testDir, 'index.html');

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  let html = fs.readFileSync(srcPath, 'utf8');
  html = html.split('__API_BASE__').join(proxyUrl);
  html = html.split('__AUTH_USERNAME__').join(authUsername);
  html = html.split('__AUTH_PASSWORD__').join(authPassword);

  fs.writeFileSync(destPath, html, 'utf8');
  console.log(`[global-setup] Wrote substituted HTML → website/.test/index.html`);
  console.log(`[global-setup]   API_BASE=${proxyUrl}  USERNAME=${authUsername}`);
}
