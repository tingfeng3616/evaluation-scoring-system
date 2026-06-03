# 部署指南 / Deployment Guide

本项目部署到 Cloudflare Workers，并使用 D1 保存数据。  
This project deploys to Cloudflare Workers and uses D1 for persistence.

## 1. 安装依赖 / Install Dependencies

```bash
npm install
```

## 2. 登录 Cloudflare / Login to Cloudflare

```bash
npx wrangler login
```

## 3. 创建 D1 数据库 / Create D1 Database

```bash
npx wrangler d1 create evaluation-scoring
```

把返回的 `database_id` 写入 `wrangler.toml`。  
Copy the returned `database_id` into `wrangler.toml`.

```toml
[[d1_databases]]
binding = "DB"
database_name = "evaluation-scoring"
database_id = "your-d1-database-id"
migrations_dir = "./migrations"
```

## 4. 执行数据库迁移 / Apply Migrations

本地 / Local:

```bash
npm run db:migrate:local
```

生产 / Remote:

```bash
npx wrangler d1 migrations apply evaluation-scoring --remote
```

## 5. 配置密钥 / Configure Secrets

生产环境不要把真实口令写进仓库。请使用 Worker Secrets。  
Do not commit real passcodes. Use Worker Secrets in production.

```bash
npx wrangler secret put APP_SECRET
npx wrangler secret put JUDGE_PASSCODE
npx wrangler secret put MEMBER_PASSCODE
npx wrangler secret put ADMIN_PASSCODE
```

建议每次活动单独设置一套口令。  
Use event-specific passcodes.

## 6. 构建和部署 / Build and Deploy

```bash
npm run build
npx wrangler deploy
```

## 7. 自定义域名 / Custom Domain

如果你绑定自定义域名，可以在 Cloudflare Dashboard 或 `wrangler.toml` 中配置。  
If you use a custom domain, configure it in Cloudflare Dashboard or `wrangler.toml`.

公开仓库中不建议提交真实生产域名和数据库 ID。  
Avoid committing real production domains or database IDs to a public repository.

## 8. 本地开发 / Local Development

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Vite 会把 `/api` 请求代理到本地 Worker。  
Vite proxies `/api` requests to the local Worker.
