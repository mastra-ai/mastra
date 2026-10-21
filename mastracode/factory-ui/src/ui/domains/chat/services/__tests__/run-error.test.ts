import { describe, expect, it } from 'vitest';

import { describeRunError } from '../run-error';

const responsesServerErrorFrame = JSON.stringify({
  type: 'error',
  sequence_number: 1,
  error: { type: 'server_error', code: 'internal_error', message: 'An internal error occurred.' },
});

describe('describeRunError', () => {
  it.each([
    ['Error', responsesServerErrorFrame, 'Model provider temporarily unavailable', 'continue'],
    ['Error', 'Incorrect API key provided.', 'Provider access failed', 'credentials'],
    ['AI_APICallError', 'Request timed out.', 'Request timed out', 'continue'],
    ['AI_APICallError', 'Request Timeout', 'Request timed out', 'continue'],
    [
      'AI_APICallError',
      'prompt is too long: 210345 tokens > 200000 maximum',
      'Conversation exceeds the model’s limit',
      'models',
    ],
    [
      'AI_APICallError',
      'Your input exceeds the context window of this model.',
      'Conversation exceeds the model’s limit',
      'models',
    ],
    [
      'AI_APICallError',
      'The input token count (1100000) exceeds the maximum number of tokens allowed (1048576).',
      'Conversation exceeds the model’s limit',
      'models',
    ],
    ['AI_APICallError', 'Input is too long for requested model.', 'Conversation exceeds the model’s limit', 'models'],
    ['AI_APICallError', 'API key not valid. Please pass a valid API key.', 'Provider access failed', 'credentials'],
    ['AI_APICallError', 'AccessDeniedException', 'Provider access failed', 'credentials'],
    [
      'AI_APICallError',
      JSON.stringify({ error: { type: 'permission_error', message: 'Your API key does not have permission.' } }),
      'Provider access failed',
      'credentials',
    ],
    [
      'AI_APICallError',
      JSON.stringify({ error: { type: 'not_found_error', message: 'model: claude-x' } }),
      'Model configuration rejected',
      'models',
    ],
    ['AI_APICallError', 'ThrottlingException', 'Provider rate limit reached', 'continue'],
    ['AI_APICallError', 'RESOURCE_EXHAUSTED', 'Provider rate limit reached', 'continue'],
    ['AI_APICallError', 'ServiceUnavailableException', 'Model provider temporarily unavailable', 'continue'],
  ])('%s %s → %s', (name, message, title, recovery) => {
    const description = describeRunError({ name, message });
    expect(description.title).toBe(title);
    expect(description.recovery).toBe(recovery);
  });

  it('keeps a rejected parameter terminal even when its name mentions a timeout', () => {
    const description = describeRunError({
      name: 'AI_APICallError',
      message: JSON.stringify({
        error: { type: 'invalid_request_error', message: 'Invalid value for parameter timeout.' },
      }),
    });
    expect(description).toEqual({ title: 'Model request rejected', message: 'Invalid value for parameter timeout.' });
  });

  it('leaves an unrelated error unclassified', () => {
    expect(describeRunError({ name: 'Error', message: 'Something unexpected happened' })).toEqual({
      title: 'Run stopped',
      message: 'Something unexpected happened',
    });
  });
});
