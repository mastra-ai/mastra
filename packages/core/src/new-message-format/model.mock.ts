import { convertArrayToReadableStream, MockLanguageModelV4 } from '@internal/ai-v7/test';

type StreamPart = Record<string, unknown> & { type: string };

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const finish = (unified: 'stop' | 'tool-calls'): StreamPart => ({
  type: 'finish',
  finishReason: { unified, raw: unified },
  usage,
});

/** One model turn that answers with `text`. */
export const textTurn = (text: string): StreamPart[] => [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: 'resp', modelId: 'mock-model', timestamp: new Date(0) },
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: text },
  { type: 'text-end', id: 't' },
  finish('stop'),
];

/** One model turn that calls `toolName` with `input`. */
export const toolCallTurn = (toolCallId: string, toolName: string, input: unknown): StreamPart[] => [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: 'resp', modelId: 'mock-model', timestamp: new Date(0) },
  { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
  finish('tool-calls'),
];

/**
 * A model that plays `turns` in order, one per call, and records every prompt it was sent.
 * Calls past the last turn repeat it.
 */
export function scriptedModel(turns: StreamPart[][]) {
  const prompts: unknown[] = [];
  let call = 0;
  const model = new MockLanguageModelV4({
    modelId: 'mock-model',
    doStream: async options => {
      prompts.push(options.prompt);
      const parts = turns[Math.min(call++, turns.length - 1)]!;
      return { stream: convertArrayToReadableStream(parts) } as never;
    },
  });
  return { model, prompts };
}
