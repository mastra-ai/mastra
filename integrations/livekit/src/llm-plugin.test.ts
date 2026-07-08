import { ReadableStream } from 'node:stream/web';
import { initializeLogger, llm } from '@livekit/agents';
import type { metrics as lkMetrics } from '@livekit/agents';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { VoiceReplyGenerator, VoiceTurnContext, VoiceTurnUsage } from './bridge';
import { MastraLLM } from './llm-plugin';

// The base LLMStream initializes a pino logger on construction.
beforeAll(() => {
  initializeLogger({ level: 'silent', pretty: false });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chatCtxWith(userText: string): llm.ChatContext {
  const ctx = llm.ChatContext.empty();
  ctx.addMessage({ role: 'user', content: userText, id: 'u1' });
  return ctx;
}

async function readChunks(stream: llm.LLMStream): Promise<llm.ChatChunk[]> {
  const out: llm.ChatChunk[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

const textChunks = (chunks: llm.ChatChunk[]) => chunks.filter(c => c.delta?.content).map(c => c.delta!.content);
const usageChunk = (chunks: llm.ChatChunk[]) => chunks.find(c => c.usage)?.usage;

/** A generator that records each turn's context and emits fixed text. */
function capturingGenerator(reply = 'ok') {
  const calls: VoiceTurnContext[] = [];
  const gen: VoiceReplyGenerator = ctx => {
    calls.push(ctx);
    return new ReadableStream<string>({
      start(controller) {
        if (reply) controller.enqueue(reply);
        controller.close();
      },
    }) as unknown as ReadableStream<string>;
  };
  return { gen, calls };
}

interface FakeChunk {
  type: string;
  payload: Record<string, unknown>;
}
function fakeMastraAgent(chunks: FakeChunk[], id = 'call-center') {
  const stream = vi.fn(async (_messages: unknown, options: { abortSignal?: AbortSignal }) => ({
    fullStream: (async function* () {
      for (const chunk of chunks) {
        if (options.abortSignal?.aborted) return;
        yield chunk;
      }
    })(),
  }));
  return { agent: { id, stream } as unknown as MastraAgent, stream };
}

// ===========================================================================
// MastraLLM — construction, contract surface
// ===========================================================================

describe('MastraLLM — options + contract (B1)', () => {
  it('requires exactly one reply source', () => {
    expect(() => new MastraLLM({})).toThrow(/exactly one reply source/);
    const { gen } = capturingGenerator();
    expect(() => new MastraLLM({ generate: gen, agent: fakeMastraAgent([]).agent })).toThrow(/exactly one/);
  });

  it('reports label / provider and model per source', () => {
    const remote = new MastraLLM({ remote: { baseUrl: 'http://x', agentId: 'callCenter' } });
    expect(remote.label()).toBe('mastra.MastraLLM');
    expect(remote.provider).toBe('mastra');
    expect(remote.model).toBe('callCenter');

    const agent = new MastraLLM({ agent: fakeMastraAgent([], 'support-bot').agent });
    expect(agent.model).toBe('support-bot');
  });

  it('forwards connOptions to the stream', () => {
    const { gen } = capturingGenerator();
    const mastraLLM = new MastraLLM({ generate: gen });
    const stream = mastraLLM.chat({
      chatCtx: chatCtxWith('hi'),
      connOptions: { maxRetry: 5, retryIntervalMs: 1000, timeoutMs: 4321 },
    });
    expect(stream.connOptions.timeoutMs).toBe(4321);
    expect(stream.connOptions.maxRetry).toBe(5);
    stream.close();
  });

  it('warns once about ignored LiveKit-side tools (D14)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gen } = capturingGenerator();
    const mastraLLM = new MastraLLM({ generate: gen });
    const toolCtx = { lookup: {}, book: {} } as unknown as llm.ToolContext;
    mastraLLM.chat({ chatCtx: chatCtxWith('a'), toolCtx }).close();
    mastraLLM.chat({ chatCtx: chatCtxWith('b'), toolCtx }).close();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('lookup, book');
    warn.mockRestore();
  });

  it('prewarm is a no-op', () => {
    const { gen } = capturingGenerator();
    expect(() => new MastraLLM({ generate: gen }).prewarm()).not.toThrow();
  });
});

// ===========================================================================
// MastraLLMStream — run() behavior (B2)
// ===========================================================================

describe('MastraLLMStream — message extraction (D3)', () => {
  it('sends only the new turn when memory is set (extractNewTurnMessages)', async () => {
    const { gen, calls } = capturingGenerator();
    const mastraLLM = new MastraLLM({ generate: gen, memory: { thread: 't1', resource: 'r1' } });
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'old', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'answer', id: 'a1' });
    ctx.addMessage({ role: 'user', content: 'new question', id: 'u2' });
    await readChunks(mastraLLM.chat({ chatCtx: ctx }));

    expect(calls[0]!.messages).toEqual([{ role: 'user', content: 'new question', id: 'u2' }]);
    expect(calls[0]!.memory).toEqual({ thread: 't1', resource: 'r1' });
  });

  it('sends the full context when memory is disabled (chatContextToMessages)', async () => {
    const { gen, calls } = capturingGenerator();
    const mastraLLM = new MastraLLM({ generate: gen, memory: false });
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'old', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'answer', id: 'a1' });
    ctx.addMessage({ role: 'user', content: 'new question', id: 'u2' });
    await readChunks(mastraLLM.chat({ chatCtx: ctx }));

    expect(calls[0]!.messages).toEqual([
      { role: 'user', content: 'old', id: 'u1' },
      { role: 'assistant', content: 'answer', id: 'a1' },
      { role: 'user', content: 'new question', id: 'u2' },
    ]);
  });

  it('closes without invoking the generator when extraction is empty', async () => {
    const { gen, calls } = capturingGenerator();
    const mastraLLM = new MastraLLM({ generate: gen, memory: { thread: 't1' } });
    // Only an assistant message → nothing new since the agent last spoke.
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'q', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'a', id: 'a1' });
    const chunks = await readChunks(mastraLLM.chat({ chatCtx: ctx }));
    expect(calls).toHaveLength(0);
    expect(chunks).toEqual([]);
  });
});

describe('MastraLLMStream — chunk mapping + metrics (B2)', () => {
  it('maps text deltas into assistant ChatChunks pushed through queue → output, with TTFT metrics', async () => {
    const gen: VoiceReplyGenerator = () =>
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue('Hello ');
          controller.enqueue('world');
          controller.close();
        },
      }) as unknown as ReadableStream<string>;
    const mastraLLM = new MastraLLM({ generate: gen });
    const metrics: lkMetrics.LLMMetrics[] = [];
    mastraLLM.on('metrics_collected', m => metrics.push(m as lkMetrics.LLMMetrics));

    const chunks = await readChunks(mastraLLM.chat({ chatCtx: chatCtxWith('hi') }));
    expect(textChunks(chunks)).toEqual(['Hello ', 'world']);
    for (const chunk of chunks) expect(chunk.delta?.role).toBe('assistant');

    // metrics_collected proves the base class drained queue → output (TTFT recorded from the first chunk).
    await vi.waitFor(() => expect(metrics).toHaveLength(1));
    expect(metrics[0]!.ttftMs).toBeGreaterThanOrEqual(0);
  });

  it('emits a final usage-only chunk and reports token metrics', async () => {
    const usage: VoiceTurnUsage = { promptTokens: 12, completionTokens: 8, promptCachedTokens: 3, totalTokens: 20 };
    const gen: VoiceReplyGenerator = ctx =>
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue('done');
          ctx.onUsage?.(usage);
          controller.close();
        },
      }) as unknown as ReadableStream<string>;
    const mastraLLM = new MastraLLM({ generate: gen });
    const metrics: lkMetrics.LLMMetrics[] = [];
    mastraLLM.on('metrics_collected', m => metrics.push(m as lkMetrics.LLMMetrics));

    const chunks = await readChunks(mastraLLM.chat({ chatCtx: chatCtxWith('hi') }));
    expect(usageChunk(chunks)).toEqual({
      promptTokens: 12,
      completionTokens: 8,
      promptCachedTokens: 3,
      totalTokens: 20,
    });
    // The usage-only chunk carries no spoken text.
    expect(chunks.find(c => c.usage)!.delta).toBeUndefined();

    await vi.waitFor(() => expect(metrics).toHaveLength(1));
    expect(metrics[0]).toMatchObject({ promptTokens: 12, completionTokens: 8, promptCachedTokens: 3, totalTokens: 20 });
  });

  it('drives an in-process Mastra agent (agent source smoke test)', async () => {
    const { agent, stream } = fakeMastraAgent([
      { type: 'text-delta', payload: { id: '1', text: 'From ' } },
      { type: 'text-delta', payload: { id: '1', text: 'the agent.' } },
    ]);
    const mastraLLM = new MastraLLM({ agent, memory: { thread: 't1' } });
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'q1', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'a1', id: 'a1' });
    ctx.addMessage({ role: 'user', content: 'q2', id: 'u2' });
    const chunks = await readChunks(mastraLLM.chat({ chatCtx: ctx }));

    expect(textChunks(chunks)).toEqual(['From ', 'the agent.']);
    expect(stream.mock.calls[0]![0]).toEqual([{ role: 'user', content: 'q2', id: 'u2' }]);
  });
});

describe('MastraLLMStream — barge-in (D5)', () => {
  it('returns silently on close(): output stops and no error is emitted', async () => {
    let cancelled = false;
    const gen: VoiceReplyGenerator = () =>
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue('Hello ');
          // Never closes on its own — waits to be cancelled.
        },
        cancel() {
          cancelled = true;
        },
      }) as unknown as ReadableStream<string>;
    const mastraLLM = new MastraLLM({ generate: gen });
    const errors: unknown[] = [];
    mastraLLM.on('error', e => errors.push(e));

    const stream = mastraLLM.chat({ chatCtx: chatCtxWith('hi') });
    const first = await stream.next();
    expect(first.value?.delta?.content).toBe('Hello ');
    stream.close();

    // The stream ends after close, the underlying reply is cancelled, and no error surfaces.
    const rest = await readChunks(stream);
    expect(textChunks(rest)).toEqual([]);
    await vi.waitFor(() => expect(cancelled).toBe(true));
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(errors).toHaveLength(0);
  });
});

describe('MastraLLMStream — overlapping turns (preemptive-generation shape)', () => {
  it('keeps per-turn text and usage isolated across two concurrent streams', async () => {
    const gen: VoiceReplyGenerator = ctx => {
      const content = (ctx.messages[0] as { content: string }).content;
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue(`reply-${content}`);
          ctx.onUsage?.({
            promptTokens: content.length,
            completionTokens: content.length,
            promptCachedTokens: 0,
            totalTokens: content.length * 2,
          });
          controller.close();
        },
      }) as unknown as ReadableStream<string>;
    };
    const mastraLLM = new MastraLLM({ generate: gen });
    const s1 = mastraLLM.chat({ chatCtx: chatCtxWith('first') }); // length 5
    const s2 = mastraLLM.chat({ chatCtx: chatCtxWith('second') }); // length 6
    const [c1, c2] = await Promise.all([readChunks(s1), readChunks(s2)]);

    expect(textChunks(c1)).toEqual(['reply-first']);
    expect(usageChunk(c1)).toMatchObject({ promptTokens: 5, totalTokens: 10 });
    expect(textChunks(c2)).toEqual(['reply-second']);
    expect(usageChunk(c2)).toMatchObject({ promptTokens: 6, totalTokens: 12 });
  });
});
