import { z } from 'zod'

import { scoreItemMaxMap, type IntentType, type Role, type ScoreInput } from './scoring'

export type BindingStatus = 'active' | 'unbound'

export type CandidateSummary = {
  id: number
  serialNo: number
  name: string
  departments: Array<{
    departmentName: string
    intentType: IntentType
  }>
}

export type ActiveCandidateResponse = {
  candidate: CandidateSummary | null
  alreadyScored: boolean
  role: Role
  scorerName: string
}

export type RankingResponse = {
  department: string
  departments: string[]
  rows: Array<{
    rank: number
    candidateId: number
    name: string
    intentType: IntentType
    departmentName: string
    judgeAverage: number | null
    memberAverage: number | null
    totalScore: number
    judgeCount: number
    memberCount: number
  }>
}

export type BindingSummary = {
  id: number
  name: string
  role: Role
  status: BindingStatus
  deviceToken: string
  fingerprintHash: string | null
  boundAt: string
  lastSeenAt: string
  unboundAt: string | null
  hasDuplicateName: boolean
}

export const passcodePayloadSchema = z.object({
  passcode: z.string().min(1, '请输入口令'),
})

export const bindNameSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[\u4e00-\u9fa5]{2,3}$/, '姓名必须是 2 或 3 个汉字，不能包含数字、字母、空格或昵称'),
  fingerprint: z.string().trim().max(512, '设备指纹过长').optional(),
})

const scoreShape = Object.fromEntries(
  Object.entries(scoreItemMaxMap).map(([key, max]) => [key, z.number().int().min(0).max(max)]),
) as Record<keyof ScoreInput, z.ZodNumber>

export const scoreSubmissionSchema = z.object(scoreShape)

export const activeCandidateSchema = z.object({
  candidateId: z.number().int().positive(),
})

export const unbindDeviceSchema = z.object({
  bindingId: z.number().int().positive(),
})

export const blockDeviceSchema = z.object({
  bindingId: z.number().int().positive(),
})
