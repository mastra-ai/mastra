import { weatherDefinitions } from './resources.js';
import { billingConfigurationSchema } from '../../../src/billing/configuration.js';

export function weatherConfiguration(
  workspaceIds?: string | readonly string[],
  workflowPolicy: 'task' | 'tokens' = 'task',
) {
  return billingConfigurationSchema.parse({
    provider: 'local',
    resources: weatherDefinitions({}, workflowPolicy).map(({ id, kind, operations, measurements, policy }) => ({
      id,
      kind,
      operations,
      measurements,
      policy,
    })),
    mappings: {
      subscriptions: ['weather-access'],
      meters: [
        { key: 'weather-credits', unit: 'credits', funding: ['prepaid'] },
        { key: 'weather-tasks', unit: 'tasks', funding: ['prepaid'] },
        { key: 'weather-tokens', unit: 'tokens', funding: ['metered'] },
      ],
    },
    localAccounts: (typeof workspaceIds === 'string' ? [workspaceIds] : (workspaceIds ?? [])).map(workspaceId => ({
      workspaceId,
      subscriptions: [{ key: 'weather-access', validFrom: '2026-01-01T00:00:00Z', validUntil: null }],
      meters: [
        { key: 'weather-credits', funding: 'prepaid', balance: 30 },
        { key: 'weather-tasks', funding: 'prepaid', balance: 10 },
        { key: 'weather-tokens', funding: 'metered', balance: null },
      ],
    })),
  });
}
