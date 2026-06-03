import { useEffect, useState } from 'react'
import { Activity, Clock3 } from 'lucide-react'

import { apiRequest } from '../lib/api'

type CandidateDisplay = {
  id: number
  serialNo: number
  name: string
  departments: Array<{
    departmentName: string
    intentType: 'first' | 'second'
  }>
  judgeSubmitted: number
  memberSubmitted: number
  judgePending: number
  memberPending: number
  judgeTotal: number
  memberTotal: number
  latestLockedAt: string | null
  queuePosition: number
}

type DisplayResponse = {
  generatedAt: string
  totals: {
    candidates: number
    completedCandidates: number
    inProgressCandidates: number
    remainingCandidates: number
  }
  activeCandidate: CandidateDisplay | null
  previousCandidate: CandidateDisplay | null
}

const formatTime = (value: string | null) => {
  if (!value) return '--:--'
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DisplayPage() {
  const [data, setData] = useState<DisplayResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')

  const refresh = async () => {
    try {
      const response = await apiRequest<DisplayResponse>('/api/display')
      setData(response)
      setError(null)
      setLastUpdate(
        new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '展示页数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, 8000)

    return () => window.clearInterval(timer)
  }, [])

  const activeCandidate = data?.activeCandidate ?? null
  const previousCandidate = data?.previousCandidate ?? null

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-teal-500/30">
      {/* 顶部：系统标题 + 状态 */}
      <header className="flex items-center justify-between px-12 py-8 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-md border border-white/15 bg-white/10 text-3xl font-black text-white">
            IS
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-[0.1em] text-white">面试现场导视</h1>
            <p className="text-slate-400 mt-2 text-xl tracking-wider">面试评分现场</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-3 text-2xl font-medium tabular-nums text-white">
            <Activity size={28} className={loading ? "text-amber-400 animate-pulse" : "text-teal-400"} />
            {lastUpdate || '--:--:--'}
          </div>
          <div className="text-slate-400 text-lg mt-2 tracking-wider">系统自动同步</div>
        </div>
      </header>

      {/* 主体左右分栏 */}
      <main className="flex-1 grid grid-cols-[2.5fr_1fr] min-h-0 overflow-hidden">
        
        {/* 左侧区域：当前候选人为主 */}
        <section className="relative min-h-0 p-16 flex flex-col justify-center border-r border-white/10 bg-slate-900/30 overflow-hidden">
          {error && (
            <div className="absolute top-8 left-16 right-16 p-4 bg-red-950/50 border border-red-900 rounded-lg text-red-400 text-2xl text-center">
              {error}
            </div>
          )}

          {activeCandidate ? (
            <div className="w-full max-w-5xl mx-auto">
              <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-3xl font-medium mb-16 animate-pulse">
                <span className="w-4 h-4 rounded-full bg-teal-400"></span>
                正在面试
              </div>

              <div className="flex items-baseline gap-8 mb-12">
                <div className="text-8xl font-medium text-slate-500 tabular-nums">#{activeCandidate.serialNo}</div>
                <div className="text-[160px] font-bold text-white leading-none tracking-tight">
                  {activeCandidate.name}
                </div>
              </div>

              <div className="flex flex-wrap gap-5 mb-24">
                {activeCandidate.departments.map(d => (
                  <div key={`${d.intentType}-${d.departmentName}`} className="px-8 py-4 rounded border border-white/20 bg-white/5 text-4xl font-medium text-slate-200 tracking-wide">
                    {d.intentType === 'first' ? '一志愿' : '二志愿'} : {d.departmentName}
                  </div>
                ))}
              </div>

              {/* 仅展示已参评/未参评进度，绝不展示应到总人数 */}
              <div className="grid grid-cols-2 gap-10">
                
                {/* 评委进度块 */}
                <div className="p-10 rounded-2xl border border-white/10 bg-black/40">
                  <div className="text-3xl tracking-widest text-slate-400 font-medium mb-10 uppercase">评委组参评进度</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl text-slate-500 mb-4">已提交</div>
                      <div className="text-[100px] leading-none font-bold tabular-nums text-teal-400">{activeCandidate.judgeSubmitted}</div>
                    </div>
                    <div className="w-px h-32 bg-white/10"></div>
                    <div>
                      <div className="text-2xl text-slate-500 mb-4">待提交</div>
                      <div className={`text-[100px] leading-none font-bold tabular-nums ${activeCandidate.judgePending > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                        {activeCandidate.judgePending}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 部员进度块 */}
                <div className="p-10 rounded-2xl border border-white/10 bg-black/40">
                  <div className="text-3xl tracking-widest text-slate-400 font-medium mb-10 uppercase">部员组参评进度</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl text-slate-500 mb-4">已提交</div>
                      <div className="text-[100px] leading-none font-bold tabular-nums text-teal-400">{activeCandidate.memberSubmitted}</div>
                    </div>
                    <div className="w-px h-32 bg-white/10"></div>
                    <div>
                      <div className="text-2xl text-slate-500 mb-4">待提交</div>
                      <div className={`text-[100px] leading-none font-bold tabular-nums ${activeCandidate.memberPending > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                        {activeCandidate.memberPending}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full">
              <div className="text-[120px] font-bold tracking-tight text-white mb-8">等待开始</div>
              <div className="text-[120px] font-bold tracking-tight text-slate-400">下一位面试</div>
              <div className="text-4xl text-slate-500 mt-16 tracking-widest">请评委和部员做好准备</div>
            </div>
          )}
        </section>

        {/* 右侧：概览与上一位信息 */}
        <section className="min-h-0 flex flex-col overflow-hidden p-10 bg-black/30">
          
          {/* 总进度简报 */}
          <div className="shrink-0">
            <h3 className="text-2xl font-bold text-slate-600 mb-8 uppercase tracking-widest">总体进度简报</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="text-slate-500 text-lg mb-4 tracking-wider">总人数</div>
                <div className="text-6xl font-bold tabular-nums text-white">
                  {data?.totals.candidates ?? 0}
                </div>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="text-slate-500 text-lg mb-4 tracking-wider">已完成</div>
                <div className="text-6xl font-bold tabular-nums text-white">
                  {data?.totals.completedCandidates ?? 0}
                </div>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="text-slate-500 text-lg mb-4 tracking-wider">剩余</div>
                <div className="text-6xl font-bold tabular-nums text-white">
                  {data?.totals.remainingCandidates ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-white/10 my-10 shrink-0"></div>

          {/* 上一位候选人简报，视觉作大幅弱化 */}
          <div className="min-h-0 overflow-hidden opacity-60">
            <h3 className="text-2xl font-bold text-slate-600 mb-6 uppercase tracking-widest flex items-center gap-4">
              <Clock3 size={24} />
              上一位结束简报
            </h3>

            {previousCandidate ? (
              <div>
                <div className="text-4xl font-medium text-slate-300 mb-5 tabular-nums">
                  <span className="text-slate-600 mr-3">#{previousCandidate.serialNo}</span>
                  {previousCandidate.name}
                </div>
                
                <div className="flex flex-wrap gap-3 mb-6">
                  {previousCandidate.departments.map(d => (
                    <span key={d.intentType} className="px-4 py-2 bg-white/5 border border-white/10 rounded text-lg text-slate-400 tracking-wide">
                      {d.intentType === 'first' ? '一志愿' : '二志愿'} : {d.departmentName}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-6 text-center">
                  <div className="p-6 rounded-lg border border-white/5 bg-black/40">
                    <div className="text-slate-500 text-lg mb-2">评委已录入</div>
                    <div className="text-4xl font-bold text-slate-300 tabular-nums">{previousCandidate.judgeSubmitted}</div>
                  </div>
                  <div className="p-6 rounded-lg border border-white/5 bg-black/40">
                    <div className="text-slate-500 text-lg mb-2">部员已录入</div>
                    <div className="text-4xl font-bold text-slate-300 tabular-nums">{previousCandidate.memberSubmitted}</div>
                  </div>
                </div>

                <div className="mt-6 text-slate-500 text-xl text-right tracking-wider">
                  结束于 {formatTime(previousCandidate.latestLockedAt)}
                </div>
              </div>
            ) : (
              <div className="text-slate-600 text-2xl tracking-widest">暂无上一位候选人记录</div>
            )}
          </div>

        </section>
      </main>
    </div>
  )
}
