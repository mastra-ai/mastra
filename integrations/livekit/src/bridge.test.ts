import { ReadableStream } from 'node:stream/web';
import { llm } from '@livekit/agents';
import type { voice } from '@livekit/agents';
import type { Agent as MastraAgent } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DISCLOSURE_REMINDER, DisclosureReminder, MastraVoiceAgent, mapTurnUsage, prependText } from './bridge';

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
  ctx.addMessage({ role: 'user', content: text, id: 'u1' });
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
    ctx.addMessage({ role: 'user', content: 'old question', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'old answer', id: 'a1' });
    ctx.addMessage({ role: 'user', content: 'new question', id: 'u2' });
    await readAll((await voiceAgent.llmNode(ctx, toolCtx, modelSettings))!);

    expect(stream).toHaveBeenCalledTimes(1);
    const [messages, options] = stream.mock.calls[0]! as [unknown, Record<string, unknown>];
    // Memory mode sends only the new turn; history comes from the thread.
    expect(messages).toEqual([{ role: 'user', content: 'new question', id: 'u2' }]);
    expect(options.memory).toEqual({ thread: 'thread-1', resource: 'user-1' });
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
    expect((options.requestContext as { get: (k: string) => unknown }).get('tenant')).toBe('acme');
  });

  it('sends the full LiveKit context when memory is disabled', async () => {
    const { agent, stream } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'ok' } }]);
    const voiceAgent = new MastraVoiceAgent({ agent, memory: false });
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'old question', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'old answer', id: 'a1' });
    ctx.addMessage({ role: 'user', content: 'new question', id: 'u2' });
    await readAll((await voiceAgent.llmNode(ctx, toolCtx, modelSettings))!);

    const [messages] = stream.mock.calls[0]! as [unknown];
    expect(messages).toEqual([
      { role: 'user', content: 'old question', id: 'u1' },
      { role: 'assistant', content: 'old answer', id: 'a1' },
      { role: 'user', content: 'new question', id: 'u2' },
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

describe('MastraVoiceAgent onTurnComplete hook', () => {
  it('fires after the reply streams with the produced text, tool calls, and turn context', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'text-delta', payload: { id: '1', text: 'Hello ' } },
      { type: 'tool-call', payload: { toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } } },
      { type: 'text-delta', payload: { id: '1', text: 'world' } },
    ]);
    const onTurnComplete = vi.fn();
    const voiceAgent = new MastraVoiceAgent({
      agent,
      memory: { thread: 't1', resource: 'r1' },
      onTurnComplete,
    });
    const result = await voiceAgent.llmNode(userTurnContext('hi'), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual(['Hello ', 'world']);

    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    const ctx = onTurnComplete.mock.calls[0]![0];
    expect(ctx.result).toEqual({
      text: 'Hello world',
      toolCalls: [{ toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } }],
      interrupted: false,
    });
    expect(ctx.messages).toEqual([{ role: 'user', content: 'hi', id: 'u1' }]);
    expect(ctx.memory).toEqual({ thread: 't1', resource: 'r1' });
  });

  it('marks the turn interrupted when barge-in cancels mid-reply', async () => {
    const stream = vi.fn(async (_messages: unknown, options: { abortSignal?: AbortSignal }) => ({
      fullStream: (async function* () {
        yield { type: 'text-delta', payload: { id: '1', text: 'Hello ' } };
        await new Promise<void>(resolve => options.abortSignal?.addEventListener('abort', () => resolve()));
        throw new DOMException('aborted', 'AbortError');
      })(),
    }));
    const agent = { stream } as unknown as MastraAgent;
    const onTurnComplete = vi.fn();
    const voiceAgent = new MastraVoiceAgent({ agent, onTurnComplete });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);

    const reader = result!.getReader();
    expect((await reader.read()).value).toBe('Hello ');
    await reader.cancel();

    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    expect(onTurnComplete.mock.calls[0]![0].result).toEqual({
      text: 'Hello ',
      toolCalls: [],
      interrupted: true,
    });
  });

  it('does not let a throwing onTurnComplete break the turn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { agent } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'done' } }]);
    const onTurnComplete = vi.fn(() => {
      throw new Error('hook boom');
    });
    const voiceAgent = new MastraVoiceAgent({ agent, onTurnComplete });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    // The reply still streams cleanly even though the hook throws.
    expect(await readAll(result!)).toEqual(['done']);

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(warn.mock.calls[0]![0]).toContain('onTurnComplete');
    warn.mockRestore();
  });

  it('does not fire onTurnComplete when generation errors', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'text-delta', payload: { id: '1', text: 'partial' } },
      { type: 'error', payload: { error: new Error('boom') } },
    ]);
    const onTurnComplete = vi.fn();
    const voiceAgent = new MastraVoiceAgent({ agent, onTurnComplete });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    await expect(readAll(result!)).rejects.toThrow('boom');

    // Give any stray microtask a chance to run, then assert the hook stayed silent.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onTurnComplete).not.toHaveBeenCalled();
  });

  it('does not fire onTurnComplete when there is no new input', async () => {
    const { agent } = fakeMastraAgent([]);
    const onTurnComplete = vi.fn();
    const voiceAgent = new MastraVoiceAgent({ agent, memory: { thread: 't1' }, onTurnComplete });
    expect(await voiceAgent.llmNode(llm.ChatContext.empty(), toolCtx, modelSettings)).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onTurnComplete).not.toHaveBeenCalled();
  });
});

describe('MastraVoiceAgent onToolCall + usage side channels', () => {
  it('fires onToolCall mid-stream for each tool call, in order', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'text-delta', payload: { id: '1', text: 'one moment ' } },
      { type: 'tool-call', payload: { toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } } },
      { type: 'tool-call', payload: { toolCallId: 'c2', toolName: 'book', args: { id: 7 } } },
      { type: 'text-delta', payload: { id: '1', text: 'done' } },
    ]);
    const onToolCall = vi.fn();
    const voiceAgent = new MastraVoiceAgent({ agent, onToolCall });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    await readAll(result!);

    expect(onToolCall.mock.calls.map(c => c[0])).toEqual([
      { toolCallId: 'c1', toolName: 'lookup', args: { q: 'x' } },
      { toolCallId: 'c2', toolName: 'book', args: { id: 7 } },
    ]);
  });

  it('captures finish-chunk usage onto the turn result', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'text-delta', payload: { id: '1', text: 'hello' } },
      {
        type: 'finish',
        payload: { output: { usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, cachedInputTokens: 5 } } },
      },
    ]);
    const onTurnComplete = vi.fn();
    const voiceAgent = new MastraVoiceAgent({ agent, onTurnComplete });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    // Usage never reaches the spoken stream — only text deltas do.
    expect(await readAll(result!)).toEqual(['hello']);

    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    expect(onTurnComplete.mock.calls[0]![0].result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      promptCachedTokens: 5,
      totalTokens: 30,
    });
  });

  it('leaves usage undefined when the finish chunk carries no token counts', async () => {
    const { agent } = fakeMastraAgent([
      { type: 'text-delta', payload: { id: '1', text: 'hi' } },
      { type: 'finish', payload: {} },
    ]);
    const onTurnComplete = vi.fn();
    const voiceAgent = new MastraVoiceAgent({ agent, onTurnComplete });
    await readAll((await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings))!);
    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    expect(onTurnComplete.mock.calls[0]![0].result.usage).toBeUndefined();
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
    expect(ctx.messages).toEqual([{ role: 'user', content: 'hello', id: 'u1' }]);
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

  it('throws when both agent and generate are provided', () => {
    const { agent } = fakeMastraAgent([]);
    expect(() => new MastraVoiceAgent({ agent, generate: vi.fn() })).toThrow(/not both/);
  });
});

describe('DisclosureReminder', () => {
  it('returns the reminder once the interval elapses, then resets the clock once markDelivered is called', () => {
    const reminder = new DisclosureReminder(1000, 'AI reminder', 0);
    expect(reminder.due(500)).toBeUndefined(); // 500ms < 1000ms
    expect(reminder.due(1000)).toBe('AI reminder'); // due
    reminder.markDelivered(1000); // clock resets to 1000 once delivery is confirmed
    expect(reminder.due(1500)).toBeUndefined(); // only 500ms since the reset
    expect(reminder.due(2000)).toBe('AI reminder'); // due again
  });

  it('stays due if markDelivered is never called, instead of silently skipping an interval', () => {
    const reminder = new DisclosureReminder(1000, 'AI reminder', 0);
    expect(reminder.due(1000)).toBe('AI reminder'); // due, but never delivered
    expect(reminder.due(1500)).toBe('AI reminder'); // still due — the clock never reset
  });
});

describe('mapTurnUsage', () => {
  it('maps the flat V2 usage shape to LiveKit field names', () => {
    expect(mapTurnUsage({ inputTokens: 12, outputTokens: 34, totalTokens: 46, cachedInputTokens: 3 })).toEqual({
      promptTokens: 12,
      completionTokens: 34,
      promptCachedTokens: 3,
      totalTokens: 46,
    });
  });

  it('derives totalTokens when the model omits it', () => {
    expect(mapTurnUsage({ inputTokens: 5, outputTokens: 7 })).toEqual({
      promptTokens: 5,
      completionTokens: 7,
      promptCachedTokens: 0,
      totalTokens: 12,
    });
  });

  it('reads the nested V3 usage shape', () => {
    expect(
      mapTurnUsage({ inputTokens: { total: 100, cacheRead: 40 }, outputTokens: { total: 60 }, totalTokens: 160 }),
    ).toEqual({
      promptTokens: 100,
      completionTokens: 60,
      promptCachedTokens: 40,
      totalTokens: 160,
    });
  });

  it('returns undefined for missing or all-zero usage', () => {
    expect(mapTurnUsage(undefined)).toBeUndefined();
    expect(mapTurnUsage({})).toBeUndefined();
    expect(mapTurnUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })).toBeUndefined();
  });
});

describe('prependText', () => {
  it('emits the prefix (with a trailing space) then pipes the source stream', async () => {
    const source = new ReadableStream<string>({
      start: controller => {
        controller.enqueue('the answer');
        controller.close();
      },
    });
    expect(await readAll(prependText(source, 'Quick note.'))).toEqual(['Quick note. ', 'the answer']);
  });

  it('keeps an existing trailing space and works with an empty source', async () => {
    const source = new ReadableStream<string>({ start: controller => controller.close() });
    expect(await readAll(prependText(source, 'note '))).toEqual(['note ']);
  });
});

describe('MastraVoiceAgent periodic re-disclosure', () => {
  it('prefixes the turn reply with the reminder when the interval has elapsed', async () => {
    const { agent } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'Sure thing.' } }]);
    // everyMs: 0 → due on the first turn.
    const voiceAgent = new MastraVoiceAgent({
      agent,
      greetingReminder: { everyMs: 0, text: 'You are speaking with an AI.' },
    });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual(['You are speaking with an AI. ', 'Sure thing.']);
  });

  it('falls back to the default reminder text', async () => {
    const { agent } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'Ok.' } }]);
    const voiceAgent = new MastraVoiceAgent({ agent, greetingReminder: { everyMs: 0 } });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual([`${DEFAULT_DISCLOSURE_REMINDER} `, 'Ok.']);
  });

  it('does not re-disclose again before the interval elapses', async () => {
    const { agent } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'Ok.' } }]);
    // A long interval that cannot have elapsed since construction → no reminder this turn.
    const voiceAgent = new MastraVoiceAgent({ agent, greetingReminder: { everyMs: 5 * 60_000, text: 'AI.' } });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual(['Ok.']);
  });

  it('does not re-disclose when re-disclosure is not configured', async () => {
    const { agent } = fakeMastraAgent([{ type: 'text-delta', payload: { id: '1', text: 'Ok.' } }]);
    const voiceAgent = new MastraVoiceAgent({ agent });
    const result = await voiceAgent.llmNode(userTurnContext(), toolCtx, modelSettings);
    expect(await readAll(result!)).toEqual(['Ok.']);
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
