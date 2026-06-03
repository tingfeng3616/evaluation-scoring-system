import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, LogOut, Minus, Plus, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'

import { apiRequest, fetchAuthMe, logout, type AuthMeResponse } from '../lib/api'
import { buildFingerprint } from '../lib/fingerprint'
import {
  computeScoreBreakdown,
  emptyScoreInput,
  scoreItemMaxMap,
  scoreSections,
  type ScoreInput,
  type SectionKey,
} from '../shared/scoring'

type CandidateSummary = {
  id: number
  serialNo: number
  name: string
  departments: Array<{
    departmentName: string
    intentType: 'first' | 'second'
  }>
}

type CurrentScoreResponse = {
  candidate: CandidateSummary | null
  alreadyScored: boolean
  role: 'judge' | 'member'
  scorerName: string
}

const roleLabel = {
  judge: '评委',
  member: '部员',
}

const sectionShortLabel: Record<SectionKey, string> = {
  grooming: '仪容举止',
  expression: '语言表达',
  fit: '能力匹配',
  attitude: '思想态度',
  performance: '综合表现',
}

const buildScoreInputFromTotal = (total: number): ScoreInput => {
  const clampedTotal = Math.min(Math.max(Math.trunc(total), 0), 100)
  const entries = Object.entries(scoreItemMaxMap) as Array<[keyof ScoreInput, number]>
  const rawEntries = entries.map(([key, max]) => {
    const raw = (max * clampedTotal) / 100
    return {
      key,
      max,
      base: Math.floor(raw),
      fraction: raw - Math.floor(raw),
    }
  })
  const result = Object.fromEntries(rawEntries.map((entry) => [entry.key, entry.base])) as ScoreInput
  let remainder = clampedTotal - rawEntries.reduce((sum, entry) => sum + entry.base, 0)

  rawEntries
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((entry) => {
      if (remainder <= 0 || result[entry.key] >= entry.max) return
      result[entry.key] += 1
      remainder -= 1
    })

  return result
}

export function ScorePage() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState<AuthMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [passcode, setPasscode] = useState('')
  const [name, setName] = useState('')
  const [current, setCurrent] = useState<CurrentScoreResponse | null>(null)
  const [scores, setScores] = useState<ScoreInput>(emptyScoreInput)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [pendingCurrent, setPendingCurrent] = useState<CurrentScoreResponse | null>(null)
  const [quickScore, setQuickScore] = useState('')

  const breakdown = useMemo(() => computeScoreBreakdown(scores), [scores])
  const activeSection = scoreSections[activeSectionIndex] ?? scoreSections[0]
  const isLastSection = activeSectionIndex === scoreSections.length - 1

  const refreshAuth = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAuthMe()
      setAuth(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '认证状态加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshCurrent = useCallback(async () => {
    if (!auth || auth.kind !== 'scorer' || auth.needsBinding) return
    try {
      const result = await apiRequest<CurrentScoreResponse>('/api/score/current')
      setCurrent((previous) => {
        const previousCandidate = previous?.candidate
        const nextCandidate = result.candidate
        const shouldHoldPrevious =
          previousCandidate &&
          nextCandidate &&
          previousCandidate.id !== nextCandidate.id &&
          !previous.alreadyScored

        if (shouldHoldPrevious) {
          setPendingCurrent(result)
          setMessage(`管理员已切换到 #${nextCandidate.serialNo} ${nextCandidate.name}。当前候选人尚未提交，可先提交，也可放弃草稿切到下一位。`)
          return previous
        }

        setPendingCurrent(null)
        return result
      })
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '候选人信息加载失败')
    }
  }, [auth])

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  useEffect(() => {
    if (!auth || auth.kind !== 'scorer' || auth.needsBinding) return
    void refreshCurrent()
    const timer = window.setInterval(() => {
      void refreshCurrent()
    }, 12000)
    return () => window.clearInterval(timer)
  }, [auth, refreshCurrent])

  useEffect(() => {
    setScores(emptyScoreInput())
    setMessage(null)
    setPendingCurrent(null)
    setActiveSectionIndex(0)
  }, [current?.candidate?.id])

  const handleScoreLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    try {
      await apiRequest('/api/auth/scorer-login', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      })
      setPasscode('')
      await refreshAuth()
    } catch (caught) {
      try {
        await apiRequest('/api/auth/admin-login', {
          method: 'POST',
          body: JSON.stringify({ passcode }),
        })
        setPasscode('')
        await refreshAuth()
        navigate('/admin')
      } catch {
        setError(caught instanceof Error ? caught.message : '登录失败')
      }
    }
  }

  const handleBindName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await apiRequest('/api/auth/bind-name', {
        method: 'POST',
        body: JSON.stringify({
          name,
          fingerprint: buildFingerprint(),
        }),
      })
      setName('')
      await refreshAuth()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '绑定失败')
    }
  }

  const submitScorePayload = async (payload: ScoreInput) => {
    if (!current?.candidate) return

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      await apiRequest(`/api/score/candidate/${current.candidate.id}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (pendingCurrent) {
        setCurrent(pendingCurrent)
        setPendingCurrent(null)
        setMessage('上一位评分已提交，已切换到管理员当前候选人。')
      } else {
        setMessage('评分已提交，等待管理员切换下一位候选人。')
        await refreshCurrent()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '评分提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitScorePayload(scores)
  }

  const handleQuickSubmit = async () => {
    if (!current?.candidate || current.alreadyScored || submitting) return
    const trimmed = quickScore.trim()
    if (!/^\d+$/.test(trimmed)) {
      setError('快捷总分请输入 0 到 100 的整数')
      return
    }

    const total = Number(trimmed)
    if (!Number.isInteger(total) || total < 0 || total > 100) {
      setError('快捷总分请输入 0 到 100 的整数')
      return
    }

    const payload = buildScoreInputFromTotal(total)
    setScores(payload)
    await submitScorePayload(payload)
    setQuickScore('')
  }

  const handleLogout = async () => {
    await logout()
    setAuth(null)
    setCurrent(null)
    setPendingCurrent(null)
    setScores(emptyScoreInput())
    setQuickScore('')
    await refreshAuth()
  }

  const skipToPendingCandidate = () => {
    if (!pendingCurrent) return
    setCurrent(pendingCurrent)
    setPendingCurrent(null)
    setScores(emptyScoreInput())
    setQuickScore('')
    setActiveSectionIndex(0)
    setMessage('已放弃当前页面草稿，切换到管理员当前候选人。')
    setError(null)
  }

  const updateScore = (key: keyof ScoreInput, value: number, max: number) => {
    if (!current?.candidate || current.alreadyScored || submitting) return
    const nextValue = Math.min(Math.max(value, 0), max)
    setScores((prev) => ({ ...prev, [key]: nextValue }))
  }

  const fillActiveSection = () => {
    if (!current?.candidate || current.alreadyScored || submitting) return
    setScores((prev) => {
      const next = { ...prev }
      activeSection.items.forEach((item) => {
        next[item.key] = item.max
      })
      return next
    })
  }

  const clearActiveSection = () => {
    if (!current?.candidate || current.alreadyScored || submitting) return
    setScores((prev) => {
      const next = { ...prev }
      activeSection.items.forEach((item) => {
        next[item.key] = 0
      })
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-500 font-sans">
        <div className="mx-auto max-w-md px-4 pt-24 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm">
            正在检查评分端状态...
          </div>
        </div>
      </div>
    )
  }

  if (!auth || auth.kind === null) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-16">
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-teal-700 uppercase">评分端</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">面试评分页</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              评委和部员从这里进入系统。输入对应口令后，再填写姓名绑定当前设备即可开始评分。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">评委 / 部员</span>
              <span>使用各自统一口令登录</span>
            </div>

            <form className="space-y-4" onSubmit={handleScoreLogin}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">评分口令</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  type="password"
                  placeholder="请输入统一口令"
                />
              </div>
              <button
                className="flex h-12 w-full items-center justify-center rounded-xl border border-transparent bg-slate-900 px-4 text-base font-medium text-white shadow-sm transition hover:bg-slate-800"
                type="submit"
              >
                进入评分系统
              </button>
            </form>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  if (auth.kind === 'scorer' && auth.needsBinding) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-16">
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-teal-700 uppercase">评分端</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">绑定设备</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              首次进入需要输入本人真实姓名，只能填写 2 或 3 个汉字，不能使用网名、昵称、数字或字母。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-teal-700">
              <ShieldCheck size={18} />
              <span className="font-medium">当前身份：{roleLabel[auth.role]}</span>
            </div>

            <form className="space-y-4" onSubmit={handleBindName}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">姓名</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：张三"
                  maxLength={3}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  同一个真实姓名只能绑定一台设备；如填错或被占用，请联系管理员处理。
                  参加面试的候选人不能绑定评分端。
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-transparent bg-teal-700 px-4 text-base font-medium text-white shadow-sm transition hover:bg-teal-800"
                  type="submit"
                >
                  绑定并进入评分页
                </button>
                <button
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition hover:bg-slate-50"
                  type="button"
                  onClick={handleLogout}
                >
                  重新输入口令
                </button>
              </div>
            </form>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 font-sans relative">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 py-2.5 shadow-sm flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <UserRound size={16} />
            <span className="font-medium text-slate-700">{auth.kind === 'scorer' ? auth.name : ''}</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs ml-1">
              {auth.kind === 'scorer' ? roleLabel[auth.role] : ''}
            </span>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-1 hover:text-teal-700 transition-colors" type="button" onClick={() => void refreshCurrent()}>
              <RefreshCw size={14} />
              <span>刷新</span>
            </button>
            <button className="flex items-center gap-1 hover:text-red-600 transition-colors" type="button" onClick={handleLogout}>
              <LogOut size={14} />
              <span>退出</span>
            </button>
          </div>
        </div>
        
        {current?.candidate ? (
          <>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
              <h1 className="text-xl font-bold text-slate-900 truncate">
                <span className="text-slate-400 font-normal mr-1">#{current.candidate.serialNo}</span>
                {current.candidate.name}
              </h1>
              <div className="flex gap-1 overflow-x-auto pb-0.5 sm:shrink-0">
                {current.candidate.departments.map((department) => (
                  <span key={`${department.intentType}-${department.departmentName}`} className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 whitespace-nowrap">
                    {department.intentType === 'first' ? '一志愿' : '二志愿'}: {department.departmentName}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              {pendingCurrent?.candidate ? (
                <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800">
                  <div>
                    管理员已切换到 #{pendingCurrent.candidate.serialNo} {pendingCurrent.candidate.name}。
                    当前页面仍保留上一位评分，可先提交，也可直接切到下一位。
                  </div>
                  <button
                    type="button"
                    className="mt-2 h-8 rounded border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 active:bg-amber-100"
                    onClick={skipToPendingCandidate}
                  >
                    放弃当前草稿，切到下一位
                  </button>
                </div>
              ) : null}
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-500">
                  当前：<span className="text-slate-800">{sectionShortLabel[activeSection.key]}</span>
                  <span className="ml-1 tabular-nums">
                    {breakdown.sectionTotals[activeSection.key]}/{activeSection.totalMax}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-500">
                  总分 <span className="ml-1 text-lg font-bold text-teal-700 tabular-nums">{breakdown.grandTotal}</span>
                  <span className="text-slate-400">/100</span>
                </div>
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                {scoreSections.map((section, index) => {
                  const isActive = index === activeSectionIndex
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveSectionIndex(index)}
                      className={`min-w-[5.65rem] rounded-md border px-2 py-1.5 text-left transition-colors ${
                        isActive
                          ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 active:bg-slate-100'
                      }`}
                    >
                      <span className="block text-[11px] font-medium opacity-80">第 {index + 1} 项</span>
                      <span className="mt-0.5 block text-sm font-bold leading-4">{sectionShortLabel[section.key]}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold tabular-nums opacity-90">
                        {breakdown.sectionTotals[section.key]}/{section.totalMax}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  disabled={current.alreadyScored || submitting}
                  value={quickScore}
                  onChange={(event) => setQuickScore(event.target.value)}
                  placeholder="快捷总分 0-100"
                  className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
                <button
                  type="button"
                  disabled={current.alreadyScored || submitting || !quickScore.trim()}
                  onClick={() => void handleQuickSubmit()}
                  className="h-9 rounded-md border border-slate-900 bg-slate-900 px-3 text-sm font-semibold text-white active:bg-slate-800 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  一键评分
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                输入总分会按各项权重自动拆分明细并直接提交。
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center h-8 text-slate-500 text-sm">
            管理员还没有切到当前候选人
          </div>
        )}
      </header>

      <main className="flex-1 p-3 space-y-3 max-w-2xl mx-auto w-full">
        {current?.candidate ? (
          <form id="score-form" onSubmit={handleSubmit} className="space-y-3">
            <section>
              <div className="rounded-md border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-teal-700">第 {activeSectionIndex + 1} / {scoreSections.length} 项</p>
                      <h2 className="mt-0.5 text-lg font-bold text-slate-900">{activeSection.title}</h2>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-500">小计</p>
                      <p className="text-xl font-bold text-slate-900 tabular-nums">
                        {breakdown.sectionTotals[activeSection.key]}
                        <span className="text-sm font-medium text-slate-400">/{activeSection.totalMax}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={current.alreadyScored || submitting}
                      onClick={fillActiveSection}
                      className="h-9 rounded-md border border-teal-100 bg-teal-50 text-sm font-medium text-teal-700 active:bg-teal-100 disabled:opacity-50"
                    >
                      本项满分
                    </button>
                    <button
                      type="button"
                      disabled={current.alreadyScored || submitting}
                      onClick={clearActiveSection}
                      className="h-9 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-600 active:bg-slate-100 disabled:opacity-50"
                    >
                      本项清零
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {activeSection.items.map((item) => (
                    <div key={item.key} className="px-3 py-3.5">
                      <div className="mb-2.5 flex items-start justify-between gap-3">
                        <span className="text-base font-semibold leading-6 text-slate-900">{item.label}</span>
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-700 tabular-nums">
                          {scores[item.key]} / {item.max}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`${item.label} 减 1 分`}
                          disabled={current.alreadyScored || submitting || scores[item.key] <= 0}
                          onClick={() => updateScore(item.key, scores[item.key] - 1, item.max)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 active:bg-slate-100 disabled:opacity-40"
                        >
                          <Minus size={18} />
                        </button>

                        <input
                          type="range"
                          min={0}
                          max={item.max}
                          step={1}
                          disabled={current.alreadyScored || submitting}
                          value={scores[item.key]}
                          onChange={(event) => updateScore(item.key, Number(event.target.value), item.max)}
                          className="h-10 min-w-0 flex-1 accent-teal-700"
                        />

                        <button
                          type="button"
                          aria-label={`${item.label} 加 1 分`}
                          disabled={current.alreadyScored || submitting || scores[item.key] >= item.max}
                          onClick={() => updateScore(item.key, scores[item.key] + 1, item.max)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 active:bg-slate-100 disabled:opacity-40"
                        >
                          <Plus size={18} />
                        </button>
                      </div>

                      <div className="mt-1 flex justify-between text-xs text-slate-400 tabular-nums">
                        <span>0</span>
                        <span>{Math.floor(item.max / 2)}</span>
                        <span>{item.max}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </form>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 space-y-2 mt-12">
            <UserRound size={48} className="text-slate-200 mb-2" />
            <p>面试开始后</p>
            <p>系统会自动显示候选人评分表</p>
          </div>
        )}
      </main>

      {current?.candidate && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-20">
          <div className="max-w-2xl mx-auto">
            {(message || error || current?.alreadyScored) && (
              <div className="mb-1 min-h-[1.25rem]">
                {message && <p className="text-xs text-teal-700 text-center">{message}</p>}
                {error && <p className="text-xs text-red-600 text-center">{error}</p>}
                {current?.alreadyScored && !message && (
                  <p className="text-xs text-slate-500 text-center">已完成评分，等待管理员切换下一位候选人。</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-[3.25rem_1fr_3.25rem] gap-2">
              <button
                type="button"
                disabled={activeSectionIndex === 0}
                onClick={() => setActiveSectionIndex((index) => Math.max(index - 1, 0))}
                className="flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 active:bg-slate-100 disabled:opacity-40"
                aria-label="上一项"
              >
                <ChevronLeft size={20} />
              </button>
              {isLastSection ? (
                <button
                  form="score-form"
                  type="submit"
                  disabled={!current?.candidate || current.alreadyScored || submitting}
                  className="h-10 bg-slate-800 text-white rounded-md font-medium text-base flex justify-center items-center active:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {submitting ? '提交中...' : current.alreadyScored ? '已提交该候选人评分' : '确认并提交'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={current.alreadyScored || submitting}
                  onClick={() => setActiveSectionIndex((index) => Math.min(index + 1, scoreSections.length - 1))}
                  className="h-10 bg-slate-800 text-white rounded-md font-medium text-base flex justify-center items-center active:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  下一项
                </button>
              )}
              <button
                type="button"
                disabled={isLastSection}
                onClick={() => setActiveSectionIndex((index) => Math.min(index + 1, scoreSections.length - 1))}
                className="flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 active:bg-slate-100 disabled:opacity-40"
                aria-label="下一项"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
