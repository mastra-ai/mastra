import { z } from 'zod';

import { bindAnswerConsistencyAgent } from '../agents/answer-consistency.ts';
import { questionResultSchema } from '../contracts/answer.ts';
import type { QuestionResult, Reason } from '../contracts/answer.ts';
import { canonicalJson } from '../intake/source.ts';
import { trustedQuestionContext } from './answers.ts';
import type { QuestionEnvironment } from './answers.ts';
import { providerOptions } from './model.ts';
import { createScreening } from './security.ts';
import { ProcessingFailure, globalFailures } from './failure.ts';

const comparisonSchema = z.object({ materialContradiction: z.boolean() }).strict();

export async function flagInconsistentAnswers(inputResults: QuestionResult[], environment: QuestionEnvironment) {
  const resultsByQuestionId = new Map(inputResults.map(result => [result.questionId, result]));
  const equivalentGroups = new Map<string, QuestionResult[]>();

  for (const result of inputResults) {
    const interpretation = result.interpretation;
    if (!interpretation?.equivalenceKey || !result.draft || result.draft.value === 'unknown') continue;

    const scopeKey = canonicalJson({
      equivalenceKey: interpretation.equivalenceKey,
      domain: interpretation.domain,
      product: interpretation.product,
      environment: interpretation.environment,
      timeQualifier: interpretation.timeQualifier,
    });
    const group = equivalentGroups.get(scopeKey) ?? [];
    group.push(result);
    equivalentGroups.set(scopeKey, group);
  }

  let pairIndex = 0;
  async function markForReview(questionIds: string[], reason: Reason) {
    for (const questionId of questionIds) {
      const previous = resultsByQuestionId.get(questionId)!;
      const securityFailure = reason === 'SECURITY_BLOCKED' || reason === 'DETECTOR_FAILED';
      const result = questionResultSchema.parse({
        ...previous,
        draft: securityFailure ? null : previous.draft,
        status:
          securityFailure || previous.status === 'security_review_required'
            ? 'security_review_required'
            : 'review_required',
        reasons: [...new Set([...previous.reasons, reason])],
      });
      resultsByQuestionId.set(questionId, result);
      await environment.store.persistResult(environment.runId, result);
    }
  }

  // At most 100 answers yield 4,950 pairs. Every physical attempt shares the finite run authority.
  for (const group of equivalentGroups.values()) {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex++) {
        const leftAnswer = group[leftIndex]!;
        const rightAnswer = group[rightIndex]!;
        const questionIds = [leftAnswer.questionId, rightAnswer.questionId];
        const questionId = `consistency-${pairIndex++}`;
        const requestContext = trustedQuestionContext(questionId, environment);

        try {
          const state = await environment.store.status(environment.runId);
          if (state?.run.stopReason) throw new ProcessingFailure(state.run.stopReason);

          // A previously blocked answer cannot be reused in a later comparison.
          if (questionIds.some(id => resultsByQuestionId.get(id)?.status === 'security_review_required')) {
            await markForReview(questionIds, 'DETECTOR_FAILED');
            continue;
          }

          const comparisonPayload = canonicalJson({
            scope: leftAnswer.interpretation,
            answers: [leftAnswer, rightAnswer].map(answer => ({
              questionId: answer.questionId,
              value: answer.draft!.value,
              text: answer.draft!.text,
              claims: answer.draft!.claims.map(claim => ({ id: claim.id, text: claim.text, kind: claim.kind })),
              limitations: answer.draft!.limitations,
            })),
          });
          const screenComparison = createScreening({ ...environment, questionId, requestContext });
          await screenComparison(comparisonPayload, 'draft');

          const verifier = bindAnswerConsistencyAgent(
            {
              ...environment,
              questionId,
              phase: 'verification',
              provider: environment.models('verification', questionId),
              maxTurns: 1,
              validateOutput: value => comparisonSchema.parse(value),
            },
            requestContext,
          );
          const response = await verifier.generate(comparisonPayload, {
            requestContext,
            structuredOutput: { schema: comparisonSchema, errorStrategy: 'strict' },
            maxSteps: 1,
            modelSettings: { maxRetries: 0 },
            providerOptions,
          });
          if (comparisonSchema.parse(response.object).materialContradiction)
            await markForReview(questionIds, 'INCONSISTENT_ANSWERS');
        } catch (error) {
          const state = await environment.store.status(environment.runId);
          const failureReason =
            state?.run.stopReason ??
            (error instanceof ProcessingFailure
              ? error.code
              : (state?.usage.filter(usage => usage.questionId === questionId && usage.reason).at(-1)?.reason ??
                'INVALID_MODEL_OUTPUT'));
          if (globalFailures.includes(failureReason)) await environment.store.stop(environment.runId, failureReason);
          await markForReview(questionIds, failureReason);
        }
      }
    }
  }

  return [...resultsByQuestionId.values()];
}
