import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import { runtimeExample } from './runtime.ts';
import type { Profile } from '../mastra/identity.ts';

export const supportConfiguration = runtimeExample;

export function isCustomerHistoryPath(path: string) {
  return supportConfiguration.customerRoots.some(root => path === root || path.startsWith(`${root}/`));
}

export function policyReference(profile: Profile) {
  return `${knowledgeScopeAddress(`${supportConfiguration.policy.kind}:$tenantId`, { ...profile })}#${supportConfiguration.policy.path}`;
}
