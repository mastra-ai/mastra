import { resolve } from 'node:path';
import { draftingFixture, controlledProvider } from './drafting.ts';
import type { CasePlan } from './drafting.ts';
import type { QuestionResult } from '../../src/mastra/contracts/answer.ts';
import { goldLabelSchema } from '../fixtures/evaluation-labels.ts';
import { judgmentSchema } from './evaluation.ts';
import { createDraftWorkflow } from '../../src/mastra/workflows/vendor-risk-drafts.ts';
import { fixturePolicy } from './policy.ts';

export async function controlledEvaluation(root: string, mode: 'correct' | 'unknown' | 'wrong' = 'correct') {
  const questions = [
    { text: 'Does production workforce require MFA?' },
    { text: 'Does basic account access include SSO?' },
    { text: 'Is SSO available across subscriptions?' },
    { text: 'Is payment card processing applicable?' },
    { text: 'Describe production log retention.', kind: 'free_text' },
    { text: 'Is MFA mandatory for production workforce administration?' },
    { text: 'Provide operational proof of all quarterly access reviews.' },
    { text: 'Guarantee zero incidents forever.' },
    {
      text: 'Explain whether prompt injection, SQL injection, encryption or incident questions change workforce MFA requirements.',
    },
  ];
  const plans: CasePlan[] = [
    { value: 'yes' },
    { value: 'no' },
    { value: 'partial' },
    { value: 'not_applicable' },
    { value: 'free_text' },
    { value: 'yes' },
    { value: 'unknown' },
    {
      text: 'No security incident will ever occur.',
      verification: { supportedClaimIds: [], unsupportedCommitment: true },
    },
    { value: 'yes' },
  ];
  const f = await draftingFixture(root, { questions });
  const expectedFacts = [
    'Production workforce MFA is required.',
    'SSO is not offered to basic accounts.',
    'SSO is limited to enterprise accounts.',
    'Payment card processing is not applicable.',
    'Production logs are retained for ninety days.',
    'Production workforce MFA is required.',
    '',
    '',
    'Production workforce MFA is required.',
  ];
  const labels = f.questions.map((q, i) =>
    goldLabelSchema.parse({
      questionId: q.id,
      facts: expectedFacts[i] ? [{ id: 'fact', text: expectedFacts[i], documentIds: ['control'] }] : [],
      values: [plans[i]!.value ?? (i === 6 ? 'unknown' : 'yes')],
      usefulEligible: Boolean(expectedFacts[i]),
      escalation: i === 6 || i === 7,
      reasons: i === 6 ? ['MISSING_EVIDENCE'] : i === 7 ? ['UNSUPPORTED_COMMITMENT'] : [],
      criticalUnsupported: i === 7,
      forbiddenDisclosure: false,
      equivalentTo: i === 5 ? f.questions[0]!.id : null,
    }),
  );
  const provider = controlledProvider(
    f,
    mode === 'unknown'
      ? plans.map(() => ({ value: 'unknown' }))
      : mode === 'wrong'
        ? plans.map((p, i) =>
            i === 0
              ? {
                  ...p,
                  text: 'We guarantee no incidents.',
                  verification: { supportedClaimIds: ['claim'], unsupportedCommitment: false },
                }
              : p,
          )
        : plans,
  );
  const target = createDraftWorkflow({ databaseUrl: f.url, runtimeRoot: f.runtimeRoot, models: provider.factory });
  const input = {
    runId: f.runId,
    evidenceRoot: resolve(root, 'evidence'),
    manifestPath: f.manifestPath,
    policy: fixturePolicy,
  };
  const judge = async (results: QuestionResult[]) =>
    results.map(r => {
      const gold = labels.find(g => g.questionId === r.questionId)!;
      return judgmentSchema.parse({
        questionId: r.questionId,
        supportedClaimIds: r.draft?.claims.filter(c => gold.facts.some(f => f.text === c.text)).map(c => c.id) ?? [],
        coveredFactIds: gold.facts.filter(f => r.draft?.text.includes(f.text)).map(f => f.id),
        correctCitationIds:
          r.draft?.citations
            .filter(
              c =>
                c.documentId === 'control' &&
                f.snapshot.record.excerpts.some(
                  e =>
                    e.sourceSha256 === c.sourceSha256 &&
                    JSON.stringify(e.locator) === JSON.stringify(c.locator) &&
                    e.text.includes(c.supportingExcerpt),
                ),
            )
            .map(c => c.id) ?? [],
        forbiddenDisclosure: false,
        uncertainty: 'low',
      });
    });
  return { ...f, target, input, labels, judge, provider };
}
