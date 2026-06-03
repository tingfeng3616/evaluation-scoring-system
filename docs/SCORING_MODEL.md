# 评分模型自定义 / Scoring Model Customization

## 中文说明

本项目默认提供一套 100 分制评分模板，但它只是示例，不是系统限制。你可以把它改成任何适合自己活动的评分模型。

默认评分配置集中在：

```text
src/shared/scoring.ts
```

这里定义了：

- 评分大项
- 每个大项的细项
- 每个细项的最高分
- 总分计算
- 排名加权公式

## 可以改成什么

### 项目路演

| 大项 | 示例分值 |
| --- | ---: |
| 创新性 | 20 |
| 需求价值 | 20 |
| 技术实现 | 25 |
| 商业/落地可行性 | 20 |
| 答辩表现 | 15 |

### 竞赛评审

| 大项 | 示例分值 |
| --- | ---: |
| 作品完成度 | 25 |
| 创意表达 | 20 |
| 技术难度 | 20 |
| 现场展示 | 20 |
| 综合印象 | 15 |

### 招新/选拔

| 大项 | 示例分值 |
| --- | ---: |
| 岗位匹配度 | 30 |
| 沟通表达 | 20 |
| 责任意识 | 20 |
| 相关经验 | 15 |
| 团队协作 | 15 |

## 修改步骤

1. 打开 `src/shared/scoring.ts`。
2. 修改 `scoreSections` 中的大项、细项和分值。
3. 确保所有大项总分相加仍为你想要的总分，例如 100。
4. 如果你改变了字段数量或字段名，需要同步更新：
   - `ScoreItemKey`
   - `ScoreInput`
   - 数据库迁移中的 `scores` 表字段
   - `worker/index.ts` 中评分写入和读取字段
   - 排名详情页的明细展示

如果只是改文案和分值，不改字段数量和字段名，改动会简单很多。  
If you only change labels and point values without changing field names or item count, customization is much easier.

## 当前限制

当前版本没有提供“后台可视化配置评分模型”的功能。评分模型是代码级配置，适合一次活动前配置好后部署。  
This version does not include an admin UI for editing scoring models. The scoring model is code-configured before deployment.

## 建议的未来增强

- 后台自定义评分大项和细项
- 每个活动独立评分模板
- 多套评分模板并存
- 评分模板导入导出
- 不同类别使用不同评分模型

## English

The default 100-point scoring model is only an example. You can replace it with a model that fits your own evaluation workflow.

The main configuration lives in:

```text
src/shared/scoring.ts
```

It defines:

- scoring sections
- scoring items
- item maximum points
- total score calculation
- ranking weight formula

If you only change labels and point values while keeping the same field names and item count, the change is straightforward.

If you change the number of fields or field names, update:

- `ScoreItemKey`
- `ScoreInput`
- the `scores` table migration
- score insert/read logic in `worker/index.ts`
- score detail rendering in the ranking page

This repository does not yet include a visual admin editor for scoring templates. Treat the model as deployment-time configuration.
