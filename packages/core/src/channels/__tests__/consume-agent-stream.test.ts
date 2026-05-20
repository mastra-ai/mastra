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

function makeChannels(opts: { streaming?: boolean | { updateIntervalMs?: number } } = {}) {
  const recording = createRecording();
  const channels = new AgentChannels({
    adapters: { test: { adapter: recording.adapter, streaming: opts.streaming ?? false } },
  });
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
async function drainStreamingPlan(plan: any): Promise<string[]> {
  const pieces: string[] = [];
  for await (const piece of plan.stream as AsyncIterable<string>) {
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

    it('closes the streaming session before posting an out-of-band tool card', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: true });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: 'thinking' } },
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
      // Ordering: stream post lands before tool card; nothing posts AFTER tool card
      // since the post for the running card returned a messageId and the result
      // edits that same card.
      const kinds = calls.map(c => c.kind);
      const firstPostIdx = kinds.indexOf('post');
      const secondPostIdx = kinds.indexOf('post', firstPostIdx + 1);
      const editIdx = kinds.indexOf('editMessage');
      expect(firstPostIdx).toBeGreaterThanOrEqual(0); // streaming plan
      expect(secondPostIdx).toBeGreaterThan(firstPostIdx); // running card
      expect(editIdx).toBeGreaterThan(secondPostIdx); // result edit
    });
  });

  describe('adaptive typing status', () => {
    it('emits Thinking → Typing → Using {tool} → Thinking transitions', async () => {
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
      expect(typingStatuses).toEqual(['Thinking…', 'Typing…', 'Using weather…', 'Thinking…', 'Typing…']);
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
      expect(typingStatuses).toEqual(['Typing…']);
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
      expect(typingStatuses).toEqual(['Typing…', 'Typing…']);
    });

    it('skips empty text-deltas (no Typing… status emitted)', async () => {
      const { channels, calls, sdkThread } = makeChannels({ streaming: false });
      await drive(
        channels,
        [
          { type: 'text-delta', payload: { text: '' } },
          { type: 'step-finish', payload: {} },
          { type: 'finish', payload: {} },
        ],
        sdkThread,
      );
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

    it('honors formatToolCall override (custom result rendering)', async () => {
      const recording = createRecording();
      const channels = new AgentChannels({
        adapters: {
          test: {
            adapter: recording.adapter,
            formatToolCall: ({ toolName, result }) => `🛠 ${toolName}=${String(result)}`,
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
      // With formatToolCall set: no running card is posted, only the result is rendered.
      const posts = recording.calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual({ kind: 'post', arg: '🛠 weather=sunny' });
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
