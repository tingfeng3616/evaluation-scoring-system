import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

const dbName = process.env.D1_DATABASE_NAME ?? 'interview-scoring'
const outputDir = path.resolve('outputs')
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outputPath = path.join(outputDir, `interview-scoring-export-${timestamp}.xlsx`)

const runSql = (sql) => {
  const compactSql = sql.replace(/\s+/g, ' ').trim()
  const escapedSql = compactSql.replace(/"/g, '`"')
  const command = `npx wrangler d1 execute ${dbName} --remote --command "${escapedSql}" --json`
  const raw = execSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 60,
    shell: 'powershell.exe',
  })
  const jsonStart = raw.indexOf('[\n')
  const jsonText = jsonStart >= 0 ? raw.slice(jsonStart) : raw
  const parsed = JSON.parse(jsonText)
  return parsed.flatMap((item) => item.results ?? [])
}

const safeSheetName = (name) => name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Sheet'

const addSheet = (workbook, name, rows) => {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 说明: '暂无数据' }])
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  sheet['!autofilter'] = { ref: sheet['!ref'] ?? 'A1:A1' }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  sheet['!cols'] = Array.from({ length: range.e.c + 1 }, (_, columnIndex) => {
    let width = 10
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
      const value = cell?.v == null ? '' : String(cell.v)
      width = Math.max(width, Math.min(value.length + 3, 36))
    }
    return { wch: width }
  })
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(name))
}

const rankingRows = runSql(`
WITH score_stats AS (
  SELECT
    candidate_id,
    AVG(CASE WHEN role = 'judge' THEN grand_total END) AS judge_average,
    AVG(CASE WHEN role = 'member' THEN grand_total END) AS member_average,
    COUNT(CASE WHEN role = 'judge' THEN 1 END) AS judge_count,
    COUNT(CASE WHEN role = 'member' THEN 1 END) AS member_count
  FROM scores
  WHERE discarded_at IS NULL
  GROUP BY candidate_id
),
base AS (
  SELECT
    cd.department_name,
    c.id AS candidate_id,
    c.serial_no,
    c.name,
    cd.intent_type,
    ROUND(ss.judge_average, 2) AS judge_average,
    ROUND(ss.member_average, 2) AS member_average,
    CASE
      WHEN ss.judge_average IS NULL AND ss.member_average IS NULL THEN 0
      WHEN ss.judge_average IS NOT NULL AND ss.member_average IS NULL THEN ss.judge_average
      WHEN ss.judge_average IS NULL AND ss.member_average IS NOT NULL THEN ss.member_average
      ELSE ss.judge_average * 0.7 + ss.member_average * 0.3
    END AS total_score,
    COALESCE(ss.judge_count, 0) AS judge_count,
    COALESCE(ss.member_count, 0) AS member_count
  FROM candidate_departments cd
  JOIN candidates c ON c.id = cd.candidate_id
  LEFT JOIN score_stats ss ON ss.candidate_id = c.id
),
ranked AS (
  SELECT
    *,
    RANK() OVER (
      PARTITION BY department_name
      ORDER BY ROUND(total_score, 4) DESC, COALESCE(judge_average, -1) DESC
    ) AS rank_no
  FROM base
)
SELECT
  department_name AS '部门',
  rank_no AS '名次',
  serial_no AS '序号',
  name AS '姓名',
  CASE intent_type WHEN 'first' THEN '第一意向' ELSE '第二意向' END AS '参评意向',
  judge_average AS '评委均分',
  member_average AS '部员均分',
  ROUND(total_score, 2) AS '总成绩',
  judge_count AS '评委评分人数',
  member_count AS '部员评分人数'
FROM ranked
ORDER BY department_name, rank_no, serial_no;
`)

const candidateRows = runSql(`
SELECT
  c.id AS '候选人ID',
  c.serial_no AS '序号',
  c.name AS '姓名',
  MAX(CASE WHEN cd.intent_type = 'first' THEN cd.department_name END) AS '第一意向',
  MAX(CASE WHEN cd.intent_type = 'second' THEN cd.department_name END) AS '第二意向',
  COUNT(CASE WHEN s.role = 'judge' AND s.discarded_at IS NULL THEN 1 END) AS '有效评委评分数',
  COUNT(CASE WHEN s.role = 'member' AND s.discarded_at IS NULL THEN 1 END) AS '有效部员评分数',
  ROUND(AVG(CASE WHEN s.role = 'judge' AND s.discarded_at IS NULL THEN s.grand_total END), 2) AS '评委均分',
  ROUND(AVG(CASE WHEN s.role = 'member' AND s.discarded_at IS NULL THEN s.grand_total END), 2) AS '部员均分',
  c.created_at AS '创建时间'
FROM candidates c
LEFT JOIN candidate_departments cd ON cd.candidate_id = c.id
LEFT JOIN scores s ON s.candidate_id = c.id
GROUP BY c.id
ORDER BY c.serial_no, c.id;
`)

const effectiveScoreRows = runSql(`
SELECT
  s.id AS '评分ID',
  c.serial_no AS '候选人序号',
  c.name AS '候选人姓名',
  db.name AS '评分人姓名',
  CASE s.role WHEN 'judge' THEN '评委' ELSE '部员' END AS '评分身份',
  s.grand_total AS '总分',
  s.grooming_total AS '仪容仪表与言行举止',
  s.expression_total AS '语言表达能力',
  s.fit_total AS '认知与能力匹配',
  s.attitude_total AS '思想态度与素养',
  s.performance_total AS '临场应变与综合表现',
  s.grooming_1 AS '着装整洁',
  s.grooming_2 AS '举止文明',
  s.grooming_3 AS '神态从容',
  s.expression_1 AS '吐字清晰',
  s.expression_2 AS '表达有条理',
  s.expression_3 AS '用语文明',
  s.fit_1 AS '了解职责',
  s.fit_2 AS '特长技能贴合',
  s.fit_3 AS '相关经验执行力',
  s.attitude_1 AS '参选动机',
  s.attitude_2 AS '责任心团队意识',
  s.attitude_3 AS '积极服从安排',
  s.performance_1 AS '审题准确',
  s.performance_2 AS '思考全面',
  s.performance_3 AS '心态稳定',
  s.created_at AS '提交时间',
  s.locked_at AS '锁定时间',
  db.device_token AS '设备Token',
  db.fingerprint_hash AS '设备指纹摘要'
FROM scores s
JOIN candidates c ON c.id = s.candidate_id
JOIN device_bindings db ON db.id = s.binding_id
WHERE s.discarded_at IS NULL
ORDER BY c.serial_no, s.role, db.name;
`)

const discardedScoreRows = runSql(`
SELECT
  s.id AS '评分ID',
  c.serial_no AS '候选人序号',
  c.name AS '候选人姓名',
  db.name AS '评分人姓名',
  CASE s.role WHEN 'judge' THEN '评委' ELSE '部员' END AS '评分身份',
  s.grand_total AS '总分',
  s.discarded_at AS '废弃时间',
  s.discard_reason AS '废弃原因',
  s.created_at AS '原提交时间',
  db.device_token AS '设备Token'
FROM scores s
JOIN candidates c ON c.id = s.candidate_id
JOIN device_bindings db ON db.id = s.binding_id
WHERE s.discarded_at IS NOT NULL
ORDER BY s.discarded_at DESC, c.serial_no;
`)

const bindingRows = runSql(`
SELECT
  id AS '绑定ID',
  name AS '姓名',
  CASE role WHEN 'judge' THEN '评委' ELSE '部员' END AS '身份',
  status AS '状态',
  bound_at AS '绑定时间',
  last_seen_at AS '最后访问时间',
  unbound_at AS '解绑时间',
  device_token AS '设备Token',
  fingerprint_hash AS '设备指纹摘要',
  first_ip AS '首次IP',
  last_ip AS '最后IP',
  user_agent AS '浏览器UA'
FROM device_bindings
ORDER BY bound_at;
`)

const activeRows = runSql(`
SELECT
  ac.id AS '记录ID',
  c.serial_no AS '当前候选人序号',
  c.name AS '当前候选人姓名',
  ac.activated_at AS '切换时间',
  ac.activated_by AS '操作人'
FROM active_candidate ac
LEFT JOIN candidates c ON c.id = ac.candidate_id;
`)

const auditRows = runSql(`
SELECT
  id AS '日志ID',
  action_type AS '动作',
  actor_role AS '操作者身份',
  actor_name AS '操作者姓名',
  metadata_json AS '元数据',
  created_at AS '时间'
FROM audit_logs
ORDER BY id;
`)

const overviewRows = [
  { 项目: '导出时间', 数值: new Date().toLocaleString('zh-CN', { hour12: false }) },
  { 项目: '候选人数', 数值: candidateRows.length },
  { 项目: '有效评分数', 数值: effectiveScoreRows.length },
  { 项目: '废弃评分数', 数值: discardedScoreRows.length },
  { 项目: '设备绑定数', 数值: bindingRows.length },
  { 项目: '说明', 数值: '排名按部门分别计算；总成绩=评委均分*0.7+部员均分*0.3；待提交不计入均分。' },
]

fs.mkdirSync(outputDir, { recursive: true })

const workbook = XLSX.utils.book_new()
addSheet(workbook, '导出说明', overviewRows)
addSheet(workbook, '部门排名', rankingRows)
addSheet(workbook, '候选人汇总', candidateRows)
addSheet(workbook, '有效评分明细', effectiveScoreRows)
addSheet(workbook, '废弃评分', discardedScoreRows)
addSheet(workbook, '设备绑定', bindingRows)
addSheet(workbook, '当前候选人', activeRows)
addSheet(workbook, '审计日志', auditRows)

XLSX.writeFile(workbook, outputPath, { bookType: 'xlsx', compression: true })
console.log(outputPath)
