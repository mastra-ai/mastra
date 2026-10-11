import { createStep } from '@mastra/core/workflows';
import { resolve } from 'node:path';
import { z } from 'zod';

import { defaultLimits } from '../../../contracts/limits.ts';
import { buildEvidenceSnapshot, loadManifest, validateSnapshotSources } from '../../../evidence/snapshot.ts';
import { databaseUrl, runtimeRoot } from '../../../persistence/database.ts';
import { openProcessingStore } from '../../../persistence/processing.ts';
import type { ProcessingStore } from '../../../persistence/processing.ts';
import { reviewResult } from '../../../processing/answers.ts';
import type { QuestionEnvironment } from '../../../processing/answers.ts';
import { classifyQuestions } from '../../../processing/classification.ts';
import { ProcessingFailure } from '../../../processing/failure.ts';
import { createProvider } from '../../../processing/model.ts';
import type { ModelFactory } from '../../../processing/model.ts';
import { draftInputSchema, draftQuestionInputSchema } from '../contracts.ts';
import { closeDraftRun } from '../runtime.ts';
import type { DraftWorkflowRuntime } from '../runtime.ts';

export function createPrepareDraftRunStep(runtime: DraftWorkflowRuntime) {
  return createStep({
    id: 'prepare-draft-run',
    inputSchema: draftInputSchema,
    outputSchema: z.array(draftQuestionInputSchema),
    execute: async ({ inputData, runId: workflowRunId }) => {
      const intakeRunId = inputData.runId;
      if (runtime.workflowOwners.has(intakeRunId)) throw new ProcessingFailure('STORAGE_FAILURE');

      // Claim the local owner before awaiting anything, so a duplicate cannot replace this run's state.
      runtime.workflowOwners.set(intakeRunId, workflowRunId);
      let store: ProcessingStore;
      try {
        store = await openProcessingStore(runtime.options.databaseUrl ?? databaseUrl);
      } catch {
        runtime.workflowOwners.delete(intakeRunId);
        throw new ProcessingFailure('STORAGE_FAILURE');
      }
      runtime.stores.set(intakeRunId, store);

      try {
        await store.begin(intakeRunId, inputData.policy);
        const intake = await store.readIntake(intakeRunId);
        const persistedEvidence = await store.readEvidence(intakeRunId);
        if (!intake || !persistedEvidence) throw new ProcessingFailure('SOURCE_UNAVAILABLE');

        const sourceContext = { limits: defaultLimits, signal: AbortSignal.timeout(defaultLimits.timeoutMs) };
        try {
          const manifest = await loadManifest(inputData.manifestPath);
          await validateSnapshotSources(persistedEvidence, manifest, inputData.evidenceRoot, sourceContext);
          const evidence = await buildEvidenceSnapshot({
            runId: intakeRunId,
            root: inputData.evidenceRoot,
            runtimeRoot: runtime.options.runtimeRoot ?? runtimeRoot,
            manifest,
            scope: persistedEvidence.scope,
            asOf: persistedEvidence.asOf,
            context: sourceContext,
          });
          if (evidence.record.digest !== persistedEvidence.digest) throw new ProcessingFailure('SOURCE_UNAVAILABLE');

          const provider = runtime.options.models ? undefined : createProvider(inputData.policy);
          const models: ModelFactory = runtime.options.models ?? (() => provider!);
          const environment: QuestionEnvironment = {
            runId: intakeRunId,
            policy: inputData.policy,
            store,
            models,
            evidence,
            evidenceRoot: resolve(inputData.evidenceRoot),
            context: { limits: defaultLimits, signal: new AbortController().signal },
          };
          const interpretations = await classifyQuestions(intake.input.questions, environment);
          runtime.sessions.set(intakeRunId, { questions: intake.input.questions, environment, interpretations });

          return intake.input.questions
            .filter(question => interpretations.has(question.id))
            .map(question => ({ runId: intakeRunId, questionId: question.id }));
        } catch (error) {
          const reason = error instanceof ProcessingFailure ? error.code : 'SOURCE_UNAVAILABLE';
          await store.stop(intakeRunId, reason);
          for (const question of intake.input.questions)
            await store.persistResult(intakeRunId, reviewResult(question, reason));
          return [];
        }
      } catch (error) {
        closeDraftRun(runtime, intakeRunId);
        throw new ProcessingFailure(error instanceof ProcessingFailure ? error.code : 'STORAGE_FAILURE');
      }
    },
  });
}
