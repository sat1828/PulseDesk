Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         PulseDesk - Startup Script          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Docker
try {
    docker ps > $null 2>&1
} catch {
    Write-Host "✖ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host "✔ Docker is running" -ForegroundColor Green

# Start services
Write-Host "`nStarting PulseDesk services..." -ForegroundColor Yellow
Write-Host "  • PostgreSQL (port 5432)"
Write-Host "  • Redis (port 6379)"
Write-Host "  • NLP Service (port 5001)"
Write-Host "  • Backend API (port 3001)"
Write-Host "  • Frontend (port 5173)"
Write-Host ""

docker compose up -d

if ($?) {
    Write-Host "`n✔ All services started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  API:       http://localhost:3001/api/health" -ForegroundColor Cyan
    Write-Host "  NLP:       http://localhost:5001/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Demo Login:" -ForegroundColor Yellow
    Write-Host "  Email:    admin@acme.com" -ForegroundColor White
    Write-Host "  Password: password123" -ForegroundColor White
    Write-Host ""
    Write-Host "  Run seed data:" -ForegroundColor Yellow
    Write-Host "  docker compose --profile seed run --rm seed" -ForegroundColor White
    Write-Host ""
    Write-Host "  View logs:" -ForegroundColor Yellow
    Write-Host "  docker compose logs -f backend" -ForegroundColor White
} else {
    Write-Host "✖ Failed to start services" -ForegroundColor Red
}
