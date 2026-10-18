import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import type { EvaluationExperimentRuntime, NativeRetrievalSummary } from './contracts.js';
import {
  asEvaluationCase,
  candidateSchema,
  normalizeAgentOutput,
  requiredRecordRecall,
  retrievalOutputSchema,
} from './contracts.js';
import type { EvaluationReport } from './evaluation.js';
import { aggregateEvaluationResults, failedEvaluationCase, scoreEvaluationCase } from './evaluation.js';
import { EVALUATION_CASES } from './fixtures/cases.js';

import { EVALUATION_STORE_NAME } from './limits.js';
import { persistedCaseEvidenceByEvaluationCase } from './state.js';

export async function inspectNativeExperiments(runtime: EvaluationExperimentRuntime, experimentIds: string[]) {
  if (experimentIds.length < 2) throw new Error('Select two persisted experiment IDs to compare.');
  const [comparison, ...families] = await Promise.all([
    runtime.mastra.datasets.compareExperiments({ experimentIds }),
    runtime.agentDataset.listExperiments({ page: 0, perPage: 100 }),
    runtime.retrievalDataset.listExperiments({ page: 0, perPage: 100 }),
    runtime.calibrationDataset.listExperiments({ page: 0, perPage: 100 }),
  ]);
  const selected = families
    .flatMap(family => family.experiments)
    .filter(experiment => experimentIds.includes(experiment.id))
    .map(experiment => ({
      id: experiment.id,
      datasetVersion:
        typeof experiment.metadata?.datasetVersion === 'number' ? experiment.metadata.datasetVersion : undefined,
      metadata: experiment.metadata,
    }));
  if (selected.length !== experimentIds.length) throw new Error('Selected experiment metadata was unavailable.');
  return { ...comparison, experiments: selected };
}

/** Read-only native comparison. It opens no sources and never dispatches a target. */
export async function inspectPersistedExperiments(stateDirectory: string, experimentIds: string[]) {
  if (experimentIds.length < 2) throw new Error('Select two persisted experiment IDs to compare.');
  const database = resolve(stateDirectory, 'experiments.db');
  await access(database);
  const storage = new LibSQLStore({ id: EVALUATION_STORE_NAME, url: `file:${database}` });
  try {
    return await new Mastra({ storage, logger: false }).datasets.compareExperiments({ experimentIds });
  } finally {
    await storage.close();
  }
}

export async function calibrationSummary(runtime: EvaluationExperimentRuntime, experimentId: string) {
  const persisted = await runtime.calibrationDataset.listExperimentResults({ experimentId, page: 0, perPage: 100 });
  const cases = persisted.results.map(result => {
    const candidate = candidateSchema.parse(result.input);
    const expectedSupported = candidate.expectedSupported;
    const observedSupported =
      typeof result.output === 'object' &&
      result.output !== null &&
      'score' in result.output &&
      typeof result.output.score === 'number' &&
      result.output.score >= 1;
    return {
      id: candidate.evaluationCase.id,
      expectedSupported,
      observedSupported,
      disagreement: expectedSupported !== observedSupported,
    };
  });
  return { cases, agreement: cases.filter(item => !item.disagreement).length / cases.length };
}

/** Reads native persisted retrieval outputs; empty hits and failed workflow runs remain distinguishable. */
export async function nativeRetrievalSummary(
  runtime: EvaluationExperimentRuntime,
  experimentId: string,
): Promise<NativeRetrievalSummary> {
  const persisted = await runtime.retrievalDataset.listExperimentResults({ experimentId, page: 0, perPage: 100 });
  const cases = persisted.results.map(result => {
    const evaluationCase = asEvaluationCase(result.groundTruth);
    if (result.error || result.output === null)
      return { id: evaluationCase.id, requiredRecordRecallAt6: null, outcome: 'failed' as const };
    const recall = requiredRecordRecall(evaluationCase, result.output);
    return {
      id: evaluationCase.id,
      requiredRecordRecallAt6: evaluationCase.requiredRecordIds.length ? recall : null,
      outcome: retrievalOutputSchema.parse(result.output).hits.length ? ('retrieved' as const) : ('empty' as const),
    };
  });
  const required = cases.filter(
    (item): item is typeof item & { requiredRecordRecallAt6: number } => item.requiredRecordRecallAt6 !== null,
  );
  return {
    experimentId,
    meanRequiredRecordRecallAt6: required.length
      ? required.reduce((total, item) => total + item.requiredRecordRecallAt6, 0) / required.length
      : 0,
    cases,
  };
}

/** Builds the existing C-07 report from the exact persisted native agent run. */
export async function nativeAgentEvaluationReport(
  runtime: EvaluationExperimentRuntime,
  experimentId: string,
): Promise<EvaluationReport> {
  const persisted = await runtime.agentDataset.listExperimentResults({ experimentId, page: 0, perPage: 100 });
  const byCase = new Map(persisted.results.map(result => [asEvaluationCase(result.groundTruth).id, result]));
  const persistedEvidence = await persistedCaseEvidenceByEvaluationCase(runtime.stateDirectory);
  const cases = await Promise.all(
    EVALUATION_CASES.map(async evaluationCase => {
      const result = byCase.get(evaluationCase.id);
      if (!result || result.error || result.output === null) return failedEvaluationCase(evaluationCase, 'generation');
      try {
        const answer = normalizeAgentOutput(result.output);
        const associated = persistedEvidence.filter(
          item =>
            item.experimentId === experimentId &&
            item.itemId === result.itemId &&
            item.evaluationCaseId === evaluationCase.id &&
            item.correlationId === answer.metadata.correlationId,
        );
        if (associated.length !== 1) return failedEvaluationCase(evaluationCase, 'generation');
        const persistedCase = associated[0]!;
        const observation = runtime.observations.get(answer.metadata.correlationId) ?? persistedCase?.observation;
        const judge = runtime.judgments.get(answer.metadata.correlationId) ?? persistedCase?.judge;
        if (!observation) return failedEvaluationCase(evaluationCase, 'retrieval');
        if (!judge) return failedEvaluationCase(evaluationCase, 'judge');
        return scoreEvaluationCase({
          evaluationCase,
          answer,
          evidence: observation.evidence,
          judge,
          retrievalMs: answer.metadata.retrievalMs,
          durationMs: Math.max(0, result.completedAt.getTime() - result.startedAt.getTime()),
        });
      } catch {
        return failedEvaluationCase(evaluationCase, 'validation');
      }
    }),
  );
  for (const result of cases.filter(result => EVALUATION_CASES.find(item => item.id === result.id)?.pairId)) {
    const evaluationCase = EVALUATION_CASES.find(item => item.id === result.id)!;
    const original = EVALUATION_CASES.find(
      item => item.pairId === evaluationCase.pairId && item.kind === 'answerable',
    )!;
    const first = cases.find(item => item.id === original.id)!;
    result.consistent = JSON.stringify(first.supportedFactIds) === JSON.stringify(result.supportedFactIds);
  }
  return aggregateEvaluationResults(cases);
}

function nativeReportPath(stateDirectory: string, experimentId: string): string {
  return resolve(stateDirectory, 'experiment-reports', `${experimentId}.json`);
}

/** Stores only synthetic answer, evidence, judgment, and aggregate data needed after reopening. */
export async function persistNativeAgentEvaluationReport(
  runtime: EvaluationExperimentRuntime,
  experimentId: string,
): Promise<EvaluationReport> {
  const report = await nativeAgentEvaluationReport(runtime, experimentId);
  const path = nativeReportPath(runtime.stateDirectory, experimentId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  return report;
}

export async function readPersistedNativeAgentEvaluationReport(
  stateDirectory: string,
  experimentId: string,
): Promise<EvaluationReport> {
  return JSON.parse(await readFile(nativeReportPath(stateDirectory, experimentId), 'utf8')) as EvaluationReport;
}
