import type { DatasetRecord, RouteResponse } from '@mastra/client-js';

export type BatchInsertResponse = RouteResponse<'POST /datasets/:datasetId/items/batch'>;

export const CSV_DATASET_ID = 'csv-dataset';

export function buildCsvDataset(overrides: Partial<DatasetRecord> = {}): DatasetRecord {
  return {
    id: CSV_DATASET_ID,
    name: 'CSV dataset',
    version: 0,
    createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

/** Dataset whose input must be a string of 10+ characters — the "Too short" row fails it. */
export const datasetWithInputSchema = buildCsvDataset({
  inputSchema: { type: 'string', minLength: 10 },
});

export const batchInsertResponse: BatchInsertResponse = { items: [], count: 2 };

export const QA_CSV = ['question,answer,source', 'What is the capital of France?,Paris,geo', 'Too short,4,math'].join(
  '\n',
);

/** Headers but no data rows — nothing to import. */
export const HEADERS_ONLY_CSV = 'question,answer,source';

export function buildCsvFile(content = QA_CSV, name = 'qa.csv') {
  return new File([content], name, { type: 'text/csv' });
}
