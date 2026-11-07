import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { slackQuestionHandlers, watchSlackQuestions } from './ask-user.js';

const threadId = 'mastra-thread';
const externalId = 'slack:C1:123';
const channelId = 'C1';
const metadata = {
  channel_platform: 'slack',
  channel_externalThreadId: externalId,
  channel_externalChannelId: channelId,
};

function fixture(selectionMode: 'single_select' | 'multi_select' = 'single_select') {
  const settings = new Map<string, unknown>();
  let listener: (event: any) => void;
  const adapter = {
    postMessage: vi.fn().mockResolvedValue({ id: 'card-1' }),
    editMessage: vi.fn().mockResolvedValue(undefined),
  };
  const session = {
    subscribe: vi.fn((fn: typeof listener) => {
      listener = fn;
    }),
    thread: {
      getId: () => threadId,
      getById: vi.fn().mockResolvedValue({ id: threadId, resourceId: 'channel:slack', metadata }),
      listMessages: vi.fn().mockResolvedValue([
        {
          role: 'user',
          content: { providerMetadata: { mastra: { channels: { slack: { author: { userId: 'U1' } } } } } },
        },
      ]),
      getSettingOn: vi.fn(async ({ key }: { key: string }) => settings.get(key)),
      setSettingOn: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
        if (value === undefined) settings.delete(key);
        else settings.set(key, value);
      }),
    },
    identity: { getResourceId: () => 'channel:slack' },
    suspensions: { has: vi.fn().mockReturnValue(false) },
    claimPersistedToolSuspension: vi.fn().mockResolvedValue({
      accepted: true,
      address: { runId: 'run-1', toolCallId: 'call-1', threadId, resourceId: 'channel:slack' },
      claimKey: 'claim-1',
    }),
    respondToToolSuspension: vi.fn().mockResolvedValue(undefined),
    releaseToolResponse: vi.fn(),
  };
  const mastra = {
    getStorage: () => ({
      getStore: async () => ({
        listThreads: async () => ({ threads: [{ id: threadId, resourceId: 'channel:slack', metadata }] }),
      }),
    }),
  };
  const handlers = slackQuestionHandlers(adapter as any, async () => session as any);
  const ctx = {
    mastra,
    requestContext: new RequestContext(),
    prepareInteractiveReply: vi.fn(),
    skipped: [],
    signalMetadata: {},
  } as any;
  const event = (actionId: string, userId = 'U1') =>
    ({
      actionId,
      user: { userId },
      thread: { id: externalId, channelId },
      messageId: 'card-1',
      openModal: vi.fn(),
    }) as any;
  const suspended = {
    type: 'tool_suspended',
    threadId,
    runId: 'run-1',
    resourceId: 'channel:slack',
    toolCallId: 'call-1',
    toolName: 'ask_user',
    suspendPayload: {
      question: 'Where should I deploy?',
      options: [{ label: 'Staging' }, { label: 'Production' }],
      selectionMode,
    },
  };
  async function posted() {
    watchSlackQuestions(session as any, adapter as any);
    listener!(suspended);
    await vi.waitFor(() => expect(adapter.postMessage).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(settings.get('factory_slack_ask_user:card-1')).toBeTruthy());
  }
  return {
    adapter,
    session,
    mastra,
    handlers,
    ctx,
    event,
    settings,
    suspended,
    posted,
    emit: (e: any) => listener!(e),
  };
}

describe('Slack suspended questions', () => {
  it('posts only one card when duplicate suspension events arrive before delivery finishes', async () => {
    const f = fixture();
    let completePost!: (value: { id: string }) => void;
    f.adapter.postMessage.mockImplementationOnce(() => new Promise(resolve => (completePost = resolve)));
    watchSlackQuestions(f.session as any, f.adapter as any);
    f.emit(f.suspended);
    f.emit(f.suspended);
    await vi.waitFor(() => expect(f.adapter.postMessage).toHaveBeenCalledOnce());
    completePost({ id: 'card-1' });
    await vi.waitFor(() => expect(f.settings.has('factory_slack_ask_user:card-1')).toBe(true));
    f.emit(f.suspended);
    await vi.waitFor(() => expect(f.adapter.postMessage).toHaveBeenCalledOnce());
  });

  it('acknowledges an answer before the run finishes and retains the card when the suspension remains', async () => {
    const f = fixture();
    await f.posted();
    let finish!: () => void;
    f.session.respondToToolSuspension.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
    f.session.suspensions.has.mockReturnValue(true);
    await f.handlers.onAction!(f.event('factory_ask_user:option:0'), vi.fn(), f.ctx);
    expect(f.session.respondToToolSuspension).toHaveBeenCalledOnce();
    expect(f.adapter.editMessage).not.toHaveBeenCalled();
    expect(f.session.releaseToolResponse).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() => expect(f.session.releaseToolResponse).toHaveBeenCalledWith('claim-1'));
    expect(f.settings.has('factory_slack_ask_user:card-1')).toBe(true);
    expect(f.adapter.editMessage).not.toHaveBeenCalled();
  });

  it('posts the question in the originating thread and resumes the exact run on an authorized choice', async () => {
    const f = fixture();
    await f.posted();
    expect(f.adapter.postMessage.mock.calls[0]?.[0]).toBe(externalId);
    const postedCard = JSON.stringify(f.adapter.postMessage.mock.calls[0]?.[1]);
    expect(postedCard).toContain('Where should I deploy?');
    expect(postedCard).toContain('factory_ask_user:option:0');
    expect(postedCard).toContain('factory_ask_user:custom');
    const defaultHandler = vi.fn();
    await f.handlers.onAction!(f.event('factory_ask_user:option:0', 'U2'), defaultHandler, f.ctx);
    expect(f.session.respondToToolSuspension).not.toHaveBeenCalled();
    await f.handlers.onAction!(f.event('factory_ask_user:option:0'), defaultHandler, f.ctx);
    expect(f.session.claimPersistedToolSuspension).toHaveBeenCalledWith('call-1', 'run-1');
    expect(f.ctx.prepareInteractiveReply).toHaveBeenCalled();
    expect(f.session.respondToToolSuspension).toHaveBeenCalledWith(
      expect.objectContaining({ resumeData: 'Staging', address: expect.objectContaining({ runId: 'run-1' }) }),
    );
    await vi.waitFor(() => expect(f.adapter.editMessage).toHaveBeenCalledWith(externalId, 'card-1', expect.anything()));
    await vi.waitFor(() => expect(f.settings.has('factory_slack_ask_user:card-1')).toBe(false));
    await f.handlers.onAction!(f.event('factory_ask_user:option:0'), defaultHandler, f.ctx);
    expect(f.session.respondToToolSuspension).toHaveBeenCalledTimes(1);
    await f.handlers.onAction!(f.event('tool_approve:other'), defaultHandler, f.ctx);
    expect(defaultHandler).toHaveBeenCalledOnce();
  });

  it('collects multiple selections and answers on Submit', async () => {
    const f = fixture('multi_select');
    await f.posted();
    await f.handlers.onAction!(f.event('factory_ask_user:option:0'), vi.fn(), f.ctx);
    await f.handlers.onAction!(f.event('factory_ask_user:option:1'), vi.fn(), f.ctx);
    expect(f.session.respondToToolSuspension).not.toHaveBeenCalled();
    await f.handlers.onAction!(f.event('factory_ask_user:submit'), vi.fn(), f.ctx);
    expect(f.session.respondToToolSuspension).toHaveBeenCalledWith(
      expect.objectContaining({ resumeData: ['Staging', 'Production'] }),
    );
  });

  it('routes a custom modal answer and closes a cancelled question card', async () => {
    const f = fixture();
    await f.posted();
    const click = f.event('factory_ask_user:custom');
    await f.handlers.onAction!(click, vi.fn(), f.ctx);
    expect(click.openModal).toHaveBeenCalledOnce();
    await f.handlers.onModalSubmit!(
      {
        callbackId: 'factory_ask_user_custom',
        privateMetadata: JSON.stringify({ externalId, channelId, messageId: 'card-1' }),
        relatedThread: { id: externalId, channelId },
        user: { userId: 'U1' },
        values: { answer: '  Later  ' },
      } as any,
      f.ctx,
    );
    expect(f.session.respondToToolSuspension).toHaveBeenCalledWith(expect.objectContaining({ resumeData: 'Later' }));
    const g = fixture();
    await g.posted();
    g.emit({ type: 'tool_suspension_cancelled', threadId, runId: 'run-1', toolCallId: 'call-1' });
    await vi.waitFor(() => expect(g.settings.has('factory_slack_ask_user:card-1')).toBe(false));
    expect(g.adapter.editMessage).toHaveBeenCalledWith(externalId, 'card-1', expect.anything());
  });
});
