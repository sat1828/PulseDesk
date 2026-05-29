Write-Host "Stopping PulseDesk services..." -ForegroundColor Yellow
docker compose down
Write-Host "✔ All services stopped" -ForegroundColor Green
