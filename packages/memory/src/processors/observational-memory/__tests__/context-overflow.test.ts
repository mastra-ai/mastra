import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { isContextOverflowError } from '../context-overflow';

function apiError(statusCode: number, message: string, responseBody?: string, data?: unknown) {
  return new APICallError({
    message,
    url: 'https://api.example.com/v1/chat',
    requestBodyValues: {},
    statusCode,
    responseBody,
    data,
  });
}

describe('isContextOverflowError', () => {
  it.each([
    [
      'OpenAI chat completions',
      apiError(
        400,
        "This model's maximum context length is 128000 tokens. However, your messages resulted in 130512 tokens. Please reduce the length of the messages.",
        undefined,
        { error: { code: 'context_length_exceeded' } },
      ),
    ],
    ['OpenAI responses', apiError(400, 'Your input exceeds the context window of this model.')],
    ['Anthropic', apiError(400, 'prompt is too long: 210345 tokens > 200000 maximum')],
    [
      'Anthropic max_tokens',
      apiError(400, 'input length and `max_tokens` exceed context limit: 198000 + 8192 > 200000'),
    ],
    [
      'Google',
      apiError(400, 'The input token count (1100000) exceeds the maximum number of tokens allowed (1048576).'),
    ],
    ['Bedrock', apiError(400, 'Input is too long for requested model.')],
    ['xAI', apiError(400, "This model's maximum prompt length is 131072 but the request contains 140000 tokens.")],
    ['local server', apiError(400, 'the request exceeds the available context size, try increasing it')],
    ['code only in response body', apiError(400, 'Bad Request', '{"error":{"code":"context_length_exceeded"}}')],
    ['wrapped cause', new Error('Model call failed', { cause: apiError(400, 'prompt is too long: 1 > 0 maximum') })],
  ])('detects %s overflow errors', (_name, error) => {
    expect(isContextOverflowError(error)).toBe(true);
  });

  it.each([
    [
      'token-per-minute rate limit',
      apiError(
        429,
        'Request too large for gpt-4o: Limit 30000, Requested 45000 tokens per min. Please reduce the length of the messages.',
      ),
    ],
    ['authentication', apiError(401, 'Incorrect API key provided')],
    ['server error', apiError(500, 'The server had an error while processing your request')],
    ['plain error', new Error('Network connection lost')],
    ['undefined', undefined],
  ])('ignores %s errors', (_name, error) => {
    expect(isContextOverflowError(error)).toBe(false);
  });
});
