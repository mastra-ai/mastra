export const sourceStatus = [
  { sourceId: 'policies', ready: true, stale: false, lastSuccessAt: '2026-01-01T00:00:00Z', error: null, records: 1 },
  {
    sourceId: 'processes',
    ready: true,
    stale: true,
    lastSuccessAt: '2026-01-01T00:00:00Z',
    error: 'Refresh failed.',
    records: 1,
  },
];

export const hits = [
  {
    content: 'Policies retain invoices for seven years.',
    metadata: {
      recordId: 'policy-retention',
      sourceId: 'policies',
      path: '/policies/retention.md',
      title: 'Retention policy',
      locator: 'Retention',
      revision: 'policy-revision',
      indexedAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    content: 'Processes require records staff approval for archived invoices.',
    metadata: {
      recordId: 'process-archive',
      sourceId: 'processes',
      path: '/processes/archive.md',
      title: 'Archive process',
      locator: 'Step 2',
      revision: 'process-revision',
      indexedAt: '2026-01-02T00:00:00Z',
    },
  },
];

export function studioUserSignal(question: string) {
  return [
    {
      id: 'studio-signal',
      role: 'signal',
      type: 'user',
      createdAt: new Date('2026-09-19T00:00:00Z'),
      threadId: 'studio-thread',
      resourceId: 'organization-agent',
      content: {
        format: 2,
        parts: [{ type: 'text', text: question, createdAt: 1_789_860_800_575 }],
        metadata: {
          signal: {
            id: 'studio-signal',
            type: 'user',
            tagName: 'user',
            createdAt: '2026-09-19T00:00:00.000Z',
            acceptedAt: '2026-09-19T00:00:00.000Z',
            metadata: { clientMessageId: 'client-set-message' },
          },
        },
      },
    },
  ] as never;
}
