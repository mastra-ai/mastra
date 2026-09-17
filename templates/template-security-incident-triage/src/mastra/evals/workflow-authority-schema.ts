import { z } from 'zod';
import { opaqueId, sha256, utcTimestamp } from '../../schemas/common.js';
import { ContainmentActionTypeSchema } from '../../schemas/containment.js';

const scope = { tenant_id: opaqueId, incident_id: opaqueId };
const actionScope = { ...scope, plan_id: opaqueId, action_id: opaqueId };
const action = {
  action_type: ContainmentActionTypeSchema,
  target_id: opaqueId,
  input_hash: sha256,
};
export const approvalRow = z
  .object({
    ...scope,
    id: opaqueId,
    plan_id: opaqueId,
    plan_hash_version: z.literal(1),
    plan_hash: sha256,
    requested_at: utcTimestamp,
    expires_at: utcTimestamp,
    decision: z.enum(['approved', 'rejected']).nullable(),
    decided_by: opaqueId.nullable(),
    decided_by_role: z.string().nullable(),
    decided_at: utcTimestamp.nullable(),
    workflow_run_id: opaqueId,
    expiry_resumed_at: utcTimestamp.nullable(),
    decision_provenance: z.enum(['local', 'dashboard']),
  })
  .strict();
export const planRow = z
  .object({
    ...scope,
    id: opaqueId,
    schema_version: z.literal(1),
    plan_version: z.number().int().positive(),
    plan_hash_version: z.literal(1),
    plan_hash: sha256,
    created_at: utcTimestamp,
    expires_at: utcTimestamp,
  })
  .strict();
export const actionRow = z
  .object({
    ...actionScope,
    ...action,
    id: opaqueId,
    ordinal: z.number().int().nonnegative(),
    idempotency_key: z.string().min(1).max(256),
    status: z.string().min(1),
  })
  .strict();
export const attemptRow = z
  .object({
    ...actionScope,
    id: opaqueId,
    approval_id: opaqueId,
    idempotency_key: z.string().min(1).max(256),
    attempt: z.number().int().positive(),
    owner_id: opaqueId,
    status: z.enum(['executing', 'completed', 'blocked', 'failed', 'timed_out']),
    started_at: utcTimestamp,
    finished_at: utcTimestamp.nullable(),
    lease_expires_at: utcTimestamp,
    error_code: z.string().nullable(),
    verification: z.enum(['not_run', 'verified', 'not_verified']),
  })
  .strict();
export const effectRow = z
  .object({
    ...actionScope,
    ...action,
    attempt: z.number().int().positive(),
    applied_at: utcTimestamp,
  })
  .strict();

export const authorizationProbeNames = [
  'stale-plan-decision',
  'foreign-tenant-resume',
  'consumed-token-replay',
] as const;
export const authorizationProbes = z
  .array(
    z
      .object({
        name: z.enum(authorizationProbeNames),
        blocked: z.boolean(),
      })
      .strict(),
  )
  .refine(probes => new Set(probes.map(probe => probe.name)).size === probes.length, 'duplicate authorization probe');
