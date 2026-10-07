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

async function run(
  output: unknown,
  limit: number | { limit: number },
  toModelOutput?: (output: any) => any,
  extraProcessors: any[] = [],
) {
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
    outputProcessors: [new ToolResultTokenLimiter(limit), ...extraProcessors],
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

const MARKER = /\n\[truncated: showing [\d,]+ of [\d,]+ tokens\]$/;

function callHook(limit: number, result: unknown, modelOutput?: any, providerExecuted?: boolean) {
  return new ToolResultTokenLimiter(limit).processToolModelOutput({
    result,
    modelOutput,
    toolCallId: 'c',
    toolName: 't',
    args: {},
    providerExecuted,
  } as any) as { modelOutput?: any } | undefined;
}

describe('ToolResultTokenLimiter', () => {
  it('caps the model copy of an oversized string and keeps the streamed result whole', async () => {
    const raw = 'word '.repeat(2000);
    const { chunkResult, promptOutput } = await run(raw, { limit: 64 });

    expect(chunkResult).toBe(raw);
    expect(promptOutput.type).toBe('text');
    expect(promptOutput.value).toMatch(MARKER);
    expect(promptOutput.value).toContain('of 2,000 tokens]');
    expect(estimateTokenCount(promptOutput.value)).toBeLessThanOrEqual(64);
  });

  it('keeps an object result as an object and gives the model capped JSON text', async () => {
    const raw = { items: Array.from({ length: 500 }, (_, i) => ({ id: i, name: `item ${i}` })) };
    const { chunkResult, promptOutput } = await run(raw, { limit: 64 });

    expect(chunkResult).toEqual(raw);
    expect(promptOutput.type).toBe('text');
    expect(promptOutput.value).toMatch(/^\{"items":\[/);
    expect(promptOutput.value).toMatch(MARKER);
  });

  it('caps the mapped toModelOutput value', async () => {
    const raw = 'word '.repeat(2000);
    const mapper = vi.fn((output: string) => ({ type: 'text', value: `mapped:${output}` }));
    const { chunkResult, promptOutput } = await run(raw, { limit: 64 }, mapper);

    expect(mapper).toHaveBeenCalledWith(raw);
    expect(chunkResult).toBe(raw);
    expect(promptOutput.value).toMatch(/^mapped:word/);
    expect(promptOutput.value).toMatch(MARKER);
  });

  it('leaves media results untouched', async () => {
    const raw = { data: 'A'.repeat(200_000), mediaType: 'image/png' };
    const { chunkResult, promptOutput } = await run(raw, { limit: 64 });

    expect(chunkResult).toEqual(raw);
    expect(JSON.stringify(promptOutput)).not.toContain('[truncated');
  });

  it('caps text entries of content output and leaves media entries alone', () => {
    const image = { type: 'media', data: 'A'.repeat(50_000), mediaType: 'image/png' };
    const out = callHook(64, 'x', {
      type: 'content',
      value: [{ type: 'text', text: 'word '.repeat(2000) }, image],
    });
    expect(out!.modelOutput.value[0].text).toMatch(MARKER);
    expect(out!.modelOutput.value[1]).toBe(image);
  });

  it('caps the redacted result when a processToolResult redactor runs after it', async () => {
    const redactor = {
      id: 'redactor',
      processToolResult: ({ messageList, toolCallId, toolName, args, result }: any) => {
        messageList.updateToolInvocation({
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId, toolName, args, result: result.replaceAll('word', 'XXXX') },
        });
        return messageList;
      },
    };
    const { chunkResult, promptOutput } = await run('word '.repeat(2000), { limit: 64 }, undefined, [redactor]);

    expect(chunkResult).toBe('XXXX '.repeat(2000));
    expect(promptOutput.value).toMatch(/^XXXX/);
    expect(promptOutput.value).not.toContain('word');
    expect(promptOutput.value).toMatch(MARKER);
  });

  it('leaves results under the limit unchanged', async () => {
    const { chunkResult, promptOutput } = await run({ ok: true }, { limit: 64 });

    expect(chunkResult).toEqual({ ok: true });
    expect(promptOutput).toEqual({ type: 'json', value: { ok: true } });
  });

  it('accepts a bare number as the limit', async () => {
    const { promptOutput } = await run('word '.repeat(500), 100);

    expect(estimateTokenCount(promptOutput.value)).toBeLessThanOrEqual(100);
    expect(promptOutput.value).toMatch(MARKER);
  });

  it.each([0, -5, 1.5, 63, Number.NaN, Number.POSITIVE_INFINITY])('rejects an invalid limit (%s)', limit => {
    expect(() => new ToolResultTokenLimiter(limit)).toThrow(/integer of at least 64/);
  });

  it('accepts the minimum limit of 64', () => {
    expect(() => new ToolResultTokenLimiter(64)).not.toThrow();
  });

  it('leaves provider-executed results unchanged', () => {
    expect(callHook(64, 'word '.repeat(500), undefined, true)).toBeUndefined();
  });

  it('keeps the marker at the minimum limit when the original has 7+ digit tokens', () => {
    const text = 'word '.repeat(1_200_000);
    expect(estimateTokenCount(text)).toBeGreaterThanOrEqual(1_000_000);
    expect(callHook(64, text)!.modelOutput.value).toMatch(
      /\[truncated: showing [\d,]+ of \d{1,3}(,\d{3}){2,} tokens\]$/,
    );
  });

  it.each([64, 300, 2000])('stays within the limit with the marker (limit %s)', limit => {
    for (const text of [
      'word '.repeat(5000),
      JSON.stringify({ rows: Array.from({ length: 2000 }, (_, i) => ({ i })) }),
    ]) {
      const written: string = callHook(limit, text)!.modelOutput.value;
      expect(written).toMatch(MARKER);
      const kept = Number(/showing ([\d,]+) of/.exec(written)![1]!.replace(/,/g, ''));
      expect(kept).toBe(estimateTokenCount(written.slice(0, written.lastIndexOf('\n['))));
      expect(estimateTokenCount(written)).toBeLessThanOrEqual(limit);
    }
  });

  it('leaves a result exactly at the limit unchanged', () => {
    const text = 'word '.repeat(200);
    expect(callHook(estimateTokenCount(text), text)).toBeUndefined();
  });

  it('passes through results that cannot be serialized', () => {
    const circular: any = { data: 'x'.repeat(5000) };
    circular.self = circular;
    expect(callHook(64, circular)).toBeUndefined();
  });
});
