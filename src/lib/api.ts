export type AuthMeResponse =
  | {
      authenticated: false
      kind: null
    }
  | {
      authenticated: true
      kind: 'admin'
    }
  | {
      authenticated: true
      kind: 'scorer'
      role: 'judge' | 'member'
      name: string | null
      needsBinding: boolean
    }

const jsonHeaders = {
  'content-type': 'application/json',
}

const normalizeErrorMessage = (payload: unknown) => {
  if (Array.isArray(payload)) {
    const issues = payload
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'message' in item) {
          return String((item as { message?: unknown }).message ?? '')
        }
        return ''
      })
      .filter(Boolean)

    if (issues.length) return issues.join('；')
    return null
  }

  if (!payload || typeof payload !== 'object') return null

  const candidate = payload as Record<string, unknown>
  const errorValue = candidate.error

  if (typeof errorValue === 'string') return errorValue
  if (Array.isArray(errorValue)) return errorValue.join('；')
  if (errorValue && typeof errorValue === 'object') {
    const nested = Object.values(errorValue as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => String(value))
      .filter(Boolean)

    if (nested.length) return nested.join('；')
  }

  if (typeof candidate.message === 'string') return candidate.message
  return null
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : jsonHeaders),
      ...(init?.headers ?? {}),
    },
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload) ?? '请求失败')
  }

  return payload as T
}

export const fetchAuthMe = () => apiRequest<AuthMeResponse>('/api/auth/me')

export const logout = () =>
  apiRequest<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
  })
