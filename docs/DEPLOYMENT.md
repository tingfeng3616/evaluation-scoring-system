# Deployment Guide

This guide deploys the system to Cloudflare Workers with static assets and D1.

## 1. Install Dependencies

```bash
npm install
```

## 2. Login to Cloudflare

```bash
npx wrangler login
```

## 3. Create a D1 Database

```bash
npx wrangler d1 create interview-scoring
```

Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "interview-scoring"
database_id = "your-d1-database-id"
migrations_dir = "./migrations"
```

## 4. Apply Migrations

```bash
npx wrangler d1 migrations apply interview-scoring --remote
```

## 5. Configure Secrets

```bash
npx wrangler secret put APP_SECRET
npx wrangler secret put JUDGE_PASSCODE
npx wrangler secret put MEMBER_PASSCODE
npx wrangler secret put ADMIN_PASSCODE
```

Use strong event-specific values.

## 6. Build and Deploy

```bash
npm run build
npx wrangler deploy
```

## 7. Optional Custom Domain

Add a route or custom domain in Cloudflare, then update your on-site instruction page copy if needed.

Do not commit production domains or database IDs to a public repository if they are not intended to be public.

## 8. Local Development

Create `.dev.vars` from `.dev.vars.example`:

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

The Vite dev server proxies `/api` to the local Worker.
