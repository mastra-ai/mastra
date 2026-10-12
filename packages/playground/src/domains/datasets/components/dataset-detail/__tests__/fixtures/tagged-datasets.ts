import type { DatasetRecord } from '@mastra/client-js';

export const dataset = (id: string, name: string): DatasetRecord => ({
  id,
  name,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

export const taggedDatasets: DatasetRecord[] = [
  { ...dataset('ds-a', 'Dataset A'), tags: ['support', 'english', 'support'] },
  { ...dataset('ds-b', 'Dataset B'), tags: ['reviewed', 'english'] },
  dataset('ds-c', 'Dataset C'),
];
