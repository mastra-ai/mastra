import type { SandboxCreateInput } from '@renderinc/sdk/experimental';
import { RenderSandboxError } from './errors.js';

/** Current public API rules. Only HTTPS egress is supported by Render. */
export type RenderNetworkPolicy =
  | { type: 'deny-all' | 'allow-all'; rules?: never }
  | { type: 'allow-list'; rules: Array<{ domain: string; protocol: 'https' }> }
  | NonNullable<SandboxCreateInput['networkPolicy']>;

type WithoutNetworkPolicy<T> = T extends unknown ? Omit<T, 'networkPolicy'> : never;
export type RenderSandboxCreateInput = WithoutNetworkPolicy<SandboxCreateInput> & {
  networkPolicy?: RenderNetworkPolicy;
};

/** Bridge SDK 1.2.0's deprecated fields to the current public API without changing clients. */
export function normalizeNetworkPolicy(policy?: RenderNetworkPolicy): NonNullable<SandboxCreateInput['networkPolicy']> {
  if (!policy) return { default: 'deny-all' };
  const value = policy as {
    type?: string;
    default?: string;
    allowedDomains?: string[];
    rules?: Array<{ domain: string; protocol: string }>;
  };
  const kind = value.type ?? value.default;
  if (value.type && value.default && value.type !== value.default)
    throw new RenderSandboxError('CONFIGURATION', 'Network policy type and default must agree');
  if (kind !== 'allow-all' && kind !== 'deny-all' && kind !== 'allow-list')
    throw new RenderSandboxError('CONFIGURATION', 'Unknown network policy');
  if (kind !== 'allow-list') {
    if (value.rules !== undefined || value.allowedDomains !== undefined)
      throw new RenderSandboxError('CONFIGURATION', 'Destination rules require an allow-list policy');
    return { default: kind };
  }
  if (value.rules !== undefined && value.allowedDomains !== undefined)
    throw new RenderSandboxError('CONFIGURATION', 'Use rules or allowedDomains, not both');
  const rules = value.rules ?? value.allowedDomains?.map(domain => ({ domain, protocol: 'https' }));
  if (
    !Array.isArray(rules) ||
    !rules.length ||
    rules.some(rule => !rule || typeof rule.domain !== 'string' || !rule.domain.trim() || rule.protocol !== 'https')
  )
    throw new RenderSandboxError('CONFIGURATION', 'Allow-list requires domain rules using protocol https');
  if (new Set(rules.map(rule => rule.domain.toLowerCase())).size !== rules.length)
    throw new RenderSandboxError('CONFIGURATION', 'Each allow-list domain must be unique');
  // The SDK forwards networkPolicy unchanged. Its public type requires the
  // accepted default alias; the API additionally requires these typed rules.
  const normalized = { default: 'allow-list' as const, rules: rules.map(rule => ({ ...rule })) };
  return normalized;
}
