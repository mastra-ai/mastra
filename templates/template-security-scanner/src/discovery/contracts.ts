import { z } from 'zod';
import { bindingSchema, idSchema, originSchema, pathSchema, revisionSchema } from '../core/contracts.js';

/** Validated discovery mode contract; bounds and cross-field rules are enforced before use. */
export const discoveryModeSchema = z.enum(['http', 'headless']);
/** Validated scan admission contract; bounds and cross-field rules are enforced before use. */
export const scanAdmissionSchema = z
  .object({
    /** Exact target revision authorized for this operation. */
    targetRevision: revisionSchema,
    /** Exact policy revision authorized for this operation. */
    policyRevision: revisionSchema,
    /** Exact profile and credential revisions participating in this operation. */
    profiles: z.array(bindingSchema).min(1).max(32),
    /** HTTP crawler or sandboxed Chromium discovery mode. */
    mode: discoveryModeSchema.default('http'),
    /** Identity-only check or discovery; identity checks use one HTTP profile. */
    operation: z.enum(['discovery', 'identity']).default('discovery'),
    /** Caller-selected stable key; repeated input returns the existing admission. */
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
/** Validated observation contract; bounds and cross-field rules are enforced before use. */
export const observationSchema = z
  .object({
    /** Discriminator for endpoint, form, or browser XHR inventory. */
    kind: z.enum(['endpoint', 'form', 'xhr']),
    /** Application role represented by this identity or observation. */
    role: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9:_-]+$/),
    /** Identity profile used for this observation or operation. */
    profileId: idSchema,
    /** Discovery engine that produced this observation. */
    source: z.enum(['katana-http', 'katana-headless', 'rest-json']),
    /** Distinguishes a gateway-observed response from an advertised surface. */
    provenance: z.enum(['upstream-response', 'advertised']),
    /** Canonical HTTP(S) origin inside the authorized target scope. */
    origin: originSchema,
    /** Canonical scoped path without query values or fragments. */
    path: pathSchema,
    /** HTTP method observed or explicitly allowed. */
    method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
    /** Parameter names only; parameter values are withheld. */
    parameterNames: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_.\-]{0,63}$/)).max(32),
    /** Confirmed or advertised route template used to interpret this REST observation. */
    routeTemplate: z.string().max(512).optional(),
    /** Previously observed scoped path that supplied this REST detail reference. */
    linkedFrom: pathSchema.optional(),
    /** Trusted upstream HTTP status; absent for advertised surfaces. */
    status: z.number().int().min(100).max(599).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.provenance === 'advertised' && value.status !== undefined)
      context.addIssue({ code: 'custom', message: 'Advertised surfaces cannot claim an upstream status.' });
    if (
      value.provenance === 'upstream-response' &&
      (!['katana-http', 'rest-json'].includes(value.source) || value.kind !== 'endpoint' || value.status === undefined)
    )
      context.addIssue({ code: 'custom', message: 'Upstream responses require an HTTP endpoint and observed status.' });
  });
/** Validated discovery counters contract; bounds and cross-field rules are enforced before use. */
export const discoveryCountersSchema = z
  .object({
    /** Raw stdout bytes processed privately, without retaining their contents. */
    bytes: z.number().int().nonnegative(),
    /** Raw stderr bytes processed privately. */
    stderrBytes: z.number().int().nonnegative(),
    /** Number of credential matches observed in private raw output. */
    rawCredentialOccurrences: z.number().int().nonnegative(),
    /** Number of candidate records parsed. */
    parsed: z.number().int().nonnegative(),
    /** Number of records rejected as malformed. */
    malformed: z.number().int().nonnegative(),
    /** Number of records withheld by sanitization. */
    withheld: z.number().int().nonnegative(),
    /** Number of fields withheld by credential-aware filtering. */
    secretFields: z.number().int().nonnegative(),
    /** Number of values removed during normalization. */
    minimizedValues: z.number().int().nonnegative(),
    /** Number of records rejected for an unknown origin. */
    unknownOrigin: z.number().int().nonnegative(),
    /** Number of records rejected by the normalized schema. */
    schemaRejected: z.number().int().nonnegative(),
    /** Number of parser stops caused by configured output bounds. */
    boundStops: z.number().int().nonnegative(),
    /** Number of gateway-denied observations withheld from inventory. */
    policyDenied: z.number().int().nonnegative(),
    /** Number of observations lacking trusted upstream provenance. */
    upstreamUnverified: z.number().int().nonnegative(),
  })
  .strict();
/** Validated scan state contract; bounds and cross-field rules are enforced before use. */
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
/** Validated reason contract; bounds and cross-field rules are enforced before use. */
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
/** Validated budget contract; bounds and cross-field rules are enforced before use. */
export const budgetSchema = z
  .object({
    /** Remaining shared request budget; null means consumption is unknown. */
    remainingRequests: z.number().int().nonnegative().nullable(),
    /** Remaining shared byte budget; null means consumption is unknown. */
    remainingBytes: z.number().int().nonnegative().nullable(),
    /** Whether budget exhaustion or uncertain consumption prevents dispatch. */
    exhausted: z.boolean(),
    /** Sanitized machine-readable reason for the recorded state. */
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
/** Validated role result contract; bounds and cross-field rules are enforced before use. */
export const roleResultSchema = z
  .object({
    /** Identity profile used for this observation or operation. */
    profileId: idSchema,
    /** Application role represented by this identity or observation. */
    role: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9:_-]+$/),
    /** Discovery engine that produced this observation. */
    source: z.enum(['katana-http', 'katana-headless', 'rest-json']),
    /** Current identity readiness information; never a vulnerability verdict. */
    identity: z.enum(['READY', 'AUTH_REQUIRED', 'UNAVAILABLE']),
    /** Finite comparisons from this scan; account identifiers never leave trusted memory. */
    principalComparisons: z
      .array(
        z
          .object({
            profileId: idSchema,
            result: z.enum(['SAME', 'DISTINCT', 'UNKNOWN']),
          })
          .strict(),
      )
      .max(31)
      .optional(),
    /** Bounded output-minimization and rejection counters. */
    counters: discoveryCountersSchema,
    /** Whether this result is incomplete or contains withheld observations. */
    partial: z.boolean(),
  })
  .strict();
/** Validated runtime code contract; bounds and cross-field rules are enforced before use. */
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
/** Validated scan contract; bounds and cross-field rules are enforced before use. */
export const scanSchema = z
  .object({
    /** Stable identifier of this record. */
    id: idSchema,
    /** Durable job associated with this operation. */
    jobId: idSchema,
    /** Authorized target to which this record belongs. */
    targetId: idSchema,
    /** Operator that owns this record; derived from the authenticated session. */
    owner: z.string().min(1).max(120),
    /** Exact admission request retained with its original revision bindings. */
    request: scanAdmissionSchema,
    /** Persisted lifecycle state; read the reason and result before interpreting it. */
    state: scanStateSchema,
    /** Sanitized machine-readable reason for the recorded state. */
    reason: reasonSchema,
    /** UTC timestamp when the record was created. */
    createdAt: z.iso.datetime(),
    /** UTC timestamp of the latest persisted transition. */
    updatedAt: z.iso.datetime(),
    /** Whether this result is incomplete or contains withheld observations. */
    partial: z.boolean(),
    /** Persisted evidence-expiry accounting, independent of scan outcome. */
    evidenceRetention: z
      .object({
        /** Total evidence records removed by retention. */
        expiredCount: z.number().int().nonnegative(),
        /** UTC timestamp of the latest evidence removal, or null if none. */
        lastExpiredAt: z.iso.datetime().nullable(),
      })
      .strict()
      .superRefine((value, context) => {
        if ((value.expiredCount === 0) !== (value.lastExpiredAt === null))
          context.addIssue({ code: 'custom', message: 'Expired evidence requires its removal timestamp.' });
      })
      .default({ expiredCount: 0, lastExpiredAt: null }),
    /** Whether owned-resource cleanup is pending, complete, or in debt. */
    cleanup: z.enum(['PENDING', 'COMPLETE', 'DEBT']),
    /** Current shared-budget snapshot. */
    budget: budgetSchema,
    /** Initial shared budgets recorded at admission. */
    budgetInitial: z
      .object({
        /** Initial request allowance. */
        requests: z.number().int().nonnegative(),
        /** Initial shared response-byte allowance. */
        bytes: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    /** Independent identity result and output counters for each participating role. */
    roles: z.array(roleResultSchema).max(32),
    /** Finite runtime failure code, or null when none was recorded. */
    diagnostic: runtimeCodeSchema.nullable(),
    /** Sanitized gateway event counts keyed by allowlisted counter names. */
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
/** Validated evidence contract; bounds and cross-field rules are enforced before use. */
export const evidenceSchema = z
  .object({
    /** Stable identifier of this record. */
    id: idSchema,
    /** Discovery scan supplying the source inventory. */
    scanId: idSchema,
    /** Authorized target to which this record belongs. */
    targetId: idSchema,
    /** UTC timestamp of the source observation. */
    observedAt: z.iso.datetime(),
    /** Normalized admissible facts; raw response content is excluded. */
    observation: observationSchema,
    /** SHA-256 digest of the sanitized evidence record. */
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    /** UTC expiration timestamp. */
    expiresAt: z.iso.datetime().nullable(),
    /** Always false for discovery evidence; verification needs a separate proof. */
    confirmationEligible: z.literal(false),
  })
  .strict();
/** Validated result contract; bounds and cross-field rules are enforced before use. */
export const resultSchema = z
  .object({
    /** Bounded sanitized observations retained from this run. */
    observations: z.array(observationSchema).max(512),
    /** Bounded output-minimization and rejection counters. */
    counters: discoveryCountersSchema,
    /** Whether this result is incomplete or contains withheld observations. */
    partial: z.boolean(),
    /** Whether processing stopped before consuming all input. */
    stopped: z.boolean(),
  })
  .strict();
/** Idempotent discovery request bound to exact target, policy, and profile revisions. */
export type ScanAdmission = z.infer<typeof scanAdmissionSchema>;
/** Supported crawler execution mode. */
export type DiscoveryMode = z.infer<typeof discoveryModeSchema>;
/** Discriminated sanitized observation with category or source provenance. */
export type Observation = z.infer<typeof observationSchema>;
/** Bounded parser output and counters before persistence. */
export type DiscoveryResult = z.infer<typeof resultSchema>;
/** Persisted discovery lifecycle, budgets, identity results, and cleanup outcome. */
export type Scan = z.infer<typeof scanSchema>;
/** Finite reason codes explaining a discovery transition. */
export type ScanReason = z.infer<typeof reasonSchema>;
/** Retained sanitized discovery observation; never sufficient for confirmation. */
export type Evidence = z.infer<typeof evidenceSchema>;
export const terminal = (state: Scan['state']) => !['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(state);
