import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import { runtimeExample } from './runtime.ts';
import type { Profile } from '../mastra/identity.ts';

/** Replace these trusted inputs when adapting the example use case. */
export const supportConfiguration = {
  policy: { kind: 'tenant' as const, path: 'policies/safe-changes', pageKey: 'safety-policy' },
  optionalListing: { list: 'docs:$tenantId#guides', depth: 1 as const },
  customerRoots: ['cases'],
  topicTerms: runtimeExample.topicTerms as Record<string, string[]>,
  instructions: runtimeExample.instructions,
};

export function policyReference(profile: Profile) {
  return `${knowledgeScopeAddress(`${supportConfiguration.policy.kind}:$tenantId`, { ...profile })}#${supportConfiguration.policy.path}`;
}
