import { describe, expect, it } from 'vitest';

import type {
  FactoryChannelsConfig as FactoryChannelsConfigFromBase,
  FactoryIntegration,
  IntegrationContext,
} from '../integrations/base.js';
import type { FactoryChannelsConfig, Messaging, MessagingSenderRef, MessagingWorkspaceContext } from './messaging.js';

/**
 * Cast-only helper: proves the two `FactoryChannelsConfig` type re-exports
 * are the same reference at compile time. If a maintainer accidentally
 * re-declared the type in `messaging.ts`, this assignment stops compiling.
 */
type _AssertSameChannelsConfig = FactoryChannelsConfig extends FactoryChannelsConfigFromBase
  ? FactoryChannelsConfigFromBase extends FactoryChannelsConfig
    ? true
    : false
  : false;
const _sameChannelsConfig: _AssertSameChannelsConfig = true;
void _sameChannelsConfig;

const ctx = {} as unknown as IntegrationContext;

function makeMessaging(overrides?: Partial<Messaging> & { link?: MessagingWorkspaceContext | null }): Messaging {
  const link = overrides?.link ?? null;
  return {
    channels: () => ({
      adapters: {
        slack: {
          adapter: { platformId: 'slack' } as unknown as FactoryChannelsConfig['adapters'][string]['adapter'],
        },
      },
    }),
    resolveWorkspaceContext: async (_ctx, senderRef) => {
      // Assert the shape flows through generic input.
      expect(senderRef.platform).toBe('slack');
      return link;
    },
    ...overrides,
  };
}

describe('Messaging capability', () => {
  it('is assignable to FactoryIntegration.messaging', () => {
    const messaging = makeMessaging();
    const integration: FactoryIntegration = {
      id: 'test-slack',
      messaging,
      routes: () => [],
      diagnostics: () => ({}),
    };
    expect(integration.messaging).toBe(messaging);
  });

  it('channels() returns a FactoryChannelsConfig with one adapter entry', () => {
    const messaging = makeMessaging();
    const config = messaging.channels(ctx);
    expect(Object.keys(config.adapters)).toEqual(['slack']);
    expect(config.adapters.slack).toBeDefined();
  });

  it('resolveWorkspaceContext returns the linked context when the sender is linked', async () => {
    const linked: MessagingWorkspaceContext = {
      orgId: 'org-1',
      userId: 'user-1',
      defaultFactoryProjectId: 'project-1',
    };
    const messaging = makeMessaging({ link: linked });
    const senderRef: MessagingSenderRef = {
      platform: 'slack',
      externalTeamId: 'T111',
      externalUserId: 'U222',
    };
    const result = await messaging.resolveWorkspaceContext(ctx, senderRef);
    expect(result).toEqual(linked);
  });

  it('resolveWorkspaceContext returns null when the sender is not linked', async () => {
    const messaging = makeMessaging({ link: null });
    const senderRef: MessagingSenderRef = {
      platform: 'slack',
      externalTeamId: 'T111',
      externalUserId: 'U999',
    };
    const result = await messaging.resolveWorkspaceContext(ctx, senderRef);
    expect(result).toBeNull();
  });
});
