import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import type { Profile } from '../mastra/identity.ts';

/** Replace these trusted inputs when adapting the example use case. */
export const supportConfiguration = {
  policy: { kind: 'tenant' as const, path: 'policies/safe-changes', pageKey: 'safety-policy' },
  optionalListing: { list: 'docs:$tenantId#guides', depth: 1 as const },
  customerRoots: ['cases'],
  topicTerms: {
    connectivity: ['connectivity', 'connection', 'network', 'wifi', 'wi-fi', 'offline', 'cable'],
    payments: ['payment', 'payments', 'pending', 'offline'],
  } as Record<string, string[]>,
  instructions:
    'Help technicians troubleshoot Retail POS and Square Terminal connectivity. Advise only; never operate hardware or handle payment data. Ask whether payments are pending and which connection indicator is visible when those facts are missing.',
};

export function policyReference(profile: Profile) {
  return `${knowledgeScopeAddress(`${supportConfiguration.policy.kind}:$tenantId`, { ...profile })}#${supportConfiguration.policy.path}`;
}
