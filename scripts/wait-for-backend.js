/**
 * Wait for backend to be ready before running tests
 * Cross-platform Node.js script (works on Windows, Linux, Mac)
 */
const http = require('http');

const BACKEND_URL = process.env.CDS_BACKEND_URL || 'http://localhost:8080';
const MAX_ATTEMPTS = parseInt(process.env.CDS_MAX_ATTEMPTS || '30', 10);
const RETRY_DELAY = parseInt(process.env.CDS_RETRY_DELAY || '2000', 10);

async function checkBackend() {
  return new Promise((resolve, reject) => {
    const url = new URL(BACKEND_URL + '/health_check');
    
    const req = http.get(url.toString(), { timeout: 5000 }, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend() {
  console.log('⏳ Waiting for backend to be ready...');
  console.log(`   URL: ${BACKEND_URL}/health_check`);
  
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isReady = await checkBackend();
    
    if (isReady) {
      console.log('✅ Backend is ready!');
      process.exit(0);
    }
    
    console.log(`Attempt ${attempt}/${MAX_ATTEMPTS} - Backend not ready yet, waiting ${RETRY_DELAY}ms...`);
    
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  console.error('❌ Backend failed to start within timeout');
  process.exit(1);
}

waitForBackend();
