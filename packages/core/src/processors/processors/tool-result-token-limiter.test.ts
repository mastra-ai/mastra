import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { createTool } from '../../tools';
import { ToolResultTokenLimiter } from './tool-result-token-limiter';

function makeModel(prompts: any[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const hasToolResult = prompt.some((m: any) => m.role === 'tool');
      const parts = hasToolResult
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'bigTool', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'r', modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });
}

async function run(output: unknown, limit: number | { limit: number }, toModelOutput?: (output: any) => any) {
  const prompts: any[] = [];
  const agent = new Agent({
    id: 'trl-agent',
    name: 'trl',
    instructions: 'test',
    model: makeModel(prompts) as any,
    tools: {
      bigTool: createTool({
        id: 'bigTool',
        description: 'returns a big result',
        inputSchema: z.object({}),
        execute: async () => output as any,
        ...(toModelOutput ? { toModelOutput } : {}),
      }),
    },
    outputProcessors: [new ToolResultTokenLimiter(limit)],
  });

  const stream = await agent.stream('go', { maxSteps: 3 });
  let chunkResult: unknown;
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-result') chunkResult = (chunk as any).payload.result;
  }
  const toolMessage = prompts[1].find((m: any) => m.role === 'tool');
  const promptOutput = toolMessage.content[0].output;
  return { chunkResult, promptOutput };
}

describe('ToolResultTokenLimiter', () => {
  it('truncates an oversized string result before the next model call', async () => {
    const { chunkResult, promptOutput } = await run('word '.repeat(2000), { limit: 50 });

    expect(chunkResult).toMatch(/\[truncated: ~\d+ tokens\]$/);
    expect(estimateTokenCount(chunkResult as string)).toBeLessThanOrEqual(50);
    expect(promptOutput).toEqual({ type: 'text', value: chunkResult });
  });

  it('truncates an oversized object result as JSON text', async () => {
    const { chunkResult, promptOutput } = await run(
      { items: Array.from({ length: 500 }, (_, i) => ({ id: i, name: `item ${i}` })) },
      { limit: 30 },
    );

    expect(chunkResult).toMatch(/^\{"items":\[/);
    expect(promptOutput).toEqual({ type: 'text', value: chunkResult });
    expect(chunkResult).toMatch(/\[truncated: ~\d+ tokens\]$/);
  });

  it('sends the truncated result through the tool toModelOutput mapping', async () => {
    const { chunkResult, promptOutput } = await run('word '.repeat(2000), { limit: 50 }, (output: string) => ({
      type: 'text',
      value: `mapped:${output}`,
    }));

    expect(chunkResult).toMatch(/\[truncated: ~\d+ tokens\]$/);
    expect(promptOutput).toEqual({ type: 'text', value: `mapped:${chunkResult}` });
  });

  it('leaves results under the limit unchanged', async () => {
    const { chunkResult, promptOutput } = await run({ ok: true }, { limit: 50 });

    expect(chunkResult).toEqual({ ok: true });
    expect(promptOutput).toEqual({ type: 'json', value: { ok: true } });
  });

  it('accepts a bare number as the limit', async () => {
    const { chunkResult } = await run('word '.repeat(500), 10);

    expect(estimateTokenCount(chunkResult as string)).toBeLessThanOrEqual(10);

    expect(chunkResult).toMatch(/\[truncated: ~\d+ tokens\]$/);
  });

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects an invalid limit (%s)', limit => {
    expect(() => new ToolResultTokenLimiter(limit)).toThrow(/positive integer/);
  });

  it('leaves provider-executed results unchanged', () => {
    const updateToolInvocation = vi.fn(() => true);
    const messageList = { updateToolInvocation } as any;
    const result = new ToolResultTokenLimiter(5).processToolResult({
      result: 'word '.repeat(500),
      toolCallId: 'c',
      toolName: 'web_search',
      args: {},
      providerExecuted: true,
      messageList,
    } as any);
    expect(result).toBeUndefined();
    expect(updateToolInvocation).not.toHaveBeenCalled();
  });

  function callHook(limit: number, result: unknown, updated = true) {
    const updateToolInvocation = vi.fn((_part: any) => updated);
    const returned = new ToolResultTokenLimiter(limit).processToolResult({
      result,
      toolCallId: 'c',
      toolName: 't',
      args: {},
      messageList: { updateToolInvocation },
    } as any);
    return { returned, updateToolInvocation, written: updateToolInvocation.mock.calls[0]?.[0]?.toolInvocation.result };
  }

  it('stays within very small limits by dropping the marker', () => {
    const { written, updateToolInvocation } = callHook(2, 'word '.repeat(500));
    expect(updateToolInvocation).toHaveBeenCalled();
    expect(estimateTokenCount(written)).toBeLessThanOrEqual(2);
  });

  it('leaves a result exactly at the limit unchanged', () => {
    const text = 'word '.repeat(20);
    const { updateToolInvocation } = callHook(estimateTokenCount(text), text);
    expect(updateToolInvocation).not.toHaveBeenCalled();
  });

  it('passes through results that cannot be serialized', () => {
    const circular: any = { data: 'x'.repeat(5000) };
    circular.self = circular;
    const { updateToolInvocation } = callHook(5, circular);
    expect(updateToolInvocation).not.toHaveBeenCalled();
  });

  it('reports no change when the tool invocation is not found', () => {
    expect(callHook(5, 'word '.repeat(500), false).returned).toBeUndefined();
  });
});
