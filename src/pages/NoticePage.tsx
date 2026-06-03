import { AlertTriangle, CheckCircle2, Compass, Globe2, ShieldAlert, Smartphone, UserRound } from 'lucide-react'

const steps = [
  {
    title: '打开手机浏览器',
    detail: 'iPhone 请优先使用 Safari；安卓请优先使用系统浏览器或 Chrome，尽量不要使用微信内置浏览器。',
  },
  {
    title: '进入评分端网页',
    detail: '在地址栏输入你的部署域名，例如 your-domain.example/score，进入后按现场身份输入评委或部员口令。',
  },
  {
    title: '填写本人真实姓名',
    detail: '必须填写 2 或 3 个汉字的本人真实姓名，不得使用网名、昵称、数字、字母或他人姓名。',
  },
  {
    title: '等待当前候选人',
    detail: '管理员切换候选人后，评分端会自动刷新；未显示时可点击页面右上角刷新。',
  },
  {
    title: '逐项完成评分',
    detail: '按 5 个大项、15 个细项依次评分，每个大项完成后点击下一项。',
  },
  {
    title: '确认并提交',
    detail: '全部评分确认无误后提交。同一设备对同一候选人只能提交一次有效评分。',
  },
]

const systemRules = [
  '请使用本人手机完成评分，不要借用他人设备或代他人评分。',
  '参加本次面试的候选人不得进入评分端，不得参与任何候选人的评分。',
  '请优先使用手机自带浏览器或 Chrome 打开评分端，尽量不要使用微信内置浏览器。',
  '姓名绑定当前手机浏览器后，请不要频繁更换浏览器、清理缓存或切换设备。',
  '同一个真实姓名只能绑定一台设备；如填错姓名或姓名被占用，请联系现场管理员处理。',
  '系统会记录设备、浏览器和提交状态，用于防止重复评分和异常操作。',
  '使用网名、昵称、数字、字母、乱填姓名、冒用他人姓名等情况，管理员可封禁设备。',
  '设备被封禁或解绑后，该设备已提交的评分可能被标记为废弃，不再参与成绩计算。',
  '如出现填错姓名、无法进入、候选人未刷新等情况，请立即联系现场管理员。',
]

const scoreRules = [
  '请依据候选人现场表现独立评分，不要相互询问或讨论分数。',
  '评分提交前请认真核对，提交后等待管理员切换下一位候选人。',
  '候选人切换后，上一位候选人的评分会锁定，评分端无法自行回改。',
  '最终成绩由系统按评委平均分和部员平均分加权计算，各部门单独排名。',
]

export function NoticePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white font-sans">
      <div className="flex h-screen flex-col px-14 py-10">
        <header className="mb-8 flex items-start justify-between gap-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-2 text-teal-200">
              <Smartphone size={22} />
              <span className="text-lg font-semibold">面试评分系统使用说明</span>
            </div>
            <h1 className="text-6xl font-bold tracking-tight text-white">请使用本人手机完成评分</h1>
            <p className="mt-5 text-2xl leading-relaxed text-slate-300">
              进入评分端后，按身份输入口令，填写本人真实姓名，并根据当前候选人现场表现独立评分。
            </p>
          </div>

          <div className="shrink-0 rounded-md border border-white/10 bg-white/5 px-8 py-6 text-right">
            <p className="text-xl text-slate-300">评分端网址</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-teal-200">your-domain.example/score</p>
            <div className="mt-5 flex justify-end gap-3 text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-lg">
                <Globe2 size={20} />
                Safari
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-lg">
                <Compass size={20} />
                系统浏览器 / Chrome
              </span>
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-8">
          <section className="min-h-0 rounded-md border border-white/10 bg-white/[0.04] p-8">
            <div className="mb-6 flex items-center gap-3">
              <CheckCircle2 className="text-teal-300" size={30} />
              <h2 className="text-3xl font-bold">操作流程</h2>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-md border border-white/10 bg-slate-900/80 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-400 text-xl font-bold text-slate-950">
                      {index + 1}
                    </span>
                    <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                  </div>
                  <p className="text-lg leading-relaxed text-slate-300">{step.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[auto_1fr] gap-6">
            <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-6">
              <div className="mb-4 flex items-center gap-3 text-amber-200">
                <ShieldAlert size={30} />
                <h2 className="text-3xl font-bold">姓名与设备要求</h2>
              </div>
              <div className="flex items-start gap-4 rounded-md bg-slate-950/60 p-5">
                <UserRound className="mt-1 shrink-0 text-amber-200" size={30} />
                <p className="text-2xl font-semibold leading-relaxed text-white">
                  必须填写 2 或 3 个汉字的本人真实姓名。参加面试的候选人不得参与评分；使用网名、昵称、数字、字母、乱填姓名或冒用他人姓名，可能被管理员封禁设备，相关评分将作废。
                </p>
              </div>
            </div>

            <div className="grid min-h-0 grid-rows-2 gap-6">
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <AlertTriangle className="text-rose-300" size={28} />
                  <h2 className="text-3xl font-bold">系统注意事项</h2>
                </div>
                <ul className="space-y-3 text-lg leading-snug text-slate-300">
                  {systemRules.map((rule) => (
                    <li key={rule} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-300" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <CheckCircle2 className="text-teal-300" size={28} />
                  <h2 className="text-3xl font-bold">评分注意事项</h2>
                </div>
                <ul className="space-y-3 text-lg leading-snug text-slate-300">
                  {scoreRules.map((rule) => (
                    <li key={rule} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-300" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
