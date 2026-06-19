import type { Signal } from './types';

export const signals: Signal[] = [
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'Operational work patterns inferred from agent traces and user requests.',
    facets: [
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
      {
        id: 'account-updates',
        name: 'Account updates',
        description: 'Profile edits, plan changes, and account recovery requests.',
        traceSummaries: [
          {
            id: 'trace-account-1',
            name: 'Update billing contact',
            status: 'success',
            startedAt: '2026-06-15T07:45:00.000Z',
            durationMs: 1420,
            entityName: 'support-agent',
            spanCount: 7,
          },
          {
            id: 'trace-account-2',
            name: 'Recover locked account',
            status: 'success',
            startedAt: '2026-06-15T07:10:00.000Z',
            durationMs: 2640,
            entityName: 'support-agent',
            spanCount: 11,
          },
        ],
      },
      {
        id: 'subscription-changes',
        name: 'Subscription changes',
        description: 'Upgrade, downgrade, pause, and renewal intent across plans.',
        traceSummaries: [
          {
            id: 'trace-subscription-1',
            name: 'Downgrade plan request',
            status: 'success',
            startedAt: '2026-06-15T06:50:00.000Z',
            durationMs: 1880,
            entityName: 'support-agent',
            spanCount: 9,
          },
        ],
      },
    ],
  },
  {
    id: 'sentiment',
    name: 'Sentiment',
    description: 'Conversation tone and confidence shifts that affect user outcomes.',
    facets: [
      {
        id: 'negative-feedback',
        name: 'Negative feedback',
        description: 'Escalations, frustration signals, and unresolved customer intent.',
        traceSummaries: [
          {
            id: 'trace-sentiment-1',
            name: 'De-escalate frustrated customer',
            status: 'success',
            startedAt: '2026-06-15T12:30:00.000Z',
            durationMs: 2150,
            entityName: 'support-agent',
            spanCount: 10,
          },
        ],
      },
      {
        id: 'positive-feedback',
        name: 'Positive feedback',
        description: 'Gratitude, satisfaction, and confirmation that the user outcome was met.',
        traceSummaries: [
          {
            id: 'trace-sentiment-2',
            name: 'Capture satisfied customer outcome',
            status: 'success',
            startedAt: '2026-06-15T12:05:00.000Z',
            durationMs: 1320,
            entityName: 'support-agent',
            spanCount: 5,
          },
        ],
      },
      {
        id: 'uncertain-feedback',
        name: 'Uncertain feedback',
        description: 'Ambiguous responses where sentiment or next best action needs clarification.',
        traceSummaries: [
          {
            id: 'trace-sentiment-3',
            name: 'Clarify ambiguous response',
            status: 'running',
            startedAt: '2026-06-15T11:35:00.000Z',
            durationMs: 1760,
            entityName: 'support-agent',
            spanCount: 8,
          },
        ],
      },
    ],
  },
  {
    id: 'issue',
    name: 'Issue',
    description: 'Recurring issue families found across support, research, and workflow traces.',
    facets: [
      {
        id: 'revenue-analysis',
        name: 'Revenue analysis',
        description: 'Revenue-impacting requests, market scans, and financial summaries.',
        traceSummaries: [
          {
            id: 'trace-revenue-1',
            name: 'Summarize revenue movement',
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
  {
    id: 'severity',
    name: 'Severity',
    description: 'Risk and urgency bands inferred from trace paths and intervention needs.',
    facets: [
      {
        id: 'urgent-escalations',
        name: 'Urgent escalations',
        description: 'High-priority paths that require faster handoff or deeper inspection.',
        traceSummaries: [
          {
            id: 'trace-severity-1',
            name: 'Escalate urgent account issue',
            status: 'error',
            startedAt: '2026-06-15T13:10:00.000Z',
            durationMs: 3880,
            entityName: 'support-agent',
            spanCount: 18,
          },
        ],
      },
    ],
  },
];
