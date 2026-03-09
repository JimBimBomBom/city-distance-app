#!/usr/bin/env bash
set -e

echo "🐳 Starting CDS backend for testing..."

# Start the backend
docker-compose -f docker-compose.test.yml up -d

# Wait for backend to be healthy
echo "⏳ Waiting for backend to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -s http://localhost:8080/health_check > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    exit 0
  fi
  
  attempt=$((attempt + 1))
  echo "Attempt $attempt/$max_attempts - Backend not ready yet, waiting..."
  sleep 2
done

echo "❌ Backend failed to start within timeout"
docker-compose -f docker-compose.test.yml logs
docker-compose -f docker-compose.test.yml down
exit 1