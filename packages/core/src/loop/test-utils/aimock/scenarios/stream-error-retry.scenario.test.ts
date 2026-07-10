import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createCodingAgent } from '../../../../coding-agent';
import type { ErrorProcessor } from '../../../../processors';

const UNMATCHED_ERROR = {
  error: {
    message: 'AIMOCK_UNMATCHED_STREAM_ERROR',
    type: 'unknown_stream_failure',
    code: 'unknown_stream_failure',
  },
  status: 422,
} as const;

describe('AIMock coding-agent scenario: retry unmatched stream errors', () => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterEach(() => {
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });

  afterAll(async () => {
    await llm.stop();
  });

  function createAgent(errorProcessors?: ErrorProcessor[]) {
    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
    });

    return createCodingAgent({
      id: `retry-all-errors-${errorProcessors ? 'control' : 'default'}`,
      name: 'Retry all stream errors test agent',
      instructions: 'Return the scripted AIMock response.',
      model: openai('gpt-4o-mini'),
      tools: {},
      workspace: undefined,
      ...(errorProcessors ? { errorProcessors } : {}),
    });
  }

  it('retries two unmatched failures and succeeds on the third request', async () => {
    let attempt = 0;
    llm.onMessage(/.*/, () => {
      attempt += 1;
      return attempt <= 2 ? UNMATCHED_ERROR : { content: 'recovered after unmatched stream errors' };
    });

    const output = await createAgent().stream('Recover from the scripted failures.');

    await expect(output.text).resolves.toBe('recovered after unmatched stream errors');
    expect(llm.getRequests()).toHaveLength(3);
  }, 15_000);

  it('delivers the non-retryable provider error to caller processors without provider-level retries', async () => {
    llm.onMessage(/.*/, UNMATCHED_ERROR);
    let processedError: unknown;
    const observer: ErrorProcessor = {
      id: 'observe-unmatched-error',
      processAPIError: async ({ error }) => {
        processedError = error;
      },
    };

    const output = await createAgent([observer]).stream('Surface the scripted failure.');

    await expect(output.finishReason).rejects.toThrow('AIMOCK_UNMATCHED_STREAM_ERROR');
    expect(processedError).toMatchObject({
      message: 'AIMOCK_UNMATCHED_STREAM_ERROR',
      statusCode: 422,
      isRetryable: false,
    });
    expect(llm.getRequests()).toHaveLength(1);
  });
});
