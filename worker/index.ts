import { zValidator } from '@hono/zod-validator'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as XLSX from 'xlsx'

import {
  activeCandidateSchema,
  bindNameSchema,
  blockDeviceSchema,
  passcodePayloadSchema,
  scoreSubmissionSchema,
  unbindDeviceSchema,
} from '../src/shared/contracts'
import {
  applyCompetitionRanks,
  calculateWeightedTotal,
  computeScoreBreakdown,
  roundScore,
  type IntentType,
  type RankingRow,
  type Role,
  type ScoreInput,
} from '../src/shared/scoring'

type AppEnv = {
  Bindings: {
    ASSETS: {
      fetch: (request: Request) => Promise<Response>
    }
    DB: D1Database
    APP_SECRET?: string
    ADMIN_PASSCODE?: string
    JUDGE_PASSCODE?: string
    MEMBER_PASSCODE?: string
  }
}

type SessionPayload =
  | {
      type: 'admin'
      issuedAt: number
    }
  | {
      type: 'scorer'
      role: Role
      deviceToken: string
      issuedAt: number
    }

type CandidateSummary = {
  id: number
  serialNo: number
  name: string
  departments: Array<{
    departmentName: string
    intentType: IntentType
  }>
}

type BindingRecord = {
  id: number
  name: string
  role: Role
  device_token: string
  fingerprint_hash: string | null
  status: 'active' | 'unbound'
  bound_at: string
  last_seen_at: string
  unbound_at: string | null
}

const app = new Hono<AppEnv>()
type ApiContext = Context<AppEnv>

const ADMIN_COOKIE = 'interview_admin'
const SCORER_COOKIE = 'interview_scorer'
const DEVICE_COOKIE = 'interview_device'
const blockedTokenKey = (deviceToken: string) => `blocked_device_token:${deviceToken}`

const jsonError = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

const nowIso = () => new Date().toISOString()

const getSecret = (env: AppEnv['Bindings']) => env.APP_SECRET ?? 'dev-only-secret'

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

const sha256 = async (value: string) =>
  toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))

const getBlockedDeviceRecord = async (
  db: D1Database,
  deviceToken: string,
) =>
  db
    .prepare(
      `
        SELECT key, value
        FROM system_settings
        WHERE key = ?
        LIMIT 1
      `,
    )
    .bind(blockedTokenKey(deviceToken))
    .first<{ key: string; value: string }>()

const ensureDeviceNotBlocked = async (
  db: D1Database,
  deviceToken: string,
) => {
  const blocked = await getBlockedDeviceRecord(db, deviceToken)
  if (!blocked) return

  throw new HTTPException(403, {
    message: '该设备已被管理员封禁，无法继续登录或评分，请联系现场管理员处理',
  })
}

const bytesToBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const stringToBase64Url = (value: string) => bytesToBase64Url(new TextEncoder().encode(value))

const base64UrlToString = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return atob(padded)
}

const signValue = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(signature))
}

const createSignedToken = async (payload: SessionPayload, secret: string) => {
  const encodedPayload = stringToBase64Url(JSON.stringify(payload))
  const signature = await signValue(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

const readSignedToken = async (token: string, secret: string): Promise<SessionPayload | null> => {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null
  const expected = await signValue(encodedPayload, secret)
  if (expected !== signature) return null
  return JSON.parse(base64UrlToString(encodedPayload)) as SessionPayload
}

const getIpAddress = (request: Request) =>
  request.headers.get('cf-connecting-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown'

const getCookieFromRequest = (request: Request, key: string) => {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return undefined

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`))
    ?.slice(key.length + 1)
}

const buildCandidateSummaries = (
  rows: Array<{
    id: number
    serial_no: number
    name: string
    department_name: string
    intent_type: IntentType
  }>,
) => {
  const grouped = new Map<number, CandidateSummary>()

  for (const row of rows) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        serialNo: row.serial_no,
        name: row.name,
        departments: [],
      })
    }

    grouped.get(row.id)?.departments.push({
      departmentName: row.department_name,
      intentType: row.intent_type,
    })
  }

  return Array.from(grouped.values()).sort((left, right) => left.serialNo - right.serialNo)
}

const fetchCandidates = async (db: D1Database) => {
  const result = await db
    .prepare(
      `
        SELECT
          c.id,
          c.serial_no,
          c.name,
          cd.department_name,
          cd.intent_type
        FROM candidates c
        LEFT JOIN candidate_departments cd ON cd.candidate_id = c.id
        ORDER BY c.serial_no ASC, cd.intent_type ASC
      `,
    )
    .all<{
      id: number
      serial_no: number
      name: string
      department_name: string
      intent_type: IntentType
    }>()

  return buildCandidateSummaries(result.results.filter((row) => row.department_name))
}

const fetchCandidateById = async (db: D1Database, candidateId: number) => {
  const result = await db
    .prepare(
      `
        SELECT
          c.id,
          c.serial_no,
          c.name,
          cd.department_name,
          cd.intent_type
        FROM candidates c
        LEFT JOIN candidate_departments cd ON cd.candidate_id = c.id
        WHERE c.id = ?
        ORDER BY cd.intent_type ASC
      `,
    )
    .bind(candidateId)
    .all<{
      id: number
      serial_no: number
      name: string
      department_name: string
      intent_type: IntentType
    }>()

  const grouped = buildCandidateSummaries(result.results.filter((row) => row.department_name))
  return grouped[0] ?? null
}

const fetchActiveCandidate = async (db: D1Database) => {
  const activeRow = await db
    .prepare(`SELECT candidate_id FROM active_candidate WHERE id = 1`)
    .first<{ candidate_id: number }>()

  if (!activeRow) return null
  return fetchCandidateById(db, activeRow.candidate_id)
}

const fetchDepartments = async (db: D1Database) => {
  const result = await db
    .prepare(
      `SELECT DISTINCT department_name FROM candidate_departments ORDER BY department_name COLLATE NOCASE ASC`,
    )
    .all<{ department_name: string }>()

  return result.results.map((row) => row.department_name)
}

const fetchActiveBindingCounts = async (db: D1Database) => {
  const result = await db
    .prepare(
      `
        SELECT
          SUM(CASE WHEN role = 'judge' AND status = 'active' THEN 1 ELSE 0 END) AS judge_total,
          SUM(CASE WHEN role = 'member' AND status = 'active' THEN 1 ELSE 0 END) AS member_total
        FROM device_bindings
      `,
    )
    .first<{
      judge_total: number | null
      member_total: number | null
    }>()

  return {
    judgeTotal: Number(result?.judge_total ?? 0),
    memberTotal: Number(result?.member_total ?? 0),
  }
}

const fetchCandidateParticipationCounts = async (db: D1Database, candidateId: number) => {
  const result = await db
    .prepare(
      `
        SELECT
          SUM(CASE WHEN role = 'judge' THEN 1 ELSE 0 END) AS judge_submitted,
          SUM(CASE WHEN role = 'member' THEN 1 ELSE 0 END) AS member_submitted,
          MAX(locked_at) AS latest_locked_at
        FROM scores
        WHERE candidate_id = ?
          AND discarded_at IS NULL
      `,
    )
    .bind(candidateId)
    .first<{
      judge_submitted: number | null
      member_submitted: number | null
      latest_locked_at: string | null
    }>()

  return {
    judgeSubmitted: Number(result?.judge_submitted ?? 0),
    memberSubmitted: Number(result?.member_submitted ?? 0),
    latestLockedAt: result?.latest_locked_at ?? null,
  }
}

const fetchLatestLockedCandidateId = async (db: D1Database) => {
  const result = await db
    .prepare(
      `
        SELECT candidate_id, MAX(locked_at) AS latest_locked_at
        FROM scores
        WHERE locked_at IS NOT NULL
          AND discarded_at IS NULL
        GROUP BY candidate_id
        ORDER BY latest_locked_at DESC
        LIMIT 1
      `,
    )
    .first<{ candidate_id: number }>()

  return result?.candidate_id ?? null
}

const fetchCandidatePosition = async (db: D1Database, candidateId: number) => {
  const result = await db
    .prepare(
      `
        SELECT position
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY serial_no ASC, id ASC) AS position
          FROM candidates
        )
        WHERE id = ?
      `,
    )
    .bind(candidateId)
    .first<{ position: number }>()

  return Number(result?.position ?? 0)
}

const buildParticipationSummary = async (
  db: D1Database,
  candidate: CandidateSummary | null,
  bindingCounts: { judgeTotal: number; memberTotal: number },
) => {
  if (!candidate) return null

  const counts = await fetchCandidateParticipationCounts(db, candidate.id)

  return {
    ...candidate,
    judgeSubmitted: counts.judgeSubmitted,
    memberSubmitted: counts.memberSubmitted,
    judgePending: Math.max(bindingCounts.judgeTotal - counts.judgeSubmitted, 0),
    memberPending: Math.max(bindingCounts.memberTotal - counts.memberSubmitted, 0),
    judgeTotal: bindingCounts.judgeTotal,
    memberTotal: bindingCounts.memberTotal,
    latestLockedAt: counts.latestLockedAt,
    queuePosition: await fetchCandidatePosition(db, candidate.id),
  }
}

const logAudit = async (
  db: D1Database,
  actionType: string,
  actorRole: string | null,
  actorName: string | null,
  metadata: Record<string, unknown> = {},
) => {
  await db
    .prepare(
      `INSERT INTO audit_logs (action_type, actor_role, actor_name, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(actionType, actorRole, actorName, JSON.stringify(metadata), nowIso())
    .run()
}

const getPasscodeHash = async (
  db: D1Database,
  settingKey: string,
  fallbackValue: string | undefined,
) => {
  const row = await db.prepare(`SELECT value FROM system_settings WHERE key = ?`).bind(settingKey).first<{ value: string }>()
  if (row?.value) return row.value
  if (!fallbackValue) return null
  return sha256(fallbackValue)
}

const resolveRoleFromPasscode = async (db: D1Database, env: AppEnv['Bindings'], passcode: string) => {
  const incomingHash = await sha256(passcode)
  const judgeHash = await getPasscodeHash(db, 'judge_passcode_hash', env.JUDGE_PASSCODE)
  const memberHash = await getPasscodeHash(db, 'member_passcode_hash', env.MEMBER_PASSCODE)

  if (judgeHash && incomingHash === judgeHash) return 'judge' as const
  if (memberHash && incomingHash === memberHash) return 'member' as const
  return null
}

const validateAdminPasscode = async (db: D1Database, env: AppEnv['Bindings'], passcode: string) => {
  const incomingHash = await sha256(passcode)
  const adminHash = await getPasscodeHash(db, 'admin_passcode_hash', env.ADMIN_PASSCODE)
  return adminHash ? incomingHash === adminHash : false
}

const ensureDeviceToken = (request: Request) =>
  getCookieFromRequest(request, DEVICE_COOKIE) ?? crypto.randomUUID()

const readScorerSession = async (request: Request, env: AppEnv['Bindings']) => {
  const token = getCookieFromRequest(request, SCORER_COOKIE)
  if (!token) return null
  const payload = await readSignedToken(token, getSecret(env))
  if (!payload || payload.type !== 'scorer') return null
  return payload
}

const readAdminSession = async (request: Request, env: AppEnv['Bindings']) => {
  const token = getCookieFromRequest(request, ADMIN_COOKIE)
  if (!token) return null
  const payload = await readSignedToken(token, getSecret(env))
  if (!payload || payload.type !== 'admin') return null
  return payload
}

const getBindingByDevice = async (db: D1Database, deviceToken: string) =>
  db
    .prepare(
      `
        SELECT
          id,
          name,
          role,
          device_token,
          fingerprint_hash,
          status,
          bound_at,
          last_seen_at,
          unbound_at
        FROM device_bindings
        WHERE device_token = ?
      `,
    )
    .bind(deviceToken)
    .first<BindingRecord>()

const parseScorePayload = (value: Record<string, number>): ScoreInput => value as ScoreInput

const compareNumbersDescending = (left: number | null, right: number | null) => (right ?? -1) - (left ?? -1)

const scorePayloadToSqlParams = (input: ScoreInput, breakdown: ReturnType<typeof computeScoreBreakdown>) => [
  input.grooming_1,
  input.grooming_2,
  input.grooming_3,
  input.expression_1,
  input.expression_2,
  input.expression_3,
  input.fit_1,
  input.fit_2,
  input.fit_3,
  input.attitude_1,
  input.attitude_2,
  input.attitude_3,
  input.performance_1,
  input.performance_2,
  input.performance_3,
  breakdown.sectionTotals.grooming,
  breakdown.sectionTotals.expression,
  breakdown.sectionTotals.fit,
  breakdown.sectionTotals.attitude,
  breakdown.sectionTotals.performance,
  breakdown.grandTotal,
]

const getScorerContext = async (c: ApiContext) => {
  const session = await readScorerSession(c.req.raw, c.env)
  if (!session) throw new HTTPException(401, { message: '请先输入评分口令' })

  const deviceToken = getCookie(c, DEVICE_COOKIE)
  if (!deviceToken || deviceToken !== session.deviceToken) {
    throw new HTTPException(401, { message: '设备身份失效，请重新登录' })
  }

  const binding = await getBindingByDevice(c.env.DB, deviceToken)
  await ensureDeviceNotBlocked(c.env.DB, deviceToken)
  return {
    session,
    deviceToken,
    binding,
  }
}

const requireBoundScorer = async (c: ApiContext) => {
  const scorerContext = await getScorerContext(c)
  if (!scorerContext.binding || scorerContext.binding.status !== 'active') {
    throw new HTTPException(403, { message: '请先绑定姓名' })
  }
  if (scorerContext.binding.role !== scorerContext.session.role) {
    throw new HTTPException(403, { message: '当前设备绑定的身份与口令不一致' })
  }
  if (await isCandidateName(c.env.DB, scorerContext.binding.name)) {
    throw new HTTPException(403, { message: '参加面试的候选人不能参与评分，请联系现场管理员处理' })
  }

  await c.env.DB
    .prepare(`UPDATE device_bindings SET last_seen_at = ?, last_ip = ? WHERE id = ?`)
    .bind(nowIso(), getIpAddress(c.req.raw), scorerContext.binding.id)
    .run()

  return scorerContext as typeof scorerContext & { binding: BindingRecord }
}

const requireAdmin = async (c: ApiContext) => {
  const session = await readAdminSession(c.req.raw, c.env)
  if (!session) throw new HTTPException(401, { message: '请先输入管理员口令' })
  return session
}

const discardScoresForBinding = async (db: D1Database, bindingId: number, reason: string) => {
  const discardedAt = nowIso()
  const result = await db
    .prepare(
      `
        UPDATE scores
        SET discarded_at = ?,
            discard_reason = ?
        WHERE binding_id = ?
          AND discarded_at IS NULL
      `,
    )
    .bind(discardedAt, reason, bindingId)
    .run()

  return Number(result.meta.changes ?? 0)
}

const isCandidateName = async (db: D1Database, name: string) => {
  const row = await db
    .prepare(`SELECT id FROM candidates WHERE name = ? LIMIT 1`)
    .bind(name)
    .first<{ id: number }>()

  return Boolean(row)
}

app.onError((error) => {
  if (error instanceof HTTPException) {
    return jsonError(error.message, error.status)
  }

  console.error(error)
  return jsonError('服务器开了个小差，请稍后再试', 500)
})

app.get('/api/health', (c) => c.json({ ok: true, time: nowIso() }))

app.get('/api/auth/me', async (c) => {
  const adminSession = await readAdminSession(c.req.raw, c.env)
  if (adminSession) {
    return c.json({
      kind: 'admin',
      authenticated: true,
    })
  }

  const scorerSession = await readScorerSession(c.req.raw, c.env)
  if (!scorerSession) {
    return c.json({
      kind: null,
      authenticated: false,
    })
  }

  const binding = await getBindingByDevice(c.env.DB, scorerSession.deviceToken)
  await ensureDeviceNotBlocked(c.env.DB, scorerSession.deviceToken)
  return c.json({
    kind: 'scorer',
    authenticated: true,
    role: scorerSession.role,
    name: binding?.status === 'active' ? binding.name : null,
    needsBinding: !binding || binding.status !== 'active',
  })
})

app.post('/api/auth/scorer-login', zValidator('json', passcodePayloadSchema), async (c) => {
  const { passcode } = c.req.valid('json')
  const role = await resolveRoleFromPasscode(c.env.DB, c.env, passcode)

  if (!role) {
    throw new HTTPException(401, { message: '口令不正确' })
  }

  const deviceToken = ensureDeviceToken(c.req.raw)
  await ensureDeviceNotBlocked(c.env.DB, deviceToken)
  const existingBinding = await getBindingByDevice(c.env.DB, deviceToken)
  if (existingBinding && existingBinding.status === 'active' && existingBinding.role !== role) {
    throw new HTTPException(409, { message: '该设备已绑定其他身份，请先让管理员解绑' })
  }

  const scorerToken = await createSignedToken(
    { type: 'scorer', role, deviceToken, issuedAt: Date.now() },
    getSecret(c.env),
  )

  setCookie(c, DEVICE_COOKIE, deviceToken, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: c.req.url.startsWith('https://'),
    maxAge: 60 * 60 * 24 * 30,
  })
  setCookie(c, SCORER_COOKIE, scorerToken, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: c.req.url.startsWith('https://'),
    maxAge: 60 * 60 * 24 * 7,
  })
  deleteCookie(c, ADMIN_COOKIE, { path: '/' })

  await logAudit(c.env.DB, 'scorer_login', role, existingBinding?.name ?? null, {
    deviceToken,
    hasBinding: Boolean(existingBinding && existingBinding.status === 'active'),
  })

  return c.json({
    role,
    needsBinding: !existingBinding || existingBinding.status !== 'active',
    name: existingBinding?.status === 'active' ? existingBinding.name : null,
  })
})

app.post('/api/auth/bind-name', async (c) => {
  const payload = await c.req.json().catch(() => null)
  const parsed = bindNameSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((issue) => issue.message).join('；') || '提交内容不合法', 400)
  }

  const { name, fingerprint } = parsed.data
  const { session, deviceToken, binding } = await getScorerContext(c)

  if (binding && binding.status === 'active') {
    if (await isCandidateName(c.env.DB, binding.name)) {
      throw new HTTPException(403, { message: '参加面试的候选人不能参与评分，请联系现场管理员处理' })
    }
    if (binding.name !== name || binding.role !== session.role) {
      throw new HTTPException(409, { message: '该设备已经绑定过姓名，请联系管理员解绑' })
    }

    return c.json({
      ok: true,
      role: binding.role,
      name: binding.name,
    })
  }

  if (await isCandidateName(c.env.DB, name)) {
    await logAudit(c.env.DB, 'bind_name_candidate_blocked', session.role, name, {
      deviceToken,
    })

    throw new HTTPException(409, {
      message: '参加面试的候选人不能参与评分，请填写评分人员本人姓名',
    })
  }

  const fingerprintHash = fingerprint ? await sha256(fingerprint) : null
  const ipAddress = getIpAddress(c.req.raw)
  const userAgent = c.req.header('user-agent') ?? ''
  await ensureDeviceNotBlocked(c.env.DB, deviceToken)

  const existingNameBinding = await c.env.DB
    .prepare(
      `
        SELECT id, role
        FROM device_bindings
        WHERE name = ?
          AND status = 'active'
          AND (? IS NULL OR id != ?)
        LIMIT 1
      `,
    )
    .bind(name, binding?.id ?? null, binding?.id ?? null)
    .first<{ id: number; role: Role }>()

  if (existingNameBinding) {
    await logAudit(c.env.DB, 'bind_name_duplicate_name_blocked', session.role, name, {
      deviceToken,
      existingBindingId: existingNameBinding.id,
      existingRole: existingNameBinding.role,
    })

    throw new HTTPException(409, {
      message: '该姓名已被其他设备绑定，请填写本人真实姓名；如确为本人，请联系管理员处理',
    })
  }

  if (fingerprintHash) {
    const existingFingerprintBinding = await c.env.DB
      .prepare(
        `
          SELECT id, name, role, bound_at, last_seen_at
          FROM device_bindings
          WHERE fingerprint_hash = ?
            AND status = 'active'
          LIMIT 1
        `,
      )
      .bind(fingerprintHash)
      .first<{ id: number; name: string; role: Role; bound_at: string; last_seen_at: string }>()

    if (existingFingerprintBinding) {
      await logAudit(
        c.env.DB,
        'bind_name_duplicate_device_warning',
        session.role,
        name,
        {
          deviceToken,
          existingBindingId: existingFingerprintBinding.id,
          existingName: existingFingerprintBinding.name,
          existingRole: existingFingerprintBinding.role,
          existingLastSeenAt: existingFingerprintBinding.last_seen_at,
        },
      )
    }
  }

  const boundAt = nowIso()

  if (binding && binding.status === 'unbound') {
    await c.env.DB
      .prepare(
        `
          UPDATE device_bindings
          SET
            name = ?,
            role = ?,
            fingerprint_hash = ?,
            user_agent = ?,
            last_ip = ?,
            bound_at = ?,
            last_seen_at = ?,
            unbound_at = NULL,
            status = 'active'
          WHERE id = ?
        `,
      )
      .bind(name, session.role, fingerprintHash, userAgent, ipAddress, boundAt, boundAt, binding.id)
      .run()
  } else {
    await c.env.DB
      .prepare(
        `
          INSERT INTO device_bindings (
            name,
            role,
            device_token,
            fingerprint_hash,
            user_agent,
            first_ip,
            last_ip,
            bound_at,
            last_seen_at,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `,
      )
      .bind(name, session.role, deviceToken, fingerprintHash, userAgent, ipAddress, ipAddress, boundAt, boundAt)
      .run()
  }

  const duplicateCount = await c.env.DB
    .prepare(
      `SELECT COUNT(*) as count FROM device_bindings WHERE name = ? AND role = ? AND status = 'active'`,
    )
    .bind(name, session.role)
    .first<{ count: number }>()

  await logAudit(c.env.DB, 'bind_name', session.role, name, {
    deviceToken,
    duplicateActiveBindings: duplicateCount?.count ?? 1,
  })

  return c.json({
    ok: true,
    role: session.role,
    name,
    duplicateActiveBindings: duplicateCount?.count ?? 1,
  })
})

app.post('/api/auth/admin-login', zValidator('json', passcodePayloadSchema), async (c) => {
  const { passcode } = c.req.valid('json')
  const isValid = await validateAdminPasscode(c.env.DB, c.env, passcode)
  if (!isValid) {
    throw new HTTPException(401, { message: '管理员口令不正确' })
  }

  const token = await createSignedToken({ type: 'admin', issuedAt: Date.now() }, getSecret(c.env))
  setCookie(c, ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: c.req.url.startsWith('https://'),
    maxAge: 60 * 60 * 12,
  })

  await logAudit(c.env.DB, 'admin_login', 'admin', '管理员', {})

  return c.json({ ok: true })
})

app.post('/api/auth/logout', async (c) => {
  deleteCookie(c, ADMIN_COOKIE, { path: '/' })
  deleteCookie(c, SCORER_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

app.get('/api/score/current', async (c) => {
  const { session, binding } = await requireBoundScorer(c)
  const candidate = await fetchActiveCandidate(c.env.DB)
  if (!candidate) {
    return c.json({
      candidate: null,
      alreadyScored: false,
      role: session.role,
      scorerName: binding.name,
    })
  }

  const scoredRow = await c.env.DB
    .prepare(`SELECT id FROM scores WHERE candidate_id = ? AND binding_id = ? AND discarded_at IS NULL`)
    .bind(candidate.id, binding.id)
    .first<{ id: number }>()

  return c.json({
    candidate,
    alreadyScored: Boolean(scoredRow),
    role: session.role,
    scorerName: binding.name,
  })
})

const submitScoreForCandidate = async (c: ApiContext, candidateId: number, payload: ScoreInput) => {
  const { session, binding } = await requireBoundScorer(c)
  const candidate = await fetchCandidateById(c.env.DB, candidateId)

  if (!candidate) {
    throw new HTTPException(404, { message: '候选人不存在' })
  }

  const existingScore = await c.env.DB
    .prepare(`SELECT id, discarded_at FROM scores WHERE candidate_id = ? AND binding_id = ?`)
    .bind(candidate.id, binding.id)
    .first<{ id: number; discarded_at: string | null }>()

  if (existingScore && !existingScore.discarded_at) {
    throw new HTTPException(409, { message: '你已经给当前候选人提交过评分了' })
  }

  const breakdown = computeScoreBreakdown(payload)
  const scoreParams = scorePayloadToSqlParams(payload, breakdown)
  const submittedAt = nowIso()
  const activeCandidate = await fetchActiveCandidate(c.env.DB)
  const lockedAt = activeCandidate?.id === candidate.id ? null : submittedAt

  if (existingScore?.discarded_at) {
    await c.env.DB
      .prepare(
        `
          UPDATE scores
          SET
            role = ?,
            grooming_1 = ?,
            grooming_2 = ?,
            grooming_3 = ?,
            expression_1 = ?,
            expression_2 = ?,
            expression_3 = ?,
            fit_1 = ?,
            fit_2 = ?,
            fit_3 = ?,
            attitude_1 = ?,
            attitude_2 = ?,
            attitude_3 = ?,
            performance_1 = ?,
            performance_2 = ?,
            performance_3 = ?,
            grooming_total = ?,
            expression_total = ?,
            fit_total = ?,
            attitude_total = ?,
            performance_total = ?,
            grand_total = ?,
            locked_at = ?,
            discarded_at = NULL,
            discard_reason = NULL,
            created_at = ?
          WHERE id = ?
        `,
      )
      .bind(session.role, ...scoreParams, lockedAt, submittedAt, existingScore.id)
      .run()
  } else {
    await c.env.DB
      .prepare(
        `
          INSERT INTO scores (
            candidate_id,
            binding_id,
            role,
            grooming_1,
            grooming_2,
            grooming_3,
            expression_1,
            expression_2,
            expression_3,
            fit_1,
            fit_2,
            fit_3,
            attitude_1,
            attitude_2,
            attitude_3,
            performance_1,
            performance_2,
            performance_3,
            grooming_total,
            expression_total,
            fit_total,
            attitude_total,
            performance_total,
            grand_total,
            locked_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(candidate.id, binding.id, session.role, ...scoreParams, lockedAt, submittedAt)
      .run()
  }

  await logAudit(c.env.DB, 'score_submit', session.role, binding.name, {
    candidateId: candidate.id,
    grandTotal: breakdown.grandTotal,
  })

  return c.json({
    ok: true,
    grandTotal: breakdown.grandTotal,
    sectionTotals: breakdown.sectionTotals,
  })
}

app.post('/api/score/current', zValidator('json', scoreSubmissionSchema), async (c) => {
  const candidate = await fetchActiveCandidate(c.env.DB)

  if (!candidate) {
    throw new HTTPException(409, { message: '当前还没有设置正在面试的候选人' })
  }

  return submitScoreForCandidate(c, candidate.id, parseScorePayload(c.req.valid('json')))
})

app.post('/api/score/candidate/:candidateId', zValidator('json', scoreSubmissionSchema), async (c) => {
  const candidateId = Number(c.req.param('candidateId'))
  if (!Number.isInteger(candidateId) || candidateId <= 0) {
    throw new HTTPException(400, { message: '候选人参数不正确' })
  }

  return submitScoreForCandidate(c, candidateId, parseScorePayload(c.req.valid('json')))
})

app.get('/api/rankings/departments', async (c) => {
  const departments = await fetchDepartments(c.env.DB)
  return c.json({ departments })
})

app.get('/api/rankings', async (c) => {
  const departments = await fetchDepartments(c.env.DB)
  if (departments.length === 0) {
    return c.json({
      department: '',
      departments: [],
      rows: [],
    })
  }

  const requestedDepartment = c.req.query('department') ?? departments[0]
  const department = departments.includes(requestedDepartment) ? requestedDepartment : departments[0]

  const result = await c.env.DB
    .prepare(
      `
        SELECT
          c.id AS candidate_id,
          c.serial_no,
          c.name,
          cd.intent_type,
          cd.department_name,
          AVG(CASE WHEN s.role = 'judge' THEN s.grand_total END) AS judge_average,
          AVG(CASE WHEN s.role = 'member' THEN s.grand_total END) AS member_average,
          SUM(CASE WHEN s.role = 'judge' THEN 1 ELSE 0 END) AS judge_count,
          SUM(CASE WHEN s.role = 'member' THEN 1 ELSE 0 END) AS member_count
        FROM candidate_departments cd
        INNER JOIN candidates c ON c.id = cd.candidate_id
        LEFT JOIN scores s ON s.candidate_id = c.id
          AND s.discarded_at IS NULL
        WHERE cd.department_name = ?
        GROUP BY c.id, c.serial_no, c.name, cd.intent_type, cd.department_name
      `,
    )
    .bind(department)
    .all<{
      candidate_id: number
      serial_no: number
      name: string
      intent_type: IntentType
      department_name: string
      judge_average: number | null
      member_average: number | null
      judge_count: number
      member_count: number
    }>()

  const rankedRows = applyCompetitionRanks(
    result.results
      .map<RankingRow>((row) => ({
        candidateId: row.candidate_id,
        name: row.name,
        intentType: row.intent_type,
        departmentName: row.department_name,
        judgeAverage: row.judge_average == null ? null : roundScore(row.judge_average),
        memberAverage: row.member_average == null ? null : roundScore(row.member_average),
        totalScore: roundScore(calculateWeightedTotal(row.judge_average, row.member_average)),
        judgeCount: Number(row.judge_count ?? 0),
        memberCount: Number(row.member_count ?? 0),
      }))
      .sort((left, right) => {
        if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore
        if ((right.judgeAverage ?? -1) !== (left.judgeAverage ?? -1)) {
          return compareNumbersDescending(left.judgeAverage, right.judgeAverage)
        }
        return left.candidateId - right.candidateId
      }),
  )

  return c.json({
    department,
    departments,
    rows: rankedRows,
  })
})

app.get('/api/rankings/candidate-scores', async (c) => {
  const candidateId = Number(c.req.query('candidateId'))

  if (!Number.isInteger(candidateId) || candidateId <= 0) {
    throw new HTTPException(400, { message: '候选人参数不正确' })
  }

  const candidate = await fetchCandidateById(c.env.DB, candidateId)
  if (!candidate) {
    throw new HTTPException(404, { message: '候选人不存在' })
  }

  const result = await c.env.DB
    .prepare(
      `
        SELECT
          s.id,
          s.role,
          db.name AS scorer_name,
          s.grooming_1,
          s.grooming_2,
          s.grooming_3,
          s.expression_1,
          s.expression_2,
          s.expression_3,
          s.fit_1,
          s.fit_2,
          s.fit_3,
          s.attitude_1,
          s.attitude_2,
          s.attitude_3,
          s.performance_1,
          s.performance_2,
          s.performance_3,
          s.grooming_total,
          s.expression_total,
          s.fit_total,
          s.attitude_total,
          s.performance_total,
          s.grand_total,
          s.created_at
        FROM scores s
        INNER JOIN device_bindings db ON db.id = s.binding_id
        WHERE s.candidate_id = ?
          AND s.discarded_at IS NULL
        ORDER BY
          CASE s.role WHEN 'judge' THEN 0 ELSE 1 END,
          s.created_at ASC,
          s.id ASC
      `,
    )
    .bind(candidateId)
    .all<{
      id: number
      role: Role
      scorer_name: string
      grooming_1: number
      grooming_2: number
      grooming_3: number
      expression_1: number
      expression_2: number
      expression_3: number
      fit_1: number
      fit_2: number
      fit_3: number
      attitude_1: number
      attitude_2: number
      attitude_3: number
      performance_1: number
      performance_2: number
      performance_3: number
      grooming_total: number
      expression_total: number
      fit_total: number
      attitude_total: number
      performance_total: number
      grand_total: number
      created_at: string
    }>()

  const scores = result.results.map((row) => ({
    id: row.id,
    role: row.role,
    scorerName: row.scorer_name,
    totals: {
      grooming: row.grooming_total,
      expression: row.expression_total,
      fit: row.fit_total,
      attitude: row.attitude_total,
      performance: row.performance_total,
      grand: row.grand_total,
    },
    items: {
      grooming_1: row.grooming_1,
      grooming_2: row.grooming_2,
      grooming_3: row.grooming_3,
      expression_1: row.expression_1,
      expression_2: row.expression_2,
      expression_3: row.expression_3,
      fit_1: row.fit_1,
      fit_2: row.fit_2,
      fit_3: row.fit_3,
      attitude_1: row.attitude_1,
      attitude_2: row.attitude_2,
      attitude_3: row.attitude_3,
      performance_1: row.performance_1,
      performance_2: row.performance_2,
      performance_3: row.performance_3,
    },
    createdAt: row.created_at,
  }))

  return c.json({
    candidate,
    scores,
    summary: {
      judgeCount: scores.filter((score) => score.role === 'judge').length,
      memberCount: scores.filter((score) => score.role === 'member').length,
    },
  })
})

app.put('/api/rankings/scores/:scoreId', zValidator('json', scoreSubmissionSchema), async (c) => {
  await requireAdmin(c)

  const scoreId = Number(c.req.param('scoreId'))
  if (!Number.isInteger(scoreId) || scoreId <= 0) {
    throw new HTTPException(400, { message: '评分参数不正确' })
  }

  const score = await c.env.DB
    .prepare(
      `
        SELECT id, candidate_id, binding_id, role, grand_total, discarded_at
        FROM scores
        WHERE id = ?
      `,
    )
    .bind(scoreId)
    .first<{
      id: number
      candidate_id: number
      binding_id: number
      role: Role
      grand_total: number
      discarded_at: string | null
    }>()

  if (!score || score.discarded_at) {
    throw new HTTPException(404, { message: '有效评分记录不存在' })
  }

  const payload = parseScorePayload(c.req.valid('json'))
  const breakdown = computeScoreBreakdown(payload)
  const scoreParams = scorePayloadToSqlParams(payload, breakdown)

  await c.env.DB
    .prepare(
      `
        UPDATE scores
        SET
          grooming_1 = ?,
          grooming_2 = ?,
          grooming_3 = ?,
          expression_1 = ?,
          expression_2 = ?,
          expression_3 = ?,
          fit_1 = ?,
          fit_2 = ?,
          fit_3 = ?,
          attitude_1 = ?,
          attitude_2 = ?,
          attitude_3 = ?,
          performance_1 = ?,
          performance_2 = ?,
          performance_3 = ?,
          grooming_total = ?,
          expression_total = ?,
          fit_total = ?,
          attitude_total = ?,
          performance_total = ?,
          grand_total = ?
        WHERE id = ?
      `,
    )
    .bind(...scoreParams, scoreId)
    .run()

  await logAudit(c.env.DB, 'ranking_score_update', 'admin', '管理员', {
    scoreId,
    candidateId: score.candidate_id,
    bindingId: score.binding_id,
    role: score.role,
    previousGrandTotal: score.grand_total,
    nextGrandTotal: breakdown.grandTotal,
  })

  return c.json({
    ok: true,
    grandTotal: breakdown.grandTotal,
    sectionTotals: breakdown.sectionTotals,
  })
})

app.delete('/api/rankings/scores/:scoreId', async (c) => {
  await requireAdmin(c)

  const scoreId = Number(c.req.param('scoreId'))
  if (!Number.isInteger(scoreId) || scoreId <= 0) {
    throw new HTTPException(400, { message: '评分参数不正确' })
  }

  const score = await c.env.DB
    .prepare(
      `
        SELECT id, candidate_id, binding_id, role, grand_total, discarded_at
        FROM scores
        WHERE id = ?
      `,
    )
    .bind(scoreId)
    .first<{
      id: number
      candidate_id: number
      binding_id: number
      role: Role
      grand_total: number
      discarded_at: string | null
    }>()

  if (!score || score.discarded_at) {
    throw new HTTPException(404, { message: '有效评分记录不存在' })
  }

  await c.env.DB
    .prepare(
      `
        UPDATE scores
        SET discarded_at = ?,
            discard_reason = 'ranking_manual_delete'
        WHERE id = ?
          AND discarded_at IS NULL
      `,
    )
    .bind(nowIso(), scoreId)
    .run()

  await logAudit(c.env.DB, 'ranking_score_delete', 'admin', '管理员', {
    scoreId,
    candidateId: score.candidate_id,
    bindingId: score.binding_id,
    role: score.role,
    grandTotal: score.grand_total,
  })

  return c.json({ ok: true })
})

app.get('/api/display', async (c) => {
  const [bindingCounts, activeCandidate, latestLockedCandidateId, totalCandidatesRow, completedCandidatesRow] =
    await Promise.all([
      fetchActiveBindingCounts(c.env.DB),
      fetchActiveCandidate(c.env.DB),
      fetchLatestLockedCandidateId(c.env.DB),
      c.env.DB.prepare(`SELECT COUNT(*) AS count FROM candidates`).first<{ count: number }>(),
      c.env.DB
        .prepare(
          `SELECT COUNT(DISTINCT candidate_id) AS count FROM scores WHERE locked_at IS NOT NULL AND discarded_at IS NULL`,
        )
        .first<{ count: number }>(),
    ])

  const previousCandidateBase =
    latestLockedCandidateId && latestLockedCandidateId !== activeCandidate?.id
      ? await fetchCandidateById(c.env.DB, latestLockedCandidateId)
      : null

  const [activeSummary, previousSummary] = await Promise.all([
    buildParticipationSummary(c.env.DB, activeCandidate, bindingCounts),
    buildParticipationSummary(c.env.DB, previousCandidateBase, bindingCounts),
  ])

  const totalCandidates = Number(totalCandidatesRow?.count ?? 0)
  const completedCandidates = Number(completedCandidatesRow?.count ?? 0)
  const inProgressCount = activeSummary ? 1 : 0

  return c.json({
    generatedAt: nowIso(),
    totals: {
      candidates: totalCandidates,
      completedCandidates,
      inProgressCandidates: inProgressCount,
      remainingCandidates: Math.max(totalCandidates - completedCandidates - inProgressCount, 0),
    },
    activeCandidate: activeSummary,
    previousCandidate: previousSummary,
  })
})

app.post('/api/admin/import-candidates', async (c) => {
  await requireAdmin(c)

  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: '请上传 Excel 文件' })
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    blankrows: false,
  })

  const candidates = rows
    .slice(2)
    .map((row) => ({
      serialNo: Number(row[0]),
      name: String(row[1] ?? '').trim(),
      firstDepartment: String(row[2] ?? '').trim(),
      secondDepartment: String(row[3] ?? '').trim(),
    }))
    .filter((row) => Number.isFinite(row.serialNo) && row.name && row.firstDepartment)

  await c.env.DB.exec(`
    DELETE FROM scores;
    DELETE FROM candidate_departments;
    DELETE FROM active_candidate;
    DELETE FROM candidates;
  `)

  for (const candidate of candidates) {
    const insertCandidate = await c.env.DB
      .prepare(`INSERT INTO candidates (serial_no, name, created_at) VALUES (?, ?, ?)`)
      .bind(candidate.serialNo, candidate.name, nowIso())
      .run()

    const candidateId = Number(insertCandidate.meta.last_row_id)

    await c.env.DB
      .prepare(
        `INSERT INTO candidate_departments (candidate_id, department_name, intent_type, created_at) VALUES (?, ?, 'first', ?)`,
      )
      .bind(candidateId, candidate.firstDepartment, nowIso())
      .run()

    if (candidate.secondDepartment && candidate.secondDepartment !== '无') {
      await c.env.DB
        .prepare(
          `INSERT INTO candidate_departments (candidate_id, department_name, intent_type, created_at) VALUES (?, ?, 'second', ?)`,
        )
        .bind(candidateId, candidate.secondDepartment, nowIso())
        .run()
    }
  }

  await logAudit(c.env.DB, 'import_candidates', 'admin', '管理员', {
    count: candidates.length,
    fileName: file.name,
  })

  return c.json({
    ok: true,
    importedCount: candidates.length,
  })
})

app.put('/api/admin/active-candidate', zValidator('json', activeCandidateSchema), async (c) => {
  await requireAdmin(c)

  const { candidateId } = c.req.valid('json')
  const existing = await c.env.DB
    .prepare(`SELECT candidate_id FROM active_candidate WHERE id = 1`)
    .first<{ candidate_id: number }>()

  const candidate = await fetchCandidateById(c.env.DB, candidateId)
  if (!candidate) {
    throw new HTTPException(404, { message: '候选人不存在' })
  }

  if (existing?.candidate_id === candidateId) {
    return c.json({ ok: true, candidate })
  }

  if (existing?.candidate_id) {
    await c.env.DB
      .prepare(
        `UPDATE scores SET locked_at = ? WHERE candidate_id = ? AND locked_at IS NULL AND discarded_at IS NULL`,
      )
      .bind(nowIso(), existing.candidate_id)
      .run()
  }

  await c.env.DB
    .prepare(
      `
        INSERT INTO active_candidate (id, candidate_id, activated_at, activated_by)
        VALUES (1, ?, ?, '管理员')
        ON CONFLICT(id) DO UPDATE SET
          candidate_id = excluded.candidate_id,
          activated_at = excluded.activated_at,
          activated_by = excluded.activated_by
      `,
    )
    .bind(candidateId, nowIso())
    .run()

  await logAudit(c.env.DB, 'set_active_candidate', 'admin', '管理员', {
    previousCandidateId: existing?.candidate_id ?? null,
    candidateId,
  })

  return c.json({ ok: true, candidate })
})

app.delete('/api/admin/active-candidate', async (c) => {
  await requireAdmin(c)

  const existing = await c.env.DB
    .prepare(`SELECT candidate_id FROM active_candidate WHERE id = 1`)
    .first<{ candidate_id: number }>()

  if (!existing?.candidate_id) {
    return c.json({ ok: true })
  }

  await c.env.DB
    .prepare(`UPDATE scores SET locked_at = ? WHERE candidate_id = ? AND locked_at IS NULL AND discarded_at IS NULL`)
    .bind(nowIso(), existing.candidate_id)
    .run()

  await c.env.DB.prepare(`DELETE FROM active_candidate WHERE id = 1`).run()

  await logAudit(c.env.DB, 'clear_active_candidate', 'admin', '管理员', {
    candidateId: existing.candidate_id,
  })

  return c.json({ ok: true })
})

app.get('/api/admin/progress', async (c) => {
  await requireAdmin(c)

  const candidates = await fetchCandidates(c.env.DB)
  const counts = await c.env.DB
    .prepare(
      `
        SELECT
          candidate_id,
          SUM(CASE WHEN role = 'judge' THEN 1 ELSE 0 END) AS judge_count,
          SUM(CASE WHEN role = 'member' THEN 1 ELSE 0 END) AS member_count,
          MAX(CASE WHEN locked_at IS NOT NULL THEN 1 ELSE 0 END) AS is_locked
        FROM scores
        WHERE discarded_at IS NULL
        GROUP BY candidate_id
      `,
    )
    .all<{
      candidate_id: number
      judge_count: number
      member_count: number
      is_locked: number
    }>()

  const active = await c.env.DB
    .prepare(`SELECT candidate_id FROM active_candidate WHERE id = 1`)
    .first<{ candidate_id: number }>()

  const countMap = new Map(
    counts.results.map((row) => [
      row.candidate_id,
      {
        judgeCount: Number(row.judge_count ?? 0),
        memberCount: Number(row.member_count ?? 0),
        isLocked: Boolean(row.is_locked),
      },
    ]),
  )

  return c.json({
    activeCandidateId: active?.candidate_id ?? null,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      judgeCount: countMap.get(candidate.id)?.judgeCount ?? 0,
      memberCount: countMap.get(candidate.id)?.memberCount ?? 0,
      isLocked: countMap.get(candidate.id)?.isLocked ?? false,
      isActive: active?.candidate_id === candidate.id,
    })),
  })
})

app.get('/api/admin/bindings', async (c) => {
  await requireAdmin(c)

  const result = await c.env.DB
    .prepare(
      `
        SELECT
          db.id,
          db.name,
          db.role,
          db.status,
          db.device_token,
          db.fingerprint_hash,
          db.bound_at,
          db.last_seen_at,
          db.unbound_at,
          EXISTS (
            SELECT 1
            FROM system_settings ss
            WHERE ss.key = 'blocked_device_token:' || db.device_token
          ) AS is_blocked,
          (
            SELECT COUNT(*)
            FROM device_bindings dup
            WHERE dup.name = db.name
              AND dup.role = db.role
              AND dup.status = 'active'
          ) AS duplicate_count,
          (
            SELECT COUNT(*)
            FROM device_bindings dup_fp
            WHERE dup_fp.fingerprint_hash = db.fingerprint_hash
              AND dup_fp.status = 'active'
              AND db.fingerprint_hash IS NOT NULL
          ) AS duplicate_fingerprint_count
        FROM device_bindings db
        ORDER BY db.bound_at DESC
      `,
    )
    .all<{
      id: number
      name: string
      role: Role
      status: 'active' | 'unbound'
      device_token: string
      fingerprint_hash: string | null
      bound_at: string
      last_seen_at: string
      unbound_at: string | null
      is_blocked: number
      duplicate_count: number
      duplicate_fingerprint_count: number
    }>()

  return c.json({
    bindings: result.results.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      status: row.status,
      deviceToken: row.device_token,
      fingerprintHash: row.fingerprint_hash,
      boundAt: row.bound_at,
      lastSeenAt: row.last_seen_at,
      unboundAt: row.unbound_at,
      isBlocked: Boolean(row.is_blocked),
      hasDuplicateName: Number(row.duplicate_count) > 1,
      hasDuplicateFingerprint: Number(row.duplicate_fingerprint_count) > 1,
    })),
  })
})

app.post('/api/admin/unbind-device', zValidator('json', unbindDeviceSchema), async (c) => {
  await requireAdmin(c)

  const { bindingId } = c.req.valid('json')
  const binding = await c.env.DB
    .prepare(`SELECT id, name, role FROM device_bindings WHERE id = ?`)
    .bind(bindingId)
    .first<{ id: number; name: string; role: Role }>()

  if (!binding) {
    throw new HTTPException(404, { message: '绑定记录不存在' })
  }

  await c.env.DB
    .prepare(`UPDATE device_bindings SET status = 'unbound', unbound_at = ? WHERE id = ?`)
    .bind(nowIso(), bindingId)
    .run()
  const discardedScoreCount = await discardScoresForBinding(c.env.DB, bindingId, 'device_unbound')

  await logAudit(c.env.DB, 'unbind_device', 'admin', '管理员', {
    bindingId,
    name: binding.name,
    role: binding.role,
    discardedScoreCount,
  })

  return c.json({ ok: true, discardedScoreCount })
})

app.post('/api/admin/block-device', zValidator('json', blockDeviceSchema), async (c) => {
  await requireAdmin(c)

  const { bindingId } = c.req.valid('json')
  const binding = await c.env.DB
    .prepare(
      `
        SELECT id, name, role, status, device_token, fingerprint_hash
        FROM device_bindings
        WHERE id = ?
      `,
    )
    .bind(bindingId)
    .first<{
      id: number
      name: string
      role: Role
      status: 'active' | 'unbound'
      device_token: string
      fingerprint_hash: string | null
    }>()

  if (!binding) {
    throw new HTTPException(404, { message: '绑定记录不存在' })
  }

  const now = nowIso()

  await c.env.DB
    .prepare(
      `
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
    )
    .bind(
      blockedTokenKey(binding.device_token),
      JSON.stringify({ blockedAt: now, bindingId: binding.id, name: binding.name, role: binding.role }),
      now,
    )
    .run()

  const discardedScoreCount = await discardScoresForBinding(c.env.DB, binding.id, 'device_blocked')

  await logAudit(c.env.DB, 'block_device', 'admin', '管理员', {
    bindingId: binding.id,
    name: binding.name,
    role: binding.role,
    discardedScoreCount,
  })

  return c.json({ ok: true, discardedScoreCount })
})

app.post('/api/admin/unblock-device', zValidator('json', blockDeviceSchema), async (c) => {
  await requireAdmin(c)

  const { bindingId } = c.req.valid('json')
  const binding = await c.env.DB
    .prepare(
      `
        SELECT id, name, role, device_token
        FROM device_bindings
        WHERE id = ?
      `,
    )
    .bind(bindingId)
    .first<{
      id: number
      name: string
      role: Role
      device_token: string
    }>()

  if (!binding) {
    throw new HTTPException(404, { message: '绑定记录不存在' })
  }

  await c.env.DB
    .prepare(`DELETE FROM system_settings WHERE key = ?`)
    .bind(blockedTokenKey(binding.device_token))
    .run()

  await logAudit(c.env.DB, 'unblock_device', 'admin', '管理员', {
    bindingId: binding.id,
    name: binding.name,
    role: binding.role,
  })

  return c.json({ ok: true })
})

export default {
  async fetch(request: Request, env: AppEnv['Bindings'], executionContext: ExecutionContext) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, executionContext)
    }

    const looksLikeAppRoute = request.method === 'GET' || request.method === 'HEAD'
    const isStaticFile = url.pathname.includes('.')

    if (looksLikeAppRoute && !isStaticFile) {
      const appShellUrl = new URL('/', request.url)
      return env.ASSETS.fetch(new Request(appShellUrl, request))
    }

    return env.ASSETS.fetch(request)
  },
}
