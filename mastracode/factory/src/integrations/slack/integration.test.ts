import { AgentControllerChannels } from '@mastra/core/channels';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/slack', () => ({
  createSlackAdapter: vi.fn(() => ({ __adapter: true })),
}));

import { SlackIntegration } from './integration.js';

function ctxWith(overrides: Record<string, unknown> = {}) {
  return {
    storage: { channelIdentity: {}, projects: {}, memorySettings: {}, ...overrides },
    runtime: { workItems: {} },
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

  it('uses concise progress statuses by default', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    const config = integration.channels(ctxWith());
    const typingStatus = config.adapters.slack.typingStatus;

    expect(typingStatus).toBeTypeOf('function');
    if (typeof typingStatus !== 'function') throw new Error('Expected a typing status function');

    const context = (currentStatus?: string) => ({ currentStatus, channelTools: new Set<string>() }) as any;

    expect(typingStatus({ type: 'reasoning-delta' } as any, context())).toBe('is thinking...');
    expect(typingStatus({ type: 'reasoning-delta' } as any, context('is thinking...'))).toBe('is thinking...');
    expect(typingStatus({ type: 'text-delta' } as any, context())).toBe('is typing...');
    expect(typingStatus({ type: 'tool-call', payload: { toolName: 'search' } } as any, context())).toBe('is working...');
    expect(
      typingStatus({ type: 'tool-call', payload: { toolName: 'search' } } as any, context('is working...')),
    ).toBe('is working...');
  });

  it('defaults streaming when an explicit undefined value is provided', () => {
    const integration = new SlackIntegration({
      signingSecret: 'secret',
      adapterOptions: { streaming: undefined } as any,
    });

    const config = integration.channels(ctxWith());

    expect(config.adapters.slack.streaming).toBe(true);
  });

  it('keeps the Factory defaults when toolDisplay and typingStatus are explicitly undefined', () => {
    const integration = new SlackIntegration({
      signingSecret: 'secret',
      adapterOptions: { toolDisplay: undefined, typingStatus: undefined } as any,
    });

    const config = integration.channels(ctxWith());

    expect(config.adapters.slack.toolDisplay).toBe('hidden');
    expect(config.adapters.slack.typingStatus).toBeTypeOf('function');
  });

  it('preserves an explicit typingStatus: false override', () => {
    const integration = new SlackIntegration({
      signingSecret: 'secret',
      adapterOptions: { typingStatus: false },
    });

    const config = integration.channels(ctxWith());

    expect(config.adapters.slack.typingStatus).toBe(false);
  });

  it('allows adapter options to override the defaults', () => {
    const typingStatus = vi.fn(() => 'custom status');
    const integration = new SlackIntegration({
      signingSecret: 'secret',
      adapterOptions: {
        streaming: false,
        toolDisplay: 'cards',
        typingStatus,
        textFormat: 'plain',
      },
    });

    const config = integration.channels(ctxWith());

    expect(config.adapters.slack).toMatchObject({
      streaming: false,
      toolDisplay: 'cards',
      typingStatus,
      textFormat: 'plain',
    });
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

  // The storage handle is only useful if it survives the trip from the
  // integration context into the hook the channel machinery calls.
  it("forwards the model-packs domain to the session-start hook, so a session starts on the sender's own model", async () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const modelPacks = { getActive: vi.fn(async () => ({ models: { build: 'openai/gpt-5.6', plan: '', fast: '' } })) };
    const config = integration.channels(
      ctxWith({
        modelPacks,
        memorySettings: { get: vi.fn(async () => null) },
        projects: { getById: vi.fn(async () => ({ id: 'fp-1', defaultModelId: 'anthropic/claude-opus-5' })) },
        sourceControlOwner: {
          sessions: {
            getBySessionId: vi.fn(async () => ({ orgId: 'org-1', userId: 'user-1', projectRepositoryId: 'pr-1' })),
          },
          projectRepositories: { get: vi.fn(async () => ({ id: 'pr-1', connectionId: 'conn-gh' })) },
          connections: { get: vi.fn(async () => ({ id: 'conn-gh', factoryProjectId: 'fp-1' })) },
        },
      }),
    );
    const session = {
      mode: { get: () => 'build' },
      thread: { getSetting: vi.fn(async () => null) },
      model: {
        get: vi.fn(() => 'openai/gpt-5.5'),
        switch: vi.fn(async () => {}),
        saveForMode: vi.fn(async () => {}),
      },
      om: {
        observer: { modelId: () => 'initial/model', switchModel: vi.fn(async () => {}) },
        reflector: { modelId: () => 'initial/model', switchModel: vi.fn(async () => {}) },
      },
      state: { get: () => ({}), set: vi.fn(async () => {}) },
    };

    await config.onSessionStart!({
      session,
      thread: { id: 'us-1', resourceId: 'us-1' },
    } as any);

    expect(modelPacks.getActive).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.model.switch).toHaveBeenLastCalledWith({ modelId: 'openai/gpt-5.6' });
  });
});
