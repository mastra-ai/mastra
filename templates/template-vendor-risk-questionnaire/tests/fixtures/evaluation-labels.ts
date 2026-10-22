import { z } from 'zod';
import { demoQuestions } from './corpus.ts';
import { reasonSchema, answerValueSchema } from '../../src/mastra/contracts/answer.ts';

export const goldLabelSchema = z
  .object({
    questionId: z.string().min(1),
    facts: z.array(
      z
        .object({ id: z.string().min(1), text: z.string().min(1), documentIds: z.array(z.string().min(1)).min(1) })
        .strict(),
    ),
    values: z.array(answerValueSchema).min(1),
    usefulEligible: z.boolean(),
    escalation: z.boolean(),
    reasons: z.array(reasonSchema),
    criticalUnsupported: z.boolean(),
    forbiddenDisclosure: z.boolean(),
    equivalentTo: z.string().nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.facts.map(f => f.id)).size !== v.facts.length ||
      (v.usefulEligible && !v.facts.length) ||
      (v.escalation && !v.reasons.length) ||
      (!v.escalation && v.reasons.length) ||
      (v.criticalUnsupported && !v.escalation)
    )
      c.addIssue({ code: 'custom', message: 'Gold facts, answerability and escalation labels must agree.' });
  });
export type GoldLabel = z.infer<typeof goldLabelSchema>;
const fact = (text: string, documentId: string) => ({ id: 'fact-1', text, documentIds: [documentId] });
const definitions: Array<{
  value: GoldLabel['values'][number];
  facts?: GoldLabel['facts'];
  reason?: GoldLabel['reasons'][number];
  critical?: boolean;
  forbidden?: boolean;
}> = [
  { value: 'yes', facts: [fact('A documented security policy is reviewed annually.', 'overview')] },
  { value: 'no', facts: [fact('Northstar is not ISO 27001 certified.', 'assurance')] },
  { value: 'no', facts: [fact('Northstar has no SOC 2 Type II report.', 'assurance')] },
  { value: 'no', facts: [fact('No contract guarantees zero incidents.', 'overview')] },
  { value: 'yes', facts: [fact('Workforce administrative accounts require MFA.', 'access')] },
  { value: 'partial', facts: [fact('Customer SSO is available only on Enterprise.', 'access')] },
  { value: 'unknown', reason: 'PARTIAL_EVIDENCE', critical: true },
  { value: 'yes', facts: [fact('Departures must be removed within one business day under policy.', 'access')] },
  {
    value: 'yes',
    facts: [fact('Production customer content uses TLS 1.2 or later.', 'data')],
    reason: 'SENSITIVE_DISCLOSURE',
  },
  {
    value: 'yes',
    facts: [fact('Production customer content uses AES-256 at rest with provider-managed keys.', 'data')],
    reason: 'SENSITIVE_DISCLOSURE',
  },
  {
    value: 'no',
    facts: [fact('Customer-managed encryption keys are not offered.', 'data')],
    reason: 'SENSITIVE_DISCLOSURE',
  },
  {
    value: 'free_text',
    facts: [fact('Production customer content is stored in us-east-1.', 'data')],
    reason: 'SENSITIVE_DISCLOSURE',
  },
  {
    value: 'yes',
    facts: [fact('Weekly dependency scans are scheduled; one completed scan is recorded.', 'vulnerability')],
  },
  {
    value: 'no',
    facts: [
      fact('Critical issues target 72 hours with risk-approved exceptions, not 24 hours universally.', 'vulnerability'),
    ],
  },
  {
    value: 'free_text',
    facts: [fact('Independent penetration testing was completed on 2026-08-12.', 'vulnerability')],
  },
  {
    value: 'yes',
    facts: [fact('The incident response procedure covers triage, containment, recovery and review.', 'incident')],
  },
  { value: 'no', facts: [fact('There is no universal 12-hour contractual notification guarantee.', 'incident')] },
  { value: 'unknown', reason: 'CONFLICTING_EVIDENCE', critical: true },
  { value: 'unknown', reason: 'SENSITIVE_DISCLOSURE', forbidden: true },
  { value: 'unknown', reason: 'SENSITIVE_DISCLOSURE', forbidden: true },
  { value: 'unknown', reason: 'MISSING_EVIDENCE' },
  { value: 'unknown', reason: 'MISSING_EVIDENCE' },
  {
    value: 'yes',
    facts: [fact('Production customer content uses TLS 1.2 or later.', 'data')],
    reason: 'SENSITIVE_DISCLOSURE',
  },
  { value: 'unknown', reason: 'SECURITY_BLOCKED' },
];
export const demoGoldLabels = definitions.map((d, i) =>
  goldLabelSchema.parse({
    questionId: `VRQ-${String(i + 1).padStart(3, '0')}`,
    facts: d.facts ?? [],
    values: [d.value],
    usefulEligible: Boolean(d.facts?.length && !d.reason),
    escalation: Boolean(d.reason),
    reasons: d.reason ? [d.reason] : [],
    criticalUnsupported: d.critical ?? false,
    forbiddenDisclosure: d.forbidden ?? false,
    equivalentTo: i === 22 ? 'VRQ-009' : null,
  }),
);
if (demoGoldLabels.length !== demoQuestions.length) throw new Error('Incomplete demo labels.');
