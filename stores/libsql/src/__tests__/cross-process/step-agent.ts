/**
 * Model-free scripted agent shared by the cross-process tests (mirrors the
 * validation harness's `script-agent` + `step-tool`). The model calls the
 * `step` tool once per turn with n = 1..steps, then answers with text. The
 * tool can park at one step until the test releases a gate or the run's abort
 * signal fires, so tests coordinate on events, not on timing.
 */
import { Agent } from '@mastra/core/agent';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';

export type StepToolEvent =
  | { event: 'start'; n: number }
  | { event: 'reached'; n: number }
  | { event: 'released'; n: number; aborted: boolean }
  | { event: 'commit'; n: number };

export interface StepAgentOptions {
  id: string;
  steps: number;
  /** Park the tool at this step until `release` resolves or the run is aborted. */
  blockAt?: number;
  release?: Promise<void>;
  onToolEvent?: (event: StepToolEvent) => void;
  onModelCall?: (call: number) => void;
}

export interface Gate<T = void> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

/** A promise the test opens explicitly (`Promise.withResolvers` without needing es2024 lib types). */
export function gate<T = void>(): Gate<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}

function chunks(parts: unknown[]): ReadableStream<any> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

export function createStepAgent({ id, steps, blockAt, release, onToolEvent, onModelCall }: StepAgentOptions) {
  let calls = 0;
  const model = new MastraLanguageModelV2Mock({
    doStream: async () => {
      const call = ++calls;
      onModelCall?.(call);
      const head = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `resp-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
      ];
      if (call <= steps) {
        return {
          stream: chunks([
            ...head,
            {
              type: 'tool-call',
              toolCallId: `call-${call}`,
              toolName: 'step',
              input: JSON.stringify({ n: call }),
              providerExecuted: false,
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: chunks([
          ...head,
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: `finished ${steps} steps` },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });

  const step = createTool({
    id: 'step',
    description: 'Perform numbered step n.',
    inputSchema: {
      type: 'object',
      properties: { n: { type: 'number' } },
      required: ['n'],
      additionalProperties: false,
    },
    execute: async (input, context) => {
      // A JSON Schema input carries no static type; the schema above validates the shape.
      const { n } = input as { n: number };
      onToolEvent?.({ event: 'start', n });
      if (n === blockAt) {
        onToolEvent?.({ event: 'reached', n });
        const signal = context?.abortSignal;
        const aborted = await new Promise<boolean>(resolve => {
          if (signal?.aborted) return resolve(true);
          signal?.addEventListener('abort', () => resolve(true), { once: true });
          void release?.then(() => resolve(false));
        });
        onToolEvent?.({ event: 'released', n, aborted });
      }
      onToolEvent?.({ event: 'commit', n });
      return { done: n };
    },
  });

  const agent = new Agent({
    id,
    name: id,
    instructions: 'Follow the script.',
    model,
    tools: { step },
  });
  return { agent, model, modelCalls: () => calls };
}
