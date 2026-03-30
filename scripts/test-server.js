/**
 * test-server.js
 *
 * Lightweight dev/test server that:
 *   1. Serves website/.test/index.html (the placeholder-substituted copy) for all non-API routes
 *   2. Proxies /suggestions, /languages, /distance, /health_check → CDS backend
 *
 * This eliminates CORS issues when running Playwright tests locally because
 * both the HTML page and the API calls share the same origin (localhost:3000).
 *
 * Usage:
 *   node scripts/test-server.js [port] [backendUrl]
 *
 * Defaults:
 *   port       = 3000
 *   backendUrl = http://localhost:8080
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT        = parseInt(process.env.TEST_PORT       || process.argv[2] || '3000', 10);
const BACKEND_URL = process.env.CDS_API_BASE              || process.argv[3] || 'http://localhost:8080';

const HTML_PATH   = path.resolve(__dirname, '..', 'website', '.test', 'index.html');

// API paths to proxy to the backend
const PROXY_PREFIXES = ['/suggestions', '/languages', '/distance', '/health_check'];

function proxyRequest(req, res, targetBase) {
  const parsed   = url.parse(targetBase);
  const isHttps  = parsed.protocol === 'https:';
  const lib      = isHttps ? https : http;
  const options  = {
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

  // Proxy API paths to backend
  if (PROXY_PREFIXES.some((p) => reqPath.startsWith(p))) {
    console.log('[test-server] PROXY', req.method, req.url, '->', BACKEND_URL);
    proxyRequest(req, res, BACKEND_URL);
    return;
  }

  // Serve index.html for all other requests (SPA fallback)
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
  console.log('[test-server] Proxying API calls to', BACKEND_URL);
  console.log('[test-server] Serving HTML from', HTML_PATH);
});
