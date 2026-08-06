import { AgentControllerChannels } from '@mastra/core/channels';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/slack', () => ({
  createSlackAdapter: vi.fn(() => ({ __adapter: true })),
}));

const { adaptSourceControlOwner } = vi.hoisted(() => ({
  adaptSourceControlOwner: vi.fn(() => ({ __sourceControl: true })),
}));

vi.mock('./slack.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./slack.js')>()),
  adaptSourceControlOwner,
}));

import { SlackIntegration } from './integration.js';

function ctxWith(overrides: Record<string, unknown> = {}) {
  return {
    storage: { channelIdentity: {}, projects: {}, ...overrides },
    rules: { workItems: {} },
  } as any;
}

beforeEach(() => {
  adaptSourceControlOwner.mockClear();
});

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

  it('wires a source-control adapter from the context source-control owner when present', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const sourceControlOwner = { integrationId: 'github' };

    integration.channels(ctxWith({ sourceControlOwner }));

    expect(adaptSourceControlOwner).toHaveBeenCalledWith(sourceControlOwner);
    expect(integration.diagnostics()).toMatchObject({ repoBackedSessions: true });
  });

  it('wires no source-control adapter when the context has no source-control owner', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    integration.channels(ctxWith());

    expect(adaptSourceControlOwner).not.toHaveBeenCalled();
    expect(integration.diagnostics()).toMatchObject({ repoBackedSessions: false });
  });
});
