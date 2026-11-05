import { z } from 'zod';
import { idSchema } from '../core/contracts.js';
import { categories, observationSchema, type Outcome, type Playbook } from '../knowledge/playbooks.js';

/** Validated verification proof contract; bounds and cross-field rules are enforced before use. */
export const verificationProofSchema = z
  .object({
    /** Trusted origin of this observation or proof. */
    source: z.enum(['policy-precheck', 'owned-gateway']),
    /** Discriminator selecting the vulnerability category and its typed facts. */
    category: z.enum(categories),
    /** Whether the bounded verification completed with admissible observations. */
    completed: z.boolean(),
    /** Whether source evidence contains the relevant test surface. */
    surfacePresent: z.boolean(),
    /** Whether all required owned resources and bindings are available. */
    prerequisitesReady: z.boolean(),
    /** Whether all participating identities passed the trusted check. */
    identityValid: z.boolean(),
    /** Whether the exact operation fits current authorization. */
    scopeApproved: z.boolean(),
    /** Actual upstream contacts observed by the gateway. */
    requestCount: z.number().int().nonnegative().max(12),
    /** Bounded normalized evidence identifiers and kinds supporting this proof. */
    evidence: z
      .array(
        z
          .object({
            /** Stable identifier of this record. */
            id: idSchema,
            /** Evidence kind matched against the playbook requiredEvidence contract. */
            kind: z.string().min(1).max(80),
          })
          .strict(),
      )
      .max(12),
    /** Normalized admissible facts; raw response content is excluded. */
    observation: observationSchema.optional(),
    /** Whether sanitization withheld any proof; withheld proof cannot confirm a finding. */
    withheld: z.boolean(),
  })
  .strict()
  .superRefine((proof, context) => {
    if (proof.observation && proof.observation.category !== proof.category)
      context.addIssue({ code: 'custom', message: 'Observation category must match the proof.' });
    if (proof.completed && !proof.observation)
      context.addIssue({ code: 'custom', message: 'Completed verification needs a normalized observation.' });
  });
/** Sanitized deterministic proof; incomplete observations cannot confirm a finding. */
export type VerificationProof = z.infer<typeof verificationProofSchema>;

/** Classify bounded verification evidence without treating missing or withheld proof as confirmation. */
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
