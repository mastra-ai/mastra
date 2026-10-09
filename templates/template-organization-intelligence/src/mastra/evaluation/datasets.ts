import { createHash } from 'node:crypto';

import type { Mastra } from '@mastra/core/mastra';

import type { EvaluationExperimentRuntime, NativeDataset, SeededExperimentDatasets } from './contracts.js';
import { calibrationItems } from './fixtures/calibration.js';
import { EVALUATION_CASES, EVALUATION_CORPUS_VERSION } from './fixtures/cases.js';

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function getOrCreateDataset(
  mastra: Mastra,
  input: Parameters<Mastra['datasets']['create']>[0],
): Promise<NativeDataset> {
  try {
    return await mastra.datasets.get({ id: input.id! });
  } catch {
    return mastra.datasets.create(input);
  }
}

export async function datasetItems(dataset: NativeDataset, version?: number) {
  const listed = await dataset.listItems(version === undefined ? { page: 0, perPage: 100 } : { version });
  return Array.isArray(listed) ? listed : listed.items;
}

async function seedDataset(
  dataset: NativeDataset,
  items: Array<{ externalId: string; input: unknown; groundTruth: unknown; metadata: Record<string, unknown> }>,
): Promise<number> {
  const existing = new Map((await datasetItems(dataset)).map(item => [item.externalId, item]));
  const missing: typeof items = [];
  for (const item of items) {
    const prior = existing.get(item.externalId);
    if (!prior) {
      missing.push(item);
      continue;
    }
    if (
      digest({ input: prior.input, groundTruth: prior.groundTruth, metadata: prior.metadata }) !==
      digest({ input: item.input, groundTruth: item.groundTruth, metadata: item.metadata })
    )
      await dataset.updateItem({
        itemId: prior.id,
        input: item.input,
        groundTruth: item.groundTruth,
        metadata: item.metadata,
      });
  }
  if (missing.length) await dataset.addItems({ items: missing });
  return (await dataset.getDetails()).version;
}

export async function seedExperimentDatasets(runtime: EvaluationExperimentRuntime): Promise<SeededExperimentDatasets> {
  const fixtureVersion = runtime.fixtureVersion;
  const base = EVALUATION_CASES.map(evaluationCase => ({
    externalId: evaluationCase.id,
    groundTruth: evaluationCase,
    metadata: {
      corpusVersion: EVALUATION_CORPUS_VERSION,
      fixtureVersion,
      kind: evaluationCase.kind,
      ...(evaluationCase.pairId ? { pairId: evaluationCase.pairId } : {}),
    },
  }));
  const [agentVersion, retrievalVersion, calibrationVersion] = await Promise.all([
    seedDataset(
      runtime.agentDataset,
      base.map(item => ({
        ...item,
        input: item.groundTruth.question,
      })),
    ),
    seedDataset(
      runtime.retrievalDataset,
      base.map(item => ({
        ...item,
        input: { question: item.groundTruth.question },
      })),
    ),
    seedDataset(runtime.calibrationDataset, calibrationItems(fixtureVersion)),
  ]);
  return {
    corpusVersion: EVALUATION_CORPUS_VERSION,
    fixtureVersion,
    agentVersion,
    retrievalVersion,
    calibrationVersion,
  };
}
