# 架构说明 / Architecture

## 运行结构 / Runtime

```text
Browser / 浏览器
  -> React/Vite static assets / 静态前端资源
  -> /api/* Hono Worker / 后端 API
  -> Cloudflare D1 / 数据库
```

## 主要模块 / Main Areas

| 模块 / Area | 文件 / Files |
| --- | --- |
| 评分端 / Scoring page | `src/pages/ScorePage.tsx` |
| 管理后台 / Admin page | `src/pages/AdminPage.tsx` |
| 排名页 / Ranking page | `src/pages/RankingPage.tsx` |
| 展示大屏 / Display screen | `src/pages/DisplayPage.tsx` |
| 注意事项页 / Notice screen | `src/pages/NoticePage.tsx` |
| API Worker | `worker/index.ts` |
| 评分规则 / Shared scoring rules | `src/shared/scoring.ts` |
| 参数校验 / Shared validation contracts | `src/shared/contracts.ts` |
| 数据库迁移 / D1 migrations | `migrations/` |

## 数据模型 / Data Model

- `candidates`: 参评对象基础信息 / participant identity and serial number.
- `candidate_departments`: 参评对象与部门/类别意向映射 / first and second department or category mapping.
- `device_bindings`: 评分人姓名、身份、设备与审计信息 / scorer name, role, device token, fingerprint hash, IP, and user agent.
- `scores`: 明细分、小计、总分、锁定与废弃状态 / submitted item scores, section totals, grand total, lock and discard status.
- `active_candidate`: 当前正在展示或评分的参评对象 / currently active participant.
- `audit_logs`: 操作审计记录 / operational and security audit trail.
- `system_settings`: 系统设置、封禁记录、口令哈希等 / runtime settings, blocked-device records, and passcode hashes.

## 排名逻辑 / Ranking Logic

参评对象在每个部门、类别或赛道内单独排名。若一个对象有第一和第二意向，会分别出现在两个榜单中。  
Participants are ranked inside each department, category, or track. A participant with first and second choices appears in both relevant ranking lists.

```text
总成绩 = 评委均分 * 0.7 + 部员均分 * 0.3
final_score = judge_average * 0.7 + member_average * 0.3
```

同分采用竞赛排名，例如 `1, 2, 2, 4`。  
Ties use competition ranking, for example `1, 2, 2, 4`.

## 设备绑定 / Device Binding

评分人先输入身份口令，再把姓名绑定到当前浏览器设备。系统会保存签名设备 token、cookie session、指纹摘要、IP 和 UA 用于审计。  
Scorers enter a role passcode, then bind a name to the current browser device. The system stores a signed device token, cookie session, fingerprint hash, IP, and user agent for audit.

浏览器指纹主要用于后台预警，硬性规则是“同一绑定设备对同一参评对象只能有一条有效评分”。  
The fingerprint is mainly advisory. The hard rule is one active score per bound device and participant.

## 分数管理 / Score Management

排名详情页支持管理员查看、修改和废弃评分。废弃评分不会物理删除，会保留在数据库中用于审计，但不参与排名计算。  
Ranking detail views allow admins to review, edit, and discard scores. Discarded scores remain in the database for audit but are excluded from rankings.
