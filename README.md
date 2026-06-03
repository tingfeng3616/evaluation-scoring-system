# Interview Scoring System

An open-source interview scoring system for panel interviews, recruitment events, student organizations, clubs, and other multi-reviewer selection workflows.

The project is built for Cloudflare:

- Frontend: React + Vite + Tailwind CSS
- API: Hono on Cloudflare Workers
- Database: Cloudflare D1
- Import/export: Excel via `xlsx`

## Features

- Separate pages for scoring, ranking, administration, display screen, and instructions.
- Unified passcode login for judges, members, and admins.
- First-time scorer name binding to the current browser device.
- Current-candidate control from the admin page.
- Late submission protection: if the admin switches candidate before a scorer submits, the scoring page keeps the previous candidate and offers a manual jump.
- Detailed scoring with 5 sections and 15 items.
- Quick total-score submission for fast on-site scoring.
- Weighted ranking by department:
  - judge average x 0.7
  - member average x 0.3
- Department-only rankings, no global ranking.
- Duplicate-score prevention per bound device and candidate.
- Admin tools for candidate import, device management, score detail review, score editing, score discard, and audit logs.
- Public display page that shows current interview progress without exposing scores.
- Notice page for on-site big-screen instructions.

## Pages

| Path | Purpose |
| --- | --- |
| `/score` | Scorer mobile page |
| `/admin` | Admin console |
| `/ranking` | Ranking and score-management page |
| `/display` | Public display screen |
| `/notice` | On-site scoring instructions |

## Privacy Notice

This repository is a sanitized open-source version. It does not include real production data, real candidate lists, real scoring records, real device bindings, real passcodes, real domains, real database IDs, or private deployment files.

Before publishing your own fork, check:

- `.dev.vars`
- `wrangler.toml`
- exported Excel files
- candidate import files
- logs and cookies
- screenshots or logos
- local `.wrangler`, `dist`, `outputs`, and `tmp` directories

## Quick Start

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Open the local pages:

- `http://127.0.0.1:5173/score`
- `http://127.0.0.1:5173/admin`
- `http://127.0.0.1:5173/ranking`
- `http://127.0.0.1:5173/display`
- `http://127.0.0.1:5173/notice`

## Environment Variables

Create `.dev.vars` locally or configure Worker secrets in Cloudflare:

```env
APP_SECRET=replace-with-a-long-random-secret
JUDGE_PASSCODE=change-this-judge-passcode
MEMBER_PASSCODE=change-this-member-passcode
ADMIN_PASSCODE=change-this-admin-passcode
```

Use long, unique passcodes for production events.

## Database

Create a D1 database and apply migrations:

```bash
npx wrangler d1 create interview-scoring
npm run db:migrate:local
```

For production:

```bash
npx wrangler d1 migrations apply interview-scoring --remote
```

Update `wrangler.toml` with your own D1 database ID before deploying.

## Candidate Import Format

The admin page imports Excel files with these fixed columns:

| Column | Meaning |
| --- | --- |
| 1 | Serial number |
| 2 | Candidate name |
| 3 | First-choice department |
| 4 | Second-choice department |

If the second choice is blank or `无`, the candidate is only ranked in the first-choice department.

See `examples/candidates-template.csv` for a safe sample template.

## Scoring Model

Each submitted score is out of 100:

- Appearance and conduct: 15
- Communication: 20
- Role fit: 30
- Attitude: 20
- On-site performance: 15

Final department score:

```text
judge_average * 0.7 + member_average * 0.3
```

If only one role group has submitted scores, that group average is used until the other group submits.

## Scripts

```bash
npm run dev              # run Vite and local Worker
npm run build            # type-check and build frontend assets
npm run check            # run Vitest tests
npm run lint             # run ESLint
npm run db:migrate:local # apply local D1 migrations
```

## Export Data

After an event, you can export data from a configured D1 database:

```bash
D1_DATABASE_NAME=interview-scoring node scripts/export-interview-data.mjs
```

The export includes department rankings, candidates, effective scores, discarded scores, device bindings, active candidate state, and audit logs.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Security and Privacy

See [docs/SECURITY.md](docs/SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
