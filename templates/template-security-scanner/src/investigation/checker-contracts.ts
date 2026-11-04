import { z } from 'zod';

const shared = {
  version: z.literal(1),
  id: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
  categoryId: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
  supportedTargetKinds: z
    .array(z.enum(['rest_api', 'owned_lab']))
    .min(1)
    .max(2),
  supportedAuthKinds: z
    .array(z.enum(['public', 'api_key_header', 'legacy_profile']))
    .min(1)
    .max(3),
  prerequisites: z.array(z.string().min(1).max(120)).max(12),
  risk: z.enum(['passive', 'active']),
  effect: z.enum(['read_only', 'state_changing', 'manual']),
  approvalRequired: z.boolean(),
  limits: z
    .object({ maxRequests: z.number().int().min(0).max(12), maxDurationSeconds: z.number().int().min(1).max(60) })
    .strict(),
  inputContract: z.string().min(1).max(160),
  outputContract: z.string().min(1).max(160),
  evidenceContract: z.array(z.string().min(1).max(120)).min(1).max(8),
  documentation: z.string().min(1).max(256),
};
const unavailable = <T extends 'tool' | 'external_script' | 'runbook'>(kind: T) =>
  z.object({ ...shared, kind: z.literal(kind), execution: z.literal('unsupported') }).strict();

/** Metadata for checkers and manual guidance. Parsing never grants execution authority. */
export const checkerSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...shared,
      kind: z.literal('http_comparison'),
      execution: z.enum(['planned', 'available', 'legacy_lab']),
    })
    .strict(),
  unavailable('tool'),
  unavailable('external_script'),
  unavailable('runbook'),
]);
export type Checker = z.infer<typeof checkerSchema>;

/** The bounded REST read comparison is the only new executable checker. */
export const bolaRestReadChecker: Checker = {
  id: 'bola_rest_read',
  version: 1,
  kind: 'http_comparison',
  categoryId: 'bola',
  supportedTargetKinds: ['rest_api'],
  supportedAuthKinds: ['api_key_header'],
  prerequisites: ['operator owner rule', 'two account-specific observations', 'own detail read'],
  risk: 'passive',
  effect: 'read_only',
  approvalRequired: false,
  limits: { maxRequests: 2, maxDurationSeconds: 30 },
  inputContract: 'bounded observed opaque resource reference and revision-bound profiles',
  outputContract: 'deterministic comparison outcome and request accounting',
  evidenceContract: ['owner response', 'alternate response', 'scope and identity bindings'],
  documentation: 'docs/contracts/checkers.md',
  execution: 'available',
};

/** Only the reviewed REST BOLA comparison has an executor registration. */
export function requireExecutableChecker(checker: Checker, targetKind: 'rest_api' | 'owned_lab'): Checker {
  if (
    checker.kind !== 'http_comparison' ||
    checker.execution !== 'available' ||
    checker.id !== 'bola_rest_read' ||
    checker.version !== 1 ||
    checker.categoryId !== 'bola' ||
    targetKind !== 'rest_api' ||
    !checker.supportedTargetKinds.includes('rest_api') ||
    !checker.supportedAuthKinds.includes('api_key_header') ||
    checker.effect !== 'read_only' ||
    checker.limits.maxRequests !== 2
  )
    throw new Error('CHECKER_UNSUPPORTED');
  return checker;
}
