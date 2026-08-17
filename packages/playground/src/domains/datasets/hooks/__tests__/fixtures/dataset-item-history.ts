import type { DatasetItemVersionResponse } from '@mastra/client-js';

export const datasetItemHistoryResponse = {
  history: [
    {
      id: 'item-1',
      datasetId: 'dataset-1',
      datasetVersion: 3,
      input: { question: 'What is the weather?' },
      timeout: 30_000,
      metadata: { source: 'test' },
      validTo: null,
      isDeleted: false,
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    },
  ],
} satisfies { history: DatasetItemVersionResponse[] };
