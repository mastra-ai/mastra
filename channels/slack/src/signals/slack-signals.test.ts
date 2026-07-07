import type { StorageThreadType } from '@mastra/core/memory';
import { describe, expect, it, vi } from 'vitest';

import { InMemorySlackCredentialStorage, SlackUserAuth } from '../user-auth';
import type { FetchNewMessagesInput, SlackConversationMessage, SlackSignalsClient } from './slack-client';
import { compareSlackTs } from './slack-client';
import type { SlackSignalsThreadStore } from './slack-signals';
import { getSlackSignalsMetadata, slackExternalResourceId, SlackSignals } from './slack-signals';

const SELF_USER_ID = 'USELF';

function makeAuth(): SlackUserAuth {
  return new SlackUserAuth({
    storage: new InMemorySlackCredentialStorage({
      accessToken: 'xoxp-test-token',
      userId: SELF_USER_ID,
      teamId: 'T123',
    }),
  });
}

/** A Slack ts guaranteed to be after "now" by the given offset in seconds. */
function tsAfterNow(offsetSeconds: number): string {
  return (Date.now() / 1000 + offsetSeconds).toFixed(6);
}

class FakeSlackClient implements SlackSignalsClient {
  calls: FetchNewMessagesInput[] = [];
  #messages = new Map<string, SlackConversationMessage[]>();

  #key(channelId: string, threadTs?: string): string {
    return `${channelId}:${threadTs ?? ''}`;
  }

  addMessage(channelId: string, threadTs: string | undefined, message: SlackConversationMessage): void {
    const key = this.#key(channelId, threadTs);
    const list = this.#messages.get(key) ?? [];
    list.push(message);
    this.#messages.set(key, list);
  }

  async fetchNewMessages(input: FetchNewMessagesInput): Promise<SlackConversationMessage[]> {
    this.calls.push(input);
    const list = this.#messages.get(this.#key(input.channelId, input.threadTs)) ?? [];
    return list
      .filter(message => !input.oldest || compareSlackTs(message.ts, input.oldest) > 0)
      .sort((a, b) => compareSlackTs(a.ts, b.ts));
  }
}

class FakeThreadStore implements SlackSignalsThreadStore {
  threads = new Map<string, StorageThreadType>();

  async getThreadById(input: { threadId: string; resourceId?: string }): Promise<StorageThreadType | null> {
    return this.threads.get(input.threadId) ?? null;
  }

  async saveThread(input: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.threads.set(input.thread.id, input.thread);
    return input.thread;
  }
}

function makeFakeAgent() {
  const sendNotificationSignal = vi.fn().mockResolvedValue({ accepted: true });
  return { agent: { sendNotificationSignal } as never, sendNotificationSignal };
}

function makeProvider(overrides: { client?: FakeSlackClient; threadStore?: FakeThreadStore } = {}) {
  const client = overrides.client ?? new FakeSlackClient();
  const threadStore = overrides.threadStore ?? new FakeThreadStore();
  const provider = new SlackSignals({ auth: makeAuth(), client, threadStore });
  const { agent, sendNotificationSignal } = makeFakeAgent();
  provider.connect(agent);
  return { provider, client, threadStore, sendNotificationSignal };
}

const TARGET = { threadId: 'thread-1', resourceId: 'resource-1' };
const CHANNEL = 'C0123456789';
const THREAD_TS = '1725000000.000100';

describe('slackExternalResourceId', () => {
  it('builds thread and channel ids', () => {
    expect(slackExternalResourceId(CHANNEL, THREAD_TS)).toBe(`slack:${CHANNEL}:${THREAD_TS}`);
    expect(slackExternalResourceId(CHANNEL)).toBe(`slack:${CHANNEL}`);
  });
});

describe('SlackSignals subscriptions', () => {
  it('subscribes a thread and persists the record with a baseline cursor', async () => {
    const { provider, threadStore } = makeProvider();

    const record = await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    expect(record.externalResourceId).toBe(`slack:${CHANNEL}:${THREAD_TS}`);
    expect(Number(record.lastSeenTs)).toBeGreaterThan(0);
    expect(provider.listSlackSubscriptions(TARGET)).toHaveLength(1);

    const persisted = getSlackSignalsMetadata(threadStore.threads.get(TARGET.threadId)?.metadata);
    expect(persisted.subscriptions).toHaveLength(1);
    expect(persisted.subscriptions[0]!.externalResourceId).toBe(record.externalResourceId);
  });

  it('re-subscribing keeps the existing persisted cursor', async () => {
    const { provider, threadStore } = makeProvider();

    const first = await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });
    const second = await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    expect(second.lastSeenTs).toBe(first.lastSeenTs);
    const persisted = getSlackSignalsMetadata(threadStore.threads.get(TARGET.threadId)?.metadata);
    expect(persisted.subscriptions).toHaveLength(1);
  });

  it('unsubscribes and removes the persisted record', async () => {
    const { provider, threadStore } = makeProvider();

    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });
    const removed = await provider.unsubscribeFromSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    expect(removed).toBe(true);
    expect(provider.listSlackSubscriptions(TARGET)).toHaveLength(0);
    const persisted = getSlackSignalsMetadata(threadStore.threads.get(TARGET.threadId)?.metadata);
    expect(persisted.subscriptions).toHaveLength(0);
  });
});

describe('SlackSignals polling', () => {
  it('fires a notification signal for new thread messages', async () => {
    const { provider, client, sendNotificationSignal } = makeProvider();
    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(10), user: 'UOTHER', text: 'hey, are you around?' });
    await provider.pollNow();

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    const [notification, target] = sendNotificationSignal.mock.calls[0]!;
    expect(notification.source).toBe('slack');
    expect(notification.kind).toBe('thread-activity');
    expect(notification.summary).toContain('1 new message');
    expect(notification.summary).toContain('hey, are you around?');
    expect(notification.attributes.channelId).toBe(CHANNEL);
    expect(notification.attributes.latestAuthor).toBe('UOTHER');
    expect(target).toMatchObject({ threadId: TARGET.threadId, resourceId: TARGET.resourceId });
  });

  it('advances the cursor — no duplicate signals on subsequent polls', async () => {
    const { provider, client, sendNotificationSignal } = makeProvider();
    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(10), user: 'UOTHER', text: 'first' });
    await provider.pollNow();
    await provider.pollNow();

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);

    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(20), user: 'UOTHER', text: 'second' });
    await provider.pollNow();

    expect(sendNotificationSignal).toHaveBeenCalledTimes(2);
    const [notification] = sendNotificationSignal.mock.calls[1]!;
    expect(notification.summary).toContain('second');
    expect(notification.summary).not.toContain('first');
  });

  it("skips the user's own messages but still advances the cursor", async () => {
    const { provider, client, sendNotificationSignal } = makeProvider();
    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(10), user: SELF_USER_ID, text: 'my own reply' });
    await provider.pollNow();
    expect(sendNotificationSignal).not.toHaveBeenCalled();

    // Own message must not be re-delivered later either.
    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(20), user: 'UOTHER', text: 'reply from someone else' });
    await provider.pollNow();

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    const [notification] = sendNotificationSignal.mock.calls[0]!;
    expect(notification.attributes.messageCount).toBe(1);
    expect(notification.summary).toContain('reply from someone else');
  });

  it('stops signaling after unsubscribe', async () => {
    const { provider, client, sendNotificationSignal } = makeProvider();
    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });
    await provider.unsubscribeFromSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(10), user: 'UOTHER', text: 'unseen' });
    await provider.pollNow();

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(client.calls).toHaveLength(0);
  });

  it('uses channel-activity kind for channel-only watches', async () => {
    const { provider, client, sendNotificationSignal } = makeProvider();
    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL });

    client.addMessage(CHANNEL, undefined, { ts: tsAfterNow(10), user: 'UOTHER', text: 'top-level post' });
    await provider.pollNow();

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    const [notification] = sendNotificationSignal.mock.calls[0]!;
    expect(notification.kind).toBe('channel-activity');
    expect(client.calls[0]!.threadTs).toBeUndefined();
  });

  it('forwards ifIdle stream options from getNotificationStreamOptions', async () => {
    const client = new FakeSlackClient();
    const threadStore = new FakeThreadStore();
    const provider = new SlackSignals({
      auth: makeAuth(),
      client,
      threadStore,
      getNotificationStreamOptions: () => ({ requestContext: { channel: 'slack' } }),
    });
    const { agent, sendNotificationSignal } = makeFakeAgent();
    provider.connect(agent);

    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });
    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(10), user: 'UOTHER', text: 'wake up' });
    await provider.pollNow();

    const [, target] = sendNotificationSignal.mock.calls[0]!;
    expect(target.ifIdle).toEqual({ streamOptions: { requestContext: { channel: 'slack' } } });
  });

  it('keeps polling other subscriptions when one fails', async () => {
    const { provider, client, sendNotificationSignal } = makeProvider();
    await provider.subscribeToSlackThread({ ...TARGET, channelId: 'CBROKEN' });
    await provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    const original = client.fetchNewMessages.bind(client);
    vi.spyOn(client, 'fetchNewMessages').mockImplementation(async input => {
      if (input.channelId === 'CBROKEN') throw new Error('channel_not_found');
      return original(input);
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(10), user: 'UOTHER', text: 'still delivered' });
    await provider.pollNow();

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('SlackSignals restart persistence', () => {
  it('resumes from the persisted cursor after a restart — no duplicate signals', async () => {
    const client = new FakeSlackClient();
    const threadStore = new FakeThreadStore();

    // First provider instance: subscribe, receive one message.
    const first = makeProvider({ client, threadStore });
    await first.provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });
    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(10), user: 'UOTHER', text: 'before restart' });
    await first.provider.pollNow();
    expect(first.sendNotificationSignal).toHaveBeenCalledTimes(1);

    // "Restart": fresh provider sharing the thread store, registry rehydrated.
    const second = makeProvider({ client, threadStore });
    const restored = await second.provider.restoreSubscriptionsForThread(TARGET);
    expect(restored).toBe(1);

    await second.provider.pollNow();
    expect(second.sendNotificationSignal).not.toHaveBeenCalled();

    client.addMessage(CHANNEL, THREAD_TS, { ts: tsAfterNow(20), user: 'UOTHER', text: 'after restart' });
    await second.provider.pollNow();
    expect(second.sendNotificationSignal).toHaveBeenCalledTimes(1);
    const [notification] = second.sendNotificationSignal.mock.calls[0]!;
    expect(notification.summary).toContain('after restart');
    expect(notification.summary).not.toContain('before restart');
  });
});

describe('SlackSignals tools', () => {
  it('exposes subscribe/unsubscribe/list tools', () => {
    const { provider } = makeProvider();
    const tools = provider.getTools();
    expect(Object.keys(tools).sort()).toEqual([
      'slack_list_subscriptions',
      'slack_subscribe_thread',
      'slack_unsubscribe_thread',
    ]);
  });

  it('subscribe tool registers a subscription using the agent thread context', async () => {
    const { provider } = makeProvider();
    const tools = provider.getTools() as Record<
      string,
      { execute: (input: unknown, context?: unknown) => Promise<any> }
    >;

    const result = await tools.slack_subscribe_thread!.execute(
      { channelId: CHANNEL, threadTs: THREAD_TS },
      { agent: { threadId: TARGET.threadId, resourceId: TARGET.resourceId } },
    );

    expect(result.ok).toBe(true);
    expect(result.subscribed).toBe(`slack:${CHANNEL}:${THREAD_TS}`);
    expect(provider.listSlackSubscriptions(TARGET)).toHaveLength(1);

    const list = await tools.slack_list_subscriptions!.execute(
      {},
      { agent: { threadId: TARGET.threadId, resourceId: TARGET.resourceId } },
    );
    expect(list.subscriptions).toHaveLength(1);

    const unsubscribe = await tools.slack_unsubscribe_thread!.execute(
      { channelId: CHANNEL, threadTs: THREAD_TS },
      { agent: { threadId: TARGET.threadId, resourceId: TARGET.resourceId } },
    );
    expect(unsubscribe.removed).toBe(true);
    expect(provider.listSlackSubscriptions(TARGET)).toHaveLength(0);
  });

  it('tools fail gracefully without agent thread context', async () => {
    const { provider } = makeProvider();
    const tools = provider.getTools() as Record<
      string,
      { execute: (input: unknown, context?: unknown) => Promise<any> }
    >;

    const result = await tools.slack_subscribe_thread!.execute({ channelId: CHANNEL }, {});
    expect(result.ok).toBe(false);
  });

  it('list tool restores persisted subscriptions after a restart', async () => {
    const threadStore = new FakeThreadStore();
    const first = makeProvider({ threadStore });
    await first.provider.subscribeToSlackThread({ ...TARGET, channelId: CHANNEL, threadTs: THREAD_TS });

    const second = makeProvider({ threadStore });
    const tools = second.provider.getTools() as Record<
      string,
      { execute: (input: unknown, context?: unknown) => Promise<any> }
    >;
    const list = await tools.slack_list_subscriptions!.execute(
      {},
      { agent: { threadId: TARGET.threadId, resourceId: TARGET.resourceId } },
    );
    expect(list.subscriptions).toHaveLength(1);
    expect(second.provider.listSlackSubscriptions(TARGET)).toHaveLength(1);
  });
});
