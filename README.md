# Evaluation Scoring System / 活动评审评分系统

一个适合面试、招新、竞选、答辩、竞赛评审、评优评先、社团/组织选拔等场景的线上评分系统。  
A flexible online evaluation and scoring system for interviews, recruitment, elections, defenses, competitions, awards, clubs, and organization selection workflows.

本项目是一个已脱敏的开源版本，不包含任何真实参评对象、真实评分、真实设备绑定、真实口令、真实域名或生产数据库信息。  
This is a sanitized open-source version. It does not include real participants, scores, device bindings, passcodes, domains, or production database identifiers.

## 技术栈 / Tech Stack

- 前端 / Frontend: React + Vite + Tailwind CSS
- API: Hono on Cloudflare Workers
- 数据库 / Database: Cloudflare D1
- Excel 导入导出 / Excel import & export: `xlsx`

## 功能 / Features

- 五个独立入口：评分端、管理后台、排名页、展示大屏、注意事项页。  
  Separate pages for scoring, administration, ranking, public display, and on-site instructions.
- 评委、部员、管理员使用不同统一口令登录。  
  Role-based passcode login for judges, members, and admins.
- 首次进入后绑定姓名到当前浏览器设备。  
  First-time scorer name binding to the current browser device.
- 管理员控制当前正在展示/评分的参评对象。  
  Admin-controlled active participant.
- 切换保护：管理员切换下一位后，未提交的评分端不会被强制切走。  
  Switch protection: unfinished scoring pages stay on the previous participant until submitted or manually skipped.
- 5 个大项、15 个细项评分，也支持直接输入总分一键提交。  
  5 sections and 15 scoring items, plus quick total-score submission.
- 部门单独排名，不生成总榜。  
  Department-only rankings, no global ranking.
- 总成绩公式：`评委均分 × 0.7 + 部员均分 × 0.3`。  
  Final score: `judge average x 0.7 + member average x 0.3`.
- 管理后台支持导入参评名单、切换当前对象、管理设备、查看/修改/废弃评分。  
  Admin tools for participant import, active participant control, device management, score review, score edit, and score discard.
- 展示大屏不展示分数，只展示当前对象和参评进度。  
  Public display screen shows the current participant and participation progress without exposing scores.

## 页面 / Pages

| 路径 / Path | 用途 / Purpose |
| --- | --- |
| `/score` | 评分端 / Scorer mobile page |
| `/admin` | 管理后台 / Admin console |
| `/ranking` | 排名与分数管理 / Ranking and score management |
| `/display` | 展示大屏 / Public display screen |
| `/notice` | 现场注意事项 / On-site instructions |

## 快速开始 / Quick Start

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

本地访问 / Local URLs:

- `http://127.0.0.1:5173/score`
- `http://127.0.0.1:5173/admin`
- `http://127.0.0.1:5173/ranking`
- `http://127.0.0.1:5173/display`
- `http://127.0.0.1:5173/notice`

## 环境变量 / Environment Variables

复制 `.dev.vars.example` 为 `.dev.vars`，生产环境请在 Cloudflare Worker Secrets 中配置。  
Copy `.dev.vars.example` to `.dev.vars`. For production, configure the same values as Cloudflare Worker secrets.

```env
APP_SECRET=replace-with-a-long-random-secret
JUDGE_PASSCODE=change-this-judge-passcode
MEMBER_PASSCODE=change-this-member-passcode
ADMIN_PASSCODE=change-this-admin-passcode
```

生产环境请使用足够长、不可猜测、每次活动单独设置的口令。  
Use long, unpredictable, event-specific passcodes in production.

## 数据库 / Database

创建 D1 数据库 / Create a D1 database:

```bash
npx wrangler d1 create evaluation-scoring
```

把返回的 `database_id` 填入 `wrangler.toml`，然后执行迁移。  
Put the returned `database_id` into `wrangler.toml`, then apply migrations.

```bash
npm run db:migrate:local
npx wrangler d1 migrations apply evaluation-scoring --remote
```

## 参评名单导入格式 / Participant Import Format

管理后台导入 Excel，固定读取前四列：  
The admin page imports Excel files and reads the first four columns:

| 列 / Column | 含义 / Meaning |
| --- | --- |
| 第 1 列 / Column 1 | 序号 / Serial number |
| 第 2 列 / Column 2 | 姓名 / Participant name |
| 第 3 列 / Column 3 | 第一意向部门 / First-choice department |
| 第 4 列 / Column 4 | 第二意向部门 / Second-choice department |

第二意向为空或 `无` 时，不建立第二部门排名映射。  
If the second choice is blank or `无`, no second-department ranking entry is created.

安全示例模板 / Safe sample template: `examples/participants-template.csv`

## 评分模型 / Scoring Model

单次评分为 100 分制。  
Each submitted score is out of 100.

| 大项 / Section | 分值 / Points |
| --- | ---: |
| 仪容仪表与言行举止 / Appearance and conduct | 15 |
| 语言表达能力 / Communication | 20 |
| 认知与能力匹配 / Role fit | 30 |
| 思想态度与素养 / Attitude | 20 |
| 临场应变与综合表现 / On-site performance | 15 |

最终成绩 / Final score:

```text
评委均分 * 0.7 + 部员均分 * 0.3
judge_average * 0.7 + member_average * 0.3
```

如果某一身份组尚未提交，则暂时按已有身份组均分计算。  
If only one role group has submitted, that group average is used temporarily.

## 常用命令 / Scripts

```bash
npm run dev              # 本地开发 / local development
npm run build            # 类型检查并构建 / type-check and build
npm run check            # 单元测试 / unit tests
npm run lint             # 代码检查 / lint
npm run db:migrate:local # 本地 D1 迁移 / local D1 migrations
```

## 数据导出 / Data Export

活动结束后可以导出数据库数据。  
After an event, export D1 data with:

```bash
D1_DATABASE_NAME=evaluation-scoring node scripts/export-interview-data.mjs
```

导出内容包括：部门排名、参评对象汇总、有效评分、废弃评分、设备绑定、当前对象状态和审计日志。  
The export includes rankings, participant summaries, effective scores, discarded scores, device bindings, active participant state, and audit logs.

## 部署 / Deployment

详见 / See: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 架构 / Architecture

详见 / See: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 安全与隐私 / Security and Privacy

详见 / See: [docs/SECURITY.md](docs/SECURITY.md)

## 开源协议 / License

MIT. See [LICENSE](LICENSE).
