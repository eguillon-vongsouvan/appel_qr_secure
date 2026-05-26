# Autorise le port 3000 sur le réseau privé (Wi-Fi maison / bureau).
# Clic droit PowerShell > Exécuter en tant qu'administrateur, puis :
#   cd C:\Users\eguillonvongsouvan\appel_qr_secure
#   .\scripts\parefeu.ps1

$port = if ($env:PORT) { $env:PORT } else { 3000 }
$name = "Emargement-QR-$port"

$existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Règle pare-feu déjà présente : $name"
    exit 0
}

New-NetFirewallRule -DisplayName $name `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $port `
    -Action Allow `
    -Profile Private `
    -Description "Serveur emargement QR Node.js"

Write-Host "OK — port $port autorisé sur réseau privé."
