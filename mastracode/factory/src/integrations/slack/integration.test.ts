import { AgentControllerChannels } from '@mastra/core/channels';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/slack', () => ({
  createSlackAdapter: vi.fn(() => ({ __adapter: true })),
}));

import { SlackIntegration } from './integration.js';

function ctxWith(overrides: Record<string, unknown> = {}) {
  return {
    storage: { channelIdentity: {}, projects: {}, memorySettings: {}, ...overrides },
    rules: { workItems: {} },
  } as any;
}

describe('SlackIntegration.channels', () => {
  it('returns a channels config (not a built instance) with the slack adapter entry in config form', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    const config = integration.channels(ctxWith());

    expect(config).not.toBeInstanceOf(AgentControllerChannels);
    expect(config.adapters.slack).toMatchObject({ adapter: { __adapter: true } });
    expect(config.handlers?.onDirectMessage).toBeTypeOf('function');
    expect(config.handlers?.onMention).toBeTypeOf('function');
    expect(config.handlers?.onSubscribedMessage).toBeTypeOf('function');
    expect(config.resolveResourceId).toBeTypeOf('function');
    expect(config.resolveThreadId).toBeTypeOf('function');
  });

  it('reports repo-backed sessions when the context carries a source-control owner', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    const config = integration.channels(ctxWith({ sourceControlOwner: { integrationId: 'github' } }));

    expect(integration.diagnostics()).toMatchObject({ repoBackedSessions: true });
    // Sessions the channel machinery creates are configured through this hook;
    // without it they would run on the SDK's built-in model defaults.
    expect(config.onSessionStart).toBeTypeOf('function');
  });

  it('reports no repo-backed sessions when the context has no source-control owner', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    integration.channels(ctxWith());

    expect(integration.diagnostics()).toMatchObject({ repoBackedSessions: false });
  });
});
