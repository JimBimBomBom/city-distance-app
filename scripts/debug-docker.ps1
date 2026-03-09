# Debug script for Docker Compose testing (Windows PowerShell)

Write-Host "🔍 Docker Compose Debug Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "✅ Checking prerequisites..." -ForegroundColor Green
Write-Host "Docker version:"
docker --version

Write-Host ""
Write-Host "Docker Compose version:"
docker compose version

Write-Host ""
Write-Host "Checking ports..."
$port9200 = netstat -ano | Select-String ":9200"
$port3306 = netstat -ano | Select-String ":3306"
$port8080 = netstat -ano | Select-String ":8080"

if ($port9200) { Write-Host "⚠️  Port 9200 is in use:" -ForegroundColor Yellow; $port9200 | Select-Object -First 3 }
else { Write-Host "  ✅ Port 9200 available" }

if ($port3306) { Write-Host "⚠️  Port 3306 is in use:" -ForegroundColor Yellow; $port3306 | Select-Object -First 3 }
else { Write-Host "  ✅ Port 3306 available" }

if ($port8080) { Write-Host "⚠️  Port 8080 is in use:" -ForegroundColor Yellow; $port8080 | Select-Object -First 3 }
else { Write-Host "  ✅ Port 8080 available" }

Write-Host ""
Write-Host "🧹 Cleaning up any existing containers..." -ForegroundColor Green
docker compose -f docker-compose.test.yml down --remove-orphans 2>$null

Write-Host ""
Write-Host "🐳 Starting Elasticsearch only (for debugging)..." -ForegroundColor Green
docker compose -f docker-compose.test.yml up -d elasticsearch

Write-Host ""
Write-Host "⏳ Waiting for Elasticsearch to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "📊 Container status:" -ForegroundColor Green
docker compose -f docker-compose.test.yml ps elasticsearch

Write-Host ""
Write-Host "📜 Recent Elasticsearch logs:" -ForegroundColor Green
docker compose -f docker-compose.test.yml logs --tail=50 elasticsearch

Write-Host ""
Write-Host "🧪 Testing Elasticsearch endpoint..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9200" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Elasticsearch is responding!" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
    }
} catch {
    Write-Host "❌ Elasticsearch is not responding" -ForegroundColor Red
    Write-Host "Checking if container is running..." -ForegroundColor Yellow
    docker compose -f docker-compose.test.yml ps
    Write-Host ""
    Write-Host "Full logs:" -ForegroundColor Yellow
    docker compose -f docker-compose.test.yml logs elasticsearch
}

Write-Host ""
Write-Host "🧹 Cleaning up..." -ForegroundColor Green
docker compose -f docker-compose.test.yml down

Write-Host ""
Write-Host "✅ Debug complete!" -ForegroundColor Green
