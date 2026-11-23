/**
 * Shared `MockLanguageModelV2` factories for unit tests that drive an agent with a scripted model.
 *
 * Prefer aimock scenarios (`packages/core/src/loop/test-utils/aimock`) for agent loop behavior.
 * Use these for focused tests that need an in-process model.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';

type Usage = { inputTokens: number; outputTokens: number; totalTokens: number };

export type MockToolCall = {
  toolName: string;
  args?: Record<string, unknown>;
  toolCallId?: string;
};

/** One model turn: reply with text, or call one or more tools. */
export type MockModelStep = { text: string; usage?: Usage } | { toolCalls: MockToolCall[]; usage?: Usage };

export type MockModelOptions = {
  modelId?: string;
};

const DEFAULT_USAGE: Usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function stepChunks(step: MockModelStep, index: number, modelId: string) {
  const chunks: any[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: `id-${index}`, modelId, timestamp: new Date(0) },
  ];

  if ('text' in step) {
    chunks.push(
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: step.text },
      { type: 'text-end', id: 'text-1' },
    );
  } else {
    step.toolCalls.forEach((call, i) => {
      chunks.push({
        type: 'tool-call',
        toolCallId: call.toolCallId ?? `call-${i + 1}`,
        toolName: call.toolName,
        input: JSON.stringify(call.args ?? {}),
        providerExecuted: false,
      });
    });
  }

  chunks.push({
    type: 'finish',
    finishReason: 'text' in step ? 'stop' : 'tool-calls',
    usage: step.usage ?? DEFAULT_USAGE,
  });
  return chunks;
}

/**
 * A model that plays `steps` in order, one per model call. Calls past the last step repeat it.
 */
export function createScriptedModel(steps: MockModelStep[], { modelId = 'mock-model-id' }: MockModelOptions = {}) {
  if (steps.length === 0) throw new Error('createScriptedModel needs at least one step');
  let calls = 0;
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => {
      const index = Math.min(calls++, steps.length - 1);
      return {
        stream: convertArrayToReadableStream(stepChunks(steps[index]!, index, modelId)),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** A model that streams `text` on every call. */
export function createTextStreamModel(text: string, options: MockModelOptions & { usage?: Usage } = {}) {
  return createScriptedModel([{ text, usage: options.usage }], options);
}

/** A model that calls `toolName` with `args` once, then replies with `finalText`. */
export function createToolCallThenTextModel(
  toolName: string,
  args: Record<string, unknown>,
  finalText: string,
  options: MockModelOptions = {},
) {
  return createScriptedModel(
    [
      { toolCalls: [{ toolName, args }], usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
      { text: finalText, usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 } },
    ],
    options,
  );
}

/**
 * A supervisor model that delegates `prompt` to the sub-agent registered as `agentKey`, then replies "Done".
 */
export function createSupervisorModel(
  agentKey: string,
  prompt: string,
  {
    toolName = `agent-${agentKey}`,
    finalText = 'Done',
    ...options
  }: MockModelOptions & { toolName?: string; finalText?: string } = {},
) {
  return createScriptedModel(
    [{ toolCalls: [{ toolName, args: { prompt }, toolCallId: 'sup-call-1' }] }, { text: finalText }],
    { modelId: 'mock-model', ...options },
  );
}
