import { describe, expect, it } from 'vitest'

import {
  applyCompetitionRanks,
  calculateWeightedTotal,
  computeScoreBreakdown,
  emptyScoreInput,
} from './scoring'

describe('scoring helpers', () => {
  it('computes section totals and grand total', () => {
    const input = {
      ...emptyScoreInput(),
      grooming_1: 6,
      grooming_2: 5,
      grooming_3: 4,
      expression_1: 7,
      expression_2: 6,
      expression_3: 6,
      fit_1: 8,
      fit_2: 10,
      fit_3: 9,
      attitude_1: 7,
      attitude_2: 6,
      attitude_3: 6,
      performance_1: 5,
      performance_2: 4,
      performance_3: 4,
    }

    const result = computeScoreBreakdown(input)
    expect(result.sectionTotals.grooming).toBe(15)
    expect(result.sectionTotals.expression).toBe(19)
    expect(result.sectionTotals.fit).toBe(27)
    expect(result.sectionTotals.attitude).toBe(19)
    expect(result.sectionTotals.performance).toBe(13)
    expect(result.grandTotal).toBe(93)
  })

  it('normalizes total when one role average is missing', () => {
    expect(calculateWeightedTotal(90, 80)).toBe(87)
    expect(calculateWeightedTotal(90, null)).toBe(90)
    expect(calculateWeightedTotal(null, 80)).toBe(80)
    expect(calculateWeightedTotal(null, null)).toBe(0)
  })

  it('applies competition ranking on ties', () => {
    const ranked = applyCompetitionRanks([
      { name: 'A', totalScore: 95, judgeAverage: 95 },
      { name: 'B', totalScore: 92, judgeAverage: 91 },
      { name: 'C', totalScore: 92, judgeAverage: 91 },
      { name: 'D', totalScore: 90, judgeAverage: 89 },
    ])

    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 2, 4])
  })
})
