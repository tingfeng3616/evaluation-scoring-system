import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Search, Trash2, Trophy, X } from 'lucide-react'

import { apiRequest } from '../lib/api'
import { computeScoreBreakdown, scoreSections, type ScoreInput, type SectionKey } from '../shared/scoring'

type RankingRow = {
  rank: number
  candidateId: number
  name: string
  intentType: 'first' | 'second'
  departmentName: string
  judgeAverage: number | null
  memberAverage: number | null
  totalScore: number
  judgeCount: number
  memberCount: number
}

type RankingResponse = {
  department: string
  departments: string[]
  rows: RankingRow[]
}

type CandidateScoreDetail = {
  candidate: {
    id: number
    serialNo: number
    name: string
  }
  scores: Array<{
    id: number
    role: 'judge' | 'member'
    scorerName: string
    totals: Record<SectionKey, number> & {
      grand: number
    }
    items: ScoreInput
    createdAt: string
  }>
  summary: {
    judgeCount: number
    memberCount: number
  }
}

const roleLabel = {
  judge: '评委',
  member: '部员',
}

export function RankingPage() {
  const [department, setDepartment] = useState<string | null>(null)
  const [data, setData] = useState<RankingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [detail, setDetail] = useState<CandidateScoreDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedScores, setExpandedScores] = useState<Record<number, boolean>>({})
  const [editingScoreId, setEditingScoreId] = useState<number | null>(null)
  const [editingScores, setEditingScores] = useState<ScoreInput | null>(null)
  const [savingScore, setSavingScore] = useState(false)

  const refresh = async (nextDepartment?: string | null) => {
    setLoading(true)
    try {
      const response = await apiRequest<RankingResponse>(
        `/api/rankings${nextDepartment ? `?department=${encodeURIComponent(nextDepartment)}` : ''}`,
      )
      setData(response)
      setDepartment(response.department)
      setError(null)
      const now = new Date()
      setLastUpdate(now.toTimeString().split(' ')[0])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '榜单加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh(department)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [department])

  const openDetail = async (row: RankingRow) => {
    setDetailLoading(true)
    setError(null)
    setExpandedScores({})
    try {
      const response = await apiRequest<CandidateScoreDetail>(
        `/api/rankings/candidate-scores?candidateId=${row.candidateId}`,
      )
      setDetail(response)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '评分详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const reloadDetail = async (candidateId: number) => {
    const response = await apiRequest<CandidateScoreDetail>(
      `/api/rankings/candidate-scores?candidateId=${candidateId}`,
    )
    setDetail(response)
  }

  const startEditScore = (score: CandidateScoreDetail['scores'][number]) => {
    setEditingScoreId(score.id)
    setEditingScores({ ...score.items })
    setExpandedScores((prev) => ({ ...prev, [score.id]: true }))
  }

  const updateEditingScore = (key: keyof ScoreInput, value: number, max: number) => {
    setEditingScores((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [key]: Math.min(Math.max(value, 0), max),
      }
    })
  }

  const saveEditingScore = async () => {
    if (!detail || !editingScoreId || !editingScores) return

    setSavingScore(true)
    setError(null)
    try {
      await apiRequest(`/api/rankings/scores/${editingScoreId}`, {
        method: 'PUT',
        body: JSON.stringify(editingScores),
      })
      setEditingScoreId(null)
      setEditingScores(null)
      await reloadDetail(detail.candidate.id)
      await refresh(department)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '评分修改失败，请确认当前浏览器已登录管理员后台')
    } finally {
      setSavingScore(false)
    }
  }

  const deleteScore = async (scoreId: number, scorerName: string) => {
    if (!detail) return
    if (!confirm(`确定要删除 ${scorerName} 的这条评分吗？删除后将不再参与排名和均分。`)) return

    setSavingScore(true)
    setError(null)
    try {
      await apiRequest(`/api/rankings/scores/${scoreId}`, {
        method: 'DELETE',
      })
      setEditingScoreId(null)
      setEditingScores(null)
      await reloadDetail(detail.candidate.id)
      await refresh(department)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '评分删除失败，请确认当前浏览器已登录管理员后台')
    } finally {
      setSavingScore(false)
    }
  }

  const groupedDetailScores = {
    judge: detail?.scores.filter((score) => score.role === 'judge') ?? [],
    member: detail?.scores.filter((score) => score.role === 'member') ?? [],
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <header className="px-8 py-6 border-b border-slate-200 flex justify-between items-end bg-slate-50/50">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="text-slate-400" size={24} />
            <h1 className="text-3xl font-bold tracking-tight">
              {department || '全部部门'} 面试实时排名
            </h1>
          </div>
          <p className="text-slate-500 text-sm flex gap-3">
            <span>筛选条件：意向部门为当前部门</span>
            <span>·</span>
            <span>排序：总成绩降序</span>
          </p>
        </div>
        
        <div className="text-right flex flex-col items-end gap-3">
          <div className="text-sm text-slate-500 flex items-center gap-2">
            {loading ? <span className="w-2 h-2 bg-slate-300 rounded-full animate-pulse"></span> : <span className="w-2 h-2 bg-teal-500 rounded-full"></span>}
            最近更新: {lastUpdate || '--:--:--'}
          </div>
          
          {data?.departments?.length ? (
            <div className="flex bg-slate-200/50 p-1 rounded-md border border-slate-200">
              {data.departments.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                    item === department
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  onClick={() => void refresh(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <main className="p-8">
        {error ? <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded">{error}</div> : null}

        <div className="w-full border border-slate-200 rounded-md overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-16 text-center">名次</th>
                <th className="px-6 py-4">姓名</th>
                <th className="px-6 py-4">参评意向</th>
                <th className="px-6 py-4 text-right">评委均分</th>
                <th className="px-6 py-4 text-right">部员均分</th>
                <th className="px-6 py-4 text-right">评分人数 (评委/部员)</th>
                <th className="px-6 py-4 text-right text-slate-900 font-bold">总成绩</th>
                <th className="px-6 py-4 text-right">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
              {data?.rows?.length ? (
                data.rows.map((row, index) => {
                  const isTop3 = index < 3;
                  const bgClass = isTop3 ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50';
                  const rankClass = isTop3 ? 'font-bold text-slate-900' : 'text-slate-500';
                  
                  return (
                    <tr key={`${row.candidateId}-${row.intentType}`} className={`transition-colors ${bgClass}`}>
                      <td className={`px-6 py-4 text-center tabular-nums ${rankClass}`}>{row.rank}</td>
                      <td className={`px-6 py-4 font-medium ${isTop3 ? 'text-slate-900' : 'text-slate-700'}`}>{row.name}</td>
                      <td className="px-6 py-4">{row.intentType === 'first' ? '第一意向' : '第二意向'}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{row.judgeAverage?.toFixed(2) ?? '-'}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{row.memberAverage?.toFixed(2) ?? '-'}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{row.judgeCount} / {row.memberCount}</td>
                      <td className={`px-6 py-4 text-right tabular-nums ${isTop3 ? 'font-bold text-teal-700 text-base' : 'font-medium text-slate-900'}`}>
                        {row.totalScore.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                          onClick={() => void openDetail(row)}
                        >
                          <Search size={14} />
                          详情
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-500 bg-slate-50/50">
                    <p className="text-lg mb-1 font-medium text-slate-700">还没有可展示的数据</p>
                    <p className="text-sm">先在后台导入名单，并开始采集评分。</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6">
          <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-medium text-teal-700">评分详情</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {detail ? `#${detail.candidate.serialNo} ${detail.candidate.name}` : '正在加载...'}
                </h2>
                {detail ? (
                  <p className="mt-2 text-sm text-slate-500">
                    有效评分：评委 {detail.summary.judgeCount} 人，部员 {detail.summary.memberCount} 人
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setDetail(null)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-6">
              {detailLoading && !detail ? (
                <div className="py-20 text-center text-slate-500">正在加载评分详情...</div>
              ) : detail ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  {(['judge', 'member'] as const).map((role) => (
                    <section key={role} className="rounded-md border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <h3 className="text-lg font-bold text-slate-900">{roleLabel[role]}评分</h3>
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {groupedDetailScores[role].length} 人
                        </span>
                      </div>

                      {groupedDetailScores[role].length ? (
                        <div className="divide-y divide-slate-100">
                          {groupedDetailScores[role].map((score) => {
                            const isExpanded = Boolean(expandedScores[score.id])
                            const isEditing = editingScoreId === score.id && editingScores
                            const displayedItems = isEditing ? editingScores : score.items
                            const displayedBreakdown = isEditing ? computeScoreBreakdown(editingScores) : null
                            return (
                              <div key={score.id} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-base font-bold text-slate-900">{score.scorerName}</p>
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                                        {new Date(score.createdAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-5 gap-2">
                                      {scoreSections.map((section) => (
                                        <div key={section.key} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
                                          <p className="truncate text-[11px] text-slate-500">{section.title.replace(/^[一二三四五]、/, '')}</p>
                                          <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                                            {(displayedBreakdown?.sectionTotals[section.key] ?? score.totals[section.key])}/{section.totalMax}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-xs text-slate-500">总分</p>
                                    <p className="text-3xl font-bold tabular-nums text-teal-700">
                                      {displayedBreakdown?.grandTotal ?? score.totals.grand}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-teal-700"
                                    onClick={() =>
                                      setExpandedScores((prev) => ({
                                        ...prev,
                                        [score.id]: !isExpanded,
                                      }))
                                    }
                                  >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {isExpanded ? '收起细项' : '查看 15 个细项'}
                                  </button>
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 disabled:opacity-50"
                                        disabled={savingScore}
                                        onClick={() => void saveEditingScore()}
                                      >
                                        保存修改
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-50"
                                        disabled={savingScore}
                                        onClick={() => {
                                          setEditingScoreId(null)
                                          setEditingScores(null)
                                        }}
                                      >
                                        取消
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
                                        disabled={savingScore}
                                        onClick={() => startEditScore(score)}
                                        title="需要先在当前浏览器登录管理员后台"
                                      >
                                        <Pencil size={13} />
                                        修改
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        disabled={savingScore}
                                        onClick={() => void deleteScore(score.id, score.scorerName)}
                                        title="需要先在当前浏览器登录管理员后台"
                                      >
                                        <Trash2 size={13} />
                                        删除
                                      </button>
                                    </>
                                  )}
                                </div>

                                {isExpanded ? (
                                  <div className="mt-3 grid gap-3">
                                    {scoreSections.map((section) => (
                                      <div key={section.key} className="rounded border border-slate-200">
                                        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                          {section.title}
                                        </div>
                                        <div className="grid grid-cols-3 divide-x divide-slate-100">
                                          {section.items.map((item) => (
                                            <div key={item.key} className="p-3">
                                              <p className="min-h-10 text-xs leading-5 text-slate-500">{item.label}</p>
                                              {isEditing ? (
                                                <div className="mt-2 flex items-center gap-2">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    max={item.max}
                                                    value={displayedItems[item.key]}
                                                    onChange={(event) =>
                                                      updateEditingScore(item.key, Number(event.target.value), item.max)
                                                    }
                                                    className="h-9 w-16 rounded border border-slate-300 px-2 text-base font-bold tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                  />
                                                  <span className="text-sm font-medium text-slate-400">/ {item.max}</span>
                                                </div>
                                              ) : (
                                                <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">
                                                  {displayedItems[item.key]} <span className="text-sm font-medium text-slate-400">/ {item.max}</span>
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="px-4 py-12 text-center text-sm text-slate-500">暂无{roleLabel[role]}提交评分</div>
                      )}
                    </section>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
