import { randomUUID } from 'node:crypto';

import type {
  EvaluationExperimentRuntime,
  ExperimentFamily,
  NativeDataset,
  NativeExperimentResult,
  NativeExperimentRun,
} from './contracts.js';
import { asEvaluationCase, candidateSchema } from './contracts.js';
import { datasetItems } from './datasets.js';
import { EVALUATION_CORPUS_VERSION } from './fixtures/cases.js';
import {
  EVALUATION_STORE_NAME,
  GROUNDEDNESS_SCORER_ID,
  MAX_EXPERIMENT_CASES,
  RETRIEVAL_RECALL_SCORER_ID,
} from './limits.js';
import { persistNativeAgentEvaluationReport } from './reports.js';
import { acquireEvaluationLease } from './state.js';

function datasetFor(runtime: EvaluationExperimentRuntime, family: ExperimentFamily): NativeDataset {
  if (family === 'agent') return runtime.agentDataset;
  if (family === 'retrieval') return runtime.retrievalDataset;
  return runtime.calibrationDataset;
}

function validateExperimentItems(
  runtime: EvaluationExperimentRuntime,
  family: ExperimentFamily,
  items: Awaited<ReturnType<typeof datasetItems>>,
) {
  for (const item of items) {
    const metadata = item.metadata ?? {};
    if (metadata.corpusVersion !== EVALUATION_CORPUS_VERSION || metadata.fixtureVersion !== runtime.fixtureVersion)
      throw new Error('Dataset fixture version does not match the synchronized synthetic index.');
    if (family === 'agent' && (typeof item.input !== 'string' || !item.input.trim() || item.input.length > 4_000))
      throw new Error('Agent evaluation dataset item is invalid.');
    if (
      family === 'retrieval' &&
      (typeof item.input !== 'object' ||
        item.input === null ||
        typeof (item.input as { question?: unknown }).question !== 'string')
    )
      throw new Error('Retrieval evaluation dataset item is invalid.');
    if (family === 'calibration') {
      candidateSchema.parse(item.input);
      continue;
    }
    asEvaluationCase(item.groundTruth);
  }
}

function targetFor(family: ExperimentFamily): { targetType: 'agent' | 'workflow' | 'scorer'; targetId: string } {
  if (family === 'agent') return { targetType: 'agent', targetId: 'organization-agent' };
  if (family === 'retrieval') return { targetType: 'workflow', targetId: 'search-organization-records' };
  return { targetType: 'scorer', targetId: GROUNDEDNESS_SCORER_ID };
}

async function requirePersistedItem(
  runtime: EvaluationExperimentRuntime,
  dataset: NativeDataset,
  experimentId: string,
  itemId: string,
  item: NativeExperimentResult,
  scorerId?: string,
): Promise<void> {
  const persisted = await dataset.listExperimentResults({ experimentId, page: 0, perPage: 100 });
  const result = persisted.results.find(candidate => candidate.itemId === itemId);
  if (!result || result.error || result.output === null) throw new Error('Experiment result storage was incomplete.');
  if (!scorerId) return;
  if (item.scores.length !== 1 || item.scores[0]?.score === null || item.scores[0]?.error)
    throw new Error('Experiment scorer output was incomplete.');
  const scores = await runtime.storage.getStore('scores');
  const saved = await scores?.listScoresByRunId({ runId: experimentId, pagination: { page: 0, perPage: 100 } });
  if (!saved?.scores.some(score => score.scorerId === scorerId && score.entityId === itemId))
    throw new Error('Experiment score storage was incomplete.');
}

/** Runs one family only. No default native concurrency or retry loop is used. */
export async function runNativeExperiment(
  runtime: EvaluationExperimentRuntime,
  options: {
    family: ExperimentFamily;
    version: number;
    name?: string;
    interruptAfter?: number;
    onItemPersisted?: (itemId: string) => Promise<void>;
    onExperimentCreated?: (experiment: { id: string; datasetVersion: number }) => void;
    onItemDispatched?: (itemId: string) => void;
    leaseHeld?: boolean;
  },
): Promise<NativeExperimentRun> {
  const dataset = datasetFor(runtime, options.family);
  const items = await datasetItems(dataset, options.version);
  if (!items.length || items.length > MAX_EXPERIMENT_CASES)
    throw new Error('An experiment must contain from one to 30 cases.');
  validateExperimentItems(runtime, options.family, items);
  const release = options.leaseHeld ? async () => undefined : await acquireEvaluationLease(runtime.stateDirectory);
  const target = targetFor(options.family);
  const completedItemIds: string[] = [];
  let storageComplete = true;
  let qualityComplete = true;
  try {
    const created = await dataset.createExperiment({
      id: randomUUID(),
      ...target,
      ...(options.family === 'agent'
        ? { scorers: [GROUNDEDNESS_SCORER_ID] }
        : options.family === 'retrieval'
          ? { scorers: [RETRIEVAL_RECALL_SCORER_ID] }
          : {}),
      name: options.name ?? `Organization ${options.family} evaluation`,
      version: options.version,
      metadata: {
        corpusVersion: EVALUATION_CORPUS_VERSION,
        fixtureVersion: runtime.fixtureVersion,
        datasetVersion: options.version,
        indexSnapshotVersion: runtime.provenance.indexSnapshotVersion,
        answerModel: runtime.provenance.answerModel,
        judgeModel: runtime.provenance.judgeModel,
        rubricVersion: runtime.provenance.rubricVersion,
        concurrency: 1,
        maxRetries: 0,
        maxCases: MAX_EXPERIMENT_CASES,
      },
      provenance: {
        source: 'local-synthetic',
        sourceId: EVALUATION_STORE_NAME,
        sourceVersion: EVALUATION_CORPUS_VERSION,
      },
    });
    options.onExperimentCreated?.({ id: created.experimentId, datasetVersion: created.datasetVersion });
    for (const item of items) {
      try {
        runtime.dispatch.activeItem =
          options.family === 'agent'
            ? {
                experimentId: created.experimentId,
                itemId: item.id,
                evaluationCaseId: asEvaluationCase(item.groundTruth).id,
              }
            : undefined;
        options.onItemDispatched?.(item.id);
        const native = await dataset.runExperimentItem({
          experimentId: created.experimentId,
          itemId: item.id,
          attempt: 0,
        });
        await requirePersistedItem(
          runtime,
          dataset,
          created.experimentId,
          item.id,
          native,
          options.family === 'agent'
            ? GROUNDEDNESS_SCORER_ID
            : options.family === 'retrieval'
              ? RETRIEVAL_RECALL_SCORER_ID
              : undefined,
        );
      } catch (error) {
        storageComplete = false;
        qualityComplete = false;
        throw error;
      } finally {
        runtime.dispatch.activeItem = undefined;
      }
      completedItemIds.push(item.id);
      await options.onItemPersisted?.(item.id);
      if (options.interruptAfter !== undefined && completedItemIds.length >= options.interruptAfter)
        throw new Error('Experiment interrupted before finalization.');
    }
    const finalized = await dataset.finalizeExperiment({ experimentId: created.experimentId });
    if (options.family === 'agent') await persistNativeAgentEvaluationReport(runtime, created.experimentId);
    return {
      experimentId: created.experimentId,
      status: finalized.status,
      datasetVersion: created.datasetVersion,
      family: options.family,
      completedItemIds,
      qualityComplete,
      storageComplete,
    };
  } finally {
    await release();
  }
}
