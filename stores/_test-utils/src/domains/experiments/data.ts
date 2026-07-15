import type { CreateExperimentInput, AddExperimentResultInput } from '@mastra/core/storage';

/**
 * Creates sample experiment input for tests.
 * Returns a CreateExperimentInput — no DB calls.
 */
export function createSampleExperiment(overrides?: Partial<CreateExperimentInput>): CreateExperimentInput {
  return {
    name: `experiment-${crypto.randomUUID().slice(0, 8)}`,
    datasetId: null,
    datasetVersion: null,
    targetType: 'agent',
    targetId: `agent-${crypto.randomUUID().slice(0, 8)}`,
    totalItems: 5,
    ...overrides,
  };
}

/**
 * Creates sample experiment result input for tests.
 * Caller must supply experimentId separately.
 */
export function createSampleExperimentResult(
  overrides?: Partial<Omit<AddExperimentResultInput, 'experimentId'>>,
): Omit<AddExperimentResultInput, 'experimentId'> {
  const now = new Date();
  return {
    itemId: `item-${crypto.randomUUID().slice(0, 8)}`,
    itemDatasetVersion: null,
    input: { q: `question-${crypto.randomUUID().slice(0, 8)}` },
    output: { a: `answer-${crypto.randomUUID().slice(0, 8)}` },
    groundTruth: null,
    error: null,
    startedAt: now,
    completedAt: new Date(now.getTime() + 500),
    retryCount: 0,
    ...overrides,
  };
}
