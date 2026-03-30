import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright global setup — runs once before all tests.
 *
 * Reads website/index.html (which contains __API_BASE__, __AUTH_USERNAME__,
 * __AUTH_PASSWORD__ placeholders), substitutes them with the values from
 * environment variables (falling back to local test defaults), and writes
 * the result to website/.test-index.html so the web server serves real URLs.
 *
 * In CI the GitHub Actions workflow already substitutes the real index.html
 * via sed before this runs, so the placeholders will already be gone and this
 * is a no-op substitution on an already-substituted file.
 */
export default async function globalSetup() {
  const isCI = !!process.env.CI;

  // In CI the backend is accessed directly (same network, no CORS).
  // Locally the proxy server is the only safe way to avoid CORS — so we
  // point __API_BASE__ at the proxy's own origin.  The proxy forwards API
  // paths (/suggestions, /languages, /distance, /health_check) to the real
  // backend, while the page itself is served from the same origin.
  const localProxyPort = 3001;
  const apiBase = process.env.CDS_API_BASE
    ?? (isCI ? 'http://localhost:8080' : `http://localhost:${localProxyPort}`);
  const authUsername = process.env.CDS_AUTH_USERNAME ?? 'admin';
  const authPassword = process.env.CDS_AUTH_PASSWORD ?? 'password';

  const srcPath  = path.resolve(__dirname, '..', 'website', 'index.html');
  const testDir  = path.resolve(__dirname, '..', 'website', '.test');
  const destPath = path.join(testDir, 'index.html');

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  let html = fs.readFileSync(srcPath, 'utf8');
  html = html.split('__API_BASE__').join(apiBase);
  html = html.split('__AUTH_USERNAME__').join(authUsername);
  html = html.split('__AUTH_PASSWORD__').join(authPassword);

  fs.writeFileSync(destPath, html, 'utf8');
  console.log(`[global-setup] Wrote substituted HTML → website/.test/index.html`);
  console.log(`[global-setup]   API_BASE=${apiBase}  USERNAME=${authUsername}`);
}
