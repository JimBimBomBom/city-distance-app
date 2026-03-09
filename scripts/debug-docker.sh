#!/bin/bash
# Debug script for Docker Compose testing

set -e

echo "🔍 Docker Compose Debug Script"
echo "================================"
echo ""

# Check prerequisites
echo "✅ Checking prerequisites..."
echo "Docker version:"
docker --version

echo ""
echo "Docker Compose version:"
docker compose version

echo ""
echo "Available memory:"
if command -v free &> /dev/null; then
    free -h
else
    echo "(free command not available on Windows, check Docker Desktop settings)"
fi

echo ""
echo "Checking ports..."
if command -v netstat &> /dev/null; then
    echo "Port 9200 (Elasticsearch):"
    netstat -ano | grep :9200 || echo "  Available"
    echo "Port 3306 (MySQL):"
    netstat -ano | grep :3306 || echo "  Available"
    echo "Port 8080 (Backend):"
    netstat -ano | grep :8080 || echo "  Available"
else
    echo "(netstat not available, skipping port check)"
fi

echo ""
echo "🧹 Cleaning up any existing containers..."
docker compose -f docker-compose.test.yml down --remove-orphans 2>/dev/null || true

echo ""
echo "🐳 Starting Elasticsearch only (for debugging)..."
docker compose -f docker-compose.test.yml up -d elasticsearch

echo ""
echo "⏳ Waiting for Elasticsearch to start..."
sleep 10

echo ""
echo "📊 Container status:"
docker compose -f docker-compose.test.yml ps elasticsearch

echo ""
echo "📜 Recent Elasticsearch logs:"
docker compose -f docker-compose.test.yml logs --tail=50 elasticsearch

echo ""
echo "🧪 Testing Elasticsearch endpoint..."
if curl -s http://localhost:9200 > /dev/null 2>&1; then
    echo "✅ Elasticsearch is responding!"
    curl -s http://localhost:9200 | head -20
else
    echo "❌ Elasticsearch is not responding"
    echo "Checking if container is running..."
    docker compose -f docker-compose.test.yml ps
    echo ""
    echo "Full logs:"
    docker compose -f docker-compose.test.yml logs elasticsearch
fi

echo ""
echo "🧹 Cleaning up..."
docker compose -f docker-compose.test.yml down

echo ""
echo "✅ Debug complete!"
