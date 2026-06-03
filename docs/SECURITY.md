# 安全与隐私 / Security and Privacy

## 系统可能保存的数据 / Data This System May Store

根据你的部署配置，系统可能保存：  
Depending on your deployment, the system may store:

- 评分人姓名 / scorer-entered names
- 参评对象姓名 / participant names
- 评分数据 / scores
- 设备 token / device tokens
- 浏览器指纹摘要 / browser fingerprint hashes
- IP 地址 / IP addresses
- User-Agent
- 审计日志元数据 / audit log metadata

请把生产数据库视为敏感数据。  
Treat the production database as sensitive.

## 生产环境检查清单 / Production Checklist

- 使用足够强的评委、部员、管理员口令。  
  Use strong passcodes for judge, member, and admin access.
- 使用足够长且随机的 `APP_SECRET`。  
  Use a long random `APP_SECRET`.
- 不要跨活动复用口令。  
  Do not reuse passcodes across events.
- 管理后台应只给可信管理员使用。  
  Restrict admin page access operationally.
- Excel 导入默认是管理员可信输入。项目使用 `xlsx`，该包目前有上游安全公告且暂无修复版；不要开放匿名上传，若你的威胁模型包含不可信文件处理，请替换解析库。  
  Treat Excel imports as trusted-admin input. The default implementation uses `xlsx`, which currently has upstream advisories with no patched release. Avoid public unauthenticated uploads and consider swapping the parser if your threat model requires untrusted file processing.
- 分享导出文件前先人工检查。  
  Review exported files before sharing.
- 根据组织规则清理、归档或删除 D1 数据。  
  Delete or archive D1 data according to your organization's retention rules.
- 不要提交 `.dev.vars`、`.wrangler`、cookies、日志、真实名单导入表、导出文件或真实截图。  
  Do not commit `.dev.vars`, `.wrangler`, cookies, logs, real participant imports, exports, or screenshots with real data.

## 公开仓库检查清单 / Public Repository Checklist

发布公开 fork 前建议扫描：  
Before pushing a public fork, scan for:

```bash
rg -n "domain|database_id|PASSCODE|APP_SECRET|\\.xlsx|cookie|token|真实姓名"
```

并手动检查：  
Then manually inspect:

- `wrangler.toml`
- `.dev.vars.example`
- `public/`
- `outputs/`
- `tmp/`
- `scripts/`

## 漏洞披露 / Responsible Disclosure

如果你发现安全问题，请优先私下联系维护者或创建 private advisory，不要先公开利用细节。  
If you find a vulnerability, please open a private advisory or contact the maintainer before publishing exploit details.
