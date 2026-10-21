import { describe, expect, it } from 'vitest';

import { describeRunError } from '../run-error';

const responsesServerErrorFrame = JSON.stringify({
  type: 'error',
  sequence_number: 1,
  error: { type: 'server_error', code: 'internal_error', message: 'An internal error occurred.' },
});

describe('describeRunError', () => {
  it.each([
    ['Error', responsesServerErrorFrame, 'Model provider temporarily unavailable'],
    ['Error', 'Incorrect API key provided.', 'Provider access failed'],
    ['AI_APICallError', 'Request timed out.', 'Request timed out'],
    ['AI_APICallError', 'prompt is too long: 210345 tokens > 200000 maximum', 'Conversation exceeds the model’s limit'],
    [
      'AI_APICallError',
      JSON.stringify({ error: { type: 'not_found_error', message: 'model: claude-x' } }),
      'Model configuration rejected',
    ],
    ['AI_APICallError', 'Your weekly limit has been reached, try again later', 'Provider quota exhausted'],
    ['AI_APICallError', 'ThrottlingException', 'Provider rate limit reached'],
    ['AI_APICallError', 'You exceeded your request size limit', 'Model request failed'],
  ])('%s %s → %s, with no Login', (name, message, title) => {
    const description = describeRunError({ name, message });
    expect(description.title).toBe(title);
    expect(description.recovery).toBeUndefined();
  });

  it('offers Login only for a rejected provider sign-in, matched on its wire name', () => {
    expect(describeRunError({ name: 'ProviderAuthRequiredError', message: 'Not logged in to Anthropic.' })).toEqual({
      title: 'Provider sign-in required',
      message: 'Not logged in to Anthropic.',
      recovery: 'credentials',
    });
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

  it('keeps a non-provider error neutral even when its reason differs from its message', () => {
    expect(
      describeRunError({ name: 'StorageError', message: 'Request failed', reason: 'Database connection refused' }),
    ).toEqual({ title: 'Run stopped', message: 'Database connection refused' });
  });

  it('leaves an unrelated error unclassified', () => {
    expect(describeRunError({ name: 'Error', message: 'Something unexpected happened' })).toEqual({
      title: 'Run stopped',
      message: 'Something unexpected happened',
    });
  });
});
