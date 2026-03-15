#!/bin/bash
# deploy.sh — One-command setup for Hatch LRI™ on a fresh Ubuntu 22.04 Droplet
# Run as root: bash deploy.sh YOUR_DOMAIN
# Example:     bash deploy.sh app.hatch.com

set -e

DOMAIN="${1:-YOUR_DOMAIN}"
APP_DIR="/var/www/hatch-lri"
LOG_DIR="/var/log/hatch-lri"

echo "================================================"
echo "  Hatch LRI™ — Digital Ocean Droplet Setup"
echo "  Domain: $DOMAIN"
echo "================================================"

# ── 1. System updates ─────────────────────────────
echo "[1/9] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Node.js 20 ─────────────────────────
echo "[2/9] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── 3. Install PM2 + Nginx + Certbot ──────────────
echo "[3/9] Installing PM2, Nginx, Certbot..."
npm install -g pm2 tsx
apt-get install -y nginx certbot python3-certbot-nginx

# ── 4. Create app directory ────────────────────────
echo "[4/9] Creating app directory..."
mkdir -p "$APP_DIR" "$LOG_DIR"

# ── 5. Copy app files ─────────────────────────────
echo "[5/9] Copying application files..."
cp -r . "$APP_DIR/"
cd "$APP_DIR"

# ── 6. Install dependencies ───────────────────────
echo "[6/9] Installing Node.js dependencies..."
npm install --omit=dev
# tsx is needed at runtime for ESM TypeScript
npm install tsx

# ── 7. Configure Nginx ────────────────────────────
echo "[7/9] Configuring Nginx..."
sed "s/YOUR_DOMAIN/$DOMAIN/g" nginx.conf > /etc/nginx/sites-available/hatch-lri

# Temporarily serve HTTP only (before SSL cert)
cat > /etc/nginx/sites-available/hatch-lri-temp << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/hatch-lri-temp /etc/nginx/sites-enabled/hatch-lri
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 8. Start app with PM2 ─────────────────────────
echo "[8/9] Starting app with PM2..."
mkdir -p data
PORT=3000 DB_PATH="$APP_DIR/data/lri.db" NODE_ENV=production \
  pm2 start ecosystem.production.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

# ── 9. SSL with Let's Encrypt ─────────────────────
echo "[9/9] Obtaining SSL certificate..."
echo ""
echo "  ⚠️  Make sure your domain $DOMAIN points to this server's IP first."
echo "  Then press ENTER to obtain the SSL certificate, or Ctrl+C to skip."
read -r

certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
  --email "admin@${DOMAIN#*.}" --redirect || \
  echo "SSL setup skipped — run: certbot --nginx -d $DOMAIN manually later"

# Switch to full SSL nginx config
ln -sf /etc/nginx/sites-available/hatch-lri /etc/nginx/sites-enabled/hatch-lri
nginx -t && systemctl reload nginx

echo ""
echo "================================================"
echo "  ✅ Hatch LRI™ is live!"
echo ""
echo "  URL      : https://$DOMAIN"
echo "  App dir  : $APP_DIR"
echo "  Database : $APP_DIR/data/lri.db"
echo "  Logs     : $LOG_DIR"
echo ""
echo "  Useful commands:"
echo "    pm2 status              — check app status"
echo "    pm2 logs hatch-lri      — view live logs"
echo "    pm2 restart hatch-lri   — restart app"
echo "    pm2 stop hatch-lri      — stop app"
echo "================================================"
