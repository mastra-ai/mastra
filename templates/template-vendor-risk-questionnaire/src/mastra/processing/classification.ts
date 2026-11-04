import { generatePhase } from '../agents/runtime.ts';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { questionInterpretationAgent, interpretationInstructions } from '../agents/question-interpretation.ts';
import {
  interpretationChoices,
  equivalenceCatalogue,
  wireInterpretationSchema,
  deriveInterpretation,
  sourceCatalogue,
} from './interpretation.ts';
import type { CanonicalQuestion } from '../contracts/question.ts';
import { canonicalJson } from '../intake/source.ts';
import { createScreening } from './security.ts';
import { isStorageFailure } from '../persistence/client.ts';
import { ProcessingFailure } from './failure.ts';
import { reviewResult, questionPayload, trustedQuestionContext } from './answers.ts';
import type { QuestionEnvironment } from './answers.ts';

export async function classifyQuestions(questions: CanonicalQuestion[], environment: QuestionEnvironment) {
  const screenedQuestions: CanonicalQuestion[] = [];
  const interpretations = await environment.store.readInterpretations(environment.runId);

  for (const question of questions) {
    if (interpretations.has(question.id)) continue;
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
      if (isStorageFailure(error) || (error instanceof ProcessingFailure && error.code === 'STORAGE_FAILURE')) {
        environment.store.stopAdmission();
        await environment.store.stop(environment.runId, 'STORAGE_FAILURE');
      }
      const state = await environment.store.status(environment.runId);
      const failureReason =
        state?.run.stopReason ?? (error instanceof ProcessingFailure ? error.code : 'DETECTOR_FAILED');
      await environment.store.persistResult(environment.runId, reviewResult(question, failureReason, attempts));
    }
  }

  // Bound both input size and expected structured response size when grouping classification.
  const batches: CanonicalQuestion[][] = [];
  const batchInputAllowance = Math.max(1, environment.policy.maxInputTokens - 6500);
  for (const question of screenedQuestions) {
    const currentBatch = batches.at(-1);
    if (
      currentBatch &&
      currentBatch.length < Math.max(1, Math.min(2, Math.floor(environment.policy.maxOutputTokens / 2000))) &&
      Buffer.byteLength(canonicalJson([...currentBatch, question].map(questionPayload))) <= batchInputAllowance
    )
      currentBatch.push(question);
    else batches.push([question]);
  }

  const equivalences = equivalenceCatalogue(screenedQuestions, `${environment.runId}:${randomUUID()}`);
  for (let batchIndex = 0; batchIndex < batches.length;) {
    const batch = batches[batchIndex]!;
    const scope = `${environment.runId}:${randomUUID()}`;
    const catalogues = new Map(batch.map(question => [question.id, sourceCatalogue(question, scope)]));
    const choices = new Map(
      batch.map(question => [
        question.id,
        interpretationChoices(question, catalogues.get(question.id)!, environment.evidence.record.scope),
      ]),
    );
    const responseSchema = z
      .object({
        interpretations: z
          .object(
            Object.fromEntries(
              batch.map(question => [
                question.id,
                wireInterpretationSchema(catalogues.get(question.id)!, choices.get(question.id)!, equivalences),
              ]),
            ),
          )
          .strict(),
      })
      .strict();
    const questionId = `classification-${batchIndex}`;
    const requestContext = trustedQuestionContext(questionId, environment);
    try {
      const instructionSources = [
        ...new Set(equivalences.filter(item => item.instructions).map(item => item.instructions)),
      ];
      const payload = canonicalJson({
        questions: batch.map(question => ({
          ...questionPayload(question),
          text: undefined,
          instructions: undefined,
          spans: catalogues.get(question.id),
          equivalenceRef: equivalences.find(item => item.questionId === question.id)!.ref,
        })),
        scope: environment.evidence.record.scope,
        equivalences: Object.fromEntries(
          equivalences.map(item => [
            item.ref,
            batch.some(q => q.id === item.questionId)
              ? null
              : [item.text, item.instructions ? instructionSources.indexOf(item.instructions) : null],
          ]),
        ),
        instructionSources,
      });
      // Pre-call planning is conservative; boundedModel still checks actual native options.
      const plannedBytes =
        Buffer.byteLength(
          JSON.stringify({
            prompt: [
              { role: 'system', content: interpretationInstructions },
              { role: 'user', content: payload },
            ],
            responseFormat: { type: 'json', schema: z.toJSONSchema(responseSchema) },
            tools: [],
          }),
        ) + 1024;
      if (batch.length > 1 && plannedBytes > environment.policy.maxInputTokens) {
        batches.splice(batchIndex, 1, ...batch.map(question => [question]));
        continue;
      }
      // Screen the exact assembled untrusted catalogue, including fragments from other batches.
      await createScreening({ ...environment, questionId, requestContext })(payload, 'question');
      const result = await generatePhase(
        questionInterpretationAgent,
        {
          ...environment,
          phase: 'interpretation',
          questionId,
          provider: environment.models('interpretation', questionId),
          maxTurns: 1,
        },
        requestContext,
        payload,
        responseSchema,
      );
      for (const question of batch) {
        const interpretation = deriveInterpretation(
          catalogues.get(question.id)!,
          result.interpretations[question.id]!,
          equivalences,
        );
        await environment.store.persistInterpretation(environment.runId, question.id, interpretation);
        interpretations.set(question.id, interpretation);
      }
    } catch (error) {
      if (isStorageFailure(error) || (error instanceof ProcessingFailure && error.code === 'STORAGE_FAILURE')) {
        environment.store.stopAdmission();
        await environment.store.stop(environment.runId, 'STORAGE_FAILURE');
      }
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
    batchIndex++;
  }

  return interpretations;
}
