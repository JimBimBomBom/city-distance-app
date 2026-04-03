/**
 * test-server.js
 *
 * Lightweight static server for Playwright E2E tests.
 *
 * Reads website/index.html, substitutes __API_BASE__, __AUTH_USERNAME__,
 * __AUTH_PASSWORD__ placeholders, writes website/.test/index.html, then
 * serves that file for every request (SPA fallback).
 *
 * API calls (/languages, /suggestions, /distance) are intercepted by
 * Playwright's page.route() mocks — this server never needs to proxy them.
 *
 * Environment variables (all optional):
 *   TEST_BASE_URL      Full URL this server listens on  (default: http://localhost:3000)
 *   CDS_AUTH_USERNAME  Injected into HTML               (default: admin)
 *   CDS_AUTH_PASSWORD  Injected into HTML               (default: password)
 *
 * CLI:
 *   node scripts/test-server.js [port]
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const BASE_URL  = (process.env.TEST_BASE_URL ?? 'http://localhost:3000').trim();
const PORT      = parseInt(process.argv[2] || ((() => { try { return new URL(BASE_URL).port || '3000'; } catch { return '3000'; } })()), 10);
const USERNAME  = (process.env.CDS_AUTH_USERNAME ?? 'admin').trim();
const PASSWORD  = (process.env.CDS_AUTH_PASSWORD ?? 'password').trim();

const SRC_HTML  = path.resolve(__dirname, '..', 'website', 'index.html');
const TEST_DIR  = path.resolve(__dirname, '..', 'website', '.test');
const HTML_PATH = path.join(TEST_DIR, 'index.html');

// ── Substitute placeholders and write .test/index.html ────────────────────────

if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });

let html = fs.readFileSync(SRC_HTML, 'utf8');
html = html.split('__API_BASE__').join(BASE_URL);
html = html.split('__AUTH_USERNAME__').join(USERNAME);
html = html.split('__AUTH_PASSWORD__').join(PASSWORD);
fs.writeFileSync(HTML_PATH, html, 'utf8');

console.log('[test-server] Wrote website/.test/index.html');
console.log('[test-server]   API_BASE=' + BASE_URL);

// ── Serve HTML for every request ──────────────────────────────────────────────

http.createServer((req, res) => {
  fs.readFile(HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Internal Server Error: ' + err.message);
      return;
    }
    res.writeHead(200, {
      'Content-Type':   'text/html; charset=utf-8',
      'Content-Length': data.length,
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('[test-server] Listening on http://localhost:' + PORT);
});
