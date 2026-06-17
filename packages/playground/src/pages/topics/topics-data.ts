import type { Topic } from '@mastra/playground-ui';

export const topics: Topic[] = [
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Common customer support paths detected across traces.',
    subtopics: [
      {
        id: 'refunds',
        name: 'Refunds',
        description: 'Refund requests, policy checks, and payment reversals.',
        traceSummaries: [
          {
            id: 'trace-refund-1',
            name: 'Refund eligibility check',
            status: 'success',
            startedAt: '2026-06-15T10:00:00.000Z',
            durationMs: 1240,
            entityName: 'support-agent',
            spanCount: 8,
          },
          {
            id: 'trace-refund-2',
            name: 'Refund escalation',
            status: 'error',
            startedAt: '2026-06-15T09:40:00.000Z',
            durationMs: 3180,
            entityName: 'support-agent',
            spanCount: 12,
          },
        ],
      },
      {
        id: 'shipping',
        name: 'Shipping',
        description: 'Shipment lookup, carrier updates, and delivery exceptions.',
        traceSummaries: [
          {
            id: 'trace-shipping-1',
            name: 'Track delayed package',
            status: 'success',
            startedAt: '2026-06-15T08:30:00.000Z',
            durationMs: 980,
            entityName: 'support-agent',
            spanCount: 6,
          },
        ],
      },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Research and synthesis traces grouped by workflow intent.',
    subtopics: [
      {
        id: 'competitor-analysis',
        name: 'Competitor Analysis',
        description: 'Market scans, competitor summaries, and source synthesis.',
        traceSummaries: [
          {
            id: 'trace-research-1',
            name: 'Summarize competitor launch',
            status: 'running',
            startedAt: '2026-06-15T11:05:00.000Z',
            durationMs: 4520,
            entityName: 'research-agent',
            spanCount: 15,
          },
        ],
      },
    ],
  },
];
