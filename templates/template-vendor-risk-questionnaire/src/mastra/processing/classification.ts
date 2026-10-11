import { z } from 'zod';

import { createQuestionInterpretationAgent } from '../agents/question-interpretation.ts';
import { interpretationSchema } from '../contracts/answer.ts';
import type { Interpretation } from '../contracts/answer.ts';
import type { CanonicalQuestion } from '../contracts/question.ts';
import { canonicalJson } from '../intake/source.ts';
import { createScreening } from './security.ts';
import { providerOptions } from './model.ts';
import { ProcessingFailure } from './failure.ts';
import { reviewResult, questionPayload, trustedQuestionContext } from './answers.ts';
import type { QuestionEnvironment } from './answers.ts';

export async function classifyQuestions(questions: CanonicalQuestion[], environment: QuestionEnvironment) {
  const screenedQuestions: CanonicalQuestion[] = [];
  const interpretations = new Map<string, Interpretation>();

  for (const question of questions) {
    let attempts = 0;
    try {
      const screen = createScreening({
        ...environment,
        questionId: question.id,
        requestContext: trustedQuestionContext(question.id, environment),
        onAttempt: () => {
          attempts++;
        },
      });
      await screen(canonicalJson(questionPayload(question)), 'question');
      screenedQuestions.push(question);
    } catch (error) {
      const state = await environment.store.status(environment.runId);
      const failureReason =
        state?.run.stopReason ?? (error instanceof ProcessingFailure ? error.code : 'DETECTOR_FAILED');
      await environment.store.persistResult(environment.runId, reviewResult(question, failureReason, attempts));
    }
  }

  // One pass if it fits; only input-size overflow splits classification into bounded batches.
  const batches: CanonicalQuestion[][] = [];
  const batchInputAllowance = Math.max(1, environment.policy.maxInputTokens - 4500);
  for (const question of screenedQuestions) {
    const currentBatch = batches.at(-1);
    if (
      currentBatch &&
      Buffer.byteLength(canonicalJson([...currentBatch, question].map(questionPayload))) <= batchInputAllowance
    )
      currentBatch.push(question);
    else batches.push([question]);
  }

  for (const [batchIndex, batch] of batches.entries()) {
    const questionIds = batch.map(question => question.id) as [string, ...string[]];
    const batchSchema = z
      .object({
        interpretations: z
          .array(z.object({ questionId: z.enum(questionIds), interpretation: interpretationSchema }).strict())
          .length(batch.length),
      })
      .strict()
      .refine(
        payload => new Set(payload.interpretations.map(item => item.questionId)).size === batch.length,
        'Every requested question requires one interpretation.',
      );
    const questionId = `classification-${batchIndex}`;
    try {
      const interpretationAgent = createQuestionInterpretationAgent({
        ...environment,
        phase: 'interpretation',
        questionId,
        provider: environment.models('interpretation', questionId),
        maxTurns: 1,
        validateOutput: value => batchSchema.parse(value),
      });
      const interpretationResponse = await interpretationAgent.generate(
        canonicalJson({ questions: batch.map(questionPayload), scope: environment.evidence.record.scope }),
        {
          requestContext: trustedQuestionContext(questionId, environment),
          structuredOutput: { schema: batchSchema, errorStrategy: 'strict' },
          maxSteps: 1,
          modelSettings: { maxRetries: 0 },
          providerOptions,
        },
      );
      for (const item of batchSchema.parse(interpretationResponse.object).interpretations)
        interpretations.set(item.questionId, item.interpretation);
    } catch (error) {
      const state = await environment.store.status(environment.runId);
      const failureReason =
        state?.run.stopReason ??
        (error instanceof ProcessingFailure
          ? error.code
          : (state?.usage.filter(usage => usage.questionId === questionId && usage.reason).at(-1)?.reason ??
            'INVALID_MODEL_OUTPUT'));
      for (const question of batch)
        await environment.store.persistResult(environment.runId, reviewResult(question, failureReason));
    }
  }

  return interpretations;
}
