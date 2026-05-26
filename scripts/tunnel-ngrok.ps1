# Tunnel Internet rapide avec ngrok (https://ngrok.com — compte gratuit)
#
# Terminal 1 :
#   npm start
#
# Terminal 2 :
#   ngrok http 3000
#   Copiez l'URL "Forwarding" (https://....ngrok-free.app)
#
# Terminal 1 — arrêtez (Ctrl+C), puis :
#   $env:PUBLIC_URL = "https://VOTRE-URL.ngrok-free.app"
#   npm start
#
# Ouvrez : $env:PUBLIC_URL/affiche

Write-Host "1. Lancez npm start dans un autre terminal"
Write-Host "2. Lancez : ngrok http 3000"
Write-Host "3. Copiez l'URL https affichee par ngrok"
Write-Host "4. PowerShell :"
Write-Host '   $env:PUBLIC_URL = "https://xxxx.ngrok-free.app"'
Write-Host "   npm run stop"
Write-Host "   npm start"
Write-Host ""
Write-Host "Le QR fonctionnera depuis n'importe quel reseau (4G, autre Wi-Fi)."
