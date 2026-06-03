# 为什么选择这个系统 / Why This Project

## 中文说明

这个系统不是单纯的“在线表单”，而是围绕现场评审流程设计的轻量级评分平台。它适合面试、招新、竞选、答辩、竞赛评审、评优评先、社团/组织选拔等场景。

## 和常见方案相比

| 方案 | 常见问题 | 本项目的处理方式 |
| --- | --- | --- |
| 问卷/表单工具 | 容易选错对象，难以控制当前评分对象，排名和权重需要后期整理 | 管理员控制当前对象，系统自动汇总和排名 |
| 普通投票系统 | 更偏“投票”，不适合多维度评分和加权均分 | 5 大项、15 细项、评委/成员权重计算 |
| Excel 手工统计 | 现场录入慢，容易复制粘贴出错，难以实时展示 | 在线提交、实时查询、活动结束后再导出 Excel |
| 账号密码系统 | 创建账号麻烦，短期活动维护成本高 | 统一口令 + 首次姓名绑定设备 |
| 完全公开排名屏 | 容易暴露分数和个人评价 | 展示屏只显示进度，不展示敏感分数 |

## 适合的场景

- 多个评分人同时打分
- 需要区分评委、成员、观众等评分身份
- 需要按部门、岗位、类别、赛道分别排名
- 需要管理员控制当前评分对象
- 需要防止重复评分或误提交
- 需要活动结束后导出完整数据留档
- 需要在大屏展示流程，但不公开分数

## 不适合的场景

- 只需要匿名投票
- 不需要评分明细，只要“支持/反对”
- 需要复杂组织架构和长期账号体系
- 需要短信实名、身份证实名或强实名验证
- 需要高并发互联网级公开投票

## 核心设计取舍

- **统一口令而不是账号体系**：更适合短期现场活动，降低准备成本。
- **设备绑定而不是手机号验证**：避免短信成本和实名合规复杂度，但仍能减少重复提交。
- **保留废弃评分而不是物理删除**：方便事后审计，排名计算时自动排除。
- **公开展示不显示分数**：保护评审过程，减少现场干扰。
- **按类别排名而不是总榜**：更适合多岗位、多部门、多赛道选拔。

## English

This project is not just an online form. It is a lightweight scoring platform designed around live evaluation workflows. It works well for interviews, recruitment, elections, defenses, competitions, awards, clubs, and organizational selection.

## Compared with Common Alternatives

| Alternative | Common limitation | This project |
| --- | --- | --- |
| Form tools | Easy to score the wrong participant; ranking and weighting require manual cleanup | Admin-controlled active participant and automatic ranking |
| Polling tools | Better for voting than weighted multi-dimensional scoring | 5 sections, 15 items, and scorer-group weighting |
| Spreadsheet workflows | Slow on site, error-prone, not naturally real-time | Online submission, real-time ranking, Excel export after the event |
| Account systems | Too much setup for short-term events | Unified passcodes plus first-time device binding |
| Public ranking screens | Can expose sensitive scores and individual judgments | Display screen shows progress without exposing scores |

## Good Fit

- Multiple scorers submitting at the same time
- Separate scorer roles such as judges and members
- Department, position, category, or track-based rankings
- Admin-controlled active participant
- Duplicate-score prevention and operational audit
- Final Excel export for records
- Public display screen without score exposure

## Not a Good Fit

- Anonymous mass voting only
- Simple yes/no voting
- Long-term enterprise account hierarchy
- SMS, ID-card, or legal real-name verification
- Internet-scale public voting with adversarial traffic

## Design Tradeoffs

- **Passcodes instead of accounts**: lower setup cost for short-term events.
- **Device binding instead of phone verification**: avoids SMS cost and real-name compliance complexity while reducing duplicates.
- **Discard instead of hard delete**: keeps an audit trail while excluding bad scores from rankings.
- **Progress-only display**: protects the evaluation process and reduces on-site pressure.
- **Category rankings instead of global rankings**: better for multi-position and multi-track selection.
