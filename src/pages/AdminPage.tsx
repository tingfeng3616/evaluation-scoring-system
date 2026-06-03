import { useEffect, useState } from 'react'
import { FileUp, LockKeyhole, RefreshCw, Users } from 'lucide-react'

import { apiRequest, fetchAuthMe, logout, type AuthMeResponse } from '../lib/api'

type ProgressCandidate = {
  id: number
  serialNo: number
  name: string
  departments: Array<{
    departmentName: string
    intentType: 'first' | 'second'
  }>
  judgeCount: number
  memberCount: number
  isLocked: boolean
  isActive: boolean
}

type ProgressResponse = {
  activeCandidateId: number | null
  candidates: ProgressCandidate[]
}

type BindingRow = {
  id: number
  name: string
  role: 'judge' | 'member'
  status: 'active' | 'unbound'
  deviceToken: string
  fingerprintHash: string | null
  boundAt: string
  lastSeenAt: string
  unboundAt: string | null
  isBlocked: boolean
  hasDuplicateName: boolean
  hasDuplicateFingerprint: boolean
}

export function AdminPage() {
  const [auth, setAuth] = useState<AuthMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [passcode, setPasscode] = useState('')
  const [progress, setProgress] = useState<ProgressResponse | null>(null)
  const [bindings, setBindings] = useState<BindingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const loadAuth = async () => {
    setLoading(true)
    try {
      const response = await fetchAuthMe()
      setAuth(response)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '后台认证失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDashboard = async () => {
    try {
      const [progressData, bindingsData] = await Promise.all([
        apiRequest<ProgressResponse>('/api/admin/progress'),
        apiRequest<{ bindings: BindingRow[] }>('/api/admin/bindings'),
      ])

      setProgress(progressData)
      setBindings(bindingsData.bindings)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '后台数据加载失败')
    }
  }

  useEffect(() => {
    void loadAuth()
  }, [])

  useEffect(() => {
    if (!auth || auth.kind !== 'admin') return
    void loadDashboard()
    const timer = window.setInterval(() => {
      void loadDashboard()
    }, 10000)
    return () => window.clearInterval(timer)
  }, [auth])

  const handleAdminLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      await apiRequest('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      })
      setPasscode('')
      await loadAuth()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '管理员登录失败')
    }
  }

  const handleImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return

    setError(null)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiRequest<{ importedCount: number }>('/api/admin/import-candidates', {
        method: 'POST',
        body: formData,
      })

      setMessage(`已导入 ${response.importedCount} 位候选人。`)
      setFile(null)
      await loadDashboard()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败')
    }
  }

  const setActiveCandidate = async (candidateId: number) => {
    setError(null)
    setMessage(null)
    try {
      await apiRequest('/api/admin/active-candidate', {
        method: 'PUT',
        body: JSON.stringify({ candidateId }),
      })
      setMessage('当前面试候选人已切换。上一位候选人评分已锁定。')
      await loadDashboard()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '切换候选人失败')
    }
  }

  const clearActiveCandidate = async () => {
    setError(null)
    setMessage(null)
    try {
      await apiRequest('/api/admin/active-candidate', {
        method: 'DELETE',
      })
      setMessage('已切换到等待开始状态。当前候选人的已提交评分已锁定。')
      await loadDashboard()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '切换等待状态失败')
    }
  }

  const unbindDevice = async (bindingId: number) => {
    setError(null)
    setMessage(null)
    try {
      await apiRequest('/api/admin/unbind-device', {
        method: 'POST',
        body: JSON.stringify({ bindingId }),
      })
      setMessage('设备已解绑，可以重新绑定姓名。')
      await loadDashboard()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '解绑失败')
    }
  }

  const blockDevice = async (bindingId: number) => {
    setError(null)
    setMessage(null)
    try {
      await apiRequest('/api/admin/block-device', {
        method: 'POST',
        body: JSON.stringify({ bindingId }),
      })
      setMessage('设备已封禁，后续将无法继续登录或评分。')
      await loadDashboard()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '封禁失败')
    }
  }

  const unblockDevice = async (bindingId: number) => {
    setError(null)
    setMessage(null)
    try {
      await apiRequest('/api/admin/unblock-device', {
        method: 'POST',
        body: JSON.stringify({ bindingId }),
      })
      setMessage('设备封禁已解除。')
      await loadDashboard()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '解除封禁失败')
    }
  }

  const handleLogout = async () => {
    await logout()
    setAuth(null)
    setProgress(null)
    setBindings([])
    await loadAuth()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-sans">
        正在检查后台登录状态...
      </div>
    )
  }

  if (!auth || auth.kind !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <p className="text-sm font-semibold text-teal-700 tracking-wider uppercase mb-1">Admin Interface</p>
            <h1 className="text-2xl font-bold text-slate-900">管理后台</h1>
            <p className="text-sm text-slate-500 mt-2">此页面只供管理员导入名单、切换当前候选人和处理设备绑定。</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleAdminLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">管理员口令</label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                type="password"
                placeholder="请输入管理员口令"
              />
            </div>
            <button
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors"
              type="submit"
            >
              进入后台
            </button>
          </form>
          {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
        </div>
      </div>
    )
  }

  const activeCandidate = progress?.candidates?.find(c => c.isActive);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans h-screen overflow-hidden">
      <header className="sticky top-0 z-10 bg-slate-900 text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium tracking-wide">面试管理控制台</h1>
          <span className="text-slate-500 text-sm">/ 面试室主控制</span>
        </div>
        <div className="flex gap-4 text-sm text-slate-300">
          <button className="hover:text-white flex items-center gap-1 transition-colors" onClick={() => void loadDashboard()}>
            <RefreshCw size={14} /> 刷新数据
          </button>
          <button className="hover:text-white flex items-center gap-1 transition-colors text-red-400 hover:text-red-300 ml-4" onClick={handleLogout}>
            <LockKeyhole size={14} /> 退出后台
          </button>
        </div>
      </header>

      {(message || error) && (
        <div className="px-6 pt-4 shrink-0">
          {message && <div className="p-3 bg-teal-50 text-teal-700 border border-teal-200 rounded text-sm">{message}</div>}
          {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{error}</div>}
        </div>
      )}

      <main className="flex-1 min-h-0 p-6 grid grid-cols-12 gap-6 items-stretch overflow-hidden">
        
        <section className="col-span-3 min-h-0 bg-white border border-slate-200 rounded-md h-full flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-slate-500" />
              候选人队列
            </h2>
          </div>
          
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <form className="flex flex-col gap-2" onSubmit={handleImport}>
              <label className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
                <FileUp size={14} />
                <span className="truncate">{file ? file.name : '选择 Excel 名单'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button 
                className="w-full py-1.5 bg-slate-200 text-slate-700 rounded text-sm font-medium hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
                type="submit" 
                disabled={!file}
              >
                开始导入
              </button>
            </form>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {progress?.candidates?.length ? (
              progress.candidates.map((candidate) => (
                <div 
                  key={candidate.id} 
                  className={`p-3 rounded border text-sm transition-colors ${
                    candidate.isActive 
                      ? 'bg-teal-50 border-teal-200 shadow-sm' 
                      : candidate.isLocked
                        ? 'bg-slate-50 border-slate-200 hover:border-slate-400 cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-teal-300 cursor-pointer'
                  }`}
                  onClick={() => {
                    const actionText = candidate.isLocked ? '回溯到' : '切换到'
                    if (!candidate.isActive && confirm(`确定要${actionText} #${candidate.serialNo} ${candidate.name} 吗？\n当前候选人的评分将被锁定。`)) {
                      void setActiveCandidate(candidate.id)
                    }
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium ${candidate.isActive ? 'text-teal-900' : candidate.isLocked ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-800'}`}>
                      #{candidate.serialNo} {candidate.name}
                    </span>
                    {candidate.isActive && <span className="text-[10px] bg-teal-600 text-white px-1.5 py-0.5 rounded font-medium animate-pulse">面试中</span>}
                    {candidate.isLocked && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">已锁分 / 可回溯</span>}
                    {!candidate.isActive && !candidate.isLocked && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">待面试</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {candidate.departments.map(d => d.departmentName).join(' / ')}
                  </div>
                  {candidate.isActive && (
                    <div className="text-xs text-teal-700 mt-2 font-medium">
                      评委评分 {candidate.judgeCount} 人 · 部员评分 {candidate.memberCount} 人
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                <p>暂无候选人</p>
                <p>请先导入名单</p>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-md p-8 text-center shadow-sm">
            <div className="text-slate-500 text-sm font-medium mb-3 tracking-widest uppercase">当前正在面试</div>
            
            {activeCandidate ? (
              <>
                <h2 className="text-5xl font-bold text-slate-900 mb-2 tracking-tight flex items-center justify-center">
                  <span className="text-3xl text-slate-400 font-normal mr-2">#{activeCandidate.serialNo}</span>
                  {activeCandidate.name}
                </h2>
                <div className="flex flex-wrap justify-center gap-2 mb-8 mt-4">
                  {activeCandidate.departments.map(d => (
                    <span key={d.intentType} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium border border-slate-200">
                      {d.intentType === 'first' ? '第一意向' : '第二意向'}: {d.departmentName}
                    </span>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded border border-slate-100">
                    <div className="text-2xl font-bold text-slate-800 tabular-nums">{activeCandidate.judgeCount}</div>
                    <div className="text-xs text-slate-500 mt-1">评委已提交</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded border border-slate-100">
                    <div className="text-2xl font-bold text-slate-800 tabular-nums">{activeCandidate.memberCount}</div>
                    <div className="text-xs text-slate-500 mt-1">部员已提交</div>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <button 
                    className="py-3 px-5 bg-white text-slate-700 rounded-md border border-slate-300 hover:bg-slate-50 font-medium transition-colors"
                    onClick={() => {
                      if (confirm(`确定要结束当前面试，并切换到等待开始状态吗？`)) {
                        void clearActiveCandidate();
                      }
                    }}
                  >
                    切换到等待开始
                  </button>
                  <button 
                    className="flex-1 py-3 bg-slate-800 text-white rounded-md hover:bg-slate-900 font-medium shadow-sm transition-colors"
                    onClick={() => {
                      const nextIndex = progress?.candidates?.findIndex(c => c.id === activeCandidate.id) ?? -1;
                      if (nextIndex !== -1 && nextIndex + 1 < (progress?.candidates?.length ?? 0)) {
                        const nextCandidate = progress!.candidates[nextIndex + 1];
                        if (confirm(`确定要结束当前面试，并切换到下一位: #${nextCandidate.serialNo} ${nextCandidate.name} 吗？`)) {
                          void setActiveCandidate(nextCandidate.id);
                        }
                      } else {
                        alert("已经是最后一位候选人了。");
                      }
                    }}
                  >
                    结束并切换下一位
                  </button>
                </div>
              </>
            ) : (
              <div className="py-12">
                <p className="text-slate-400 mb-4">没有正在进行的面试</p>
                <p className="text-sm text-slate-500">请在左侧列表中点击一位候选人开始面试，已锁分候选人也可以回溯切回。</p>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-5 min-h-0 bg-white border border-slate-200 rounded-md h-full flex flex-col overflow-hidden shadow-sm">
           <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-800">设备绑定管理</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">在线: {bindings.filter(b => b.status === 'active').length}</span>
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto p-0">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">姓名</th>
                  <th className="px-4 py-3">身份</th>
                  <th className="px-4 py-3">状态/异常</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bindings.length ? (
                  bindings.map((binding) => (
                    <tr key={binding.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {binding.name}
                        {binding.hasDuplicateName && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200" title="该姓名在多台设备上登录">
                            重名
                          </span>
                        )}
                        {binding.isBlocked && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-white border border-slate-800">
                            已封禁
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className={`px-2 py-0.5 rounded text-xs ${binding.role === 'judge' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {binding.role === 'judge' ? '评委' : '部员'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {binding.status === 'active' ? (
                          <div className="flex items-center gap-1.5 text-teal-600 text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                            活跃 ({new Date(binding.lastSeenAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                            {binding.hasDuplicateFingerprint && (
                              <span
                                className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 border border-rose-200"
                                title="检测到相同设备指纹在多个绑定中出现"
                              >
                                同机
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                            已解绑
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="text-red-600 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors p-1"
                            type="button"
                            disabled={binding.status !== 'active'}
                            onClick={() => {
                              if (confirm(`确定要解绑 ${binding.name} 吗？解绑后设备需重新输入姓名。`)) {
                                void unbindDevice(binding.id)
                              }
                            }}
                          >
                            强制解绑
                          </button>
                          {binding.isBlocked ? (
                            <button
                              className="text-sky-700 hover:text-sky-900 text-xs font-medium transition-colors p-1"
                              type="button"
                              onClick={() => {
                                if (confirm(`确定要解除 ${binding.name} 的设备封禁吗？`)) {
                                  void unblockDevice(binding.id)
                                }
                              }}
                            >
                              解除封禁
                            </button>
                          ) : (
                            <button
                              className="text-slate-700 hover:text-slate-900 text-xs font-medium transition-colors p-1"
                              type="button"
                              onClick={() => {
                                if (confirm(`确定要封禁 ${binding.name} 当前设备吗？封禁后该设备将无法继续登录或评分。`)) {
                                  void blockDevice(binding.id)
                                }
                              }}
                            >
                              封禁设备
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                        暂无设备绑定记录
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  )
}
