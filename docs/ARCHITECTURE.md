# Architecture

## Runtime

```text
Browser
  -> React/Vite static assets
  -> /api/* Hono Worker
  -> Cloudflare D1
```

## Main Areas

| Area | Files |
| --- | --- |
| Scoring page | `src/pages/ScorePage.tsx` |
| Admin page | `src/pages/AdminPage.tsx` |
| Ranking page | `src/pages/RankingPage.tsx` |
| Display screen | `src/pages/DisplayPage.tsx` |
| Notice screen | `src/pages/NoticePage.tsx` |
| API Worker | `worker/index.ts` |
| Shared scoring rules | `src/shared/scoring.ts` |
| Shared validation contracts | `src/shared/contracts.ts` |
| D1 migrations | `migrations/` |

## Data Model

- `candidates`: candidate identity and serial number.
- `candidate_departments`: first and second department intent mapping.
- `device_bindings`: scorer name, role, device token, fingerprint hash, IP/UA audit data.
- `scores`: submitted scoring items, section totals, grand total, lock and discard status.
- `active_candidate`: currently active candidate controlled by admin.
- `audit_logs`: operational and security audit trail.
- `system_settings`: runtime settings such as blocked-device records and passcode hashes.

## Ranking Logic

Candidates are ranked inside each department. A candidate with first and second choices appears in both relevant department lists.

The total score formula is:

```text
judge_average * 0.7 + member_average * 0.3
```

Ties use competition ranking, for example `1, 2, 2, 4`.

## Device Binding

Scorers log in with a role passcode, then bind a real name to the current browser device. The system stores a signed device token, a cookie session, fingerprint hash, IP, and user agent for audit.

The fingerprint is advisory and used for warnings. The hard scoring rule is one active score per binding and candidate.

## Score Management

Ranking detail views allow admin-authenticated score review, edit, and discard. Discarded scores remain in the database for audit and are excluded from ranking calculations.
