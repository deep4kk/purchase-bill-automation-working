# Purchase Bill Automation - Setup & Deployment Guide

## Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)
- MongoDB 5.0+ (local or cloud)

---

## Local Development Setup

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/deep4kk/purchase-bill-automation-working.git
cd purchase-bill-automation-working

# Install all dependencies
pnpm install
```

### 2. Setup MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB (macOS with Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option B: MongoDB Atlas (Cloud)**
1. Create free cluster at https://mongodb.com/atlas
2. Get connection string: `mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net`

### 3. Configure Environment Variables

```bash
# API Server
cd api-server
cp .env.example .env

# Edit .env with your settings:
# - MONGODB_URI=mongodb://localhost:27017 (or your Atlas URI)
# - MONGODB_DB=purchase_bill_automation
# - JWT_SECRET=your-secure-secret-key
# - GOOGLE_API_KEY=your-gemini-api-key (optional, for AI extraction)
```

```bash
# Frontend (invoice-app)
cd ../invoice-app
cp .env.example .env 2>/dev/null || echo "VITE_API_URL=http://localhost:5000" > .env
```

### 4. Run the Application

```bash
# Terminal 1: Start API Server
cd api-server
pnpm run dev

# Terminal 2: Start Frontend  
cd invoice-app
pnpm run dev
```

Access:
- Frontend: http://localhost:3000
- API Server: http://localhost:5000

---

## Deployment Guide

### Option 1: Render.com (Recommended for Quick Deploy)

#### Backend (API Server)

1. Create new **Web Service** on Render
2. Connect your GitHub repository
3. Configure:
   - **Root Directory:** `api-server`
   - **Build Command:** `pnpm install && pnpm run build`
   - **Start Command:** `pnpm run start`
4. Add Environment Variables:
   ```
   MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.xxxxx.mongodb.net
   MONGODB_DB=purchase_bill_automation
   JWT_SECRET=<generate-secure-random-string>
   PORT=10000
   NODE_ENV=production
   ```
5. Deploy

#### Frontend (Invoice App)

1. Create new **Static Site** on Render
2. Connect your GitHub repository
3. Configure:
   - **Root Directory:** `invoice-app`
   - **Build Command:** `pnpm install && pnpm run build`
   - **Publish Directory:** `dist`
4. Add Environment Variables:
   ```
   VITE_API_URL=https://your-api-service.onrender.com
   ```
5. Deploy

---

### Option 2: Railway.app

1. Create new project on Railway
2. Add **MongoDB** plugin (auto-provisions database)
3. Deploy API Server with:
   - Build Command: `pnpm install && pnpm run build`
   - Start Command: `pnpm run start`
4. Deploy Frontend with static hosting
5. Set environment variables from Railway dashboard

---

### Option 3: Docker Deployment

```dockerfile
# api-server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
EXPOSE 5000
CMD ["pnpm", "run", "start"]
```

```bash
# Build & Run
docker build -t purchase-bill-api ./api-server
docker run -p 5000:5000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017 \
  -e MONGODB_DB=purchase_bill_automation \
  -e JWT_SECRET=your-secret \
  purchase-bill-api
```

---

### Option 4: VPS/Server Deployment

```bash
# SSH into your server
ssh user@your-server-ip

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Clone & setup
git clone https://github.com/deep4kk/purchase-bill-automation-working.git
cd purchase-bill-automation-working/api-server
pnpm install
pnpm run build

# Create .env file
nano .env  # Add your MONGODB_URI, JWT_SECRET, etc.

# Start with PM2
pm2 start pnpm --name "purchase-bill-api" -- run start
pm2 save
pm2 startup
```

---

## Option 5: AWS EC2 Deployment (Complete Guide)

This guide deploys the application on AWS EC2 with:
- **Frontend**: Served via Nginx on port 80
- **API Server**: Running on port 5000 (internal)
- **MongoDB**: Using MongoDB Atlas (cloud) - recommended for production
- **SSL**: Optional with Certbot

### Step 1: Launch EC2 Instance

1. Go to AWS Console → EC2 → **Launch Instance**
2. Configure:
   - **Name**: `purchase-bill-app`
   - **Amazon Machine Image (AMI)**: `Ubuntu 22.04 LTS`
   - **Instance Type**: `t3.medium` (or `t3.small` for testing)
   - **Key Pair**: Create or select existing
   - **Network Settings**:
     - Allow SSH (port 22) from My IP
     - Allow HTTP (port 80) from anywhere
     - Allow HTTPS (port 443) from anywhere
     - Allow Custom TCP (port 5000) from anywhere (for API)
3. **Storage**: 20 GB gp3
4. Click **Launch Instance**

### Step 2: Connect to EC2

```bash
# Replace with your key path and instance IP
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

### Step 3: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node -v  # Should show v18.x.x
npm -v

# Install pnpm
npm install -g pnpm

# Install PM2 for process management
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL (optional)
sudo apt install -y certbot python3-certbot-nginx
```

### Step 4: Clone Repository

```bash
# Clone the repository
git clone https://github.com/deep4kk/purchase-bill-automation-working.git
cd purchase-bill-automation-working

# Install API dependencies
cd api-server
pnpm install
pnpm run build
```

### Step 5: Configure Environment

```bash
cd /home/ubuntu/purchase-bill-automation-working/api-server

# Create .env file
cat > .env << 'EOF'
# MongoDB Atlas Connection (REPLACE WITH YOUR ATLAS CREDENTIALS)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net
MONGODB_DB=purchase_bill_automation

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters

# Server Configuration
PORT=5000
BASE_PATH=/api
NODE_ENV=production

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=20971520

# Optional: AI API Keys
GOOGLE_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
EOF

# Create uploads directory
mkdir -p uploads
```

### Step 6: Build Frontend

```bash
cd /home/ubuntu/purchase-bill-automation-working/invoice-app

# Create frontend env
cat > .env << 'EOF'
VITE_API_URL=http://your-ec2-public-ip:5000
BASE_PATH=/
EOF

# Install and build
pnpm install
pnpm run build
```

### Step 7: Configure PM2 for API

```bash
cd /home/ubuntu/purchase-bill-automation-working/api-server

# Start API with PM2
pm2 start pnpm --name "purchase-bill-api" -- run start

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Check status
pm2 status
pm2 logs purchase-bill-api
```

### Step 8: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/purchase-bill
```

Paste this configuration:

```nginx
# Frontend - serving static files
server {
    listen 80;
    server_name your-domain.com;  # Or your EC2 public IP

    root /home/ubuntu/purchase-bill-automation-working/invoice-app/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_request_buffering off;
        client_max_body_size 50M;
    }

    # Uploads (if needed for file access)
    location /uploads/ {
        alias /home/ubuntu/purchase-bill-automation-working/api-server/uploads/;
        expires 1d;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/purchase-bill /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 9: (Optional) Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo certbot --nginx -d your-domain.com

# Auto-renewal is automatically set up
sudo systemctl status certbot.timer
```

### Step 10: Configure Firewall (UFW)

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### Step 11: Verify Deployment

Test from your local machine:

```bash
# Test API
curl http://your-ec2-public-ip:5000/health

# Test Frontend (should return HTML)
curl http://your-ec2-public-ip/

# Test API through Nginx proxy
curl http://your-ec2-public-ip/api/health
```

### MongoDB Atlas Setup (Required for Production)

1. Go to https://mongodb.com/atlas
2. Create free cluster (M0 Sandbox)
3. Create database user:
   - Username: `purchase_bill_user`
   - Password: (generate secure password)
4. Network Access → Add IP `0.0.0.0/0` (or your EC2 IP)
5. Get connection string:
   ```
   mongodb+srv://purchase_bill_user:<password>@cluster.xxxxx.mongodb.net
   ```
6. Update `.env` file on EC2:
   ```bash
   nano /home/ubuntu/purchase-bill-automation-working/api-server/.env
   # Update MONGODB_URI with your Atlas connection string
   pm2 restart purchase-bill-api
   ```

### Update Frontend API URL

If using domain with SSL, update frontend:

```bash
cd /home/ubuntu/purchase-bill-automation-working/invoice-app
echo "VITE_API_URL=https://your-domain.com" > .env
pnpm run build
```

### Useful Commands

```bash
# View API logs
pm2 logs purchase-bill-api

# Restart API
pm2 restart purchase-bill-api

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Check Nginx status
sudo systemctl status nginx

# Update application
cd /home/ubuntu/purchase-bill-automation-working
git pull origin main
cd api-server && pnpm install && pnpm run build && pm2 restart purchase-bill-api
cd ../invoice-app && pnpm install && pnpm run build
```

### Cost Estimate (AWS EC2)

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| EC2 t3.micro | 2 vCPU, 1GB RAM | ~$10 |
| EC2 t3.small | 2 vCPU, 2GB RAM | ~$20 |
| Data Transfer | ~10GB/month | ~$1 |
| MongoDB Atlas | M0 (512MB, free) | $0 |
| **Total** | | ~$10-20/month |

---

## Environment Variables Reference

### API Server (`api-server/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | mongodb://localhost:27017 | MongoDB connection string |
| `MONGODB_DB` | Yes | purchase_bill_automation | Database name |
| `JWT_SECRET` | Yes | - | Secret for JWT tokens (min 32 chars) |
| `PORT` | No | 5000 | Server port |
| `BASE_PATH` | No | /api | API base path |
| `NODE_ENV` | No | development | Environment mode |
| `UPLOAD_DIR` | No | ./uploads | File upload directory |
| `MAX_FILE_SIZE` | No | 20971520 | Max upload size (bytes) |
| `GOOGLE_API_KEY` | No | - | Gemini AI API key for extraction |
| `OPENAI_API_KEY` | No | - | OpenAI API key (backup) |

### Frontend (`invoice-app/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | http://localhost:5000 | API server URL |
| `PORT` | No | 3000 | Frontend dev port |
| `BASE_PATH` | No | / | Frontend base path |

---

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Test connection string format
mongodb://user:pass@host:27017/database?authSource=admin
```

### Build Errors
```bash
# Clear cache and reinstall
cd api-server
rm -rf node_modules dist
pnpm install
pnpm run build
```

### Port Already in Use
```bash
# Find and kill process on port
lsof -ti:5000 | xargs kill -9
```

---

## Default Login (Development)

After first setup, register a new user via the UI at `/register`.

Or create admin user via API:
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"admin123","role":"admin"}'
```
