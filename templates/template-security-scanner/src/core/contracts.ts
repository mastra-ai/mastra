import { z } from 'zod';

export class ControlPlaneError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 403 | 404 | 409 | 503,
  ) {
    super(code);
    this.name = 'ControlPlaneError';
  }
}

export const idSchema = z.string().uuid();
export const revisionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
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
export const originSchema = urlSchema.refine(value => {
  const url = new URL(value);
  return value === url.origin;
}, 'Use a canonical origin.');
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
export const limitsSchema = z
  .object({
    maxRequests: z.number().int().min(1).max(10000),
    maxDurationSeconds: z.number().int().min(1).max(3600),
    maxResponseBytes: z.number().int().min(1024).max(10485760),
    maxConcurrency: z.number().int().min(1).max(8),
  })
  .strict();
export const policySchema = z
  .object({
    name: label,
    permittedMethods: methods,
    scanLimits: limitsSchema,
    retention: z
      .object({ evidenceDays: z.number().int().min(1).max(365), approvedBy: label })
      .strict()
      .optional(),
  })
  .strict();
export const targetSchema = z
  .object({
    name: label,
    entryUrl: urlSchema,
    approvedOrigins: z
      .array(originSchema)
      .min(1)
      .max(16)
      .refine(value => new Set(value).size === value.length),
    allowedPaths: paths,
    excludedPaths: z.array(pathSchema).max(64),
    permittedMethods: methods,
    environment: z.enum(['lab', 'staging', 'production']),
    authorizationEvidenceRef: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9 ._:/-]*$/),
    authorizationConfirmed: z.literal(true),
    policyId: idSchema,
    policyRevision: revisionSchema,
    schedule: z
      .object({
        enabled: z.literal(false),
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
    scanLimits: limitsSchema,
    authProfileIds: z
      .array(idSchema)
      .max(32)
      .refine(value => new Set(value).size === value.length)
      .default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (!urlSchema.safeParse(value.entryUrl).success) return;
    const entry = new URL(value.entryUrl);
    if (!value.approvedOrigins.includes(entry.origin) || !pathAllowed(entry.pathname, value)) {
      context.addIssue({ code: 'custom', message: 'The entry URL must be inside approved scope.' });
    }
  });
export function pathAllowed(path: string, scope: { allowedPaths: string[]; excludedPaths: string[] }) {
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
  name: label,
  role: identity,
  expiresAt: z.iso.datetime().optional(),
};
const authenticatedBase = {
  ...profileBase,
  identityEndpoint: urlSchema,
  expectedIdentity: identity,
};
export const profileSchema = z.discriminatedUnion('kind', [
  z.object({ ...profileBase, kind: z.literal('public') }).strict(),
  z
    .object({ ...authenticatedBase, kind: z.literal('bearer'), credential: z.object({ value: privateValue }).strict() })
    .strict(),
  z
    .object({
      ...authenticatedBase,
      kind: z.literal('header'),
      credential: z
        .object({
          name: z.enum(['authorization', 'cookie', 'x-api-key', 'x-test-identity']),
          value: privateValue,
        })
        .strict(),
    })
    .strict(),
]);
export const bindingSchema = z
  .object({
    targetRevision: revisionSchema,
    policyRevision: revisionSchema,
    profileId: idSchema,
    profileRevision: revisionSchema,
    credentialRevision: revisionSchema,
  })
  .strict();
export const pageSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(1000000).default(0),
  })
  .strict();
export const sessionSchema = z.object({ secret: z.string().min(32).max(256) }).strict();
export type PolicyInput = z.infer<typeof policySchema>;
export type TargetInput = z.infer<typeof targetSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type IdentityBinding = z.infer<typeof bindingSchema>;
export type IdentityStatus = 'CHECK_REQUIRED' | 'READY' | 'AUTH_REQUIRED' | 'CREDENTIAL_UNAVAILABLE' | 'UNAVAILABLE';
export type IdentityResult = IdentityBinding & { status: IdentityStatus; checkedAt: string; reason: string };
export type Policy = PolicyInput & { id: string; owner: string; revision: number };
export type Target = TargetInput & { id: string; owner: string; revision: number };
type ProfileMetadata<T> = T extends unknown ? Omit<T, 'credential'> : never;
export type Profile = ProfileMetadata<ProfileInput> & {
  id: string;
  targetId: string;
  owner: string;
  revision: number;
  credentialRevision: number;
  credentialRef?: string;
  identityResult?: IdentityResult;
};
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ControlPlaneError('INVALID_INPUT', 400);
  return result.data;
}
