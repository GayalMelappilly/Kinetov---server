# Deploying Kinetov Backend to Cloudflare D1 & Workers

This guide walks you through deploying the Kinetov backend database to **Cloudflare D1** (serverless SQLite) and running the API using **Cloudflare Workers**.

---

## Prerequisites

1. A [Cloudflare Account](https://dash.cloudflare.com/)
2. Node.js 18+ installed

---

## Step 1: Authenticate with Cloudflare

Inside the `backend` folder, log in to your Cloudflare account using Wrangler:

```bash
npx wrangler login
```

---

## Step 2: Create Your Cloudflare D1 Database

Run the following command to create your serverless D1 database:

```bash
npx wrangler d1 create kinetov-db
```

Wrangler will output configuration information similar to:

```jsonc
[[d1_databases]]
binding = "DB"
database_name = "kinetov-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` string.

---

## Step 3: Update `wrangler.jsonc`

Open `backend/wrangler.jsonc` and paste your `database_id`:

```jsonc
{
  "name": "kinetov-backend",
  "main": "src/worker.ts",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "kinetov-db",
      "database_id": "PASTE_YOUR_ACTUAL_DATABASE_ID_HERE"
    }
  ],
  "vars": {
    "NODE_ENV": "production",
    "ALLOWED_ORIGINS": "https://kinetov.com,https://kinetov.pages.dev,http://localhost:3000"
  }
}
```

---

## Step 4: Execute Schema and Initial Seed on Cloudflare D1

Run the SQL migration files directly on your remote D1 database:

### 1. Apply Schema:
```bash
npx wrangler d1 execute kinetov-db --remote --file=./d1/schema.sql
```

### 2. Seed Initial Custom Battery Products & Admin:
```bash
npx wrangler d1 execute kinetov-db --remote --file=./d1/seed.sql
```

*(You can also test locally anytime using `--local` instead of `--remote`)*.

---

## Step 5: Set Production Secrets

Store your secure JWT secret in Cloudflare's encrypted key vault:

```bash
npx wrangler secret put JWT_SECRET
```

When prompted, enter a strong random 32+ character secret.

---

## Step 6: Deploy the Backend Worker

Deploy the API to Cloudflare edge:

```bash
npx wrangler deploy
```

Upon completion, Wrangler will output your live URL:
```
Published kinetov-backend (x.xx sec)
  https://kinetov-backend.<your-subdomain>.workers.dev
```

---

## Step 7: Verify Live Health Endpoint

Open your browser or run curl:

```bash
curl https://kinetov-backend.<your-subdomain>.workers.dev/api/health
```

Expected response:
```json
{
  "status": "ok",
  "store": "Kinetov API (Cloudflare D1 Worker)",
  "runtime": "cloudflare-worker",
  "database": "connected"
}
```

---

## Step 8: Update Frontend Production Environment

In `frontend/.env.production` (or your Cloudflare Pages / Vercel dashboard):

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://kinetov-backend.<your-subdomain>.workers.dev/api
```

Deploy your frontend to Cloudflare Pages or Vercel, and the full store is live!
