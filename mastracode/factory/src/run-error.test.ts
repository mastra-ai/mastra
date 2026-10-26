import { describe, expect, it } from 'vitest';

import { describeRunError } from './run-error';

const responsesServerErrorFrame = JSON.stringify({
  type: 'error',
  sequence_number: 1,
  error: { type: 'server_error', code: 'internal_error', message: 'An internal error occurred.' },
});

describe('describeRunError', () => {
  it.each([
    ['Error', responsesServerErrorFrame, 'Model provider temporarily unavailable'],
    ['AI_APICallError', 'Request timed out.', 'Request timed out'],
    ['AI_APICallError', 'ThrottlingException', 'Provider rate limit reached'],
    ['AI_APICallError', 'You exceeded your request size limit', 'Model request failed'],
  ])('%s %s → %s, nothing to change', (name, message, title) => {
    const description = describeRunError({ name, message });
    expect(description.title).toBe(title);
    expect(description.recovery).toBeUndefined();
  });

  it.each([
    ['Error', 'Incorrect API key provided.', 'Provider access failed'],
    ['AI_APICallError', 'Your weekly limit has been reached, try again later', 'Provider quota exhausted'],
  ])('%s %s → %s, quoting the provider and fixed in the credential settings', (name, message, title) => {
    const description = describeRunError({ name, message });
    expect(description).toMatchObject({ title, recovery: 'credentials' });
    expect(description.message).toContain(message);
  });

  it('gives only the next step when the provider wrote nothing beyond the HTTP phrase', () => {
    const unauthorized = { name: 'AI_APICallError', message: 'Unauthorized', statusCode: 401 };
    expect(describeRunError(unauthorized)).toEqual({
      title: 'Provider access failed',
      message: 'Review the credentials and model access configured for this session.',
      recovery: 'credentials',
    });
  });

  it('offers the credential settings for a missing provider sign-in, matched on its wire name', () => {
    expect(describeRunError({ name: 'ProviderAuthRequiredError', message: 'Not logged in to Anthropic.' })).toEqual({
      title: 'Provider sign-in required',
      message: 'Not logged in to Anthropic.',
      recovery: 'credentials',
    });
  });

  it('quotes the provider when it refuses the model, and offers another model', () => {
    const codexPlanRefusal = {
      name: 'AI_APICallError',
      message: 'Bad Request',
      statusCode: 400,
      responseBody: JSON.stringify({
        detail: "The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.",
      }),
    };
    expect(describeRunError(codexPlanRefusal)).toEqual({
      title: 'Model not available',
      message:
        "The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account. Choose another model for this session.",
      recovery: 'model',
    });
  });

  it('offers another model when the provider names nothing beyond the model', () => {
    expect(
      describeRunError({
        name: 'AI_APICallError',
        message: JSON.stringify({ error: { type: 'not_found_error', message: 'model: claude-x' } }),
      }),
    ).toMatchObject({ title: 'Model not available', recovery: 'model' });
  });

  it('offers a larger model when the conversation overflows', () => {
    expect(
      describeRunError({ name: 'AI_APICallError', message: 'prompt is too long: 210345 tokens > 200000 maximum' }),
    ).toMatchObject({ title: 'Conversation exceeds the model’s limit', recovery: 'model' });
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
