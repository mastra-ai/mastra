import { describe, expect, it } from 'vitest';

import { describeRunError } from './run-error';

const responsesServerErrorFrame = JSON.stringify({
  type: 'error',
  sequence_number: 1,
  error: { type: 'server_error', code: 'internal_error', message: 'An internal error occurred.' },
});

describe('describeRunError', () => {
  it.each([
    ['AI_APICallError', 'Request timed out.', 'Request timed out', ['continue']],
    ['AI_APICallError', 'ThrottlingException', 'Provider rate limit reached', ['continue', 'credentials', 'model']],
    ['Error', responsesServerErrorFrame, 'Model provider temporarily unavailable', ['continue', 'model']],
  ])('%s %s → %s, continued once the provider recovers', (name, message, title, recoveries) => {
    expect(describeRunError({ name, message })).toMatchObject({ title, recoveries });
  });

  it.each([
    ['AI_APICallError', 'You exceeded your request size limit', 'Model request failed', ['model']],
    [
      'AI_APICallError',
      'prompt is too long: 210345 tokens > 200000 maximum',
      'Conversation exceeds the model’s limit',
      ['model', 'new_session'],
    ],
    [
      'AI_APICallError',
      'No tool output found for function call call_abc123.',
      'Conversation history rejected',
      ['new_session'],
    ],
  ])('%s %s → %s, never offering to resend the same request', (name, message, title, recoveries) => {
    expect(describeRunError({ name, message })).toMatchObject({ title, recoveries });
  });

  it.each([
    ['Error', 'Incorrect API key provided.', 'Provider access failed'],
    ['AI_APICallError', 'Your weekly limit has been reached, try again later', 'Provider quota exhausted'],
  ])('%s %s → %s, quoting the provider and fixed with another credential or model', (name, message, title) => {
    const description = describeRunError({ name, message });
    expect(description).toMatchObject({ title, recoveries: ['credentials', 'model'] });
    expect(description.message).toContain(message);
  });

  it.each([
    ['the HTTP phrase', { name: 'AI_APICallError', message: 'Unauthorized', statusCode: 401 }],
    [
      'a gateway page',
      {
        name: 'AI_APICallError',
        message: 'Forbidden',
        statusCode: 403,
        responseBody: '<!DOCTYPE html><html><title>Attention Required!</title></html>',
      },
    ],
  ])('gives only the next step when the provider wrote nothing beyond %s', (_source, rejected) => {
    expect(describeRunError(rejected)).toEqual({
      title: 'Provider access failed',
      message: 'Review the credentials and model access configured for this session.',
      recoveries: ['credentials', 'model'],
    });
  });

  it('quotes a plain-text body the provider sent instead of JSON', () => {
    const textBody = {
      name: 'AI_APICallError',
      message: 'Bad Request',
      statusCode: 400,
      responseBody: 'Invalid schema for function search.',
    };
    expect(describeRunError(textBody)).toEqual({
      title: 'Model request rejected',
      message: 'Invalid schema for function search.',
      recoveries: ['model'],
    });
  });

  it('offers the credential settings for a missing provider sign-in, matched on its wire name', () => {
    expect(describeRunError({ name: 'ProviderAuthRequiredError', message: 'Not logged in to Anthropic.' })).toEqual({
      title: 'Provider sign-in required',
      message: 'Not logged in to Anthropic.',
      recoveries: ['credentials', 'model'],
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
      recoveries: ['model'],
    });
  });

  it('offers to continue, switch credential, or switch model when the provider throttles the run', () => {
    expect(describeRunError({ name: 'AI_APICallError', message: 'ThrottlingException' })).toMatchObject({
      title: 'Provider rate limit reached',
      recoveries: ['continue', 'credentials', 'model'],
    });
  });

  it('keeps a rejected parameter terminal even when its name mentions a timeout', () => {
    const description = describeRunError({
      name: 'AI_APICallError',
      message: JSON.stringify({
        error: { type: 'invalid_request_error', message: 'Invalid value for parameter timeout.' },
      }),
    });
    expect(description).toEqual({
      title: 'Model request rejected',
      message: 'Invalid value for parameter timeout.',
      recoveries: ['model'],
    });
  });

  it('keeps a non-provider error neutral even when its reason differs from its message', () => {
    expect(
      describeRunError({ name: 'StorageError', message: 'Request failed', reason: 'Database connection refused' }),
    ).toEqual({ title: 'Run stopped', message: 'Database connection refused', recoveries: [] });
  });

  it.each([
    ['as the run error', new Error("OOM command not allowed when used memory > 'maxmemory'.")],
    [
      'as the cause of the run error',
      new Error('Failed to publish event', {
        cause: new Error("OOM command not allowed when used memory > 'maxmemory'."),
      }),
    ],
  ])('tells the user Factory itself ran out of memory, with the Redis reply %s', (_, error) => {
    const description = describeRunError(error);

    expect(description).toMatchObject({ title: 'Factory is unavailable', recoveries: ['continue'] });
    expect(description.message).toContain('Your request and the model provider are fine.');
    expect(description.message).not.toContain('maxmemory');
  });

  it('leaves an unrelated error unclassified', () => {
    expect(describeRunError({ name: 'Error', message: 'Something unexpected happened' })).toEqual({
      title: 'Run stopped',
      message: 'Something unexpected happened',
      recoveries: [],
    });
  });
});
