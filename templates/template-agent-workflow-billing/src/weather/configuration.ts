import { billingConfigurationSchema } from '../billing/configuration.js';

export function weatherConfiguration(workspaceId?: string, workflowPolicy: 'task' | 'tokens' = 'task') {
  const measurements = [
    { key: 'tokens', unit: 'tokens', enforceableBound: false },
    { key: 'model-calls', unit: 'custom', enforceableBound: true },
  ];
  return billingConfigurationSchema.parse({
    provider: 'local',
    resources: [
      {
        id: 'weather-agent',
        kind: 'agent',
        operations: ['generate'],
        measurements,
        policy: {
          version: 'weather-agent-v1',
          access: { subscription: 'weather-access' },
          charge: { type: 'credits', meter: 'weather-credits', units: 3 },
        },
      },
      {
        id: 'weather-report',
        kind: 'workflow',
        operations: ['start', 'resume', 'cancel'],
        measurements,
        policy: {
          version: workflowPolicy === 'task' ? 'weather-report-task-v1' : 'weather-report-tokens-v1',
          suspendedReservationTtlMs: 86400000,
          charge:
            workflowPolicy === 'task'
              ? { type: 'per-task', meter: 'weather-tasks', units: 1, funding: 'prepaid' }
              : { type: 'usage', meter: 'weather-tokens', measure: 'tokens', maxUnits: 8192, funding: 'metered' },
        },
      },
    ],
    mappings: {
      subscriptions: ['weather-access'],
      meters: [
        { key: 'weather-credits', unit: 'credits', funding: ['prepaid'] },
        { key: 'weather-tasks', unit: 'tasks', funding: ['prepaid'] },
        { key: 'weather-tokens', unit: 'tokens', funding: ['metered'] },
      ],
    },
    localAccounts: workspaceId
      ? [
          {
            workspaceId,
            subscriptions: [{ key: 'weather-access', validFrom: '2026-01-01T00:00:00Z', validUntil: null }],
            meters: [
              { key: 'weather-credits', funding: 'prepaid', balance: 30 },
              { key: 'weather-tasks', funding: 'prepaid', balance: 10 },
              { key: 'weather-tokens', funding: 'metered', balance: null },
            ],
          },
        ]
      : [],
  });
}
