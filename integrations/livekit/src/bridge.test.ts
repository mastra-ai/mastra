import { ReadableStream } from 'node:stream/web';
import { llm } from '@livekit/agents';
import type { voice } from '@livekit/agents';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';
import { MastraVoiceAgent } from './bridge';

interface FakeChunk {
  type: string;
  payload: Record<string, unknown>;
}

function fakeMastraAgent(chunks: FakeChunk[] | (() => AsyncGenerator<FakeChunk>)) {
  const stream = vi.fn(async (_messages: unknown, options: { abortSignal?: AbortSignal }) => {
    const fullStream =
      typeof chunks === 'function'
        ? chunks()
        : (async function* () {
            for (const chunk of chunks) {
              if (options.abortSignal?.aborted) return;
              yield chunk;
            }
          })();
    return { fullStream };
  });
  return { agent: { stream } as unknown as MastraAgent, stream };
}

async function readAll(stream: ReadableStream<llm.ChatChunk | string>): Promise<(llm.ChatChunk | string)[]> {
  const reader = stream.getReader();
  const out: (llm.ChatChunk | string)[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

function userTurnContext(text = 'Hello'): llm.ChatContext {
  const ctx = llm.ChatContext.empty();
  ctx.addMessage({ role: 'user', content: text });
  return ctx;
}

const toolCtx = {} as llm.ToolContext;
const modelSettings = {} as voice.ModelSettings;

describe('MastraVoiceAgent.llmNode', () => {
  it('returns null when there is no new input', async () => {
    const { agent, stream } = fakeMastraAgent([]);
    const voiceAgent = new MastraVoiceAgent({ agent, memory: { thread: 't1' } });
    const result = await voiceAgent.llmNode(llm.ChatContext.empty(), toolCtx, modelSettings);
    expect(result).toBeNull();
    expect(stream).not.toHaveBeenCalled();
  });

  it('streams text deltas and filters other chunk types', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'text-start', payload: { id: '1' } },
      { type: 'text-delta', payload: { id: '1', text: 'Hello ' } },
      { type: 'tool-call', payload: { toolCallId: 'c1', toolName: 'lookup', args: {} } },
      { type: 'tool-result', payload: { toolCallId: 'c1', toolName: 'lookup' } },
      { type: 'text-delta', payload: { id: '1', text: 'world' } },
      { type: 'finish', payload: {} },
    ]);
    const voiceAgent = new MastraVoiceAgent({ agent });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual(['Hello ', 'world']);
  });

  it('speaks tool feedback while a tool call runs', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'tool-call', payload: { toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } } },
      { type: 'text-delta', payload: { id: '1', text: 'Found it.' } },
    ]);
    const toolFeedback = vi.fn(() => 'Let me check.');
    const voiceAgent = new MastraVoiceAgent({ agent, toolFeedback });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual(['Let me check. ', 'Found it.']);
    expect(toolFeedback).toHaveBeenCalledWith({ toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } });
  });

  it('passes memory, request context, and an abort signal to agent.stream', async () => {
    const { agent, stream } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'ok' } }]);
    const voiceAgent = new MastraVoiceAgent({
      agent,
      memory: { thread: 'thread-1', resource: 'user-1' },
      requestContext: { tenant: 'acme' },
    });
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'old question' });
    ctx.addMessage({ role: 'assistant', content: 'old answer' });
    ctx.addMessage({ role: 'user', content: 'new question' });
    await readAll((await voiceAgent.llmNode(ctx, toolCtx, modelSettings))!);

    expect(stream).toHaveBeenCalledTimes(1);
    const [messages, options] = stream.mock.calls[0]! as [unknown, Record<string, unknown>];
    // Memory mode sends only the new turn; history comes from the thread.
    expect(messages).toEqual([{ role: 'user', content: 'new question' }]);
    expect(options.memory).toEqual({ thread: 'thread-1', resource: 'user-1' });
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
    expect((options.requestContext as { get: (k: string) => unknown }).get('tenant')).toBe('acme');
  });

  it('sends the full LiveKit context when memory is disabled', async () => {
    const { agent, stream } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'ok' } }]);
    const voiceAgent = new MastraVoiceAgent({ agent, memory: false });
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'old question' });
    ctx.addMessage({ role: 'assistant', content: 'old answer' });
    ctx.addMessage({ role: 'user', content: 'new question' });
    await readAll((await voiceAgent.llmNode(ctx, toolCtx, modelSettings))!);

    const [messages] = stream.mock.calls[0]! as [unknown];
    expect(messages).toEqual([
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: 'new question' },
    ]);
  });

  it('aborts the Mastra stream when LiveKit cancels (barge-in)', async () => {
    let observedSignal: AbortSignal | undefined;
    const stream = vi.fn(async (_messages: unknown, options: { abortSignal?: AbortSignal }) => {
      observedSignal = options.abortSignal;
      return {
        fullStream: (async function* () {
          yield { type: 'text-delta', payload: { id: '1', text: 'Hello ' } };
          await new Promise<void>(resolve => options.abortSignal?.addEventListener('abort', () => resolve()));
          throw new DOMException('aborted', 'AbortError');
        })(),
      };
    });
    const agent = { stream } as unknown as MastraAgent;
    const voiceAgent = new MastraVoiceAgent({ agent });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);

    const reader = result!.getReader();
    expect((await reader.read()).value).toBe('Hello ');
    await reader.cancel();
    expect(observedSignal?.aborted).toBe(true);
  });

  it('propagates error chunks as stream errors', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'text-delta', payload: { id: '1', text: 'partial' } },
      { type: 'error', payload: { error: new Error('boom') } },
    ]);
    const voiceAgent = new MastraVoiceAgent({ agent });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    await expect(readAll(result!)).rejects.toThrow('boom');
  });
});

describe('MastraVoiceAgent reply generator seam', () => {
  it('delegates to a custom generate function with the turn context', async () => {
    const generate = vi.fn(() => {
      return new ReadableStream<string>({
        start: controller => {
          controller.enqueue('from generator');
          controller.close();
        },
      }) as unknown as ReadableStream<llm.ChatChunk | string>;
    });
    const voiceAgent = new MastraVoiceAgent({ generate, memory: { thread: 't1', resource: 'r1' } });
    const result = await voiceAgent.llmNode(userTurnContext('hello'), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual(['from generator']);
    const ctx = generate.mock.calls[0]![0] as { messages: unknown; memory: unknown };
    expect(ctx.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(ctx.memory).toEqual({ thread: 't1', resource: 'r1' });
  });

  it('returns null without invoking the generator when there is no new input', async () => {
    const generate = vi.fn();
    const voiceAgent = new MastraVoiceAgent({ generate, memory: { thread: 't1' } });
    expect(await voiceAgent.llmNode(llm.ChatContext.empty(), toolCtx, modelSettings)).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it('throws when neither agent nor generate is provided', () => {
    expect(() => new MastraVoiceAgent({})).toThrow(/requires `agent` or `generate`/);
  });
});

describe('MastraVoiceAgent llm placeholder', () => {
  it('provides an LLM instance so the session runs the cascaded reply pipeline', () => {
    const { agent } = fakeMastraAgent([]);
    const voiceAgent = new MastraVoiceAgent({ agent });
    expect(voiceAgent.llm).toBeInstanceOf(llm.LLM);
    // Inference never goes through it — generation runs in llmNode.
    expect(() => (voiceAgent.llm as llm.LLM).chat({ chatCtx: llm.ChatContext.empty() })).toThrow(/llmNode/);
  });
});
