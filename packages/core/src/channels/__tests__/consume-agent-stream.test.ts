import { describe, it, expect, vi, beforeAll } from 'vitest';

import { AgentChannels } from '../agent-channels';
import { getChatModule } from '../chat-lazy';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
//
// `consumeAgentStream` is the heart of the channels rendering pipeline: it
// turns an `AsyncIterable<AgentChunkType>` (from `agent.subscribeToThread()`)
// into a sequence of platform calls (`sdkThread.post()`, `startTyping()`,
// `adapter.editMessage()`, ...). These tests drive it directly with canned
// chunk streams and assert against a flat recording of every platform call.

type Call =
  | { kind: 'post'; arg: unknown }
  | { kind: 'startTyping'; status: string | undefined }
  | { kind: 'editMessage'; threadId: string; messageId: string; content: unknown };

function createRecording() {
  const calls: Call[] = [];
  let nextMessageId = 1;

  const adapter: any = {
    name: 'test',
    postMessage: vi.fn().mockResolvedValue({ id: 'fallback', text: '' }),
    editMessage: vi.fn(async (threadId: string, messageId: string, content: unknown) => {
      calls.push({ kind: 'editMessage', threadId, messageId, content });
    }),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok')),
    initialize: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn().mockResolvedValue([]),
    encodeThreadId: vi.fn((...parts: string[]) => parts.join(':')),
    decodeThreadId: vi.fn((id: string) => id.split(':')),
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((t: string) => t),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  };

  const sdkThread: any = {
    id: 'test:c1:t1',
    channelId: 'test:c1',
    isDM: false,
    post: vi.fn(async (content: unknown) => {
      calls.push({ kind: 'post', arg: content });
      return { id: `m${nextMessageId++}`, text: typeof content === 'string' ? content : '' };
    }),
    startTyping: vi.fn(async (status: string | undefined) => {
      calls.push({ kind: 'startTyping', status });
    }),
  };

  return { calls, adapter, sdkThread };
}

async function* chunkStream(chunks: any[]): AsyncIterable<any> {
  for (const c of chunks) yield c;
}

function makeChannels(
  opts: {
    streaming?: boolean | { updateIntervalMs?: number };
    toolDisplay?: 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden' | ((event: any, ctx: any) => any);
    typingStatus?: boolean | ((chunk: any, ctx: any) => any);
    cards?: boolean;
    logger?: any;
  } = {},
) {
  const recording = createRecording();
  const adapterConfig: Record<string, unknown> = {
    adapter: recording.adapter,
    streaming: opts.streaming ?? false,
  };
  if (opts.toolDisplay !== undefined) adapterConfig.toolDisplay = opts.toolDisplay;
  if (opts.typingStatus !== undefined) adapterConfig.typingStatus = opts.typingStatus;
  if (opts.cards !== undefined) adapterConfig.cards = opts.cards;
  const channels = new AgentChannels({
    adapters: { test: adapterConfig as any },
  });
  if (opts.logger) (channels as any).__setLogger(opts.logger);
  return { channels, ...recording };
}

async function drive(
  channels: AgentChannels,
  chunks: any[],
  sdkThread: any,
  approvalContext?: { toolCallId: string; messageId: string },
) {
  await (channels as any).consumeAgentStream(chunkStream(chunks), sdkThread, 'test', approvalContext);
}

// Drain a StreamingPlan's underlying iterable so we can assert on the
// pieces that would have been streamed to the platform.
async function drainStreamingPlan(plan: any): Promise<Array<string | Record<string, unknown>>> {
  const pieces: Array<string | Record<string, unknown>> = [];
  for await (const piece of plan.stream as AsyncIterable<string | Record<string, unknown>>) {
    pieces.push(piece);
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('consumeAgentStream', () => {
  beforeAll(async () => {
    // Card/CardText etc. are looked up via chatModule() at call time, so we
    // need to prime the lazy import before the consumer runs.
    await getChatModule();
  });

  describe('buffered text (streaming disabled)', () => {
    it('accumulates text-deltas and posts once on step-finish', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'Hello' } },
          { type: 'text-delta', payload: { text: ', ' } },
          { type: 'text-delta', payload: { text: 'world!' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toEqual([{ kind: 'post', arg: 'Hello, world!' }]);
    });

    it('strips zero-width characters before posting', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: '\u200BHi\u200C\uFEFF' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      expect(calls.filter(c => c.kind === 'post')).toEqual([{ kind: 'post', arg: 'Hi' }]);
    });

    it('skips empty/whitespace-only buffers', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: '   ' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      expect(calls.filter(c => c.kind === 'post')).toEqual([]);
    });
  });

  describe('streaming session (streaming enabled)', () => {
    it('opens a StreamingPlan on first text-delta and feeds it pieces until step-finish', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'Hel' } },
          { type: 'text-delta', payload: { text: 'lo!' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      const plan = (posts[0] as Extract<Call, { kind: 'post' }>).arg as any;
      expect(plan).toBeInstanceOf((await getChatModule()).StreamingPlan);
      expect(await drainStreamingPlan(plan)).toEqual(['Hel', 'lo!']);
    });

    it('forwards updateIntervalMs onto the StreamingPlan options', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: { updateIntervalMs: 250 } });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'x' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const plan = (calls.find(c => c.kind === 'post') as Extract<Call, { kind: 'post' }>).arg as any;
      expect(plan.options.updateIntervalMs).toBe(250);
    });

    it('opens a fresh session for each step (closes on step-finish)', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'first' } },
          { type: 'step-finish', payload: {} },
          { type: 'text-delta', payload: { text: 'second' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const plans = calls.filter(c => c.kind === 'post');
      expect(plans).toHaveLength(2);
      expect(await drainStreamingPlan((plans[0] as Extract<Call, { kind: 'post' }>).arg)).toEqual(['first']);
      expect(await drainStreamingPlan((plans[1] as Extract<Call, { kind: 'post' }>).arg)).toEqual(['second']);
    });

    it("with streaming and undefined toolDisplay, defaults to 'cards'", async () => {
      // The default is always `'cards'` regardless of streaming —
      // `'timeline'`/`'grouped'` require StreamingPlan and aren't available
      // on every platform, so users opt in explicitly. With streaming on,
      // `'cards'` closes the streaming session, posts the card, and reopens
      // on the next chunk.
      const { channels, calls, sdkThread } = makeChannels({ streaming: true });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'thinking ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      // Tool renders as discrete cards (post + edit), not as task_updates.
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('toolDisplay modes', () => {
    it("'timeline': emits task_update chunks into the streaming session (one task per tool)", async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true, toolDisplay: 'timeline' });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'thinking ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' }, result: 'sunny' },
          },
          { type: 'text-delta', payload: { text: 'done' } },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      // Text-before-tools triggers a session flush so the leading text posts
      // as its own platform message; the tool widget + trailing text post as
      // a second message. Without the flush, Slack's AI Assistant widget
      // would always render tasks above text within a single post.
      expect(posts).toHaveLength(2);
      expect(calls.find(c => c.kind === 'editMessage')).toBeUndefined();

      // First post: streaming text only (no task_update chunks).
      const firstPost = (posts[0] as Extract<Call, { kind: 'post' }>).arg as any;
      const firstDrained = await drainStreamingPlan(firstPost);
      const firstText = firstDrained.filter((p): p is string => typeof p === 'string').join('');
      expect(firstText).toContain('thinking');

      // Second post: tool widget + trailing text.
      const planArg = (posts[1] as Extract<Call, { kind: 'post' }>).arg as any;
      // `'timeline'` mode tells StreamingPlan to render each task inline.
      expect(planArg.options?.groupTasks).toBe('timeline');

      const drained = await drainStreamingPlan(planArg);
      const taskUpdates = drained.filter(
        (p): p is { type: 'task_update'; status: string; id: string; output?: string; details?: string } =>
          typeof p === 'object' && (p as any).type === 'task_update',
      );
      expect(taskUpdates).toHaveLength(2);
      expect(taskUpdates[0]).toMatchObject({ id: 't1', status: 'in_progress' });
      expect(taskUpdates[1]).toMatchObject({ id: 't1', status: 'complete' });
      // The completion chunk must not repeat `details` — Chat SDK appends to
      // the existing task entry by id, so re-sending would render duplicates.
      expect(taskUpdates[1].details).toBeUndefined();
      const text = drained.filter((p): p is string => typeof p === 'string').join('');
      expect(text).toContain('done');
    });

    it("'grouped': renders task_updates inside a single plan block (groupTasks: 'plan')", async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true, toolDisplay: 'grouped' });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-call',
            payload: { toolCallId: 't2', toolName: 'weather', args: { city: 'LA' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'rainy' },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't2', toolName: 'weather', args: { city: 'LA' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      const planArg = (posts[0] as Extract<Call, { kind: 'post' }>).arg as any;
      expect(planArg.options?.groupTasks).toBe('plan');

      const drained = await drainStreamingPlan(planArg);
      const taskUpdates = drained.filter(
        (p): p is { type: 'task_update'; id: string; status: string } =>
          typeof p === 'object' && (p as any).type === 'task_update',
      );
      // 2 tools × 2 updates each (in_progress + complete) → 4 chunks total.
      expect(taskUpdates).toHaveLength(4);
      expect(new Set(taskUpdates.map(t => t.id))).toEqual(new Set(['t1', 't2']));
    });

    it("flushes pending OM tasks as 'complete' before closing the session", async () => {
      // OM buffering runs async in the background — if the session closes
      // before `buffering-end` arrives, the chat-SDK plan widget flips any
      // still-`in_progress` task to an error icon. The streaming driver
      // optimistically marks pending OM tasks complete on close so the
      // "Saving to memory…" row doesn't visually error out.
      const { channels, calls, sdkThread } = makeChannels({ streaming: true, toolDisplay: 'grouped' });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'hello' } },
          {
            type: 'data-om-buffering-start',
            data: { cycleId: 'cyc-1', operationType: 'observation' },
          },
          // No buffering-end before finish — the background work hasn't
          // resolved by the time the stream closes.
          { type: 'finish', payload: {} },
        ] as any,
        sdkThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      const planArg = (posts[0] as Extract<Call, { kind: 'post' }>).arg as any;
      const drained = await drainStreamingPlan(planArg);
      const taskUpdates = drained.filter(
        (p): p is { type: 'task_update'; id: string; status: string; title: string } =>
          typeof p === 'object' && (p as any).type === 'task_update',
      );
      const omUpdates = taskUpdates.filter(t => t.id === 'om-buffer:cyc-1');
      expect(omUpdates).toHaveLength(2);
      expect(omUpdates[0]).toMatchObject({ status: 'in_progress', title: 'Saving to memory…' });
      expect(omUpdates[1]).toMatchObject({ status: 'complete', title: 'Saving to memory…' });
    });

    it("'hidden': drops tool-call/result chunks entirely (no card, no task_update)", async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true, toolDisplay: 'hidden' });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'thinking ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' }, result: 'sunny' },
          },
          { type: 'text-delta', payload: { text: 'done' } },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      // Streaming text still posts; tools render nothing.
      // Hidden mode flushes pending text on tool-call so the leading text
      // posts before the silent tool runs (otherwise the user sees the
      // typing status with no leading message until the tool resolves).
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(2);
      expect(calls.find(c => c.kind === 'editMessage')).toBeUndefined();

      const allDrained = (
        await Promise.all(posts.map(p => drainStreamingPlan((p as Extract<Call, { kind: 'post' }>).arg)))
      ).flat();
      const taskUpdates = allDrained.filter(p => typeof p === 'object' && (p as any).type === 'task_update');
      expect(taskUpdates).toHaveLength(0);
      const text = allDrained.filter((p): p is string => typeof p === 'string').join('');
      expect(text).toContain('thinking');
      expect(text).toContain('done');
    });

    it("'timeline' without streaming: warns once and falls back to cards", async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false, toolDisplay: 'timeline' });
      const warn = vi.fn();
      (channels as any).__setLogger({
        info: vi.fn(),
        warn,
        error: vi.fn(),
        debug: vi.fn(),
      });

      // Two runs in a row — the warn should fire on the first and stay quiet on the second.
      const chunks = [
        {
          type: 'tool-call',
          payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
        },
        {
          type: 'tool-result',
          payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' }, result: 'sunny' },
        },
        { type: 'finish', payload: {} },
      ];
      await drive(channels, chunks, sdkThread);
      await drive(channels, chunks, sdkThread);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("toolDisplay: 'timeline' requires streaming: true");

      // Fallback behavior should be `'cards'`: running card posted, edited on result.
      const posts = calls.filter(c => c.kind === 'post');
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(posts.length).toBeGreaterThan(0);
      expect(edits.length).toBeGreaterThan(0);
    });

    it("'timeline' with parallel tool calls: each gets its own task entry", async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true, toolDisplay: 'timeline' });
      await drive(
        channels,
        [
          { type: 'tool-call', payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } } },
          { type: 'tool-call', payload: { toolCallId: 't2', toolName: 'weather', args: { city: 'LA' } } },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'rainy' },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't2', toolName: 'weather', args: { city: 'LA' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      const drained = await drainStreamingPlan((posts[0] as Extract<Call, { kind: 'post' }>).arg);
      const taskUpdates = drained.filter(
        (p): p is { type: 'task_update'; id: string; status: string } =>
          typeof p === 'object' && (p as any).type === 'task_update',
      );
      expect(taskUpdates.map(t => `${t.id}:${t.status}`)).toEqual([
        't1:in_progress',
        't2:in_progress',
        't1:complete',
        't2:complete',
      ]);
    });

    it("deprecated cards: false maps to toolDisplay: 'text' and warns once", async () => {
      const warn = vi.fn();
      const logger = { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() };
      const { channels, calls, sdkThread } = makeChannels({ streaming: false, cards: false, logger });
      await drive(
        channels,
        [
          { type: 'tool-call', payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } } },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      // `'text'` mode posts plain-text running and result messages, not Block Kit cards.
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.every(p => typeof (p as any).arg === 'string')).toBe(true);
      // Deprecation warning logged with the suggested replacement.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toMatch(/cards.*deprecated.*toolDisplay: 'text'/);
    });

    it('explicit toolDisplay wins over deprecated cards', async () => {
      const warn = vi.fn();
      const logger = { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() };
      const { channels, calls, sdkThread } = makeChannels({
        streaming: false,
        cards: false,
        toolDisplay: 'cards',
        logger,
      });
      await drive(
        channels,
        [
          { type: 'tool-call', payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } } },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );

      // Explicit `toolDisplay: 'cards'` wins; deprecated `cards: false` is ignored
      // and the deprecation warning is suppressed (only fires when `toolDisplay` is absent).
      const posts = calls.filter(c => c.kind === 'post');
      const hasBlockKit = posts.some(p => typeof (p as any).arg === 'object' && (p as any).arg !== null);
      expect(hasBlockKit).toBe(true);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('adaptive typing status', () => {
    it('emits Thinking → Typing → Calling {tool} → Typing transitions', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'reasoning-delta', payload: { text: 'planning' } },
          { type: 'text-delta', payload: { text: 'ok ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Tokyo' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Tokyo' }, result: 'rainy' },
          },
          { type: 'text-delta', payload: { text: 'done' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is thinking…', 'is typing…', 'is calling weather…', 'is typing…']);
    });

    it('does not surface channel tools (e.g. add_reaction) in the typing indicator', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'ok ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 'r1', toolName: 'add_reaction', args: { emoji: 'thumbsup' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 'r1', toolName: 'add_reaction', args: { emoji: 'thumbsup' }, result: 'ok' },
          },
          { type: 'text-delta', payload: { text: 'done' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      // Should NEVER contain "is calling add_reaction…"
      expect(typingStatuses).toEqual(['is typing…']);
    });

    it('emits "is working…" on the start chunk before other activity', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'start', payload: {} },
          { type: 'text-delta', payload: { text: 'hi' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is working…', 'is typing…']);
    });

    it('dedups consecutive same-status calls', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'a' } },
          { type: 'text-delta', payload: { text: 'b' } },
          { type: 'text-delta', payload: { text: 'c' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is typing…']);
    });

    it('resets typing status between runs so the next run re-emits its first status', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'first' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
          // Next run on same subscription:
          { type: 'text-delta', payload: { text: 'second' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is typing…', 'is typing…']);
    });

    it('emits at most one typing status across a run with only empty text-deltas', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: '' } },
          { type: 'text-delta', payload: { text: '' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is typing…']);
    });

    it('typingStatus: false disables all typing indicators', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false, typingStatus: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'hi ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Tokyo' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Tokyo' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      expect(calls.filter(c => c.kind === 'startTyping')).toEqual([]);
    });

    it('typingStatus function receives chunks and can override status', async () => {
      const { channels, calls, sdkThread } = makeChannels({
        streaming: false,
        typingStatus: (chunk: any) => {
          if (chunk.type === 'text-delta') return 'cooking…';
          if (chunk.type === 'tool-call') return `running ${chunk.payload.toolName}`;
          return undefined;
        },
      });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'hi ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Tokyo' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Tokyo' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['cooking…', 'running weather']);
    });

    it('typingStatus function returning false/undefined leaves status unchanged', async () => {
      const { channels, calls, sdkThread } = makeChannels({
        streaming: false,
        typingStatus: (chunk: any) => (chunk.type === 'text-delta' ? 'first' : undefined),
      });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'a' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          { type: 'text-delta', payload: { text: 'b' } },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      // Only the text-delta returns a string; tool-call returns undefined so status holds.
      // Second text-delta returns 'first' again but it's de-duped.
      expect(typingStatuses).toEqual(['first']);
    });

    it('typingStatus function exceptions are swallowed and stream continues', async () => {
      const { channels, calls, sdkThread } = makeChannels({
        streaming: false,
        typingStatus: () => {
          throw new Error('boom');
        },
      });
      await expect(
        drive(
          channels,
          [
            { type: 'text-delta', payload: { text: 'hi' } },
            { type: 'finish', payload: {} },
          ],
          sdkThread,
        ),
      ).resolves.not.toThrow();
      expect(calls.filter(c => c.kind === 'startTyping')).toEqual([]);
    });
  });

  describe('tool lifecycle', () => {
    it('posts running card on tool-call and edits it with the result on tool-result', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const posts = calls.filter(c => c.kind === 'post');
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(1); // running card
      expect(edits).toHaveLength(1); // result edit on same messageId
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('m1');
    });

    it('edits the existing running card on tool-call-approval (no second post)', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-call-approval',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
        ],
        sdkThread,
      );
      expect(calls.filter(c => c.kind === 'post')).toHaveLength(1); // running card only
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits).toHaveLength(1);
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('m1');
    });

    it('uses the pendingApprovalCards entry when tool-result arrives without a matching tool-call (resumed run)', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      // Pre-seed a pending card as if the click handler posted the "Approved ⋯" card.
      (channels as any).pendingApprovalCards.set('t1', {
        displayName: 'weather',
        argsSummary: 'NYC',
        startedAt: Date.now() - 1000,
        messageId: 'pending-card-1',
      });
      await drive(
        channels,
        [
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits).toHaveLength(1);
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('pending-card-1');
      expect((channels as any).pendingApprovalCards.has('t1')).toBe(false); // consumed
    });

    it('seeds tool tracking from approvalContext so result edits the original card', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
        { toolCallId: 't1', messageId: 'seeded-card' },
      );
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits).toHaveLength(1);
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('seeded-card');
    });

    it('skips channel-emitted tool reactions (add_reaction / remove_reaction)', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'add_reaction', args: { emoji: '👍' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'add_reaction', args: {}, result: 'ok' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      expect(calls.filter(c => c.kind === 'post')).toEqual([]);
      expect(calls.filter(c => c.kind === 'editMessage')).toEqual([]);
    });

    it("honors toolDisplay function form returning { kind: 'post' } (custom result rendering)", async () => {
      const recording = createRecording();
      const channels = new AgentChannels({
        adapters: {
          test: {
            adapter: recording.adapter,
            toolDisplay: event => {
              if (event.kind !== 'result') return undefined;
              return { kind: 'post', message: `🛠 ${event.toolName}=${String(event.result)}` };
            },
          },
        },
      });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        recording.sdkThread,
      );
      // The fn skipped the `running` event (returned undefined), then
      // rendered `result` once — exactly one post.
      const posts = recording.calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual({ kind: 'post', arg: '🛠 weather=sunny' });
    });

    it("toolDisplay: 'text' renders plain-text per-tool messages (no Block Kit)", async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false, toolDisplay: 'text' });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      // Running post + result edit, both plain strings (no Block Kit object).
      const posts = calls.filter(c => c.kind === 'post');
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(1);
      expect(edits).toHaveLength(1);
      expect(typeof (posts[0] as Extract<Call, { kind: 'post' }>).arg).toBe('string');
      expect(typeof (edits[0] as Extract<Call, { kind: 'editMessage' }>).content).toBe('string');
    });

    it('toolDisplay fn returning undefined skips the event silently', async () => {
      const recording = createRecording();
      const channels = new AgentChannels({
        adapters: {
          test: {
            adapter: recording.adapter,
            // Always skip.
            toolDisplay: () => undefined,
          },
        },
      });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        recording.sdkThread,
      );
      const posts = recording.calls.filter(c => c.kind === 'post');
      const edits = recording.calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(0);
      expect(edits).toHaveLength(0);
    });

    it("streaming + toolDisplay: 'cards' uses close/post/reopen lifecycle", async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true, toolDisplay: 'cards' });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'before ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'text-delta', payload: { text: 'after' } },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      // Cards rendering still produces a running card post + a result edit
      // even with streaming enabled — the streaming session is closed around
      // the cards and reopened for surrounding text.
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits.length).toBeGreaterThanOrEqual(1);
    });

    it("streaming + toolDisplay fn returning { kind: 'post' } closes session, posts, reopens", async () => {
      const recording = createRecording();
      const channels = new AgentChannels({
        adapters: {
          test: {
            adapter: recording.adapter,
            streaming: true,
            toolDisplay: event => {
              if (event.kind !== 'result') return undefined;
              return { kind: 'post', message: `🛠 ${event.toolName}=${String(event.result)}` };
            },
          },
        },
      });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'before ' } },
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'text-delta', payload: { text: 'after' } },
          { type: 'finish', payload: {} },
        ],
        recording.sdkThread,
      );
      const stringPosts = recording.calls.filter(
        c => c.kind === 'post' && typeof (c as Extract<Call, { kind: 'post' }>).arg === 'string',
      );
      expect(stringPosts).toHaveLength(1);
      expect((stringPosts[0] as Extract<Call, { kind: 'post' }>).arg).toBe('🛠 weather=sunny');
    });
  });

  describe('run boundary reset', () => {
    it('flushes pending text and discards tool tracking on finish', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'pending' } },
          { type: 'finish', payload: {} }, // no step-finish; finish must flush
          { type: 'text-delta', payload: { text: 'next run' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      expect(calls.filter(c => c.kind === 'post').map(c => (c as any).arg)).toEqual(['pending', 'next run']);
    });

    it('posts a friendly error message on error chunks and resets state', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'partial' } },
          { type: 'error', payload: { error: new Error('boom') } },
          { type: 'text-delta', payload: { text: 'recovery' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['partial', '❌ Error: boom', 'recovery']);
    });

    it('does not post anything on abort but still flushes pending text', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'partial' } },
          { type: 'abort', payload: {} },
        ],
        sdkThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['partial']);
    });
  });

  describe('tripwire', () => {
    it('posts the tripwire reason when retry=false', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'tripwire', payload: { reason: 'blocked by guard', processorId: 'safety' } },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect((posts[0] as Extract<Call, { kind: 'post' }>).arg).toBe('🛡️ Blocked by safety: blocked by guard');
    });

    it('skips tripwire posts when retry=true (agent will retry internally)', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'tripwire', payload: { reason: 'too long', retry: true } },
          { type: 'text-delta', payload: { text: 'shorter take' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['shorter take']);
    });
  });

  describe('signal echo', () => {
    it('drops data-* chunks (echoed user-message / system-reminder signals)', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'data-user-message', payload: { contents: 'hello' } },
          { type: 'data-system-reminder', payload: { contents: 'noop' } },
          { type: 'text-delta', payload: { text: 'reply' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['reply']);
    });
  });

  describe('file chunks', () => {
    it('posts file attachments and decodes base64 payloads', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      const payloadStr = Buffer.from('hello-bytes').toString('base64');
      await drive(
        channels,
        [
          { type: 'file', payload: { data: payloadStr, mimeType: 'image/png' } },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      const arg = (posts[0] as Extract<Call, { kind: 'post' }>).arg as any;
      expect(arg.files).toHaveLength(1);
      expect(arg.files[0].mimeType).toBe('image/png');
      expect(arg.files[0].filename).toBe('generated.png');
      expect((arg.files[0].data as Buffer).toString()).toBe('hello-bytes');
    });

    it('flushes pending text before posting a file', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'here you go' } },
          { type: 'file', payload: { data: Buffer.from('x').toString('base64'), mimeType: 'image/png' } },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(typeof postArgs[0]).toBe('string');
      expect(postArgs[0]).toBe('here you go');
      expect(typeof postArgs[1]).toBe('object');
    });
  });
});
