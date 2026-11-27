import { billingConfigurationSchema } from '../../src/billing/configuration/policy.js';

/** Logical billing keys used by the image policies, independent of payment provider IDs. */
export const imageBillingKeys = {
  entitlements: [],
  subscriptions: [],
  meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }],
} as const;
/** Add versioned allowances and offers here, then bind offer keys to provider plans. */
export const imagePlans = { allowances: [], offers: [] } as const;
export const imagePolicies = [
  {
    id: 'image-agent',
    kind: 'agent',
    operations: ['generate'],
    measurements: [],
    policy: { version: 'image-agent-v1', charge: { type: 'credits', meter: 'credits', units: 1 } },
  },
  {
    id: 'image-kit',
    kind: 'workflow',
    operations: ['start', 'resume', 'cancel'],
    measurements: [],
    policy: {
      version: 'image-kit-v2',
      suspendedReservationTtlMs: 1800000,
      charge: { type: 'credits', meter: 'credits', units: 3 },
    },
  },
] as const;

export function imageConfiguration(workspaceIds?: string | readonly string[]) {
  return billingConfigurationSchema.parse({
    provider: 'local',
    resourcePolicies: imagePolicies,
    billingKeys: imageBillingKeys,
    catalog: imagePlans,
    localAccounts: (typeof workspaceIds === 'string' ? [workspaceIds] : (workspaceIds ?? [])).map(workspaceId => ({
      workspaceId,
      meters: [{ key: 'credits', funding: 'prepaid', balance: 30 }],
    })),
  });
}
