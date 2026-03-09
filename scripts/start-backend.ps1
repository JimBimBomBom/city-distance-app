# PowerShell script to start CDS backend for testing
$ErrorActionPreference = "Stop"

Write-Host "🐳 Starting CDS backend for testing..." -ForegroundColor Cyan

# Start the backend
docker-compose -f docker-compose.test.yml up -d

# Wait for backend to be healthy
Write-Host "⏳ Waiting for backend to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health_check" -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Write-Host "✅ Backend is ready!" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        $attempt++
        Write-Host "Attempt $attempt/$maxAttempts - Backend not ready yet, waiting..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "❌ Backend failed to start within timeout" -ForegroundColor Red
    docker-compose -f docker-compose.test.yml logs
    docker-compose -f docker-compose.test.yml down
    exit 1
}