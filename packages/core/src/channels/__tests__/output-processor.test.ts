import { describe, it, expect, vi, beforeAll } from 'vitest';

import { InMemoryStore } from '../../storage/mock';
import { AgentChannels } from '../agent-channels';
import { getChatModule } from '../chat-lazy';
import { ChatChannelOutputProcessor, CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
//
// The channels rendering pipeline routes agent stream chunks to the chat
// platform via `ChatChannelOutputProcessor`. These tests drive the processor
// directly with canned chunks and assert against a flat recording of every
// platform call (`chatThread.post()`, `startTyping()`, `adapter.editMessage()`).

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

  const chatThread: any = {
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

  return { calls, adapter, chatThread };
}

function makeChannels(
  opts: {
    streaming?: boolean | { updateIntervalMs?: number };
    toolDisplay?: 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden' | ((event: any, ctx: any) => any);
    typingStatus?: boolean | ((chunk: any, ctx: any) => any);
    cards?: boolean;
    formatToolCall?: (info: {
      toolName: string;
      args: Record<string, unknown>;
      result: unknown;
      isError?: boolean;
    }) => string | Record<string, unknown> | null;
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
  if (opts.formatToolCall !== undefined) adapterConfig.formatToolCall = opts.formatToolCall;
  const channels = new AgentChannels({
    adapters: { test: adapterConfig as any },
  });
  if (opts.logger) (channels as any).__setLogger(opts.logger);
  return { channels, ...recording };
}

async function drive(
  channels: AgentChannels,
  chunks: any[],
  chatThread: any,
  approvalContext?: { toolCallId: string; messageId: string },
) {
  const render = (channels as any)._buildRenderContext(chatThread, 'test', approvalContext);
  const processor = new ChatChannelOutputProcessor();
  const requestContext = new Map<string, unknown>();
  requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, render);
  const state: Record<string, unknown> = {};

  // The output processor needs a terminal chunk (step-finish with
  // isContinued !== true, or error) to close the queue and flush.
  // Auto-append one if the test chunks don't already end with a terminal.
  const last = chunks[chunks.length - 1];
  const hasTerminal =
    last && ((last.type === 'step-finish' && last.payload?.stepResult?.isContinued !== true) || last.type === 'error');
  const effective = hasTerminal
    ? chunks
    : [...chunks, { type: 'step-finish', payload: { stepResult: { isContinued: false } } }];

  for (const chunk of effective) {
    await processor.processOutputStream({
      part: chunk,
      state,
      requestContext: { get: (key: string) => requestContext.get(key) } as any,
    } as any);
  }
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

describe('ChatChannelOutputProcessor', () => {
  beforeAll(async () => {
    // Card/CardText etc. are looked up via chatModule() at call time, so we
    // need to prime the lazy import before the consumer runs.
    await getChatModule();
  });

  describe('buffered text (streaming disabled)', () => {
    it('accumulates text-deltas and posts once on step-finish', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'Hello' } },
          { type: 'text-delta', payload: { text: ', ' } },
          { type: 'text-delta', payload: { text: 'world!' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toEqual([{ kind: 'post', arg: 'Hello, world!' }]);
    });

    it('strips zero-width characters before posting', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: '\u200BHi\u200C\uFEFF' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      expect(calls.filter(c => c.kind === 'post')).toEqual([{ kind: 'post', arg: 'Hi' }]);
    });

    it('skips empty/whitespace-only buffers', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: '   ' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      expect(calls.filter(c => c.kind === 'post')).toEqual([]);
    });
  });

  describe('streaming session (streaming enabled)', () => {
    it('opens a StreamingPlan on first text-delta and feeds it pieces until step-finish', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: true });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'Hel' } },
          { type: 'text-delta', payload: { text: 'lo!' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      const plan = (posts[0] as Extract<Call, { kind: 'post' }>).arg as any;
      expect(plan).toBeInstanceOf((await getChatModule()).StreamingPlan);
      expect(await drainStreamingPlan(plan)).toEqual(['Hel', 'lo!']);
    });

    it('forwards updateIntervalMs onto the StreamingPlan options', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: { updateIntervalMs: 250 } });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'x' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const plan = (calls.find(c => c.kind === 'post') as Extract<Call, { kind: 'post' }>).arg as any;
      expect(plan.options.updateIntervalMs).toBe(250);
    });

    it('opens a fresh session for each step (closes on step-finish)', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: true });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'first' } },
          { type: 'step-finish', payload: { stepResult: { isContinued: true } } },
          { type: 'text-delta', payload: { text: 'second' } },
          { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
          { type: 'finish', payload: {} },
        ],
        chatThread,
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
      const { channels, calls, chatThread } = makeChannels({ streaming: true });
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
        chatThread,
      );
      // Tool renders as discrete cards (post + edit), not as task_updates.
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('toolDisplay modes', () => {
    it("'timeline': emits task_update chunks into the streaming session (one task per tool)", async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'timeline' });
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
        chatThread,
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
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'grouped' });
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
        chatThread,
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
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'grouped' });
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
        chatThread,
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

    it('coalesces consecutive observation activations into one aggregated row', async () => {
      // Activation chunks fire one-per-cycle, but reflection runs typically
      // emit a burst of them in a row. Instead of stacking N "Recalled
      // memory" rows, the driver rolls them into a single `om-activation`
      // task that updates in place with the running totals.
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'grouped' });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'hello' } },
          {
            type: 'data-om-activation',
            data: {
              cycleId: 'a1',
              operationType: 'observation',
              tokensActivated: 1000,
              observationTokens: 100,
            },
          },
          {
            type: 'data-om-activation',
            data: {
              cycleId: 'a2',
              operationType: 'observation',
              tokensActivated: 2000,
              observationTokens: 200,
            },
          },
          {
            type: 'data-om-activation',
            data: {
              cycleId: 'a3',
              operationType: 'observation',
              tokensActivated: 3000,
              observationTokens: 300,
            },
          },
          { type: 'finish', payload: {} },
        ] as any,
        chatThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      const drained = await drainStreamingPlan((posts[0] as Extract<Call, { kind: 'post' }>).arg as any);
      const taskUpdates = drained.filter(
        (p): p is { type: 'task_update'; id: string; status: string; title: string; details?: string } =>
          typeof p === 'object' && (p as any).type === 'task_update',
      );
      const activations = taskUpdates.filter(t => t.id === 'om-activation');
      // All three activation chunks should target the same stable id with
      // running totals — the SDK plan widget updates the row in place.
      expect(activations).toHaveLength(3);
      expect(activations[0]).toMatchObject({
        title: 'Recalled memory',
        details: '-1k message tokens, +0.1k memory tokens',
      });
      expect(activations[1]).toMatchObject({
        title: 'Recalled memory (2x)',
        details: '-3k message tokens, +0.3k memory tokens',
      });
      expect(activations[2]).toMatchObject({
        title: 'Recalled memory (3x)',
        details: '-6k message tokens, +0.6k memory tokens',
      });

      // A meaningful plan title should be set on first OM event so memory-only
      // runs don't show the chat-SDK default ("Thinking completed").
      const planUpdates = drained.filter(
        (p): p is { type: 'plan_update'; title: string } => typeof p === 'object' && (p as any).type === 'plan_update',
      );
      expect(planUpdates.some(p => p.title === 'Updating memory')).toBe(true);
    });

    it('resets the recall aggregator when a non-observation chunk interrupts the sequence', async () => {
      // Two separate activation bursts separated by a text-delta should not
      // be merged into one row — the aggregator must reset on any non-
      // observation-activation chunk.
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'grouped' });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'a' } },
          {
            type: 'data-om-activation',
            data: { cycleId: 'a1', operationType: 'observation', tokensActivated: 1000, observationTokens: 100 },
          },
          {
            type: 'data-om-activation',
            data: { cycleId: 'a2', operationType: 'observation', tokensActivated: 2000, observationTokens: 200 },
          },
          // Interruption — recall sequence must reset here.
          { type: 'text-delta', payload: { text: 'b' } },
          {
            type: 'data-om-activation',
            data: { cycleId: 'a3', operationType: 'observation', tokensActivated: 500, observationTokens: 50 },
          },
          { type: 'finish', payload: {} },
        ] as any,
        chatThread,
      );

      const posts = calls.filter(c => c.kind === 'post');
      const drained = await drainStreamingPlan((posts[0] as Extract<Call, { kind: 'post' }>).arg as any);
      const activations = drained.filter(
        (p): p is { type: 'task_update'; id: string; title: string; details?: string } =>
          typeof p === 'object' && (p as any).type === 'task_update' && (p as any).id === 'om-activation',
      );
      // 3 pushes: 2 from first burst (1x, 2x), 1 from post-interrupt burst.
      expect(activations).toHaveLength(3);
      expect(activations[0]).toMatchObject({ title: 'Recalled memory' });
      expect(activations[1]).toMatchObject({ title: 'Recalled memory (2x)' });
      // After the text-delta interrupt, recall starts from 1x again with only
      // the new totals — not 3x with merged totals from the prior burst.
      expect(activations[2]).toMatchObject({
        title: 'Recalled memory',
        details: '-0.5k message tokens, +0.1k memory tokens',
      });
    });

    it("'cards' mode skips OM events entirely (no plan widget for memory-only work)", async () => {
      // OM events render into the Plan widget, which only makes sense in
      // 'timeline'/'grouped' where tool calls already live there. In non-plan
      // modes the OM rows would either flash a phantom plan widget or land
      // alongside the cards — both inconsistent with the mode contract.
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'cards' });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'hello' } },
          {
            type: 'data-om-buffering-start',
            data: { cycleId: 'cyc-1', operationType: 'observation' },
          },
          {
            type: 'data-om-buffering-end',
            data: { cycleId: 'cyc-1', operationType: 'observation', tokensBuffered: 1000, outputTokens: 500 },
          },
          {
            type: 'data-om-activation',
            data: { cycleId: 'a1', operationType: 'observation', tokensActivated: 1000, observationTokens: 100 },
          },
          { type: 'finish', payload: {} },
        ] as any,
        chatThread,
      );

      const StreamingPlan = (await getChatModule()).StreamingPlan;
      const posts = calls.filter(c => c.kind === 'post');
      const planPosts = posts.filter(p => (p as Extract<Call, { kind: 'post' }>).arg instanceof StreamingPlan);
      // Text streaming still produces a session; OM produces nothing extra.
      const allDrained = (
        await Promise.all(planPosts.map(p => drainStreamingPlan((p as Extract<Call, { kind: 'post' }>).arg)))
      ).flat();
      const taskUpdates = allDrained.filter(p => typeof p === 'object' && (p as any).type === 'task_update');
      const planUpdates = allDrained.filter(p => typeof p === 'object' && (p as any).type === 'plan_update');
      expect(taskUpdates).toHaveLength(0);
      // No OM-driven "Updating memory" plan title either.
      expect(planUpdates.find((p: any) => p.title === 'Updating memory')).toBeUndefined();
    });

    it("streaming + 'cards': approval edits the running tool card in place (no second post)", async () => {
      // Regression: previously the approval handler ignored toolMessageIds
      // and always posted a fresh approval message, leaving the original
      // running card stranded above it. The fix prefers editing the stashed
      // running-card messageId so the approval buttons replace the running
      // card in place — and the eventual tool-result edits the same message.
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'cards' });
      await drive(
        channels,
        [
          {
            type: 'tool-call',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
          },
          {
            type: 'tool-call-approval',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
          },
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ] as any,
        chatThread,
      );

      const StreamingPlan = (await getChatModule()).StreamingPlan;
      const posts = calls.filter(c => c.kind === 'post');
      const cardPosts = posts.filter(p => !((p as Extract<Call, { kind: 'post' }>).arg instanceof StreamingPlan));
      // Only ONE platform post — the original running card.
      expect(cardPosts).toHaveLength(1);
      // Both the approval and the tool-result should edit that same message.
      const edits = calls.filter(c => c.kind === 'editMessage') as Extract<Call, { kind: 'editMessage' }>[];
      expect(edits).toHaveLength(2);
      expect(edits[0]!.messageId).toBe('m1');
      expect(edits[1]!.messageId).toBe('m1');
    });

    it("'cards' approval does not push plan/task rows (no flash plan widget)", async () => {
      // The built-in approval handler used to push plan_update + task_update
      // unconditionally before posting the Block Kit card, which produced a
      // one-row Plan widget that closed immediately after — visual noise in
      // modes where tool calls live out-of-band.
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'cards' });
      await drive(
        channels,
        [
          {
            type: 'tool-call-approval',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
          },
          { type: 'finish', payload: {} },
        ] as any,
        chatThread,
      );

      // The approval card should be posted out-of-band, but no Plan widget
      // (StreamingPlan post) should appear for the approval itself.
      const StreamingPlan = (await getChatModule()).StreamingPlan;
      const posts = calls.filter(c => c.kind === 'post');
      const planPosts = posts.filter(p => (p as Extract<Call, { kind: 'post' }>).arg instanceof StreamingPlan);
      expect(planPosts).toHaveLength(0);
      // The approval card itself is posted as a non-StreamingPlan message.
      expect(posts.length).toBeGreaterThan(0);
    });

    it("'grouped' approval still pushes plan/task rows (no regression)", async () => {
      // Plan-rendering modes should keep parking the approval row in the
      // plan before closing the session and posting the card — otherwise the
      // SDK plan would close mid-tool with the row still "in progress" and
      // flip to ⚠.
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'grouped' });
      await drive(
        channels,
        [
          {
            type: 'tool-call-approval',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'Vancouver' } },
          },
          { type: 'finish', payload: {} },
        ] as any,
        chatThread,
      );

      const StreamingPlan = (await getChatModule()).StreamingPlan;
      const posts = calls.filter(c => c.kind === 'post');
      const planPosts = posts.filter(p => (p as Extract<Call, { kind: 'post' }>).arg instanceof StreamingPlan);
      expect(planPosts).toHaveLength(1);
      const drained = await drainStreamingPlan((planPosts[0] as Extract<Call, { kind: 'post' }>).arg);
      const taskUpdates = drained.filter(
        (p): p is { type: 'task_update'; id: string; status: string; details?: string } =>
          typeof p === 'object' && (p as any).type === 'task_update',
      );
      const planUpdates = drained.filter(
        (p): p is { type: 'plan_update'; title: string } => typeof p === 'object' && (p as any).type === 'plan_update',
      );
      // One task_update parking the row, one plan_update titled for the
      // approval request.
      expect(taskUpdates).toHaveLength(1);
      expect(taskUpdates[0]).toMatchObject({ id: 't1', status: 'complete', details: 'Requesting user approval…' });
      expect(planUpdates.some(p => p.title.startsWith('Requesting approval:'))).toBe(true);
    });

    it("'hidden': drops tool-call/result chunks entirely (no card, no task_update)", async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'hidden' });
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
        chatThread,
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
      const { channels, calls, chatThread } = makeChannels({ streaming: false, toolDisplay: 'timeline' });
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
      await drive(channels, chunks, chatThread);
      await drive(channels, chunks, chatThread);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("toolDisplay: 'timeline' requires streaming: true");

      // Fallback behavior should be `'cards'`: running card posted, edited on result.
      const posts = calls.filter(c => c.kind === 'post');
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(posts.length).toBeGreaterThan(0);
      expect(edits.length).toBeGreaterThan(0);
    });

    it("'timeline' with parallel tool calls: each gets its own task entry", async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'timeline' });
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
        chatThread,
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

    it("deprecated cards: false maps to toolDisplay: 'text'", async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false, cards: false });
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
        chatThread,
      );

      // `'text'` mode posts plain-text running and result messages, not Block Kit cards.
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.every(p => typeof (p as any).arg === 'string')).toBe(true);
    });

    it('deprecated cards is ignored when toolDisplay is a function (type-bypass case)', async () => {
      // The discriminated union makes this a TS error, but runtime callers
      // (casts, JS, dynamic configs) should still get a function-form
      // resolution untouched by `cards` so the fn drives every event.
      const seen: string[] = [];
      const { channels, calls, chatThread } = makeChannels({
        streaming: false,
        cards: false,
        toolDisplay: event => {
          seen.push(event.kind);
          if (event.kind === 'result') return { kind: 'post', message: `fn:${event.toolName}=${String(event.result)}` };
          return undefined;
        },
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
        chatThread,
      );

      // The fn drives the render path: result event fires and the fn's
      // custom message is posted. (Static driver intentionally skips the
      // 'running' event when a fn is set — most fns prefer a single render
      // on result.) Crucially, `cards: false` did not divert to the
      // built-in `'text'` renderer.
      expect(seen).toContain('result');
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts.some(p => (p as any).arg === 'fn:weather=sunny')).toBe(true);
      // No built-in 'text'-mode "Running…" / "Result" plain-text fallback
      // posts (those would show up alongside the fn's custom message).
      expect(posts).toHaveLength(1);
    });

    it('deprecated formatToolCall shims into toolDisplay fn for result events', async () => {
      const { channels, calls, chatThread } = makeChannels({
        streaming: false,
        formatToolCall: ({ toolName, result }) => `🛠 ${toolName}=${String(result)}`,
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
        chatThread,
      );

      // The shim only fires on result/error, so the eager "Running…" card from
      // the built-in renderer is suppressed and we just see the custom result text.
      const posts = calls.filter(c => c.kind === 'post');
      const texts = posts.map(p => (p as any).arg).filter((a): a is string => typeof a === 'string');
      expect(texts).toContain('🛠 weather=sunny');
    });
  });

  describe('adaptive typing status', () => {
    it('emits Thinking → Typing → Calling {tool} → Typing transitions', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
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
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is thinking…', 'is typing…', 'is calling weather…', 'is typing…']);
    });

    it('does not surface channel tools (e.g. add_reaction) in the typing indicator', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
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
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      // Should NEVER contain "is calling add_reaction…"
      expect(typingStatuses).toEqual(['is typing…']);
    });

    it('emits "is working…" on the start chunk before other activity', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'start', payload: {} },
          { type: 'text-delta', payload: { text: 'hi' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is working…', 'is typing…']);
    });

    it('dedups consecutive same-status calls', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'a' } },
          { type: 'text-delta', payload: { text: 'b' } },
          { type: 'text-delta', payload: { text: 'c' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is typing…']);
    });

    it('resets typing status between runs so the next run re-emits its first status', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      // First run:
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'first' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      // Second run (separate output-processor invocation, like a real second message):
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'second' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is typing…', 'is typing…']);
    });

    it('emits at most one typing status across a run with only empty text-deltas', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: '' } },
          { type: 'text-delta', payload: { text: '' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['is typing…']);
    });

    it('typingStatus: false disables all typing indicators', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false, typingStatus: false });
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
        chatThread,
      );
      expect(calls.filter(c => c.kind === 'startTyping')).toEqual([]);
    });

    it('typingStatus function receives chunks and can override status', async () => {
      const { channels, calls, chatThread } = makeChannels({
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
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      expect(typingStatuses).toEqual(['cooking…', 'running weather']);
    });

    it('typingStatus function returning false/undefined leaves status unchanged', async () => {
      const { channels, calls, chatThread } = makeChannels({
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
        chatThread,
      );
      const typingStatuses = calls.filter(c => c.kind === 'startTyping').map(c => (c as any).status);
      // Only the text-delta returns a string; tool-call returns undefined so status holds.
      // Second text-delta returns 'first' again but it's de-duped.
      expect(typingStatuses).toEqual(['first']);
    });

    it('typingStatus function exceptions are swallowed and stream continues', async () => {
      const { channels, calls, chatThread } = makeChannels({
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
          chatThread,
        ),
      ).resolves.not.toThrow();
      expect(calls.filter(c => c.kind === 'startTyping')).toEqual([]);
    });
  });

  describe('tool lifecycle', () => {
    it('posts running card on tool-call and edits it with the result on tool-result', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
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
        chatThread,
      );
      const posts = calls.filter(c => c.kind === 'post');
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(1); // running card
      expect(edits).toHaveLength(1); // result edit on same messageId
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('m1');
    });

    it('edits the existing running card on tool-call-approval (no second post)', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
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
        chatThread,
      );
      expect(calls.filter(c => c.kind === 'post')).toHaveLength(1); // running card only
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits).toHaveLength(1);
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('m1');
    });

    it('uses the pendingApprovalCards entry when tool-result arrives without a matching tool-call (resumed run)', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
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
        chatThread,
      );
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits).toHaveLength(1);
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('pending-card-1');
      expect((channels as any).pendingApprovalCards.has('t1')).toBe(false); // consumed
    });

    it('seeds tool tracking from approvalContext so result edits the original card', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          {
            type: 'tool-result',
            payload: { toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'sunny' },
          },
          { type: 'finish', payload: {} },
        ],
        chatThread,
        { toolCallId: 't1', messageId: 'seeded-card' },
      );
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits).toHaveLength(1);
      expect((edits[0] as Extract<Call, { kind: 'editMessage' }>).messageId).toBe('seeded-card');
    });

    it('skips channel-emitted tool reactions (add_reaction / remove_reaction)', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
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
        chatThread,
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
        recording.chatThread,
      );
      // The fn skipped the `running` event (returned undefined), then
      // rendered `result` once — exactly one post.
      const posts = recording.calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual({ kind: 'post', arg: '🛠 weather=sunny' });
    });

    it("toolDisplay: 'text' renders plain-text per-tool messages (no Block Kit)", async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false, toolDisplay: 'text' });
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
        chatThread,
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
        recording.chatThread,
      );
      const posts = recording.calls.filter(c => c.kind === 'post');
      const edits = recording.calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(0);
      expect(edits).toHaveLength(0);
    });

    it("static + toolDisplay fn returning { kind: 'stream' } flattens a renderable chunk to text", async () => {
      const recording = createRecording();
      const channels = new AgentChannels({
        adapters: {
          test: {
            adapter: recording.adapter,
            streaming: false,
            toolDisplay: event => {
              if (event.kind !== 'result') return undefined;
              return {
                kind: 'stream',
                chunk: {
                  type: 'task_update',
                  id: `tool-${event.toolName}`,
                  title: `Ran ${event.toolName}`,
                  status: 'complete',
                  details: String(event.result),
                },
              };
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
        recording.chatThread,
      );
      const posts = recording.calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual({ kind: 'post', arg: 'Ran weather · complete\nsunny' });
    });

    it("static + toolDisplay fn returning { kind: 'stream' } with unrenderable chunk skips silently", async () => {
      const recording = createRecording();
      const channels = new AgentChannels({
        adapters: {
          test: {
            adapter: recording.adapter,
            streaming: false,
            toolDisplay: event => {
              if (event.kind !== 'result') return undefined;
              // task_update with no title/details has no fallback text → skip.
              return {
                kind: 'stream',
                // Cast: intentionally minimal chunk to exercise the
                // `chunkToFallbackMessage` null path in static mode.
                chunk: { type: 'task_update', id: 'x' } as any,
              };
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
        recording.chatThread,
      );
      const posts = recording.calls.filter(c => c.kind === 'post');
      const edits = recording.calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(0);
      expect(edits).toHaveLength(0);
    });

    it("streaming + toolDisplay: 'cards' uses close/post/reopen lifecycle", async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: true, toolDisplay: 'cards' });
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
        chatThread,
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
        recording.chatThread,
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
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'pending' } },
          { type: 'finish', payload: {} }, // no step-finish; finish must flush
          { type: 'text-delta', payload: { text: 'next run' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      expect(calls.filter(c => c.kind === 'post').map(c => (c as any).arg)).toEqual(['pending', 'next run']);
    });

    it('posts a friendly error message on error chunks and resets state', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      // First run errors:
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'partial' } },
          { type: 'error', payload: { error: new Error('boom') } },
        ],
        chatThread,
      );
      // Recovery run (separate output-processor invocation):
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'recovery' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['partial', '❌ Error: boom', 'recovery']);
    });

    it('does not post anything on abort but still flushes pending text', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'partial' } },
          { type: 'abort', payload: {} },
        ],
        chatThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['partial']);
    });
  });

  describe('tripwire', () => {
    it('posts the tripwire reason when retry=false', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'tripwire', payload: { reason: 'blocked by guard', processorId: 'safety' } },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect((posts[0] as Extract<Call, { kind: 'post' }>).arg).toBe('🛡️ Blocked by safety: blocked by guard');
    });

    it('skips tripwire posts when retry=true (agent will retry internally)', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'tripwire', payload: { reason: 'too long', retry: true } },
          { type: 'text-delta', payload: { text: 'shorter take' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['shorter take']);
    });
  });

  describe('signal echo', () => {
    it('drops data-* chunks (echoed user-message / signal / system-reminder signals)', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'data-user-message', payload: { contents: 'hello' } },
          { type: 'data-signal', payload: { type: 'reactive', tagName: 'system-reminder', contents: 'noop' } },
          { type: 'text-delta', payload: { text: 'reply' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(postArgs).toEqual(['reply']);
    });
  });

  describe('file chunks', () => {
    it('posts file attachments and decodes base64 payloads', async () => {
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      const payloadStr = Buffer.from('hello-bytes').toString('base64');
      await drive(
        channels,
        [
          { type: 'file', payload: { data: payloadStr, mimeType: 'image/png' } },
          { type: 'finish', payload: {} },
        ],
        chatThread,
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
      const { channels, calls, chatThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'here you go' } },
          { type: 'file', payload: { data: Buffer.from('x').toString('base64'), mimeType: 'image/png' } },
          { type: 'finish', payload: {} },
        ],
        chatThread,
      );
      const postArgs = calls.filter(c => c.kind === 'post').map(c => (c as any).arg);
      expect(typeof postArgs[0]).toBe('string');
      expect(postArgs[0]).toBe('here you go');
      expect(typeof postArgs[1]).toBe('object');
    });
  });
});

// ---------------------------------------------------------------------------
// Fallback render-context resolution (no inbound requestContext)
// ---------------------------------------------------------------------------
//
// Runs that did NOT originate from a platform webhook (heartbeats, Studio,
// custom UI, user code) have no `CHAT_CHANNEL_RENDER_CONTEXT_KEY` on
// `requestContext`. When the processor is bound to its owning `AgentChannels`
// and the run's thread carries channel coordinates, it must reconstruct the
// render context from the thread and still broadcast.

const FALLBACK_THREAD_ID = 'mastra-thread-1';
const FALLBACK_EXTERNAL_ID = 'test:c1:t1';

async function makeFallbackChannels(
  threadMetadata?: Record<string, unknown> | null,
): Promise<ReturnType<typeof createRecording> & { channels: AgentChannels }> {
  const recording = createRecording();

  const channels = new AgentChannels({
    adapters: { test: { adapter: recording.adapter, streaming: false } as any },
  });

  const storage = new InMemoryStore();
  if (threadMetadata !== null) {
    const memory = await storage.getStore('memory');
    await memory!.saveThread({
      thread: {
        id: FALLBACK_THREAD_ID,
        resourceId: 'resource-1',
        title: 'channel thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: threadMetadata ?? {
          channel_platform: 'test',
          channel_externalThreadId: FALLBACK_EXTERNAL_ID,
        },
      },
    });
  }

  // Bind a minimal agent that exposes the Mastra storage, and a Chat stub that
  // materializes the live Thread handle from the stored external id.
  (channels as any).agent = { getMastraInstance: () => ({ getStorage: () => storage }) };
  (channels as any).chat = {
    thread: (id: string) => {
      expect(id).toBe(FALLBACK_EXTERNAL_ID);
      return recording.chatThread;
    },
  };

  return { channels, ...recording };
}

async function driveFallback(
  channels: AgentChannels,
  chunks: any[],
  opts: { threadId?: string; requestContext?: Map<string, unknown> } = {},
) {
  const processor = new ChatChannelOutputProcessor(channels);
  const requestContext = opts.requestContext ?? new Map<string, unknown>();
  // The framework stashes the run's thread on `requestContext` under the
  // `MastraMemory` key; the processor reads its `threadId` from there.
  if (opts.threadId !== undefined && !requestContext.has('MastraMemory')) {
    requestContext.set('MastraMemory', { thread: { id: opts.threadId } });
  }
  const state: Record<string, unknown> = {};

  const effective = [...chunks, { type: 'step-finish', payload: { stepResult: { isContinued: false } } }];

  for (const chunk of effective) {
    await processor.processOutputStream({
      part: chunk,
      state,
      requestContext: { get: (key: string) => requestContext.get(key) } as any,
    } as any);
  }
}

describe('ChatChannelOutputProcessor fallback render context', () => {
  beforeAll(async () => {
    await getChatModule();
  });

  it('broadcasts on a channel-backed thread with no requestContext key', async () => {
    const { channels, calls } = await makeFallbackChannels();
    await driveFallback(channels, [{ type: 'text-delta', payload: { text: 'heartbeat says hi' } }], {
      threadId: FALLBACK_THREAD_ID,
    });

    const posts = calls.filter(c => c.kind === 'post');
    expect(posts).toEqual([{ kind: 'post', arg: 'heartbeat says hi' }]);
  });

  it('passes through when the thread has no channel metadata', async () => {
    const { channels, calls } = await makeFallbackChannels({ some: 'other-metadata' });
    await driveFallback(channels, [{ type: 'text-delta', payload: { text: 'no channel here' } }], {
      threadId: FALLBACK_THREAD_ID,
    });

    expect(calls.filter(c => c.kind === 'post')).toHaveLength(0);
  });

  it('passes through when channel metadata is present but not a string', async () => {
    // `thread.metadata` is persisted `unknown`; a truthy non-string value must
    // not slip past the guard into `chat.thread(...)`.
    const { channels, calls } = await makeFallbackChannels({
      channel_platform: 123,
      channel_externalThreadId: { nested: true },
    });
    await driveFallback(channels, [{ type: 'text-delta', payload: { text: 'bad metadata' } }], {
      threadId: FALLBACK_THREAD_ID,
    });

    expect(calls.filter(c => c.kind === 'post')).toHaveLength(0);
  });

  it('passes through when the thread does not exist in storage', async () => {
    const { channels, calls } = await makeFallbackChannels(null);
    await driveFallback(channels, [{ type: 'text-delta', payload: { text: 'orphan run' } }], {
      threadId: 'unknown-thread',
    });

    expect(calls.filter(c => c.kind === 'post')).toHaveLength(0);
  });

  it('passes through when no threadId is provided', async () => {
    const { channels, calls } = await makeFallbackChannels();
    await driveFallback(channels, [{ type: 'text-delta', payload: { text: 'threadless' } }], {});

    expect(calls.filter(c => c.kind === 'post')).toHaveLength(0);
  });

  it('prefers the inbound requestContext render context over the fallback', async () => {
    const { channels, calls, chatThread } = await makeFallbackChannels();

    // Inbound fast path: a render context is already on requestContext. The
    // fallback must not run (and would post to the same chatThread anyway, so
    // assert it posts exactly once via the fast path).
    const render = (channels as any)._buildRenderContext(chatThread, 'test');
    const requestContext = new Map<string, unknown>();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, render);

    // Break the fallback so a single post proves the fast path was taken.
    (channels as any).chat = {
      thread: () => {
        throw new Error('fallback should not run when requestContext render exists');
      },
    };

    await driveFallback(channels, [{ type: 'text-delta', payload: { text: 'inbound message' } }], {
      threadId: FALLBACK_THREAD_ID,
      requestContext,
    });

    const posts = calls.filter(c => c.kind === 'post');
    expect(posts).toEqual([{ kind: 'post', arg: 'inbound message' }]);
  });
});
