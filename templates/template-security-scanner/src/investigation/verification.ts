import { z } from 'zod';
import { idSchema } from '../core/contracts.js';
import { categories, observationSchema, type Outcome, type Playbook } from '../knowledge/playbooks.js';

export const verificationProofSchema = z
  .object({
    source: z.enum(['policy-precheck', 'owned-gateway']),
    category: z.enum(categories),
    completed: z.boolean(),
    surfacePresent: z.boolean(),
    prerequisitesReady: z.boolean(),
    identityValid: z.boolean(),
    scopeApproved: z.boolean(),
    requestCount: z.number().int().nonnegative().max(12),
    evidence: z.array(z.object({ id: idSchema, kind: z.string().min(1).max(80) }).strict()).max(12),
    observation: observationSchema.optional(),
    withheld: z.boolean(),
  })
  .strict()
  .superRefine((proof, context) => {
    if (proof.observation && proof.observation.category !== proof.category)
      context.addIssue({ code: 'custom', message: 'Observation category must match the proof.' });
    if (proof.completed && !proof.observation)
      context.addIssue({ code: 'custom', message: 'Completed verification needs a normalized observation.' });
  });
export type VerificationProof = z.infer<typeof verificationProofSchema>;

export function deterministicOutcome(
  playbook: Playbook,
  proof: VerificationProof,
  assessed: Outcome,
  watson: 'agree' | 'disagree' | 'uncertain',
) {
  if (!proof.scopeApproved) return 'OUT_OF_SCOPE' as const;
  if (!proof.surfacePresent) return 'NOT_APPLICABLE' as const;
  if (!proof.prerequisitesReady) return 'PRECONDITION_MISSING' as const;
  if (!proof.identityValid) return 'AUTH_REQUIRED' as const;
  if (!proof.completed || proof.withheld) return 'INCONCLUSIVE' as const;
  if (assessed !== 'CONFIRMED') return assessed;
  if (proof.source !== 'owned-gateway') return 'INCONCLUSIVE' as const;
  if (watson !== 'agree') return 'INCONCLUSIVE' as const;
  const kinds = new Set(proof.evidence.map(item => item.kind));
  if (playbook.requiredEvidence.some(kind => !kinds.has(kind))) return 'INCONCLUSIVE' as const;
  if (new Set(proof.evidence.map(item => item.id)).size !== proof.evidence.length) return 'INCONCLUSIVE' as const;
  return 'CONFIRMED' as const;
}
