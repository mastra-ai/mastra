import { ReadableStream } from 'node:stream/web';
import { FlushSentinel, llm } from '@livekit/agents';
import type { Agent } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';
import { instrumentVoiceReply, MastraVoiceAgent } from './bridge';
import { VOICE_TURN_METADATA } from './turn-metrics';

function context() {
  const chatCtx = llm.ChatContext.empty();
  chatCtx.addMessage({ role: 'user', content: 'Look it up.', id: 'user-1' });
  return {
    messages: [{ role: 'user' as const, content: 'Look it up.', id: 'user-1' }],
    chatCtx,
    memory: false as const,
  };
}

describe('voice turn metrics and flushing', () => {
  it('flushes tool feedback before a blocked tool returns and correlates the completed generation', async () => {
    let resolveTool!: () => void;
    const blocked = new Promise<void>(resolve => {
      resolveTool = resolve;
    });
    const onTurnComplete = vi.fn();
    const onTurnMetrics = vi.fn();
    const agent = new MastraVoiceAgent({
      onTurnComplete,
      onTurnMetrics,
      toolFeedback: () => 'One moment.',
      agent: {
        stream: async () => ({
          fullStream: (async function* () {
            yield { type: 'text-delta', payload: { text: 'Checking.' } };
            yield { type: 'text-end', payload: {} };
            yield { type: 'tool-call', payload: { toolCallId: 'tool-1', toolName: 'lookup' } };
            await blocked;
            yield { type: 'tool-result', payload: { toolCallId: 'tool-1' } };
            yield { type: 'text-delta', payload: { text: 'The answer is 42.' } };
          })(),
        }),
      } as unknown as Agent,
    });
    const stream = await agent.llmNode(context().chatCtx, {} as llm.ToolContext, {});
    const reader = stream!.getReader();
    const first = (await reader.read()).value as llm.ChatChunk;
    expect(first.delta?.content).toBe('Checking.');
    expect((await reader.read()).value).toBe(FlushSentinel);
    expect((await reader.read()).value).toBe(FlushSentinel);
    expect((await reader.read()).value).toMatchObject({ delta: { content: 'One moment. ' } });
    expect((await reader.read()).value).toBe(FlushSentinel);
    expect(onTurnComplete).not.toHaveBeenCalled();
    resolveTool();
    expect((await reader.read()).value).toMatchObject({ delta: { content: 'The answer is 42.' } });
    expect((await reader.read()).done).toBe(true);
    await vi.waitFor(() => expect(onTurnMetrics).toHaveBeenCalledOnce());
    const metric = onTurnMetrics.mock.calls[0]![0];
    expect(metric).toMatchObject({
      phase: 'generation',
      turnId: 'user-1',
      outcome: 'completed',
      tools: [{ toolCallId: 'tool-1', toolName: 'lookup', durationMs: expect.any(Number) }],
    });
    expect(first.delta?.extra?.[VOICE_TURN_METADATA]).toEqual({ turnId: metric.turnId, attemptId: metric.attemptId });
    expect(onTurnComplete).toHaveBeenCalledOnce();
    expect(onTurnComplete.mock.calls[0]![0].result).toMatchObject({
      interrupted: false,
      text: 'Checking.The answer is 42.',
    });
  });

  it('emits one interrupted outcome immediately even when a source does not finish', async () => {
    const onMetrics = vi.fn();
    const cancel = vi.fn();
    const { reply } = await instrumentVoiceReply(
      () => new ReadableStream({ start: controller => controller.enqueue('hello'), cancel }),
      context(),
      onMetrics,
    );
    const reader = reply!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(onMetrics).toHaveBeenCalledOnce());
    expect(onMetrics.mock.calls[0]![0].outcome).toBe('interrupted');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('keeps one user turn linked across unique failed and successful attempts', async () => {
    const onMetrics = vi.fn();
    await expect(
      instrumentVoiceReply(
        async () => {
          throw new Error('provider');
        },
        context(),
        onMetrics,
      ),
    ).rejects.toThrow('provider');
    await instrumentVoiceReply(() => null, context(), onMetrics);
    await vi.waitFor(() => expect(onMetrics).toHaveBeenCalledTimes(2));
    const [a, b] = onMetrics.mock.calls.map(([metric]) => metric);
    expect(a.turnId).toBe(b.turnId);
    expect(a.attemptId).not.toBe(b.attemptId);
    expect(a.outcome).toBe('failed');
    expect(b.firstTextMs).toBeUndefined();
  });
});
