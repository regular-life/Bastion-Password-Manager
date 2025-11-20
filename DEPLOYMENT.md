# Deployment Guide

This guide covers deploying Bastion Password Manager for production use.

## Architecture Overview

Bastion consists of two main components for deployment:

1. **Backend Server**: Runs on a VM or server (24/7)
2. **Desktop Application**: Distributed as standalone installers (.exe, .dmg, .AppImage)

The desktop application connects to the remote backend server.

## Backend Deployment

### Prerequisites

- Linux server or VM with SSH access
- PostgreSQL 14+
- Node.js 18+
- At least 1GB RAM, 10GB disk space

### Deployment Methods

#### Method 1: Automated Deployment Script (Recommended)

```bash
# Run from your development machine
npm run deploy:backend

# Follow the prompts:
# - SSH user (default: user4)
# - SSH host (default: 192.168.2.246)
# - Remote path (default: /home/user4/bastion-backend)
```

The script will:
- Create deployment package
- Upload files to server
- Install dependencies
- Setup configuration template
- Provide next steps

#### Method 2: Manual Deployment

**On your development machine:**

```bash
# Create deployment package
cd backend
tar -czf bastion-backend.tar.gz src/ schema*.sql package.json .env.example

# Upload to server
scp bastion-backend.tar.gz user4@192.168.2.246:/home/user4/
```

**On the server:**

```bash
ssh user4@192.168.2.246

# Extract
mkdir bastion-backend
cd bastion-backend
tar -xzf ../bastion-backend.tar.gz

# Install dependencies
npm install --production

# Configure
cp .env.example .env
nano .env
```

### Server Configuration

Edit `.env` on the server:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database (update with your credentials)
DATABASE_URL=postgresql://dbuser:dbpassword@localhost:5432/bastion

# Session
SESSION_DURATION_HOURS=24

# CORS (if needed, comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
```

### Database Setup

On the server:

```bash
# Create database
createdb bastion

# If PostgreSQL requires sudo
sudo -u postgres createdb bastion
sudo -u postgres psql -c "CREATE USER dbuser WITH PASSWORD 'dbpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bastion TO dbuser;"

# Apply schema
psql bastion < schema.sql
psql bastion < schema-family.sql
```

### Starting the Server

#### Option 1: Direct (for testing)

```bash
cd bastion-backend
npm start
```

#### Option 2: PM2 Process Manager (Recommended for production)

```bash
# Install PM2 globally
npm install -g pm2

# Start server
pm2 start src/server.js --name bastion-backend

# Configure to start on boot
pm2 save
pm2 startup
# Follow the instructions PM2 provides

# Useful PM2 commands
pm2 status                    # Check status
pm2 logs bastion-backend      # View logs
pm2 restart bastion-backend   # Restart
pm2 stop bastion-backend      # Stop
pm2 delete bastion-backend    # Remove
```

### Firewall Configuration

Allow incoming connections on port 3001:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 3001/tcp
sudo ufw reload

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables-save
```

### SSL/TLS with Reverse Proxy (Optional but Recommended)

Use Nginx or Apache as a reverse proxy with SSL:

**Nginx configuration:**

```nginx
server {
    listen 443 ssl http2;
    server_name api.bastion.example.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.bastion.example.com;
    return 301 https://$server_name$request_uri;
}
```

Then use `https://api.bastion.example.com` as your backend URL.

### Health Check

Test the deployment:

```bash
# From server
curl http://localhost:3001/api/health

# From development machine
curl http://192.168.2.246:3001/api/health

# Expected response: {"status":"ok"}
```

## Desktop Application Deployment

### Building Installers

#### Automated Build Script (Recommended)

```bash
# Run from your development machine
npm run build:app

# Follow the prompts:
# - Enter backend URL: http://192.168.2.246:3001
# - Select platform: Windows/macOS/Linux/All
```

The script will:
-   Build frontend with configured backend URL
-   Build Electron installer(s)
-   Output to `electron/dist/`

#### Manual Build

```bash
# Set backend URL
export VITE_API_URL=http://192.168.2.246:3001
# Or for production with SSL
export VITE_API_URL=https://api.bastion.example.com

# Build frontend
cd frontend
npm run build
cd ..

# Build Electron app
cd electron

# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux

# For all platforms
npm run build
```

### Built Artifacts

After building, you'll find:

```
electron/dist/
├── Bastion Setup 1.0.0.exe      # Windows installer
├── Bastion-1.0.0.dmg            # macOS installer
├── Bastion-1.0.0.AppImage       # Linux AppImage
└── bastion_1.0.0_amd64.deb      # Linux Debian package (if built)
```

### Distribution

#### To End Users

1.  **Upload installers** to a file server or cloud storage
2.  **Create download page** with instructions:
    -   Windows: Download and run `Bastion Setup.exe`
    -   macOS: Download, open DMG, drag to Applications
    -   Linux: Download AppImage, make executable, run

3.  **Provide user guide**: Share the User-Guide.md

#### Internal Distribution

For corporate/internal use:
-   Use internal file server
-   Deploy via group policy (Windows)
-   Use MDM for macOS
-   Package in internal app store

### Testing Before Distribution

#### Windows

```bash
# Install
./electron/dist/Bastion\ Setup\ 1.0.0.exe

# Run from Start menu
# Test creating account, adding passwords, etc.
```

#### macOS

```bash
# Open DMG
open electron/dist/Bastion-1.0.0.dmg

# Drag to Applications, then run
open /Applications/Bastion.app
```

#### Linux

```bash
# Make executable
chmod +x electron/dist/Bastion-1.0.0.AppImage

# Run
./electron/dist/Bastion-1.0.0.AppImage
```

## Updating/Maintenance

### Backend Updates

```bash
# On server
cd bastion-backend

# Backup database
pg_dump bastion > backup-$(date +%Y%m%d).sql

# Pull new code or upload new version
# Install any new dependencies
npm install --production

# Apply schema changes (if any)
psql bastion < new-schema.sql

# Restart
pm2 restart bastion-backend
```

### Desktop App Updates

1.  Build new version with updated version number
2.  Distribute new installer to users
3.  Users install over existing version
4.  (Future: Implement auto-update via electron-updater)

## Monitoring

### Backend Monitoring

```bash
# Check if running
pm2 status

# View logs
pm2 logs bastion-backend

# Monitor resources
pm2 monit

# View error logs
tail -f ~/.pm2/logs/bastion-backend-error.log
```

### Database Monitoring

```bash
# Check database size
psql bastion -c "SELECT pg_size_pretty(pg_database_size('bastion'));"

# Check table sizes
psql bastion -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check active connections
psql bastion -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'bastion';"
```

## Backup Strategy

### Database Backups

**Automated daily backups:**

```bash
# Create backup script
cat > /home/user4/backup-bastion.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/user4/backups"
mkdir -p $BACKUP_DIR
pg_dump bastion | gzip > "$BACKUP_DIR/bastion-$(date +%Y%m%d-%H%M%S).sql.gz"

# Keep only last 30 days
find $BACKUP_DIR -name "bastion-*.sql.gz" -mtime +30 -delete
EOF

chmod +x /home/user4/backup-bastion.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/user4/backup-bastion.sh
```

**Manual backup:**

```bash
pg_dump bastion > bastion-backup-$(date +%Y%m%d).sql
```

**Restore from backup:**

```bash
psql bastion < bastion-backup-20251121.sql
```

## Security Checklist

-   [ ] Backend runs as non-root user
-   [ ] Firewall configured (only port 3001 or 443 open)
-   [ ] PostgreSQL has strong passwords
-   [ ] SSL/TLS enabled for production (reverse proxy)
-   [ ] Regular database backups configured
-   [ ] Server OS patched and updated
-   [ ] SSH uses key authentication (disable password auth)
-   [ ] Monitoring/logging enabled
-   [ ] User installers are from trusted source only

## Troubleshooting

### Backend won't start

```bash
# Check logs
pm2 logs bastion-backend

# Check database connection
psql $DATABASE_URL

# Check port availability
netstat -tulpn | grep 3001

# Check .env file
cat .env
```

### Desktop app can't connect to backend

1.  Check backend is running: `pm2 status`
2.  Check firewall allows port 3001
3.  Test from client: `curl http://SERVER_IP:3001/api/health`
4.  Verify `VITE_API_URL` was set correctly during build
5.  Check network connectivity

### Database issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
psql -l | grep bastion

# Check schema
psql bastion -c "\dt"

# Check for errors
sudo journalctl -u postgresql -n 50
```

## Production Checklist

Before going to production:

- [ ] Backend deployed and tested
- [ ] Database backups configured
- [ ] SSL/TLS enabled (if accessible from internet)
- [ ] Firewall configured
- [ ] PM2 configured to restart on reboot
- [ ] Desktop app built with correct backend URL
- [ ] Desktop app tested on each platform
- [ ] User guide distributed to users
- [ ] Admin has SSH access to server
- [ ] Monitoring/alerting setup (optional but recommended)

## Support

For deployment issues:
1. Check this guide
2. Review logs (PM2, PostgreSQL, system logs)
3. Test each component individually
4. Contact system administrator

---

**Deployment Date**: _________
**Backend URL**: _________
**Deployed By**: _________
**Version**: 1.0.0
