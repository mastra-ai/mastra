import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { isProcessorWorkflow } from '../../processors';
import type { Processor } from '../../processors';
import { Agent } from '../agent';

function createModel(chunks: number) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text' },
        ...Array.from({ length: chunks }, () => ({ type: 'text-delta' as const, id: 'text', delta: 'x' })),
        { type: 'text-end', id: 'text' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: chunks, totalTokens: chunks + 1 },
        },
      ]),
    }),
  });
}

describe('generated stream processor execution', () => {
  it.each([
    { chunks: 1, streamHook: true },
    { chunks: 100, streamHook: true },
    { chunks: 1, streamHook: false },
    { chunks: 100, streamHook: false },
  ])('avoids workflow execution for $chunks deltas (stream hook: $streamHook)', async ({ chunks, streamHook }) => {
    const stream = vi.fn<NonNullable<Processor['processOutputStream']>>(({ part }) => part);
    const finals = Array.from({ length: 6 }, () =>
      vi.fn<NonNullable<Processor['processOutputResult']>>(({ messages }) => messages),
    );
    const agent = new Agent({
      id: 'stream-execution',
      name: 'stream-execution',
      instructions: 'test',
      model: createModel(chunks),
      outputProcessors: [
        ...(streamHook ? [{ id: 'stream', processOutputStream: stream }] : []),
        ...finals.map((processOutputResult, i) => ({ id: `final-${i}`, processOutputResult })),
      ],
    });
    const processors = await agent.listResolvedOutputProcessors();
    const workflow = processors[0]!;
    if (!isProcessorWorkflow(workflow)) throw new Error('Expected generated workflow');
    const createRun = vi.spyOn(workflow, 'createRun');
    const finalSteps = finals.map((_, i) => vi.spyOn(workflow.steps[`processor:final-${i}`]!, 'execute'));
    vi.spyOn(agent, 'listResolvedOutputProcessors').mockResolvedValue(processors);
    const output = await agent.stream('test');
    await output.consumeStream();
    expect(await output.text).toBe('x'.repeat(chunks));
    expect(stream.mock.calls.filter(([{ part }]) => part.type === 'text-delta')).toHaveLength(streamHook ? chunks : 0);
    expect(stream.mock.calls.some(([{ part }]) => part.type === 'finish')).toBe(streamHook);
    for (const final of finals) expect(final).toHaveBeenCalledTimes(1);
    for (const step of finalSteps) {
      expect(step).toHaveBeenCalledTimes(2);
      expect(step.mock.calls.some(([{ inputData }]) => inputData.phase === 'outputStream')).toBe(false);
    }
    expect(createRun.mock.calls.filter(([options]) => options?.tracingPolicy)).toHaveLength(0);
    expect(createRun.mock.calls.filter(([options]) => !options?.tracingPolicy)).toHaveLength(2);
  });
});
