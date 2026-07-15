import type { ChannelConfig, ChannelInstallation } from '@mastra/core/storage';

/**
 * Creates a sample channel installation for tests.
 */
export function createSampleInstallation(overrides?: Partial<ChannelInstallation>): ChannelInstallation {
  const now = new Date();
  return {
    id: `install_${crypto.randomUUID()}`,
    platform: 'slack',
    agentId: `agent_${crypto.randomUUID()}`,
    status: 'active',
    webhookId: `webhook_${crypto.randomUUID()}`,
    data: { botToken: 'xoxb-test-token', teamId: 'T123456' },
    configHash: `hash_${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a sample channel config for tests.
 */
export function createSampleConfig(overrides?: Partial<ChannelConfig>): ChannelConfig {
  const now = new Date();
  return {
    platform: 'slack',
    data: { appConfigToken: 'xapp-test-token', clientId: 'client_123' },
    updatedAt: now,
    ...overrides,
  };
}
