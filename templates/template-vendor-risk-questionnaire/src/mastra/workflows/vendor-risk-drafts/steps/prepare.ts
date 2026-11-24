import { isStorageFailure } from '../../../persistence/client.ts';
import { createStep } from '@mastra/core/workflows';
import { resolve } from 'node:path';
import { z } from 'zod';

import { defaultLimits } from '../../../contracts/limits.ts';
import { buildEvidenceSnapshot, loadManifest, validateSnapshotSources } from '../../../evidence/snapshot.ts';
import { openDatabase, databaseUrl, runtimeRoot } from '../../../persistence/database.ts';
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
import { prepareCompletion } from '../../../persistence/completion.ts';

export async function prepareDraftRun(
  runtime: DraftWorkflowRuntime,
  inputData: z.infer<typeof draftInputSchema>,
  workflowRunId: string,
) {
  const intakeRunId = inputData.runId;
  if (runtime.workflowOwners.has(intakeRunId)) throw new ProcessingFailure('STORAGE_FAILURE');

  // Claim the local owner before awaiting anything, so a duplicate cannot replace this run's state.
  runtime.options.storageOwner!.claim(intakeRunId);
  runtime.workflowOwners.set(intakeRunId, workflowRunId);
  let store: ProcessingStore;
  try {
    store = await openProcessingStore(
      runtime.options.databaseUrl ?? databaseUrl,
      undefined,
      runtime.options.storageOwner,
      runtime.options.applicationClient,
    );
  } catch {
    runtime.options.storageOwner?.release(intakeRunId);
    runtime.workflowOwners.delete(intakeRunId);
    throw new ProcessingFailure('STORAGE_FAILURE');
  }
  runtime.stores.set(intakeRunId, store);

  try {
    const config = await openDatabase(runtime.options.databaseUrl ?? databaseUrl);
    try {
      await config.execute({
        sql: 'INSERT INTO vrq_draft_inputs (run_id,input_json) VALUES (?,?) ON CONFLICT(run_id) DO NOTHING',
        args: [intakeRunId, JSON.stringify(inputData)],
      });
    } finally {
      config.close();
    }
    await store.begin(intakeRunId, inputData.policy, workflowRunId);
    store.bindOwner(intakeRunId, () => closeDraftRun(runtime, intakeRunId));
    const intake = await store.readIntake(intakeRunId);
    const persistedEvidence = await store.readEvidence(intakeRunId);
    if (!intake || !persistedEvidence) throw new ProcessingFailure('SOURCE_UNAVAILABLE');

    const sourceContext = { limits: defaultLimits, signal: AbortSignal.timeout(defaultLimits.timeoutMs) };
    try {
      await prepareCompletion(runtime.options.databaseUrl ?? databaseUrl, intakeRunId);
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
      const previous = (await store.status(intakeRunId))!.results;
      const pending = intake.input.questions.filter(q => !previous.some(r => r.questionId === q.id));
      const interpretations = await classifyQuestions(pending, environment);
      for (const result of previous)
        if (result.interpretation) interpretations.set(result.questionId, result.interpretation);
      runtime.sessions.set(intakeRunId, { questions: intake.input.questions, environment, interpretations });

      return intake.input.questions
        .filter(question => interpretations.has(question.id))
        .map(question => ({ runId: intakeRunId, questionId: question.id }));
    } catch (error) {
      const reason =
        isStorageFailure(error) || runtime.options.storageOwner?.stopped
          ? 'STORAGE_FAILURE'
          : error instanceof ProcessingFailure
            ? error.code
            : 'SOURCE_UNAVAILABLE';
      if (reason === 'STORAGE_FAILURE') store.stopAdmission();
      await store.stop(intakeRunId, reason);
      const retained = (await store.status(intakeRunId))!.results;
      for (const question of intake.input.questions)
        if (!retained.some(r => r.questionId === question.id))
          await store.persistResult(intakeRunId, reviewResult(question, reason));
      return [];
    }
  } catch (error) {
    await closeDraftRun(runtime, intakeRunId);
    throw new ProcessingFailure(error instanceof ProcessingFailure ? error.code : 'STORAGE_FAILURE');
  }
}
export function createPrepareDraftRunStep(runtime: DraftWorkflowRuntime) {
  return createStep({
    id: 'prepare-draft-run',
    inputSchema: draftInputSchema,
    outputSchema: z.array(draftQuestionInputSchema),
    execute: async ({ inputData, runId }) => prepareDraftRun(runtime, inputData, runId),
  });
}
export async function rehydrateDraftRun(runtime: DraftWorkflowRuntime, runId: string) {
  if (runtime.sessions.has(runId)) return;
  let pending = runtime.rehydrating.get(runId);
  if (!pending) {
    pending = (async () => {
      const db = await openDatabase(runtime.options.databaseUrl ?? databaseUrl);
      try {
        const rows = await db.execute({
          sql: 'SELECT i.input_json,o.workflow_run_id FROM vrq_draft_inputs i JOIN vrq_draft_owners o ON i.run_id=o.run_id WHERE i.run_id = ?',
          args: [runId],
        });
        if (!rows.rows[0]) throw new ProcessingFailure('STORAGE_FAILURE');
        await prepareDraftRun(
          runtime,
          draftInputSchema.parse(JSON.parse(String(rows.rows[0].input_json))),
          String(rows.rows[0].workflow_run_id),
        );
      } finally {
        db.close();
      }
    })();
    runtime.rehydrating.set(runId, pending);
  }
  await pending;
}
