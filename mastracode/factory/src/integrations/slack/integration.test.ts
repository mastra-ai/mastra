import { AgentChannels, AgentControllerChannels } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { createSlackAdapter } from '@mastra/slack';
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

const createSlackAdapterMock = vi.mocked(createSlackAdapter);

/** Slack's adapter settings as core's AgentChannels resolves them from Factory's options. */
function resolved(integration: SlackIntegration) {
  const channels = new AgentChannels({ adapters: integration.channels(ctxWith()).adapters as any });
  return (channels as any).adapterConfigs.slack as ReturnType<SlackIntegration['channels']>['adapters']['slack'];
}

beforeEach(() => {
  createSlackAdapterMock.mockClear();
});

describe('SlackIntegration transport configuration', () => {
  it('requires a signing secret in webhook mode', () => {
    expect(() => new SlackIntegration({})).toThrow("'signingSecret' is required");
    expect(() => new SlackIntegration({ mode: 'webhook' })).toThrow("'signingSecret' is required");
  });

  it('requires an app token and bot token in socket mode', () => {
    expect(() => new SlackIntegration({ mode: 'socket' })).toThrow("'appToken' is required");
    expect(() => new SlackIntegration({ mode: 'socket', appToken: 'xapp-test' })).toThrow("'botToken' is required");
  });

  it('keeps account-link credentials out of the socket mode adapter configuration', () => {
    const integration = new SlackIntegration({
      mode: 'socket',
      appToken: 'xapp-test',
      botToken: 'xoxb-test',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    integration.channels(ctxWith());

    const adapterConfig = createSlackAdapterMock.mock.calls[0]?.[0];
    expect(adapterConfig).toEqual(
      expect.objectContaining({
        mode: 'socket',
        appToken: 'xapp-test',
        botToken: 'xoxb-test',
      }),
    );
    expect(adapterConfig).not.toHaveProperty('clientId');
    expect(adapterConfig).not.toHaveProperty('clientSecret');
  });

  it('preserves webhook mode and forwards its transport and OAuth credentials', () => {
    const integration = new SlackIntegration({
      signingSecret: 'secret',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    integration.channels(ctxWith());

    expect(createSlackAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: undefined,
        signingSecret: 'secret',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
    );
  });
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

  it('uses concise progress statuses by default', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });

    const config = { adapters: { slack: resolved(integration) } };
    const typingStatus = config.adapters.slack.typingStatus;

    expect(typingStatus).toBeTypeOf('function');
    if (typeof typingStatus !== 'function') throw new Error('Expected a typing status function');

    const context = (currentStatus?: string) => ({ currentStatus, channelTools: new Set<string>() }) as any;

    expect(typingStatus({ type: 'reasoning-delta' } as any, context())).toBe('is thinking...');
    expect(typingStatus({ type: 'reasoning-delta' } as any, context('is thinking...'))).toBe('is thinking...');
    // Reply text is hidden by default, so streamed text sets no status.
    expect(typingStatus({ type: 'text-delta' } as any, context())).toBeUndefined();
    // ...but the reply tool's text, which streams into the thread, does.
    expect(
      typingStatus(
        { type: 'tool-call-input-streaming-start', payload: { toolName: 'reply_in_thread' } } as any,
        context(),
      ),
    ).toBe('is typing...');
    expect(
      typingStatus({ type: 'tool-call-input-streaming-start', payload: { toolName: 'search' } } as any, context()),
    ).toBeUndefined();
    // When the reply's args finish it is still typing, not "working".
    expect(
      typingStatus(
        { type: 'tool-call', payload: { toolName: 'reply_in_thread', args: { text: 'hi' } } } as any,
        context(),
      ),
    ).toBe('is typing...');
    expect(typingStatus({ type: 'tool-call', payload: { toolName: 'search' } } as any, context())).toBe(
      'is working...',
    );
    expect(typingStatus({ type: 'tool-call', payload: { toolName: 'search' } } as any, context('is working...'))).toBe(
      'is working...',
    );
  });

  it('shows "is typing..." for streamed text when reply text is shown', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret', adapterOptions: { textDisplay: 'show' } });
    const typingStatus = resolved(integration).typingStatus;
    if (typeof typingStatus !== 'function') throw new Error('Expected a typing status function');
    const ctx = { currentStatus: undefined, channelTools: new Set<string>() } as any;
    expect(typingStatus({ type: 'text-delta' } as any, ctx)).toBe('is typing...');
  });

  it("names the tool's current step in the typing status when its args describe it", () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const typingStatus = resolved(integration).typingStatus;
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
    // Slack rejects a loading message of 51 characters or more.
    expect(status({ description: long })).toHaveLength(50);
    expect(status({ description: long })!.endsWith('…')).toBe(true);
    // No usable description falls back to the generic status.
    expect(status({ command: 'ls' })).toBe('is working...');
    expect(status({ description: '   \n ' })).toBe('is working...');
    expect(status({ description: 42 })).toBe('is working...');
    expect(status('{"description":"raw string"}')).toBe('is working...');
  });

  it('explains a failed run with a card that names what went wrong', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    const formatError = integration.channels(ctxWith()).adapters.slack.formatError;

    const badRequest = Object.assign(new Error('Bad Request'), { name: 'AI_APICallError', statusCode: 400 });
    const posted = formatError?.(badRequest, {});

    expect(JSON.stringify(posted)).toContain('Model request rejected');
  });

  it('keeps a caller-supplied error formatter', () => {
    const custom = vi.fn(() => 'custom');
    const integration = new SlackIntegration({ signingSecret: 'secret', adapterOptions: { formatError: custom } });

    expect(integration.channels(ctxWith()).adapters.slack.formatError).toBe(custom);
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

    const config = { adapters: { slack: resolved(integration) } };

    expect(config.adapters.slack.toolDisplay).toBe('hidden');
    expect(config.adapters.slack.typingStatus).toBeTypeOf('function');
  });

  it('keeps reply text out of Slack by default, so the agent posts through reply_in_thread', () => {
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    expect(resolved(integration).textDisplay).toBe('hidden');

    const shown = new SlackIntegration({ signingSecret: 'secret', adapterOptions: { textDisplay: 'show' } });
    expect(resolved(shown).textDisplay).toBe('show');
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
        getSettingOn: vi.fn(async () => null),
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

describe('SlackIntegration pull request announcements', () => {
  const prResult = {
    type: 'tool-result',
    runId: 'r',
    from: 'AGENT',
    payload: {
      toolCallId: 'c1',
      toolName: 'execute_command',
      args: { command: 'gh pr create --draft --title "Fix"' },
      result: { stdout: 'https://github.com/mastra-ai/mastra/pull/123\n' },
    },
  };

  function setup(platform: string | null) {
    const post = vi.fn(async () => ({ id: 'reply-ts' }));
    const addReaction = vi.fn(async () => {});
    const channels = {
      buildRenderContextForThread: vi.fn(async () =>
        platform
          ? { platform, chatThread: { id: 'slack:C123:1792771853.363419', post }, adapter: { addReaction } }
          : null,
      ),
    };
    const integration = new SlackIntegration({ signingSecret: 'secret' });
    integration.initialize({ channels: () => channels as any });
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'thread-1', sessionId: 'session-1' });
    const announcer = integration.processors.output!.find(p => p.id === 'channel-tool-announcement')!;
    const emit = async (part: unknown) => {
      await announcer.processOutputStream!({ part, requestContext, state: {} } as any);
      await new Promise(resolve => setTimeout(resolve, 0));
    };
    return { emit, post, addReaction };
  }

  it('posts the pull request link into the linked Slack thread', async () => {
    const { emit, post, addReaction } = setup('slack');

    await emit(prResult);

    expect(post).toHaveBeenCalledWith({
      markdown: 'Pull request opened: https://github.com/mastra-ai/mastra/pull/123',
    });
    // Opening a pull request does not close the thread out; its merge does.
    expect(addReaction).not.toHaveBeenCalled();
  });

  it('stays silent for sessions not linked to Slack and for tools that open no pull request', async () => {
    const unlinked = setup(null);
    await unlinked.emit(prResult);
    expect(unlinked.post).not.toHaveBeenCalled();

    const linked = setup('slack');
    await linked.emit({ ...prResult, payload: { ...prResult.payload, args: { command: 'gh pr view 123' } } });
    expect(linked.post).not.toHaveBeenCalled();
  });
});

describe('SlackIntegration early typing status', () => {
  // Factory pins "is thinking..." before dispatching a run (acknowledgeReceipt
  // in slack.ts). Drive core's real typing wrapper with Factory's real Slack
  // adapter config to prove the run end clears it, including runs whose
  // stream maps to no status under Factory's typingStatus (text only, empty).
  async function statusesAfterRun(chunkTypes: string[]): Promise<string[]> {
    const adapterConfig = resolved(new SlackIntegration({ signingSecret: 'secret' }));
    const statuses: string[] = [];
    const thread = {
      id: 'slack:C1:1.0',
      startTyping: async (status: string) => {
        statuses.push(status);
      },
    };
    await thread.startTyping('is thinking...');
    async function* stream() {
      for (const type of chunkTypes) yield { type, payload: { text: 'x' } };
    }
    const withTypingStatus = (AgentChannels.prototype as any).withTypingStatus as (
      ...args: unknown[]
    ) => AsyncIterable<unknown>;
    const fakeChannels = { log() {}, channelToolNames: new Set<string>() };
    for await (const _ of withTypingStatus.call(fakeChannels, stream(), thread, 'slack', adapterConfig, {
      active: false,
    })) {
      // drain
    }
    return statuses;
  }

  it('clears the early status when the run streams only text', async () => {
    expect(await statusesAfterRun(['start', 'text-delta', 'finish'])).toEqual(['is thinking...', '']);
  });

  it('clears the early status when the run streams nothing', async () => {
    expect(await statusesAfterRun(['start', 'finish'])).toEqual(['is thinking...', '']);
  });

  it('clears the early status after a run that set its own status', async () => {
    expect(await statusesAfterRun(['start', 'reasoning-delta', 'text-delta', 'finish'])).toEqual([
      'is thinking...',
      'is thinking...',
      '',
    ]);
  });
});
