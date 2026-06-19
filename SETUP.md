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
