/**
 * Playwright global setup — runs once after webServer starts, before tests.
 *
 * HTML substitution (__API_BASE__, __AUTH_USERNAME__, __AUTH_PASSWORD__) is
 * performed by scripts/test-server.js at startup, before the server begins
 * listening.  This is necessary because Playwright starts webServer before
 * running globalSetup, so globalSetup cannot be relied upon to write the
 * file that the server needs to serve.
 *
 * This file is kept as the globalSetup entry point so the config reference
 * remains valid.  Any test-wide setup that doesn't involve the HTML file
 * can be added here.
 */
export default async function globalSetup() {
  // HTML substitution is handled by scripts/test-server.js at server startup.
  // Nothing to do here.
}
