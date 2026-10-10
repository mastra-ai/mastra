import type { SignalSubscriptionIdentity, UpsertSignalSubscriptionInput } from '@mastra/core/storage';

export const SIGNAL_AGENT = 'agent-a';
export const SIGNAL_PROVIDER = 'webhook-signals';

export function createSampleSignalIdentity(
  overrides: Partial<SignalSubscriptionIdentity> = {},
): SignalSubscriptionIdentity {
  return {
    agentId: SIGNAL_AGENT,
    providerId: SIGNAL_PROVIDER,
    resourceId: 'resource-1',
    threadId: 'thread-1',
    externalResourceId: 'ext-1',
    ...overrides,
  };
}

/**
 * `count` subscriptions with fixed-width alphanumeric ids, so `(createdAt, id)`
 * ordering is identical under binary and locale-aware collations.
 */
export function createSampleSignalSubscriptions(
  count: number,
  overrides: Partial<UpsertSignalSubscriptionInput> = {},
): UpsertSignalSubscriptionInput[] {
  return Array.from({ length: count }, (_, index) => {
    const suffix = String(index).padStart(4, '0');
    return {
      ...createSampleSignalIdentity({ externalResourceId: `ext${suffix}` }),
      id: `sub${suffix}`,
      ...overrides,
    };
  });
}

export function createSampleDocumentOwner(key: string, overrides: Partial<SignalSubscriptionIdentity> = {}) {
  const { externalResourceId: _external, ...identity } = createSampleSignalIdentity({ threadId: key, ...overrides });
  return { key, ...identity };
}
