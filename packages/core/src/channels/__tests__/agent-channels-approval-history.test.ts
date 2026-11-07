import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { Adapter, ChatInstance, StateAdapter } from 'chat';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { createDurableAgent, DurableAgent } from '../../agent/durable';
import type { MastraDBMessage } from '../../agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import type { MemoryStorage } from '../../storage';
import type { MastraModelOutput } from '../../stream';
import { createTool } from '../../tools';
import { AgentChannels } from '../agent-channels';
import { ChannelSessionRejectedError } from '../errors';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';
import type { ChatChannelRenderContext } from '../output-processor';
import type { PendingApprovalRecord } from '../stream-helpers';

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
  /** Makes the next approval resume fail, as a storage or model outage would, or with the given error. */
  failNextApproval: boolean | Error = false;
  /** Runs while an approval is resuming, before it is recorded. */
  whileResuming?: (render: ChatChannelRenderContext) => Promise<void>;

  protected override async dispatchApproval(args: {
    runId: string;
    toolCallId: string;
    requestContext: RequestContext;
  }): Promise<void> {
    if (this.failNextApproval) {
      const failure = this.failNextApproval;
      this.failNextApproval = false;
      throw failure instanceof Error ? failure : new Error('resume failed');
    }
    const whileResuming = this.whileResuming;
    this.whileResuming = undefined;
    await whileResuming?.(args.requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext);
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

  it('keeps the card answerable when resuming the run fails', async () => {
    const { channels, reads, click } = await setup(deepApproval());
    channels.failNextApproval = true;

    await click('tool_approve:deep-pending', 'alice');
    expect(channels.decisions).toEqual([]);

    await click('tool_approve:deep-pending', 'alice');
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'deep-pending', runId: 'deep-run' }]);
    expect(reads).toHaveBeenCalledTimes(9);
  });

  it('keeps the card answerable when the session resolver refuses a click', async () => {
    const { channels, click } = await setup(deepApproval());
    // A refusal is about this click, not the run, even if its message reads like a missing snapshot.
    channels.failNextApproval = new ChannelSessionRejectedError('No snapshot found for this session');

    await click('tool_approve:deep-pending', 'alice');
    expect(channels.decisions).toEqual([]);

    await click('tool_approve:deep-pending', 'alice');
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'deep-pending', runId: 'deep-run' }]);
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

  it('keeps one lookup per card when two threads reuse the same tool call id', async () => {
    const { channels, reads, click } = await setup(deepApproval(), deepApproval());
    const second = { thread: SECOND_EXTERNAL_THREAD_ID };

    for (let i = 0; i < 3; i++) {
      await click('tool_approve:deep-pending', 'mallory');
      await click('tool_approve:deep-pending', 'mallory', second);
    }
    expect(channels.decisions).toEqual([]);
    expect(reads).toHaveBeenCalledTimes(18);

    // Answering the second thread's card reseeds it, as a resumed run does;
    // that must not cost the first thread another read.
    channels.whileResuming = async render => {
      const { toolCallId, messageId } = render.approvalContext!;
      render.onApprovalPosted(toolCallId, { messageId, displayName: '', argsSummary: '', startedAt: Date.now() });
    };
    await click('tool_approve:deep-pending', 'alice', second);
    expect(channels.decisions).toEqual([{ kind: 'approve', toolCallId: 'deep-pending', runId: 'deep-run' }]);

    await click('tool_approve:deep-pending', 'mallory');
    expect(channels.decisions).toHaveLength(1);
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

// The clicks below resume a real Agent run through `approveToolCall` and
// `declineToolCall`, so core's own resume rules decide what a second answer
// does: only one resume of a suspended run can execute it, and a resume that
// fails before the run starts hands the suspension back.
describe('approval clicks that resume a real agent run', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup?.();
    cleanup = undefined;
  });

  const TOOL_CALL_ID = 'refund-call';
  const SECOND_TOOL_CALL_ID = 'second-refund-call';

  /**
   * `secondApproval`: once the first refund runs, the agent asks to approve another.
   * `durable`: run the agent through a `DurableAgent` wrapper.
   */
  async function setup({
    secondApproval = false,
    durable = false,
  }: { secondApproval?: boolean; durable?: boolean } = {}) {
    const refunds: number[] = [];
    const refund = createTool({
      id: 'refund',
      description: 'Refund an order. Requires approval.',
      inputSchema: z.object({ amount: z.number() }),
      requireApproval: true,
      execute: async ({ amount }) => {
        refunds.push(amount);
        return { refunded: amount };
      },
    });
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const results = JSON.stringify(prompt).split('tool-result').length - 1;
        const chunks =
          secondApproval && results === 1
            ? [
                { type: 'tool-call', toolCallId: SECOND_TOOL_CALL_ID, toolName: 'refund', input: '{"amount":20}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : results > 0
              ? [
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'Done.' },
                  { type: 'text-end', id: 't' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ]
              : [
                  { type: 'tool-call', toolCallId: TOOL_CALL_ID, toolName: 'refund', input: '{"amount":10}' },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...chunks] as any),
        };
      },
    });
    const store = new InMemoryStore({ id: 'approval-real-agent' });
    const baseAgent = new Agent({
      id: 'approval-owner',
      name: 'Approval owner',
      instructions: 'Refund orders when asked.',
      model,
      tools: { refund },
      memory: new MockMemory({ storage: store }),
    });
    const agent = durable ? createDurableAgent({ agent: baseAgent }) : baseAgent;
    const loopWorkflowName = durable ? 'durable-agentic-loop' : 'agentic-loop';
    const mastra = new Mastra({
      agents: { [agent.id]: agent },
      storage: store,
      workers: false,
      scheduler: { enabled: false },
      logger: false,
    });
    const memory = (await store.getStore('memory')) as MemoryStorage;
    const workflows = (await store.getStore('workflows'))!;
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

    // Alice asks for a refund; the run suspends on the approval and the agent
    // stores the pending entry with its assistant message.
    const memoryOptions = { memory: { thread: THREAD_ID, resource: RESOURCE_ID } };
    const loopStatus = async (id: string) =>
      (await workflows.loadWorkflowSnapshot({ workflowName: loopWorkflowName, runId: id }))?.status;
    // Read a run's stream until it waits on an approval or finishes. A durable
    // stream stays open while its run is suspended, so stop at the approval.
    const untilWaiting = async (id: string, output: MastraModelOutput<any>) => {
      for await (const chunk of output.fullStream) {
        if (durable && chunk.type === 'tool-call-approval') break;
      }
      await vi.waitFor(async () => expect([undefined, 'suspended']).toContain(await loopStatus(id)));
    };
    let runId: string;
    if (agent instanceof DurableAgent) {
      const started = await agent.stream('Refund my order', memoryOptions);
      runId = started.runId;
      await untilWaiting(runId, started.output);
    } else {
      const started = await agent.stream('Refund my order', memoryOptions);
      runId = started.runId;
      await untilWaiting(runId, started);
    }
    expect(await loopStatus(runId)).toBe('suspended');
    // Mark the request as Alice's, as an inbound channel message would be.
    const { messages } = await memory.listMessages({ threadId: THREAD_ID, perPage: false });
    const ask = messages.find(m => m.role === 'user')!;
    await memory.saveMessages({
      messages: [
        {
          ...ask,
          content: {
            ...ask.content,
            providerMetadata: { mastra: { channels: { mock: { author: { userId: 'alice' } } } } },
          },
        },
      ],
    });

    const posts: unknown[] = [];
    const edits: unknown[] = [];
    const instances: AgentChannels[] = [];
    // A fresh AgentChannels, as after a restart: the card is not cached.
    // Each instance has its own adapter, as separate processes would.
    const startInstance = async () => {
      const adapter = createAdapter();
      Object.assign(adapter, {
        async postMessage(_threadId: string, message: unknown) {
          posts.push(message);
          return { id: `post-${posts.length}`, threadId: EXTERNAL_THREAD_ID, raw: {} };
        },
        async editMessage(_threadId: string, _messageId: string, message: unknown) {
          edits.push(message);
          return { id: 'approval-card', threadId: EXTERNAL_THREAD_ID, raw: {} };
        },
        async startTyping() {},
      });
      const channels = new AgentChannels({
        adapters: { mock: { adapter, gateway: false } },
        state: createState(),
        tools: false,
      });
      agent.setChannels(channels);
      await channels.initialize(mastra);
      instances.push(channels);
      const click = (actionId: string, userId: string) =>
        adapter.chat!.processAction(
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
      return { channels, click };
    };
    const { channels, click } = await startInstance();
    cleanup = async () => {
      for (const instance of instances) await instance.sdk?.shutdown();
      await mastra.shutdown();
    };
    const runStatus = () => loopStatus(runId);
    // Another instance approves the card through the agent and its run goes on
    // until it waits again or finishes.
    const approveElsewhere = async (toolCallId: string) =>
      untilWaiting(
        runId,
        await agent.approveToolCall({ runId, toolCallId, memory: { thread: THREAD_ID, resource: RESOURCE_ID } }),
      );
    const errorPosts = () => posts.filter(p => JSON.stringify(p).includes('Error'));
    // Card edits that record a decision (the tool result edits the card too).
    const decisionEdits = () => edits.filter(e => /Approved|Denied/.test(JSON.stringify(e)));
    // How each resume this test spied on ended: 'resumed' or the core error id.
    const outcomes = async (...spies: { mock: { results: { value: unknown }[] } }[]) =>
      (await Promise.allSettled(spies.flatMap(spy => spy.mock.results.map(r => r.value)))).map(r =>
        r.status === 'fulfilled' ? 'resumed' : (r.reason as { id?: string }).id,
      );

    return {
      agent,
      channels,
      workflows,
      runId,
      refunds,
      decisionEdits,
      click,
      startInstance,
      runStatus,
      approveElsewhere,
      errorPosts,
      outcomes,
    };
  }

  it('runs the refund once when the requester clicks Approve twice at the same time', async () => {
    const { agent, refunds, decisionEdits, click, runStatus, errorPosts, outcomes } = await setup();
    const approve = vi.spyOn(agent, 'approveToolCall');

    await Promise.all([click(`tool_approve:${TOOL_CALL_ID}`, 'alice'), click(`tool_approve:${TOOL_CALL_ID}`, 'alice')]);
    await vi.waitFor(async () => expect(await runStatus()).toBeUndefined());

    expect(await outcomes(approve)).toEqual(['resumed']);
    expect(decisionEdits()).toHaveLength(1);
    expect(refunds).toEqual([10]);
    expect(errorPosts()).toEqual([]);
  });

  it('runs the refund once when two instances get the Approve click at the same time', async () => {
    const { agent, refunds, click, startInstance, runStatus, errorPosts, outcomes } = await setup();
    const other = await startInstance();
    const approve = vi.spyOn(agent, 'approveToolCall');

    await Promise.all([
      click(`tool_approve:${TOOL_CALL_ID}`, 'alice'),
      other.click(`tool_approve:${TOOL_CALL_ID}`, 'alice'),
    ]);
    await vi.waitFor(async () => expect(await runStatus()).toBeUndefined());

    // Both clicks reach core; core lets one resume run and refuses the other.
    expect((await outcomes(approve)).sort()).toEqual(['AGENT_RESUME_ALREADY_CLAIMED', 'resumed']);
    expect(refunds).toEqual([10]);
    expect(errorPosts()).toEqual([]);
  });

  it('applies only one answer when the requester clicks Approve and Deny at the same time', async () => {
    const { agent, refunds, decisionEdits, click, runStatus, errorPosts, outcomes } = await setup();
    const approve = vi.spyOn(agent, 'approveToolCall');
    const decline = vi.spyOn(agent, 'declineToolCall');

    await Promise.all([click(`tool_approve:${TOOL_CALL_ID}`, 'alice'), click(`tool_deny:${TOOL_CALL_ID}`, 'alice')]);
    await vi.waitFor(async () => expect(await runStatus()).toBeUndefined());

    // The losing click neither resumes nor edits the card the winner resolved.
    const [approved, denied] = [await outcomes(approve), await outcomes(decline)];
    expect([...approved, ...denied]).toEqual(['resumed']);
    expect(decisionEdits()).toHaveLength(1);
    expect(refunds).toEqual(approved.length ? [10] : []);
    expect(errorPosts()).toEqual([]);
  });

  it('stops resuming an approval that another instance already answered', async () => {
    const { agent, runId, refunds, click, runStatus, errorPosts, outcomes } = await setup();
    // Mallory's click is refused, but this instance now knows the card is pending.
    await click(`tool_approve:${TOOL_CALL_ID}`, 'mallory');

    // Another instance answers the approval and the run finishes.
    const resumed = await agent.approveToolCall({
      runId,
      toolCallId: TOOL_CALL_ID,
      memory: { thread: THREAD_ID, resource: RESOURCE_ID },
    });
    await resumed.consumeStream();
    expect(await runStatus()).toBeUndefined();
    expect(refunds).toEqual([10]);

    const approve = vi.spyOn(agent, 'approveToolCall');
    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await click(`tool_deny:${TOOL_CALL_ID}`, 'alice');

    // Only the first click reaches core, which reports the run as gone.
    expect(await outcomes(approve)).toEqual(['AGENT_RESUME_NO_SNAPSHOT_FOUND']);
    expect(refunds).toEqual([10]);
    expect(errorPosts()).toEqual([]);
  });

  it('stops resuming a card this instance posted once another instance answered it', async () => {
    const { agent, channels, runId, refunds, click, startInstance, errorPosts, outcomes } = await setup();
    // This instance posted the card, so it holds the approval in memory.
    const cards = (channels as unknown as { pendingApprovalCards: Map<string, PendingApprovalRecord> })
      .pendingApprovalCards;
    cards.set(TOOL_CALL_ID, {
      messageId: 'approval-card',
      displayName: 'refund',
      argsSummary: '',
      startedAt: Date.now(),
      runId,
      toolName: 'refund',
      args: { amount: 10 },
      requesterId: 'alice',
    });
    // Another instance answers it; the agent now renders through that instance.
    await startInstance();
    await (
      await agent.approveToolCall({
        runId,
        toolCallId: TOOL_CALL_ID,
        memory: { thread: THREAD_ID, resource: RESOURCE_ID },
      })
    ).consumeStream();

    const approve = vi.spyOn(agent, 'approveToolCall');
    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');

    expect(await outcomes(approve)).toEqual(['AGENT_RESUME_NO_SNAPSHOT_FOUND']);
    expect(refunds).toEqual([10]);
    expect(errorPosts()).toEqual([]);
  });

  // The first card's run/tool target is remembered on this instance, from its
  // history lookup or because it posted the card. Another instance answers the
  // card and the same run then suspends on a second refund. A late click on the
  // first card must not resume the run: a DurableAgent would apply it to the
  // second refund.
  it.each([
    { agentKind: 'Agent', durable: false, remembered: 'history lookup' },
    { agentKind: 'Agent', durable: false, remembered: 'posted card' },
    { agentKind: 'DurableAgent', durable: true, remembered: 'history lookup' },
    { agentKind: 'DurableAgent', durable: true, remembered: 'posted card' },
  ])(
    'ignores a stale card once the run waits on a newer approval ($agentKind, $remembered)',
    async ({ durable, remembered }) => {
      const {
        agent,
        channels,
        runId,
        refunds,
        click,
        startInstance,
        runStatus,
        approveElsewhere,
        errorPosts,
        outcomes,
      } = await setup({ secondApproval: true, durable });
      if (remembered === 'history lookup') {
        // Mallory's click is refused, but this instance now caches the card as pending.
        await click(`tool_approve:${TOOL_CALL_ID}`, 'mallory');
      } else {
        (channels as unknown as { pendingApprovalCards: Map<string, PendingApprovalRecord> }).pendingApprovalCards.set(
          TOOL_CALL_ID,
          {
            messageId: 'approval-card',
            displayName: 'refund',
            argsSummary: '',
            startedAt: Date.now(),
            runId,
            toolName: 'refund',
            args: { amount: 10 },
            requesterId: 'alice',
          },
        );
      }
      // Another instance approves the first refund; the run then asks to approve a second one.
      await startInstance();
      await approveElsewhere(TOOL_CALL_ID);
      expect(await runStatus()).toBe('suspended');
      expect(refunds).toEqual([10]);

      const approve = vi.spyOn(agent, 'approveToolCall');
      const decline = vi.spyOn(agent, 'declineToolCall');
      await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
      await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
      await click(`tool_deny:${TOOL_CALL_ID}`, 'alice');
      // The stale clicks reach no resume and leave the second refund waiting.
      expect(await outcomes(approve, decline)).toEqual([]);
      expect(refunds).toEqual([10]);
      expect(await runStatus()).toBe('suspended');
      expect(errorPosts()).toEqual([]);

      // The second refund's card still works.
      await click(`tool_approve:${SECOND_TOOL_CALL_ID}`, 'alice');
      await vi.waitFor(async () => expect(await runStatus()).toBeUndefined());
      expect(await outcomes(approve)).toEqual(['resumed']);
      expect(refunds).toEqual([10, 20]);
      expect(errorPosts()).toEqual([]);
    },
  );

  it('keeps the card answerable when core times out waiting for the suspension to persist', async () => {
    const { agent, refunds, click, runStatus } = await setup();
    const approve = vi.spyOn(agent, 'approveToolCall').mockRejectedValueOnce(
      new MastraError({
        id: 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'not suspended',
        details: { timedOut: true },
      }),
    );

    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await vi.waitFor(async () => expect(await runStatus()).toBeUndefined());

    expect(approve).toHaveBeenCalledTimes(2);
    expect(refunds).toEqual([10]);
  });

  // What a DurableAgent reports for a run that already finished or was recovered.
  it.each([
    ['missing cold run', 'AGENT_RESUME_NO_SNAPSHOT_FOUND', {}],
    ['run finished by recovery', 'AGENT_RESUME_RUN_FINISHED', {}],
    ['completed run', 'AGENT_RESUME_RUN_NOT_SUSPENDED', { status: 'success' }],
  ] as const)('stops resuming a durable approval after a %s', async (_case, id, details) => {
    const { agent, click, errorPosts } = await setup();
    const approve = vi.spyOn(agent, 'approveToolCall').mockRejectedValue(
      new MastraError({
        id,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'cannot resume',
        details,
      }),
    );

    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');

    expect(approve).toHaveBeenCalledTimes(1);
    expect(errorPosts()).toEqual([]);
  });

  it('lets the requester approve again when the resumed run fails before it starts', async () => {
    const { workflows, refunds, click, runStatus } = await setup();
    // One storage failure while the resumed run starts. Core hands the
    // suspension back, after the click has already returned.
    const update = workflows.updateWorkflowState.bind(workflows);
    let failed = false;
    vi.spyOn(workflows, 'updateWorkflowState').mockImplementation(async args => {
      if (!failed && args.opts.status === 'running' && args.opts.expectedStatus === 'pending') {
        failed = true;
        throw new Error('storage unavailable');
      }
      return update(args);
    });

    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await vi.waitFor(async () => expect(await runStatus()).toBe('suspended'));
    expect(failed).toBe(true);
    expect(refunds).toEqual([]);

    await click(`tool_approve:${TOOL_CALL_ID}`, 'alice');
    await vi.waitFor(async () => expect(await runStatus()).toBeUndefined());
    expect(refunds).toEqual([10]);
  });
});
