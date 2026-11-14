import { z } from 'zod';
import { categories, type Category, type Outcome } from '../knowledge/playbooks.js';

const outcome = z.enum([
  'CONFIRMED',
  'NOT_REPRODUCED',
  'INCONCLUSIVE',
  'NOT_APPLICABLE',
  'PRECONDITION_MISSING',
  'AUTH_REQUIRED',
  'BLOCKED',
  'OUT_OF_SCOPE',
  'EXECUTION_ERROR',
]);
const categoryBase = {
  version: z.literal(1),
  label: z.string().min(1).max(120),
  aliases: z.array(z.string().min(1).max(60)).max(8),
  applicability: z
    .array(z.enum(['owned_lab', 'rest_api']))
    .min(1)
    .max(2),
  requiredEvidence: z.array(z.string().min(1).max(120)).min(1).max(8),
  permittedCheckerIds: z.array(z.string().regex(/^[a-z][a-z0-9_]{2,63}$/)).max(8),
  outcomes: z.array(outcome).min(1),
};

/** New BOLA is a distinct category; the old IDOR identifier retains its laboratory semantics. */
export const vulnerabilityCategorySchema = z.discriminatedUnion('id', [
  z.object({ ...categoryBase, id: z.literal('bola'), execution: z.enum(['planned', 'available']) }).strict(),
  z.object({ ...categoryBase, id: z.literal('idor'), execution: z.literal('legacy_lab') }).strict(),
  ...categories
    .filter((category): category is Exclude<Category, 'idor'> => category !== 'idor')
    .map(category =>
      z.object({ ...categoryBase, id: z.literal(category), execution: z.literal('legacy_lab') }).strict(),
    ),
]);
export type VulnerabilityCategory = z.infer<typeof vulnerabilityCategorySchema>;

const legacyCheckers = {
  idor: 'check_idor',
  authentication_bypass: 'check_authentication',
  bfla: 'check_bfla',
  ssrf: 'check_owned_ssrf',
  misconfiguration: 'check_configuration',
  cors: 'check_cors',
  open_redirect: 'check_redirect',
  information_exposure: 'check_exposure',
} as const;

/** Historical findings keep `idor`; compatibility only groups labels for display/search. */
export function categoryCompatibility(id: Category | 'bola'): {
  storedId: Category | 'bola';
  family: 'BOLA_IDOR' | 'OTHER';
  proofSemantics: 'legacy_owned_lab' | 'rest_owner_comparison' | 'legacy_other';
} {
  if (id === 'idor') return { storedId: id, family: 'BOLA_IDOR', proofSemantics: 'legacy_owned_lab' };
  if (id === 'bola') return { storedId: id, family: 'BOLA_IDOR', proofSemantics: 'rest_owner_comparison' };
  return { storedId: id, family: 'OTHER', proofSemantics: 'legacy_other' };
}

const legacyOutcomes: Outcome[] = [
  'CONFIRMED',
  'NOT_REPRODUCED',
  'INCONCLUSIVE',
  'NOT_APPLICABLE',
  'PRECONDITION_MISSING',
  'AUTH_REQUIRED',
  'BLOCKED',
  'OUT_OF_SCOPE',
  'EXECUTION_ERROR',
];

/** Existing local categories stay in the catalog without gaining external-target support. */
export const vulnerabilityCategoryCatalog: VulnerabilityCategory[] = [
  {
    id: 'bola',
    version: 1,
    label: 'Broken object level authorization',
    aliases: ['BOLA', 'IDOR'],
    applicability: ['rest_api'],
    requiredEvidence: ['two account-specific collections', 'own detail read', 'cross-account detail read'],
    permittedCheckerIds: ['bola_rest_read'],
    outcomes: legacyOutcomes,
    execution: 'available',
  },
  ...categories.map(category => ({
    id: category,
    version: 1 as const,
    label: category === 'idor' ? 'Legacy IDOR' : category.replaceAll('_', ' '),
    aliases: category === 'idor' ? ['IDOR', 'BOLA terminology'] : [],
    applicability: ['owned_lab'] as ['owned_lab'],
    requiredEvidence: ['category-specific owned-lab proof'],
    permittedCheckerIds: [legacyCheckers[category]],
    outcomes: legacyOutcomes,
    execution: 'legacy_lab' as const,
  })),
];
