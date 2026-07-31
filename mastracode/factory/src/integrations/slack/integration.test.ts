import { AgentControllerChannels } from '@mastra/core/channels';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/slack', () => ({
  createSlackAdapter: vi.fn(() => ({ __adapter: true })),
}));

const { createGithubSourceControl } = vi.hoisted(() => ({
  createGithubSourceControl: vi.fn(() => ({ __sourceControl: true })),
}));

vi.mock('./gates.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./gates.js')>()),
  createGithubSourceControl,
}));

import { SlackIntegration } from './integration.js';

function ctxWith(overrides: Record<string, unknown> = {}) {
  return {
    storage: { channelIdentity: {}, projects: {}, ...overrides },
    rules: { workItems: {} },
  } as any;
}

describe('SlackIntegration.messaging.channels', () => {
  it('returns a channels config (not a built instance) with the slack adapter entry in config form', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    const config = integration.messaging.channels(ctxWith());

    expect(config).not.toBeInstanceOf(AgentControllerChannels);
    expect(config.adapters.slack).toMatchObject({ adapter: { __adapter: true } });
    expect(config.handlers?.onDirectMessage).toBeTypeOf('function');
    expect(config.handlers?.onMention).toBeTypeOf('function');
    expect(config.handlers?.onSubscribedMessage).toBeTypeOf('function');
    expect(config.resolveResourceId).toBeTypeOf('function');
    expect(config.resolveThreadId).toBeTypeOf('function');
  });

  it('wires a source-control adapter from the context source-control owner when present', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const sourceControlOwner = { integrationId: 'github' };

    integration.messaging.channels(ctxWith({ sourceControlOwner }));

    expect(createGithubSourceControl).toHaveBeenCalledWith(sourceControlOwner);
    expect(integration.diagnostics()).toMatchObject({ repoBackedSessions: true });
  });

  it('wires no source-control adapter when the context has no source-control owner', () => {
    createGithubSourceControl.mockClear();
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    integration.messaging.channels(ctxWith());

    expect(createGithubSourceControl).not.toHaveBeenCalled();
    expect(integration.diagnostics()).toMatchObject({ repoBackedSessions: false });
  });
});

describe('SlackIntegration.messaging.resolveWorkspaceContext', () => {
  const ref = { platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1' };

  it('returns the linked workspace context when the sender is linked', async () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const link = { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fac-1', linkedAt: new Date() };
    const ctx = ctxWith({
      channelIdentity: {
        getAccountLink: vi.fn(async () => link),
      },
    });

    const result = await integration.messaging.resolveWorkspaceContext(ctx, ref);

    expect(result).toEqual({ orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fac-1' });
    expect(ctx.storage.channelIdentity.getAccountLink).toHaveBeenCalledWith(ref);
  });

  it('returns null for an unlinked sender', async () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const ctx = ctxWith({
      channelIdentity: {
        getAccountLink: vi.fn(async () => null),
      },
    });

    const result = await integration.messaging.resolveWorkspaceContext(ctx, ref);

    expect(result).toBeNull();
  });
});
