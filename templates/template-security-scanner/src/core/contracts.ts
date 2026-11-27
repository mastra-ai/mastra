import { z } from 'zod';
import { applicationDriverSchema } from './application-drivers.js';
import { authenticationDriverSchema } from './authentication-drivers.js';
import { routeAccessRulesSchema, routeTemplateWithinScope } from './route-access.js';

export class ControlPlaneError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 403 | 404 | 409 | 503,
  ) {
    super(code);
    this.name = 'ControlPlaneError';
  }
}

/** Validated id contract; bounds and cross-field rules are enforced before use. */
export const idSchema = z.string().uuid();
/** Validated revision contract; bounds and cross-field rules are enforced before use. */
export const revisionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
/** Strict quoted If-Match revision shared by protected mutation routes. */
export const ifMatchRevision = z
  .string()
  .regex(/^"[1-9][0-9]{0,15}"$/)
  .transform(value => Number(value.slice(1, -1)))
  .pipe(revisionSchema);
const label = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N} ._:-]+$/u);
const identity = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9:_-]+$/);

// Reject encodings before URL normalization can erase traversal or authority ambiguity.
/** Validated url contract; bounds and cross-field rules are enforced before use. */
export const urlSchema = z
  .string()
  .max(2048)
  .superRefine((value, context) => {
    try {
      const url = new URL(value);
      if (
        !/^https?:\/\//.test(value) ||
        /[%\\\s#]/.test(value) ||
        url.username ||
        url.password ||
        url.hash ||
        value.includes('/./') ||
        value.includes('/../') ||
        /\/(?:\.|\.\.)$/.test(value) ||
        !['http:', 'https:'].includes(url.protocol) ||
        url.search
      )
        throw new Error();
      if (url.href !== value && url.href !== `${value}/`) throw new Error();
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Use an unambiguous HTTP(S) URL without credentials, query or fragment.',
      });
    }
  });
/** Validated origin contract; bounds and cross-field rules are enforced before use. */
export const originSchema = urlSchema.refine(value => {
  const url = new URL(value);
  return value === url.origin;
}, 'Use a canonical origin.');
/** Validated path contract; bounds and cross-field rules are enforced before use. */
export const pathSchema = z
  .string()
  .max(512)
  .refine(value => {
    // Separators are checked independently: hostile suffixes cannot trigger
    // backtracking through nested segment repetitions on the parser thread.
    if (value.length > 512 || !value.startsWith('/') || value.startsWith('//')) return false;
    if (value === '/') return true;
    const segments = value.slice(1).replace(/\/$/, '').split('/');
    return segments.every(
      segment =>
        segment.length > 0 &&
        /^[a-zA-Z0-9_~.-]+$/.test(segment) &&
        !segment.startsWith('.') &&
        !segment.endsWith('.') &&
        !segment.includes('..'),
    );
  }, 'Use a canonical ASCII path.');
const paths = z
  .array(pathSchema)
  .min(1)
  .max(64)
  .refine(value => new Set(value).size === value.length);
const methods = z
  .array(z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']))
  .min(1)
  .max(7)
  .refine(value => new Set(value).size === value.length);
/** Validated limits contract; bounds and cross-field rules are enforced before use. */
export const limitsSchema = z
  .object({
    /** Maximum upstream requests allowed; reservations are shared and not refunded. */
    maxRequests: z.number().int().min(1).max(10000),
    /** Maximum elapsed duration in seconds. */
    maxDurationSeconds: z.number().int().min(1).max(3600),
    /** Maximum bytes accepted from one upstream response. */
    maxResponseBytes: z.number().int().min(1024).max(10485760),
    /** Maximum simultaneous upstream requests. */
    maxConcurrency: z.number().int().min(1).max(8),
  })
  .strict();
/** Validated policy contract; bounds and cross-field rules are enforced before use. */
export const policySchema = z
  .object({
    /** Human-readable label shown in the console. */
    name: label,
    /** Unique HTTP methods explicitly allowed by the operator. */
    permittedMethods: methods,
    /** Finite scan budgets, bounded by the target policy. */
    scanLimits: limitsSchema,
    /** Explicit evidence-retention selection; required for non-lab targets. */
    retention: z
      .object({
        /** Number of days to retain evidence, from 1 through 365. */
        evidenceDays: z.number().int().min(1).max(365),
        /** Operator reference recording the retention decision. */
        approvedBy: label,
      })
      .strict()
      .optional(),
  })
  .strict();
/** Validated target contract; bounds and cross-field rules are enforced before use. */
export const targetSchema = z
  .object({
    /** Human-readable label shown in the console. */
    name: label,
    /** Canonical HTTP(S) entry URL inside the approved origin and path scope. */
    entryUrl: urlSchema,
    /** Exact canonical origins the gateway may contact. */
    approvedOrigins: z
      .array(originSchema)
      .min(1)
      .max(16)
      .refine(value => new Set(value).size === value.length),
    /** Allowed canonical path prefixes, matched at segment boundaries. */
    allowedPaths: paths,
    /** Denied path prefixes; exclusions override allowed paths. */
    excludedPaths: z.array(pathSchema).max(64),
    /** Unique HTTP methods explicitly allowed by the operator. */
    permittedMethods: methods,
    /** Deployment classification; lab alone does not grant private-network access. */
    environment: z.enum(['lab', 'staging', 'production']),
    /** Reference to the operator authorization for this target. */
    authorizationEvidenceRef: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9 ._:/-]*$/),
    /** Explicit confirmation that the target is authorized. */
    authorizationConfirmed: z.literal(true),
    /** Policy that bounds the target scope and budgets. */
    policyId: idSchema,
    /** Exact policy revision authorized for this operation. */
    policyRevision: revisionSchema,
    /** Discovery scheduling setting; recurrence is configured separately. */
    schedule: z
      .object({
        /** Whether this feature is explicitly enabled. */
        enabled: z.literal(false),
        /** IANA timezone used to calculate scheduled occurrences. */
        timezone: z
          .string()
          .min(1)
          .max(100)
          .refine(value => {
            try {
              new Intl.DateTimeFormat('en', { timeZone: value });
              return true;
            } catch {
              return false;
            }
          }),
      })
      .strict(),
    /** Finite scan budgets, bounded by the target policy. */
    scanLimits: limitsSchema,
    /** Target-owned profile identifiers, maintained by profile registration/removal. */
    authProfileIds: z
      .array(idSchema)
      .max(32)
      .refine(value => new Set(value).size === value.length)
      .default([]),
    /** Explicit application contract; absent on historical Katana targets. */
    application: applicationDriverSchema.optional(),
    /** Future authentication metadata only; credentials still require sealed registration. */
    authenticationDrivers: z
      .array(authenticationDriverSchema)
      .max(32)
      .refine(value => new Set(value.map(driver => driver.profileId)).size === value.length)
      .optional(),
    /** Operator-confirmed or suggested route intent, bound by the target revision. */
    routeAccessRules: routeAccessRulesSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!urlSchema.safeParse(value.entryUrl).success) return;
    const entry = new URL(value.entryUrl);
    if (!value.approvedOrigins.includes(entry.origin) || !pathAllowed(entry.pathname, value)) {
      context.addIssue({ code: 'custom', message: 'The entry URL must be inside approved scope.' });
    }
    if (value.application?.kind === 'rest_api' && value.application.openApiUrl) {
      const openApi = value.application.openApiUrl;
      if (
        !urlSchema.safeParse(openApi).success ||
        !value.approvedOrigins.includes(new URL(openApi).origin) ||
        !pathAllowed(new URL(openApi).pathname, value)
      ) {
        context.addIssue({ code: 'custom', message: 'The OpenAPI URL must be inside approved scope.' });
      }
    }
    for (const driver of value.authenticationDrivers ?? []) {
      if (
        driver.credentialOrigins.some(origin => !value.approvedOrigins.includes(origin)) ||
        (driver.kind === 'api_key_header' && !pathAllowed(driver.accessCheckPath, value))
      ) {
        context.addIssue({ code: 'custom', message: 'Authentication access must remain inside approved scope.' });
      }
    }
    for (const rule of value.routeAccessRules ?? []) {
      if (!value.permittedMethods.includes(rule.method) || !routeTemplateWithinScope(rule.pathTemplate, value))
        context.addIssue({
          code: 'custom',
          message: 'Route access rules must remain inside approved methods and paths.',
        });
    }
  });
/** Check a request path against the target's allowed and excluded path boundaries. */
export function pathAllowed(path: string, scope: { allowedPaths: string[]; excludedPaths: string[] }) {
  /** Match the current path to a whole allowed or excluded prefix segment. */
  const matches = (prefix: string) =>
    prefix === '/' || path === prefix || path.startsWith(`${prefix.replace(/\/$/, '')}/`);
  return scope.allowedPaths.some(matches) && !scope.excludedPaths.some(matches);
}
const privateValue = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[\x20-\x7e]+$/);
const profileBase = {
  /** Human-readable label shown in the console. */
  name: label,
  /** Application role represented by this identity or observation. */
  role: identity,
  /** Optional UTC expiration of the identity profile. */
  expiresAt: z.iso.datetime().optional(),
};
const authenticatedBase = {
  ...profileBase,
  /** Scoped read-only endpoint returning the expected identity and role. */
  identityEndpoint: urlSchema,
  /** Exact application identity the endpoint must report. */
  expectedIdentity: identity,
};
/** Validated profile contract; bounds and cross-field rules are enforced before use. */
export const profileSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...profileBase,
      /** Discriminator selecting the supported record or credential shape. */
      kind: z.literal('public'),
    })
    .strict(),
  z
    .object({
      ...authenticatedBase,
      /** Discriminator selecting the supported record or credential shape. */
      kind: z.literal('bearer'),
      /** Private registration-only credential; never returned with profile metadata. */
      credential: z
        .object({
          /** Private printable-ASCII credential accepted only during registration. */
          value: privateValue,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...authenticatedBase,
      /** Discriminator selecting the supported record or credential shape. */
      kind: z.literal('header'),
      /** Private registration-only credential; never returned with profile metadata. */
      credential: z
        .object({
          /** Allowlisted header name used to transport the private credential. */
          name: z.enum(['authorization', 'cookie', 'x-api-key', 'x-test-identity']),
          /** Private printable-ASCII credential accepted only during registration. */
          value: privateValue,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...profileBase,
      kind: z.literal('api_key_header'),
      /** Credential transport is selected by the target's versioned authentication driver. */
      credential: z.object({ value: privateValue }).strict(),
    })
    .strict(),
]);
/** Validated binding contract; bounds and cross-field rules are enforced before use. */
export const bindingSchema = z
  .object({
    /** Exact target revision authorized for this operation. */
    targetRevision: revisionSchema,
    /** Exact policy revision authorized for this operation. */
    policyRevision: revisionSchema,
    /** Identity profile used for this observation or operation. */
    profileId: idSchema,
    /** Exact profile metadata revision bound to this operation. */
    profileRevision: revisionSchema,
    /** Credential version bound to this operation; changes invalidate prior authorization. */
    credentialRevision: revisionSchema,
  })
  .strict();
/** Validated page contract; bounds and cross-field rules are enforced before use. */
export const pageSchema = z
  .object({
    /** Maximum number of records returned by one page. */
    limit: z.coerce.number().int().min(1).max(100).default(25),
    /** Zero-based collection offset. */
    offset: z.coerce.number().int().min(0).max(1000000).default(0),
  })
  .strict();
/** Validated session contract; bounds and cross-field rules are enforced before use. */
export const sessionSchema = z
  .object({
    /** Private bootstrap secret submitted only to establish a local session. */
    secret: z.string().min(32).max(256),
  })
  .strict();
/** Validated input for policy creation and full replacement. */
export type PolicyInput = z.infer<typeof policySchema>;
/** Validated authorized-target input; profile membership is maintained separately. */
export type TargetInput = z.infer<typeof targetSchema>;
/** Discriminated registration input; credential fields are write-only. */
export type ProfileInput = z.infer<typeof profileSchema>;
/** Exact revisions required for identity checks and scan admission. */
export type IdentityBinding = z.infer<typeof bindingSchema>;
/** Authentication/readiness state, independent of vulnerability assessment. */
export type IdentityStatus = 'CHECK_REQUIRED' | 'READY' | 'AUTH_REQUIRED' | 'CREDENTIAL_UNAVAILABLE' | 'UNAVAILABLE';
/** Dated identity check bound to the exact target, policy, and credential revisions. */
export type IdentityResult = IdentityBinding & {
  /** Identity readiness state; never a vulnerability verdict. */
  status: IdentityStatus;
  /** UTC timestamp of the identity check. */
  checkedAt: string;
  /** Sanitized machine-readable reason for the recorded state. */
  reason: string;
};
/** Persisted operator-owned policy and its current revision. */
export type Policy = PolicyInput & {
  /** Stable identifier of this record. */
  id: string;
  /** Operator that owns this record; derived from the authenticated session. */
  owner: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
};
/** Persisted authorized target and its policy binding. */
export type Target = TargetInput & {
  /** Stable identifier of this record. */
  id: string;
  /** Operator that owns this record; derived from the authenticated session. */
  owner: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
};
type ProfileMetadata<T> = T extends unknown ? Omit<T, 'credential'> : never;
/** Public identity metadata; private credential values are excluded. */
export type Profile = ProfileMetadata<ProfileInput> & {
  /** Stable identifier of this record. */
  id: string;
  /** Authorized target to which this record belongs. */
  targetId: string;
  /** Operator that owns this record; derived from the authenticated session. */
  owner: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
  /** Credential version bound to this operation; changes invalidate prior authorization. */
  credentialRevision: number;
  /** Opaque reference to the sealed credential, never the credential itself. */
  credentialRef?: string;
  /** Most recent identity check bound to the recorded revisions. */
  identityResult?: IdentityResult;
};
/** Validate a domain input and translate schema failures into a control-plane error. */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ControlPlaneError('INVALID_INPUT', 400);
  return result.data;
}
