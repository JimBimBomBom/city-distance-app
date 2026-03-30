/**
 * test-server.js
 *
 * Lightweight proxy server for Playwright E2E tests that:
 *
 *   1. Substitutes __API_BASE__, __AUTH_USERNAME__, __AUTH_PASSWORD__
 *      placeholders in website/index.html and writes the result to
 *      website/.test/index.html BEFORE the server starts listening.
 *      This must happen here (not in Playwright globalSetup) because
 *      Playwright starts webServer before running globalSetup.
 *
 *   2. Serves website/.test/index.html for all non-API routes.
 *
 *   3. Proxies /suggestions, /languages, /distance, /health_check
 *      to the real CDS backend (CDS_API_BASE).
 *
 * Same-origin proxying means the browser page and its API calls share
 * the same origin → no CORS issues in any environment.
 *
 * Environment variables (all optional):
 *   TEST_BASE_URL      Full URL this server listens on  (default: http://localhost:3000)
 *                      Port is extracted from this value.
 *   CDS_API_BASE       URL of the real CDS backend      (default: http://localhost:8080)
 *   CDS_AUTH_USERNAME  HTTP Basic username injected into HTML (default: admin)
 *   CDS_AUTH_PASSWORD  HTTP Basic password injected into HTML (default: password)
 *
 * CLI arguments (override env vars):
 *   node scripts/test-server.js [port] [backendUrl]
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ── Configuration ────────────────────────────────────────────────────────────

const BASE_URL    = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const PORT        = parseInt(process.argv[2] || ((() => { try { return new URL(BASE_URL).port || '3000'; } catch { return '3000'; } })()), 10);
const BACKEND_URL = process.argv[3] || process.env.CDS_API_BASE || 'http://localhost:8080';
const USERNAME    = process.env.CDS_AUTH_USERNAME ?? 'admin';
const PASSWORD    = process.env.CDS_AUTH_PASSWORD ?? 'password';

const SRC_HTML  = path.resolve(__dirname, '..', 'website', 'index.html');
const TEST_DIR  = path.resolve(__dirname, '..', 'website', '.test');
const HTML_PATH = path.join(TEST_DIR, 'index.html');

// ── Step 1: Write substituted HTML synchronously before listening ─────────────

if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

let html = fs.readFileSync(SRC_HTML, 'utf8');
html = html.split('__API_BASE__').join(BASE_URL);
html = html.split('__AUTH_USERNAME__').join(USERNAME);
html = html.split('__AUTH_PASSWORD__').join(PASSWORD);
fs.writeFileSync(HTML_PATH, html, 'utf8');

console.log('[test-server] Substituted HTML → website/.test/index.html');
console.log('[test-server]   API_BASE=' + BASE_URL + '  USERNAME=' + USERNAME);
console.log('[test-server] Proxying API calls to', BACKEND_URL);

// ── API paths to proxy ────────────────────────────────────────────────────────

const PROXY_PREFIXES = ['/suggestions', '/languages', '/distance', '/health_check'];

// ── Step 2: Start the server ──────────────────────────────────────────────────

function proxyRequest(req, res, targetBase) {
  const parsed  = url.parse(targetBase);
  const isHttps = parsed.protocol === 'https:';
  const lib     = isHttps ? https : http;
  const options = {
    hostname: parsed.hostname,
    port:     parsed.port || (isHttps ? 443 : 80),
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: parsed.hostname + (parsed.port ? ':' + parsed.port : '') },
  };

  const proxy = lib.request(options, (backRes) => {
    res.writeHead(backRes.statusCode, backRes.headers);
    backRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('[test-server] Proxy error:', err.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'Backend unavailable', detail: err.message }));
  });

  req.pipe(proxy, { end: true });
}

const server = http.createServer((req, res) => {
  const reqPath = url.parse(req.url).pathname;

  if (PROXY_PREFIXES.some((p) => reqPath.startsWith(p))) {
    proxyRequest(req, res, BACKEND_URL);
    return;
  }

  // SPA fallback — serve the substituted index.html for every non-API route
  fs.readFile(HTML_PATH, (err, data) => {
    if (err) {
      console.error('[test-server] Could not read', HTML_PATH, err.message);
      res.writeHead(500);
      res.end('Internal Server Error: ' + err.message);
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': data.length,
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('[test-server] Listening on http://localhost:' + PORT);
});
