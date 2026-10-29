import { z } from 'zod';
import { bindingSchema, idSchema, originSchema, pathSchema, revisionSchema } from '../core/contracts.js';

export const discoveryModeSchema = z.enum(['http', 'headless']);
export const scanAdmissionSchema = z
  .object({
    targetRevision: revisionSchema,
    policyRevision: revisionSchema,
    profiles: z.array(bindingSchema).min(1).max(32),
    mode: discoveryModeSchema.default('http'),
    operation: z.enum(['discovery', 'identity']).default('discovery'),
    idempotencyKey: z
      .string()
      .min(16)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.operation === 'identity' && (value.mode !== 'http' || value.profiles.length !== 1))
      context.addIssue({ code: 'custom', message: 'Identity checks use one profile and the HTTP driver.' });
    if (
      new Set(value.profiles.map(profile => profile.profileId)).size !== value.profiles.length ||
      value.profiles.some(
        profile => profile.targetRevision !== value.targetRevision || profile.policyRevision !== value.policyRevision,
      )
    )
      context.addIssue({ code: 'custom', message: 'Profile bindings must be unique and match the scan revisions.' });
  });
export const observationSchema = z
  .object({
    kind: z.enum(['endpoint', 'form', 'xhr']),
    role: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9:_-]+$/),
    profileId: idSchema,
    source: z.enum(['katana-http', 'katana-headless']),
    provenance: z.enum(['upstream-response', 'advertised']),
    origin: originSchema,
    path: pathSchema,
    method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
    parameterNames: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_.\-]{0,63}$/)).max(32),
    status: z.number().int().min(100).max(599).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.provenance === 'advertised' && value.status !== undefined)
      context.addIssue({ code: 'custom', message: 'Advertised surfaces cannot claim an upstream status.' });
    if (
      value.provenance === 'upstream-response' &&
      (value.source !== 'katana-http' || value.kind !== 'endpoint' || value.status === undefined)
    )
      context.addIssue({ code: 'custom', message: 'Upstream responses require an HTTP endpoint and observed status.' });
  });
export const discoveryCountersSchema = z
  .object({
    bytes: z.number().int().nonnegative(),
    stderrBytes: z.number().int().nonnegative(),
    rawCredentialOccurrences: z.number().int().nonnegative(),
    parsed: z.number().int().nonnegative(),
    malformed: z.number().int().nonnegative(),
    withheld: z.number().int().nonnegative(),
    secretFields: z.number().int().nonnegative(),
    minimizedValues: z.number().int().nonnegative(),
    unknownOrigin: z.number().int().nonnegative(),
    schemaRejected: z.number().int().nonnegative(),
    boundStops: z.number().int().nonnegative(),
    policyDenied: z.number().int().nonnegative(),
    upstreamUnverified: z.number().int().nonnegative(),
  })
  .strict();
export const scanStateSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'CANCEL_REQUESTED',
  'CANCELLED',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'AUTH_REQUIRED',
]);
export const reasonSchema = z.enum([
  'ADMITTED',
  'DISCOVERY_COMPLETE',
  'DISCOVERY_PARTIAL',
  'POLICY_BLOCKED',
  'UPSTREAM_UNVERIFIED',
  'CANCELLED_BY_OPERATOR',
  'SCOPE_CHANGED',
  'AUTH_REQUIRED',
  'IDENTITY_UNAVAILABLE',
  'OUTPUT_BOUND',
  'BUDGET_EXHAUSTED',
  'RUNTIME_UNAVAILABLE',
  'CLEANUP_FAILED',
  'PROCESS_INTERRUPTED',
  'SERVER_STOPPED',
]);
export const budgetSchema = z
  .object({
    remainingRequests: z.number().int().nonnegative().nullable(),
    remainingBytes: z.number().int().nonnegative().nullable(),
    exhausted: z.boolean(),
    reason: z.enum(['requests', 'bytes', 'time', 'peer-mismatch', 'unknown']).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.exhausted !== Boolean(value.reason) ||
      (value.remainingRequests === null) !== (value.remainingBytes === null) ||
      (value.reason === 'unknown') !== (value.remainingRequests === null)
    )
      context.addIssue({
        code: 'custom',
        message: 'Exhaustion and uncertain remaining budget require accurate reasons.',
      });
  });
export const roleResultSchema = z
  .object({
    profileId: idSchema,
    role: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9:_-]+$/),
    source: z.enum(['katana-http', 'katana-headless']),
    identity: z.enum(['READY', 'AUTH_REQUIRED', 'UNAVAILABLE']),
    counters: discoveryCountersSchema,
    partial: z.boolean(),
  })
  .strict();
export const runtimeCodeSchema = z.enum([
  'INPUTS',
  'NETWORK',
  'GATEWAY',
  'FIREWALL',
  'FIREWALL_COMMAND',
  'FIREWALL_RULES',
  'FIREWALL_CAPABILITY',
  'NATIVE_SANDBOX',
  'IDENTITY',
  'DISCOVERY',
  'BROWSER_ARGS',
  'BROWSER_ARGS_FAILED',
  'BROWSER_ARGS_TRUNCATED',
  'BROWSER_ARGS_SECRET',
  'BROWSER_FLAGS',
  'BROWSER_CONTROL',
  'BROWSER_SANDBOX',
  'BROWSER_VERSION',
  'BROWSER_WEBSOCKET',
  'BROWSER_TARGET',
  'BROWSER_STATUS',
  'PUBLISH',
  'DRAIN',
  'CLEANUP',
]);
export const scanSchema = z
  .object({
    id: idSchema,
    jobId: idSchema,
    targetId: idSchema,
    owner: z.string().min(1).max(120),
    request: scanAdmissionSchema,
    state: scanStateSchema,
    reason: reasonSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    partial: z.boolean(),
    evidenceRetention: z
      .object({ expiredCount: z.number().int().nonnegative(), lastExpiredAt: z.iso.datetime().nullable() })
      .strict()
      .superRefine((value, context) => {
        if ((value.expiredCount === 0) !== (value.lastExpiredAt === null))
          context.addIssue({ code: 'custom', message: 'Expired evidence requires its removal timestamp.' });
      })
      .default({ expiredCount: 0, lastExpiredAt: null }),
    cleanup: z.enum(['PENDING', 'COMPLETE', 'DEBT']),
    budget: budgetSchema,
    roles: z.array(roleResultSchema).max(32),
    diagnostic: runtimeCodeSchema.nullable(),
    networkCounters: z
      .record(
        z
          .string()
          .max(160)
          .regex(/^[a-zA-Z0-9:_-]+$/),
        z.number().int().nonnegative(),
      )
      .default({}),
  })
  .strict()
  .superRefine((value, context) => {
    if (['CANCELLED', 'COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(value.state) && value.cleanup !== 'COMPLETE')
      context.addIssue({ code: 'custom', message: 'Successful terminal cleanup must be observed before completion.' });
  });
export const evidenceSchema = z
  .object({
    id: idSchema,
    scanId: idSchema,
    targetId: idSchema,
    observedAt: z.iso.datetime(),
    observation: observationSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z.iso.datetime().nullable(),
    confirmationEligible: z.literal(false),
  })
  .strict();
export const resultSchema = z
  .object({
    observations: z.array(observationSchema).max(512),
    counters: discoveryCountersSchema,
    partial: z.boolean(),
    stopped: z.boolean(),
  })
  .strict();
export type ScanAdmission = z.infer<typeof scanAdmissionSchema>;
export type DiscoveryMode = z.infer<typeof discoveryModeSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type DiscoveryResult = z.infer<typeof resultSchema>;
export type Scan = z.infer<typeof scanSchema>;
export type ScanReason = z.infer<typeof reasonSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export const terminal = (state: Scan['state']) => !['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(state);
