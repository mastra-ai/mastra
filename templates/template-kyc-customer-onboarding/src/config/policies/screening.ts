import { z } from 'zod';

import { deepFreeze, type DeepReadonly } from '../../domain/immutable.js';

const matchingBandSchema = z
  .object({
    possibleMatchThreshold: z.number().min(0).max(1),
    strongCandidateThreshold: z.number().min(0).max(1),
  })
  .strict()
  .refine(value => value.possibleMatchThreshold < value.strongCandidateThreshold, {
    message: 'possible match threshold must be lower than strong candidate threshold',
  });

const matchingScopeSchema = matchingBandSchema.extend({ topics: z.array(z.string().min(1).max(80)).min(1) }).strict();

export const screeningPolicySchema = z
  .object({
    id: z.literal('demo-screening'),
    version: z.literal('1.0.0'),
    profile: z.enum(['demo-default', 'demo-strict']),
    dataset: z.literal('default'),
    algorithm: z.literal('logic-v2'),
    limit: z.literal(5),
    sanctions: matchingScopeSchema,
    pep: matchingScopeSchema,
  })
  .strict();

export type ScreeningPolicy = DeepReadonly<z.infer<typeof screeningPolicySchema>>;

const createPolicy = (profile: ScreeningPolicy['profile']): ScreeningPolicy =>
  deepFreeze(
    screeningPolicySchema.parse({
      id: 'demo-screening',
      version: '1.0.0',
      profile,
      dataset: 'default',
      algorithm: 'logic-v2',
      limit: 5,
      sanctions: {
        possibleMatchThreshold: 0.7,
        strongCandidateThreshold: 0.85,
        topics: ['sanction', 'sanction.linked', 'debarment'],
      },
      pep: {
        possibleMatchThreshold: 0.7,
        strongCandidateThreshold: 0.85,
        topics: ['role.pep', 'role.rca'],
      },
    }),
  );

const policies = Object.freeze({
  'demo-default': createPolicy('demo-default'),
  'demo-strict': createPolicy('demo-strict'),
});

export const loadScreeningPolicy = (profile: ScreeningPolicy['profile']): ScreeningPolicy => policies[profile];

export const classifyScreeningScore = (
  score: number,
  scope: Pick<z.infer<typeof matchingScopeSchema>, 'possibleMatchThreshold' | 'strongCandidateThreshold'>,
): 'NO_MATERIAL_MATCH' | 'POSSIBLE' | 'STRONG_REVIEW' => {
  if (score < scope.possibleMatchThreshold) return 'NO_MATERIAL_MATCH';
  return score >= scope.strongCandidateThreshold ? 'STRONG_REVIEW' : 'POSSIBLE';
};
