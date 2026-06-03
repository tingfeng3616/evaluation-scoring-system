export type Role = 'judge' | 'member'
export type IntentType = 'first' | 'second'

export type ScoreItemKey =
  | 'grooming_1'
  | 'grooming_2'
  | 'grooming_3'
  | 'expression_1'
  | 'expression_2'
  | 'expression_3'
  | 'fit_1'
  | 'fit_2'
  | 'fit_3'
  | 'attitude_1'
  | 'attitude_2'
  | 'attitude_3'
  | 'performance_1'
  | 'performance_2'
  | 'performance_3'

export type SectionKey = 'grooming' | 'expression' | 'fit' | 'attitude' | 'performance'

export type ScoreInput = Record<ScoreItemKey, number>

export type ScoreSection = {
  key: SectionKey
  title: string
  totalMax: number
  items: Array<{
    key: ScoreItemKey
    label: string
    max: number
  }>
}

export const scoreSections: ScoreSection[] = [
  {
    key: 'grooming',
    title: '一、仪容仪表与言行举止',
    totalMax: 15,
    items: [
      { key: 'grooming_1', label: '着装整洁，符合面试场景', max: 6 },
      { key: 'grooming_2', label: '举止文明，姿态大方得体', max: 5 },
      { key: 'grooming_3', label: '神态从容，礼貌谦逊', max: 4 },
    ],
  },
  {
    key: 'expression',
    title: '二、语言表达能力',
    totalMax: 20,
    items: [
      { key: 'expression_1', label: '吐字清晰，语速适中', max: 7 },
      { key: 'expression_2', label: '表达有条理，逻辑清晰', max: 7 },
      { key: 'expression_3', label: '用语文明，沟通自然', max: 6 },
    ],
  },
  {
    key: 'fit',
    title: '三、认知与能力匹配',
    totalMax: 30,
    items: [
      { key: 'fit_1', label: '了解岗位/部门职责', max: 8 },
      { key: 'fit_2', label: '自身特长、技能贴合工作需求', max: 12 },
      { key: 'fit_3', label: '有相关经验，执行力较强', max: 10 },
    ],
  },
  {
    key: 'attitude',
    title: '四、思想态度与素养',
    totalMax: 20,
    items: [
      { key: 'attitude_1', label: '参选动机端正，态度诚恳', max: 7 },
      { key: 'attitude_2', label: '有责任心、集体观念与团队意识', max: 7 },
      { key: 'attitude_3', label: '积极上进，服从安排', max: 6 },
    ],
  },
  {
    key: 'performance',
    title: '五、临场应变与综合表现',
    totalMax: 15,
    items: [
      { key: 'performance_1', label: '审题准确，作答切题', max: 6 },
      { key: 'performance_2', label: '思考全面，见解合理', max: 5 },
      { key: 'performance_3', label: '心态稳定，临场发挥良好', max: 4 },
    ],
  },
]

export const scoreItemMaxMap = Object.fromEntries(
  scoreSections.flatMap((section) => section.items.map((item) => [item.key, item.max])),
) as Record<ScoreItemKey, number>

export const emptyScoreInput = (): ScoreInput =>
  Object.fromEntries(Object.keys(scoreItemMaxMap).map((key) => [key, 0])) as ScoreInput

export const validateScoreInput = (input: ScoreInput) => {
  for (const [key, max] of Object.entries(scoreItemMaxMap) as Array<[ScoreItemKey, number]>) {
    const value = input[key]
    if (!Number.isInteger(value) || value < 0 || value > max) {
      throw new Error(`${key} 超出允许分值范围`)
    }
  }
}

export const computeScoreBreakdown = (input: ScoreInput) => {
  validateScoreInput(input)

  const sectionTotals = Object.fromEntries(
    scoreSections.map((section) => [
      section.key,
      section.items.reduce((sum, item) => sum + input[item.key], 0),
    ]),
  ) as Record<SectionKey, number>

  const grandTotal = Object.values(sectionTotals).reduce((sum, value) => sum + value, 0)

  return {
    sectionTotals,
    grandTotal,
  }
}

export type RankingRow = {
  candidateId: number
  name: string
  intentType: IntentType
  departmentName: string
  judgeAverage: number | null
  memberAverage: number | null
  totalScore: number
  judgeCount: number
  memberCount: number
}

export const calculateWeightedTotal = (
  judgeAverage: number | null,
  memberAverage: number | null,
) => {
  if (judgeAverage == null && memberAverage == null) return 0
  if (judgeAverage != null && memberAverage == null) return judgeAverage
  if (judgeAverage == null && memberAverage != null) return memberAverage
  const safeJudgeAverage = judgeAverage ?? 0
  const safeMemberAverage = memberAverage ?? 0
  return safeJudgeAverage * 0.7 + safeMemberAverage * 0.3
}

export const roundScore = (value: number, decimals = 2) => {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export const applyCompetitionRanks = <T extends { totalScore: number; judgeAverage: number | null }>(
  rows: T[],
) => {
  let previousKey = ''
  let previousRank = 0

  return rows.map((row, index) => {
    const key = `${row.totalScore.toFixed(4)}:${(row.judgeAverage ?? -1).toFixed(4)}`
    const rank = key === previousKey ? previousRank : index + 1
    previousKey = key
    previousRank = rank
    return {
      ...row,
      rank,
    }
  })
}
