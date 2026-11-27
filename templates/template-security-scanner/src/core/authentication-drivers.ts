import { z } from 'zod';
import { principalJsonPointerSchema } from '../discovery/principals.js';

const id = z.string().uuid();
const canonicalOrigin = z
  .string()
  .max(2048)
  .refine(value => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use a canonical HTTP(S) origin.');
const origins = z
  .array(canonicalOrigin)
  .min(1)
  .max(16)
  .refine(value => new Set(value).size === value.length);
const headerName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^(?:[Xx]-[A-Za-z0-9-]+|[Aa]uthorization)$/);
const base = {
  version: z.literal(1),
  profileId: id,
  credentialOrigins: origins,
  secretRef: id,
  expiresAt: z.iso.datetime().optional(),
};
const canonicalReadPath = z
  .string()
  .min(1)
  .max(512)
  .refine(value => {
    if (!value.startsWith('/') || value.startsWith('//')) return false;
    if (value === '/') return true;
    return value
      .slice(1)
      .split('/')
      .every(segment => /^[A-Za-z0-9_~.-]+$/.test(segment) && !segment.includes('..'));
  }, 'Use a canonical read path.');
const unsupported = <T extends 'login_password' | 'browser_session' | 'mfa_sso'>(kind: T) =>
  z.object({ ...base, kind: z.literal(kind), execution: z.literal('unsupported') }).strict();

/** Only sealed references are persisted; registration and injection remain trusted runtime work. */
export const authenticationDriverSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...base,
      kind: z.literal('api_key_header'),
      headerName,
      accessCheckPath: canonicalReadPath,
      principalJsonPointer: principalJsonPointerSchema.optional(),
      refresh: z.literal('reregister'),
    })
    .strict(),
  unsupported('login_password'),
  unsupported('browser_session'),
  unsupported('mfa_sso'),
]);
export type AuthenticationDriver = z.infer<typeof authenticationDriverSchema>;

/** Presence of metadata never proves that a credential exists or that access succeeded. */
export const authenticationDriverCatalog = {
  api_key_header: { version: 1, execution: 'available', accessEvidence: 'successful scoped read' },
  login_password: { version: 1, execution: 'unsupported' },
  browser_session: { version: 1, execution: 'unsupported' },
  mfa_sso: { version: 1, execution: 'unsupported' },
} as const;
