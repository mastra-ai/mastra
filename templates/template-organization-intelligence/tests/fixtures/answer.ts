import type { OrganizationAnswer } from '../../src/mastra/answers/schema.js';

export const answerFor = (id: string, status: OrganizationAnswer['status'] = 'answered'): OrganizationAnswer => ({
  status,
  answer: status === 'insufficient_evidence' ? 'The records do not establish this.' : `Synthetic ${id} answer.`,
  citations:
    status === 'insufficient_evidence'
      ? []
      : [
          {
            recordId: id,
            sourceId: 'synthetic',
            path: '/synthetic',
            title: 'Synthetic',
            locator: 'Fact',
            revision: 'v1',
            indexedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
  sourceStatus: [],
  metadata: { correlationId: '00000000-0000-4000-8000-000000000001', retrievalMs: 1, sourceIds: ['synthetic'] },
});
