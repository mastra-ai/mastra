/**
 * Regression for GitHub issue #26081.
 *
 * A native API-error retry (the default `StreamErrorRetryProcessor` answering a
 * retryable error with `retry: true`) returns from `llm-execution-step.ts`
 * while the failed attempt's streamed text-deltas are already committed to
 * `messageList` under the response message id. The early return clears the
 * error state but never rolls that output back, so:
 *
 * - the retry prompt replays the failed prefix as accepted assistant history,
 *   and
 * - the final `text` concatenates the failed prefix onto the recovered answer.
 *
 * The processor-retry paths (`processOutputStep` tripwire) already do the
 * rollback; the API-error path must do the same. This mirrors the real-world
 * scenario from the issue: a provider streams a prefix, then fails mid-stream
 * with a retryable 503, and the retry succeeds.
 *
 * @see https://github.com/mastra-ai/mastra/issues/26081
 */

import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { convertArrayToReadableStream, MockLanguageModelV2 } from '../../../agent/__tests__/mock-model';
import { Agent } from '../../../agent/agent';

const FAILED_PREFIX = 'The answer is ';
const RECOVERED_ANSWER = 'The answer is 42.';

function makeRetryableMidStreamError() {
  return new APICallError({
    message: 'upstream is overloaded',
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 503,
    responseHeaders: {},
    isRetryable: true,
  });
}

/**
 * Attempt 1 streams a prefix and then fails mid-stream with a retryable error.
 * Attempt 2 streams the complete recovered answer. Records every prompt the
 * model receives so the test can assert the failed prefix never reaches the
 * retry's prompt.
 */
function createMidStreamErrorModel() {
  const receivedPrompts: any[][] = [];
  let callCount = 0;

  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      callCount += 1;
      receivedPrompts.push(prompt);

      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: FAILED_PREFIX },
            { type: 'error', error: makeRetryableMidStreamError() },
          ]),
        };
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-2' },
          { type: 'text-delta', id: 'text-2', delta: RECOVERED_ANSWER },
          { type: 'text-end', id: 'text-2' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });

  return { model, receivedPrompts };
}

/** Flatten every text part a prompt sent to the model, for containment checks. */
function promptTexts(prompt: any[]): string[] {
  const texts: string[] = [];
  for (const message of prompt ?? []) {
    const content = message?.content;
    if (typeof content === 'string') {
      texts.push(content);
      continue;
    }
    for (const part of content ?? []) {
      if (typeof part?.text === 'string') texts.push(part.text);
    }
  }
  return texts;
}

describe('native API-error retry after mid-stream text (issue #26081)', () => {
  it('drops the failed attempt prefix from the recovered answer and the retry prompt', async () => {
    const { model, receivedPrompts } = createMidStreamErrorModel();

    const agent = new Agent({
      name: 'mid-stream-retry-agent',
      instructions: 'Answer the question.',
      model,
      // The AI SDK must not retry on its own — the retry under test is the
      // native error-processor one.
      maxRetries: 0,
    });

    const streamResult = await agent.stream('What is the answer?');
    const streamedText: string[] = [];
    for await (const chunk of streamResult.fullStream) {
      if (chunk.type === 'text-delta') {
        const delta =
          (chunk as { textDelta?: string }).textDelta ?? (chunk as { payload?: { text?: string } }).payload?.text ?? '';
        if (delta) streamedText.push(delta);
      }
    }
    const finalText = await streamResult.text;

    // The failed attempt's prefix was streamed live (that cannot be un-sent),
    // and the retry delivered the complete recovered answer...
    expect(streamedText).toContain(RECOVERED_ANSWER);
    // ...but the final text must be the recovered answer alone, without the
    // failed prefix concatenated on.
    expect(finalText).toBe(RECOVERED_ANSWER);

    // The failed prefix must not be replayed to the model as assistant history.
    expect(receivedPrompts).toHaveLength(2);
    const retryPromptTexts = promptTexts(receivedPrompts[1] ?? []);
    expect(retryPromptTexts.some(text => text.includes(FAILED_PREFIX))).toBe(false);
  }, 30_000);
});
