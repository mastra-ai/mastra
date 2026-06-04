import { randomUUID } from 'node:crypto';
import type { ChannelConfig, ChannelInstallation } from '@mastra/core/storage';

/**
 * Creates a sample channel installation for tests.
 */
export function createSampleInstallation(overrides?: Partial<ChannelInstallation>): ChannelInstallation {
  const now = new Date();
  return {
    id: `install_${randomUUID()}`,
    platform: 'slack',
    agentId: `agent_${randomUUID()}`,
    status: 'active',
    webhookId: `webhook_${randomUUID()}`,
    data: { botToken: 'xoxb-test-token', teamId: 'T123456' },
    configHash: `hash_${randomUUID()}`,
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
