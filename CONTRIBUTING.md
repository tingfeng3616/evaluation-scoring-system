# 贡献指南 / Contributing

欢迎提交 Issue 和 Pull Request。  
Issues and pull requests are welcome.

## 本地开发 / Development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

提交前建议运行：  
Before submitting changes:

```bash
npm run build
npm run check
npm run lint
```

## 贡献原则 / Guidelines

- 不要提交真实活动数据、真实口令、真实域名、真实数据库 ID 或导出文件。  
  Keep private event data, passcodes, domains, database IDs, and exports out of the repository.
- 优先提交小而清晰的 PR。  
  Prefer small, focused pull requests.
- 修改评分和排名规则时，请补充测试。  
  Add tests when changing scoring or ranking behavior.
- UI 文案默认保持通用；私有活动定制请放在 fork 中。  
  Keep UI copy generic by default; event-specific wording belongs in private forks.
