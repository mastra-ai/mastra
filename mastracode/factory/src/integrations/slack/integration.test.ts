import { AgentControllerChannels } from '@mastra/core/channels';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/slack', () => ({
  createSlackAdapter: vi.fn(() => ({ __adapter: true })),
}));

import { SlackIntegration } from './integration.js';

function ctxWith(overrides: Record<string, unknown> = {}) {
  return {
    storage: { channelIdentity: {}, projects: {}, memorySettings: {}, ...overrides },
    runtime: { workItems: { findRunBindingByThread: async () => null } },
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
    expect(typingStatus({ type: 'tool-call', payload: { toolName: 'search' } } as any, context())).toBe(
      'is working...',
    );
    expect(typingStatus({ type: 'tool-call', payload: { toolName: 'search' } } as any, context('is working...'))).toBe(
      'is working...',
    );
  });

  it("names the tool's current step in the typing status when its args describe it", () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const typingStatus = integration.channels(ctxWith()).adapters.slack.typingStatus;
    if (typeof typingStatus !== 'function') throw new Error('Expected a typing status function');
    const ctx = { currentStatus: undefined, channelTools: new Set<string>() } as any;
    const status = (args: unknown) =>
      typingStatus({ type: 'tool-call', payload: { toolName: 'execute_command', args } } as any, ctx);

    // Sentence-case descriptions read after the app name: "<App> is listing the repo root".
    expect(status({ description: 'Listing the repo root', command: 'ls' })).toBe('is listing the repo root');
    // Acronyms and identifiers keep their case.
    expect(status({ description: 'PR lookup for #27350' })).toBe('is PR lookup for #27350');
    // Multi-line bodies (issue/PR creators) contribute their first line only, whitespace collapsed.
    expect(status({ description: '\n  Fix the   flaky\tlogin test\n\nIt fails when…' })).toBe(
      'is fix the flaky login test',
    );
    // Long descriptions are clipped so Slack's inline status stays one line.
    const long = 'A'.repeat(200);
    expect(status({ description: long })).toHaveLength('is '.length + 80);
    expect(status({ description: long })!.endsWith('…')).toBe(true);
    // No usable description falls back to the generic status.
    expect(status({ command: 'ls' })).toBe('is working...');
    expect(status({ description: '   \n ' })).toBe('is working...');
    expect(status({ description: 42 })).toBe('is working...');
    expect(status('{"description":"raw string"}')).toBe('is working...');
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

  it('lets a caller opt into the Thinking Steps widget', () => {
    const integration = new SlackIntegration({
      signingSecret: 'secret',
      adapterOptions: { toolDisplay: 'grouped' },
    });

    expect(integration.channels(ctxWith()).adapters.slack.toolDisplay).toBe('grouped');
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
  it("forwards the model-defaults domain to the session-start hook, so a session starts on the sender's own model", async () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const modelDefaults = { get: vi.fn(async () => ({ modelId: 'openai/gpt-5.6' })) };
    const config = integration.channels(
      ctxWith({
        modelDefaults,
        memorySettings: { get: vi.fn(async () => null) },
        projects: {
          getById: vi.fn(async () => ({
            id: 'fp-1',
            orgId: 'org-1',
            modelScope: 'user',
            defaultModelId: 'anthropic/claude-opus-5',
          })),
        },
        sourceControlOwner: {
          sessions: {
            getBySessionId: vi.fn(async () => ({
              orgId: 'org-1',
              userId: 'user-1',
              projectRepositoryId: 'pr-1',
              factoryProjectId: 'fp-1',
            })),
          },
        },
      }),
    );
    const session = {
      identity: { getId: () => 'us-1', getResourceId: () => 'us-1' },
      mode: { get: () => 'build' },
      thread: {
        getId: () => 'us-1',
        getById: vi.fn(async () => ({ metadata: {} })),
        getSetting: vi.fn(async () => null),
        setSetting: vi.fn(async () => {}),
        setSettingOn: vi.fn(async () => {}),
      },
      model: {
        get: vi.fn(() => 'openai/gpt-5.5'),
        switch: vi.fn(async () => {}),
      },
      om: {
        observer: { modelId: () => 'initial/model', switchModel: vi.fn(async () => {}) },
        reflector: { modelId: () => 'initial/model', switchModel: vi.fn(async () => {}) },
      },
      state: { get: () => ({}), set: vi.fn(async () => {}) },
      subagents: { model: { set: vi.fn(async () => {}) } },
    };

    await config.onSessionStart!({
      session,
      thread: { id: 'us-1', resourceId: 'us-1' },
    } as any);

    expect(modelDefaults.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.model.switch).toHaveBeenLastCalledWith('openai/gpt-5.6');
  });
});
