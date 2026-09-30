#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SOC Radar - HTTPS Setup Script
# setup-https.sh
#
# Führe dieses Skript EINMALIG auf deinem Heimserver aus, um:
#   1. Tailscale TLS-Zertifikate zu generieren
#   2. Die Zertifikate an die richtige Stelle zu kopieren
#   3. Docker Compose neu zu starten
#
# Verwendung:
#   chmod +x setup-https.sh
#   sudo ./setup-https.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DOMAIN="heimserver.tail2ad9cd.ts.net"
CERT_DIR="/opt/soc/certs"
COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"   # directory of this script

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SOC Radar - HTTPS Setup"
echo "  Domain : $DOMAIN"
echo "  CertDir: $CERT_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Check tailscale is available ──────────────────────────────────────────
if ! command -v tailscale &>/dev/null; then
  echo "❌  tailscale CLI not found. Is Tailscale installed?"
  exit 1
fi

echo ""
echo "🔐 [1/4] Generating Tailscale TLS certificate for $DOMAIN ..."
# tailscale cert writes two files into the current directory:
#   <domain>.crt  and  <domain>.key
cd /tmp
tailscale cert "$DOMAIN"
echo "✅  Certificate generated."

# ── 2. Move certs to target directory ────────────────────────────────────────
echo ""
echo "📂 [2/4] Moving certificates to $CERT_DIR ..."
mkdir -p "$CERT_DIR"
mv "/tmp/${DOMAIN}.crt" "${CERT_DIR}/${DOMAIN}.crt"
mv "/tmp/${DOMAIN}.key" "${CERT_DIR}/${DOMAIN}.key"
chmod 644 "${CERT_DIR}/${DOMAIN}.crt"
chmod 600 "${CERT_DIR}/${DOMAIN}.key"
echo "✅  Certificates placed at $CERT_DIR"

# ── 3. (Re)start Docker Compose ──────────────────────────────────────────────
echo ""
echo "🐳 [3/4] (Re)starting SOC Gateway + nginx ..."
cd "$COMPOSE_DIR"
docker compose down --remove-orphans || true
docker compose up -d --build
echo "✅  Containers started."

# ── 4. Health check ──────────────────────────────────────────────────────────
echo ""
echo "🩺 [4/4] Waiting for gateway to be healthy ..."
sleep 8
if curl -fsk "https://${DOMAIN}/api/health" | grep -q '"ok"'; then
  echo "✅  Gateway is reachable at https://${DOMAIN}"
else
  echo "⚠️  Health check failed — check logs with: docker compose logs"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done! Gateway URL: https://${DOMAIN}"
echo "  Redeploy Vercel to pick up the new GATEWAY_URL."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
