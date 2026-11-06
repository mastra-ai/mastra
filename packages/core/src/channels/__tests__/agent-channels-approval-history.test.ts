import type { Adapter, ChatInstance, StateAdapter } from 'chat';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import type { MemoryStorage } from '../../storage';
import { AgentChannels } from '../agent-channels';

// A user clicks Approve/Deny on a tool-approval card after the bot rebuilt (or
// restarted) its AgentChannels. The new instance has no in-memory record of the
// card, so it has to find the pending approval in Memory. That lookup used to
// read only the newest 50 messages, so an approval followed by a long thread was
// silently ignored ("No pending approval found") while its metadata still
// existed. (#29186)

type Decision = { kind: 'approve' | 'deny'; toolCallId: string; runId: string };

// Records decisions at the documented subclass dispatch boundary so the test
// needs no model call. Everything before it (Chat `processAction`, thread
// mapping, Memory lookup, requester check) runs for real.
class RecordingChannels extends AgentChannels {
  readonly decisions: Decision[] = [];
  /** Makes the next approval resume fail, as a storage or model outage would. */
  failNextApproval = false;

  protected override async dispatchApproval(args: { runId: string; toolCallId: string }): Promise<void> {
    if (this.failNextApproval) {
      this.failNextApproval = false;
      throw new Error('resume failed');
    }
    this.decisions.push({ kind: 'approve', toolCallId: args.toolCallId, runId: args.runId });
  }

  protected override async dispatchDecline(args: { runId: string; toolCallId: string }): Promise<void> {
    this.decisions.push({ kind: 'deny', toolCallId: args.toolCallId, runId: args.runId });
  }
}

const THREAD_ID = 'memory-thread';
const RESOURCE_ID = 'alice';
const EXTERNAL_THREAD_ID = 'mock:room:thread';
const when = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n));

type FakeAdapter = Adapter & { chat?: ChatInstance };

function createAdapter(): FakeAdapter {
  const adapter = {
    name: 'mock',
    userName: 'mock-bot',
    async initialize(chat: ChatInstance) {
      adapter.chat = chat;
    },
    async disconnect() {},
    channelIdFromThreadId: () => 'mock:room',
    isDM: () => true,
    async editMessage() {
      return { id: 'approval-card', threadId: EXTERNAL_THREAD_ID, raw: {} };
    },
  } as unknown as FakeAdapter;
  return adapter;
}

function createState(): StateAdapter {
  return { async connect() {}, async disconnect() {} } as unknown as StateAdapter;
}

function assistant(id: string, n: number, metadata: Record<string, unknown> = {}): MastraDBMessage {
  return {
    id,
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
    role: 'assistant',
    type: 'text',
    createdAt: when(n),
    content: { format: 2, parts: [{ type: 'text', text: id }], metadata },
  };
}

function user(id: string, n: number, userId: string): MastraDBMessage {
  return {
    id,
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
    role: 'user',
    type: 'text',
    createdAt: when(n),
    content: {
      format: 2,
      parts: [{ type: 'text', text: id }],
      providerMetadata: { mastra: { channels: { mock: { author: { userId } } } } },
    },
  };
}

function pending(toolCallId: string, runId: string) {
  return { pendingToolApprovals: { [toolCallId]: { toolCallId, runId, toolName: 'refund', args: { amount: 10 } } } };
}

// The assistant message that called a tool needing approval, as the agent
// stores it: the tool call part plus the pending entry in its metadata.
function pendingToolCall(id: string, n: number, toolCallId: string, runId: string): MastraDBMessage {
  return {
    ...assistant(id, n),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId, toolName: 'refund', args: { amount: 10 } },
        },
      ],
      metadata: pending(toolCallId, runId),
    },
  };
}

// The assistant message that called the tool. Once the approval is answered,
// its pending entry is removed from this message's metadata.
function answeredToolCall(id: string, n: number, toolCallId: string): MastraDBMessage {
  return {
    ...assistant(id, n),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId, toolName: 'refund', args: { amount: 10 }, result: 'ok' },
        },
      ],
    },
  };
}

function filler(count: number, startAt: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => assistant(`filler-${startAt + i}`, startAt + i));
}

describe('tool approval after AgentChannels is rebuilt (#29186)', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  async function setup(messages: MastraDBMessage[], toolApprovers?: 'requester' | 'anyone') {
    const store = new InMemoryStore({ id: 'approval-history' });
    const agent = new Agent({
      id: 'approval-owner',
      name: 'Approval owner',
      instructions: 'unused',
      model: 'openai/gpt-4.1',
    });
    const mastra = new Mastra({
      agents: { [agent.id]: agent },
      storage: store,
      workers: false,
      scheduler: { enabled: false },
      logger: false,
    });
    const memory = (await store.getStore('memory')) as MemoryStorage;
    await memory.saveThread({
      thread: {
        id: THREAD_ID,
        resourceId: RESOURCE_ID,
        title: 'Support thread',
        createdAt: when(0),
        updatedAt: when(0),
        metadata: {
          channel_platform: 'mock',
          channel_externalThreadId: EXTERNAL_THREAD_ID,
          channel_externalChannelId: 'mock:room',
          channel_ownerId: agent.id,
        },
      },
    });
    await memory.saveMessages({ messages });

    const adapter = createAdapter();
    const original = new RecordingChannels({
      adapters: { mock: { adapter, gateway: false, ...(toolApprovers ? { toolApprovers } : {}) } },
      state: createState(),
      tools: false,
    });
    agent.setChannels(original);
    await original.initialize(mastra);

    // Rebuild with the pattern documented on `channelConfig`, reusing the same
    // adapter and StateAdapter. The replacement starts with no card cache.
    const replacement = new RecordingChannels({ ...original.channelConfig });
    agent.setChannels(replacement);
    await replacement.initialize(mastra);

    cleanup = async () => {
      await replacement.sdk?.shutdown();
      await mastra.shutdown();
    };

    const click = async (actionId: string, userId: string) => {
      await adapter.chat!.processAction(
        {
          actionId,
          adapter,
          threadId: EXTERNAL_THREAD_ID,
          messageId: 'approval-card',
          user: { userId, userName: userId, fullName: userId, isBot: false, isMe: false },
          raw: {},
        },
        undefined,
      );
    };

    return { replacement, memory, click };
  }

  it('approves a pending refund whose approval is older than the newest 50 messages', async () => {
    const { replacement, memory, click } = await setup([
      user('ask', 0, 'alice'),
      pendingToolCall('approval-metadata', 1, 'older-pending', 'older-run'),
      ...filler(60, 2),
      pendingToolCall('recent-approval-metadata', 62, 'recent-pending', 'recent-run'),
    ]);

    await click('tool_approve:recent-pending', 'alice');
    await click('tool_approve:older-pending', 'alice');

    expect(replacement.decisions).toEqual([
      { kind: 'approve', toolCallId: 'recent-pending', runId: 'recent-run' },
      { kind: 'approve', toolCallId: 'older-pending', runId: 'older-run' },
    ]);
    // The lookup only reads; the persisted approval is untouched.
    const { messages } = await memory.listMessagesById({ messageIds: ['approval-metadata'] });
    expect(messages[0]?.content.metadata).toEqual(pending('older-pending', 'older-run'));
  });

  it('denies a pending approval that sits hundreds of messages back', async () => {
    const { replacement, click } = await setup([
      user('ask', 0, 'alice'),
      pendingToolCall('approval-metadata', 1, 'old-pending', 'old-run'),
      ...filler(400, 2),
    ]);

    await click('tool_deny:old-pending', 'alice');

    expect(replacement.decisions).toEqual([{ kind: 'deny', toolCallId: 'old-pending', runId: 'old-run' }]);
  });

  it('still only lets the original requester answer an old approval', async () => {
    const { replacement, click } = await setup([
      user('ask', 0, 'alice'),
      pendingToolCall('approval-metadata', 1, 'older-pending', 'older-run'),
      ...filler(120, 2),
    ]);

    await click('tool_approve:older-pending', 'mallory');
    expect(replacement.decisions).toEqual([]);

    await click('tool_approve:older-pending', 'alice');
    expect(replacement.decisions).toEqual([{ kind: 'approve', toolCallId: 'older-pending', runId: 'older-run' }]);
  });

  it('finds the requester when their message falls just past the approval in the next batch of history', async () => {
    // Placed so the approval is the oldest message in one 50-message read and
    // the user turn that triggered it is the newest message of the next.
    const { replacement, click } = await setup([
      user('ask', 0, 'alice'),
      pendingToolCall('approval-metadata', 1, 'edge-pending', 'edge-run'),
      ...filler(49, 2),
    ]);

    await click('tool_approve:edge-pending', 'mallory');
    expect(replacement.decisions).toEqual([]);

    await click('tool_approve:edge-pending', 'alice');
    expect(replacement.decisions).toEqual([{ kind: 'approve', toolCallId: 'edge-pending', runId: 'edge-run' }]);
  });

  // Two people spoke in the turn that triggered the tool. With 49 newer
  // messages that turn sits wholly in the next batch of history; with 48 it
  // is split, Alice ending one batch and Bob starting the next.
  const ambiguousAcrossBatches = (newer = 49) => [
    user('ask-bob', 0, 'bob'),
    user('ask-alice', 1, 'alice'),
    pendingToolCall('approval-metadata', 2, 'shared-pending', 'shared-run'),
    ...filler(newer, 3),
  ];

  it.each([
    ['in the next batch of history', 49],
    ['split across two batches of history', 48],
  ])('lets no one answer an old approval when two people spoke in the turn that triggered it, %s', async (_, newer) => {
    const { replacement, click } = await setup(ambiguousAcrossBatches(newer));

    await click('tool_approve:shared-pending', 'alice');
    await click('tool_deny:shared-pending', 'bob');

    expect(replacement.decisions).toEqual([]);
  });

  it('lets anyone answer that old approval when the channel allows any approver', async () => {
    const { replacement, click } = await setup(ambiguousAcrossBatches(), 'anyone');

    await click('tool_deny:shared-pending', 'bob');

    expect(replacement.decisions).toEqual([{ kind: 'deny', toolCallId: 'shared-pending', runId: 'shared-run' }]);
  });

  it('stops reading history once a recent approval and its request are found', async () => {
    const { replacement, memory, click } = await setup([
      ...filler(400, 0),
      user('ask', 400, 'alice'),
      pendingToolCall('approval-metadata', 401, 'recent-pending', 'recent-run'),
      ...filler(10, 402),
    ]);
    const reads = vi.spyOn(memory, 'listMessages');

    await click('tool_approve:recent-pending', 'alice');

    expect(replacement.decisions).toEqual([{ kind: 'approve', toolCallId: 'recent-pending', runId: 'recent-run' }]);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('stops reading history at the tool call when its approval was already answered', async () => {
    const { replacement, memory, click } = await setup([
      ...filler(400, 0),
      user('ask', 400, 'alice'),
      answeredToolCall('refund-call', 401, 'answered-call'),
      ...filler(60, 402),
    ]);
    const reads = vi.spyOn(memory, 'listMessages');

    await click('tool_approve:answered-call', 'alice');

    expect(replacement.decisions).toEqual([]);
    // 60 newer messages fill the first read; the tool call is in the second.
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('ignores a click for an approval that is no longer pending anywhere in a long thread', async () => {
    const { replacement, click } = await setup([user('ask', 0, 'alice'), ...filler(150, 1)]);

    await click('tool_approve:resolved-earlier', 'alice');

    expect(replacement.decisions).toEqual([]);
  });
});

// Without a card cache every click falls back to reading history, and that read
// runs before the requester check. Lookup results are kept per card, so
// clicking a card again, by anyone, does not read the thread again.

const SECOND_THREAD_ID = 'memory-thread-2';
const SECOND_EXTERNAL_THREAD_ID = 'mock:room:thread-2';

// The same messages in the second thread. Providers with sequential tool call
// ids (`call_0`, ...) reuse ids across threads, so tool call ids are kept.
function inSecondThread(messages: MastraDBMessage[]): MastraDBMessage[] {
  return messages.map(m => ({ ...m, id: `t2-${m.id}`, threadId: SECOND_THREAD_ID }));
}
describe('repeated clicks on an approval card after a rebuild', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    vi.useRealTimers();
    await cleanup?.();
    cleanup = undefined;
  });

  async function setup(messages: MastraDBMessage[], secondThread: MastraDBMessage[] = []) {
    const store = new InMemoryStore({ id: 'approval-repeat-clicks' });
    const agent = new Agent({
      id: 'approval-owner',
      name: 'Approval owner',
      instructions: 'unused',
      model: 'openai/gpt-4.1',
    });
    const mastra = new Mastra({
      agents: { [agent.id]: agent },
      storage: store,
      workers: false,
      scheduler: { enabled: false },
      logger: false,
    });
    const memory = (await store.getStore('memory')) as MemoryStorage;
    await memory.saveThread({
      thread: {
        id: THREAD_ID,
        resourceId: RESOURCE_ID,
        title: 'Support thread',
        createdAt: when(0),
        updatedAt: when(0),
        metadata: {
          channel_platform: 'mock',
          channel_externalThreadId: EXTERNAL_THREAD_ID,
          channel_externalChannelId: 'mock:room',
          channel_ownerId: agent.id,
        },
      },
    });
    await memory.saveThread({
      thread: {
        id: SECOND_THREAD_ID,
        resourceId: RESOURCE_ID,
        title: 'Second support thread',
        createdAt: when(0),
        updatedAt: when(0),
        metadata: {
          channel_platform: 'mock',
          channel_externalThreadId: SECOND_EXTERNAL_THREAD_ID,
          channel_externalChannelId: 'mock:room',
          channel_ownerId: agent.id,
        },
      },
    });
    await memory.saveMessages({ messages: [...messages, ...inSecondThread(secondThread)] });

    const adapter = createAdapter();
    // A fresh instance, as after a restart: no approval card is cached.
    const channels = new RecordingChannels({
      adapters: { mock: { adapter, gateway: false } },
      state: createState(),
      tools: false,
    });
    agent.setChannels(channels);
    await channels.initialize(mastra);
    cleanup = async () => {
      await channels.sdk?.shutdown();
      await mastra.shutdown();
    };

    const reads = vi.spyOn(memory, 'listMessages');
    const click = (
      actionId: string,
      userId: string,
      { card = 'approval-card', thread = EXTERNAL_THREAD_ID }: { card?: string; thread?: string } = {},
    ) =>
      adapter.chat!.processAction(
        {
          actionId,
          adapter,
          threadId: thread,
          messageId: card,
          user: { userId, userName: userId, fullName: userId, isBot: false, isMe: false },
          raw: {},
        },
        undefined,
      );

    return { channels, memory, reads, click };
  }

  const deepApproval = () => [
    user('ask', 0, 'alice'),
    pendingToolCall('approval-metadata', 1, 'deep-pending', 'deep-run'),
    ...filler(400, 2),
  ];

  it('reads history once for a deep approval however often another user clicks it, then lets the requester answer', async () => {
    const { channels, reads, click } = await setup(deepApproval());

    await click('tool_approve:deep-pending', 'mallory');
    const oneScan = reads.mock.calls.length;
    // 402 messages, 50 per page.
    expect(oneScan).toBe(9);

    for (let i = 0; i < 5; i++) {
      await click('tool_approve:deep-pending', 'mallory');
      await click('tool_deny:deep-pending', 'mallory');
    }
    expect(channels.decisions).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(oneScan);

    await click('tool_approve:deep-pending', 'alice');
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'deep-pending', runId: 'deep-run' }]);
    expect(reads).toHaveBeenCalledTimes(oneScan);
  });

  it('shares one history read between clicks that arrive at the same time', async () => {
    const { channels, reads, click } = await setup(deepApproval());

    await Promise.all([
      click('tool_approve:deep-pending', 'mallory'),
      click('tool_deny:deep-pending', 'mallory'),
      click('tool_approve:deep-pending', 'eve'),
    ]);

    expect(channels.decisions).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(9);
  });

  it('reads history once for repeated clicks on a card it cannot find', async () => {
    const { channels, reads, click } = await setup([user('ask', 0, 'alice'), ...filler(400, 1)]);

    for (let i = 0; i < 5; i++) await click('tool_approve:unknown-call', 'alice');

    expect(channels.decisions).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(9);
  });

  it('reads history once for repeated clicks on an approval that was already answered', async () => {
    const { channels, reads, click } = await setup([
      user('ask', 0, 'alice'),
      answeredToolCall('refund-call', 1, 'answered-call'),
      ...filler(400, 2),
    ]);

    for (let i = 0; i < 5; i++) await click('tool_approve:answered-call', 'alice');

    expect(channels.decisions).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(9);
  });

  it('does not let an approval be answered twice', async () => {
    const { channels, reads, click } = await setup(deepApproval());

    await click('tool_approve:deep-pending', 'alice');
    await click('tool_approve:deep-pending', 'alice');
    await click('tool_deny:deep-pending', 'alice');

    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'deep-pending', runId: 'deep-run' }]);
    expect(reads).toHaveBeenCalledTimes(9);
  });

  it('keeps the card answerable when resuming the run fails', async () => {
    const { channels, reads, click } = await setup(deepApproval());
    channels.failNextApproval = true;

    await click('tool_approve:deep-pending', 'alice');
    expect(channels.decisions).toEqual([]);

    await click('tool_approve:deep-pending', 'alice');
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'deep-pending', runId: 'deep-run' }]);
    expect(reads).toHaveBeenCalledTimes(9);
  });

  it('finds an approval saved after an earlier click missed it, once the miss expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { channels, memory, reads, click } = await setup([user('ask', 0, 'alice'), ...filler(10, 1)]);

    await click('tool_approve:late-pending', 'alice');
    // Another instance persists the approval after this one looked.
    await memory.saveMessages({
      messages: [user('ask-again', 11, 'alice'), pendingToolCall('late-approval', 12, 'late-pending', 'late-run')],
    });
    await click('tool_approve:late-pending', 'alice');
    expect(channels.decisions).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 61_000);
    await click('tool_approve:late-pending', 'alice');
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'late-pending', runId: 'late-run' }]);
  });

  it('resumes the run once when the requester clicks Approve and Deny at the same time', async () => {
    const { channels, reads, click } = await setup(deepApproval());

    await Promise.all([click('tool_approve:deep-pending', 'alice'), click('tool_deny:deep-pending', 'alice')]);

    expect(channels.decisions).toHaveLength(1);
    expect(reads).toHaveBeenCalledTimes(9);
  });

  it('keeps one lookup per card when two threads reuse the same tool call id', async () => {
    const { channels, reads, click } = await setup(deepApproval(), deepApproval());
    const second = { thread: SECOND_EXTERNAL_THREAD_ID };

    for (let i = 0; i < 3; i++) {
      await click('tool_approve:deep-pending', 'mallory');
      await click('tool_approve:deep-pending', 'mallory', second);
    }
    expect(channels.decisions).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(18);

    await click('tool_approve:deep-pending', 'alice', second);
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'deep-pending', runId: 'deep-run' }]);
    expect(reads).toHaveBeenCalledTimes(18);
  });

  it('looks up a new card fresh when a later run in the thread reuses a tool call id', async () => {
    const { channels, memory, click } = await setup([
      user('ask', 0, 'alice'),
      pendingToolCall('first-call', 1, 'call_0', 'first-run'),
      ...filler(60, 2),
    ]);

    await click('tool_approve:call_0', 'bob', { card: 'first-card' });
    expect(channels.decisions).toEqual([]);

    // Another instance answers the first approval, then a new run by Bob asks
    // for approval again under the same id and posts a new card.
    await memory.saveMessages({
      messages: [
        answeredToolCall('first-call', 1, 'call_0'),
        user('ask-bob', 62, 'bob'),
        pendingToolCall('second-call', 63, 'call_0', 'second-run'),
      ],
    });

    await click('tool_approve:call_0', 'bob', { card: 'second-card' });
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'call_0', runId: 'second-run' }]);
  });
});
