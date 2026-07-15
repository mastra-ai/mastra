import type { CreateDatasetInput, AddDatasetItemInput } from '@mastra/core/storage';

/**
 * Creates sample dataset input for tests.
 * Returns a CreateDatasetInput — no DB calls.
 */
export function createSampleDataset(overrides?: Partial<CreateDatasetInput>): CreateDatasetInput {
  return {
    name: `dataset-${crypto.randomUUID().slice(0, 8)}`,
    ...overrides,
  };
}

/**
 * Creates sample dataset item input for tests.
 * Caller must supply datasetId separately (mirrors AddDatasetItemInput).
 */
export function createSampleDatasetItem(
  overrides?: Partial<Omit<AddDatasetItemInput, 'datasetId'>>,
): Omit<AddDatasetItemInput, 'datasetId'> {
  return {
    input: { q: `question-${crypto.randomUUID().slice(0, 8)}` },
    ...overrides,
  };
}
