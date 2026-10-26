import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { toPersistedErrorIdentity } from '../loop/shared/record-terminal-error-message';
import { classifyProviderError, providerErrorFacts, providerErrorReason } from './provider-error';
import type { ProviderFailureKind } from './provider-error';

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

const responsesServerErrorFrame = {
  type: 'error',
  sequence_number: 1,
  error: { type: 'server_error', code: 'internal_error', message: 'An internal error occurred.' },
};

const classifications: Array<[name: string, error: unknown, kind: ProviderFailureKind]> = [
  [
    'OpenAI chat completions overflow',
    apiError(
      400,
      "This model's maximum context length is 128000 tokens. However, your messages resulted in 130512 tokens. Please reduce the length of the messages.",
      undefined,
      { error: { code: 'context_length_exceeded' } },
    ),
    'context_overflow',
  ],
  [
    'OpenAI responses overflow',
    apiError(400, 'Your input exceeds the context window of this model.'),
    'context_overflow',
  ],
  ['Anthropic overflow', apiError(400, 'prompt is too long: 210345 tokens > 200000 maximum'), 'context_overflow'],
  [
    'Anthropic max_tokens overflow',
    apiError(400, 'input length and `max_tokens` exceed context limit: 198000 + 8192 > 200000'),
    'context_overflow',
  ],
  [
    'Google overflow',
    apiError(400, 'The input token count (1100000) exceeds the maximum number of tokens allowed (1048576).'),
    'context_overflow',
  ],
  ['Bedrock overflow', apiError(400, 'Input is too long for requested model.'), 'context_overflow'],
  [
    'xAI overflow',
    apiError(400, "This model's maximum prompt length is 131072 but the request contains 140000 tokens."),
    'context_overflow',
  ],
  [
    'local server overflow',
    apiError(400, 'the request exceeds the available context size, try increasing it'),
    'context_overflow',
  ],
  [
    'overflow code only in the response body',
    apiError(400, 'Bad Request', '{"error":{"code":"context_length_exceeded"}}'),
    'context_overflow',
  ],
  [
    'overflow behind a wrapping cause',
    new Error('Model call failed', { cause: apiError(400, 'prompt is too long: 1 > 0 maximum') }),
    'context_overflow',
  ],
  [
    'overflow stream payload without a status',
    {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'prompt is too long: 210345 tokens > 200000 maximum' },
    },
    'context_overflow',
  ],
  [
    'token-per-minute limit that asks to shorten the request',
    apiError(
      429,
      'Request too large for gpt-4o: Limit 30000, Requested 45000 tokens per min. Please reduce the length of the messages.',
    ),
    'rate_limited',
  ],
  [
    'wrapped token-per-minute limit',
    new Error('Model call failed', {
      cause: apiError(
        429,
        'Request too large for gpt-4o: Limit 30000, Requested 45000 tokens per min. Please reduce the length of the messages.',
      ),
    }),
    'rate_limited',
  ],
  ['401', apiError(401, 'Incorrect API key provided'), 'auth'],
  ['403 by status alone', apiError(403, 'Bad Request'), 'auth'],
  [
    'invalid_api_key frame with a derived 400',
    { type: 'error', code: 'invalid_api_key', message: 'Incorrect API key provided.', statusCode: 400 },
    'auth',
  ],
  ['persisted "Incorrect API key provided."', { name: 'Error', message: 'Incorrect API key provided.' }, 'auth'],
  [
    'Google "API key not valid"',
    { name: 'AI_APICallError', message: 'API key not valid. Please pass a valid API key.' },
    'auth',
  ],
  ['Bedrock AccessDeniedException', { name: 'AI_APICallError', message: 'AccessDeniedException' }, 'auth'],
  [
    'Anthropic permission_error envelope',
    {
      name: 'AI_APICallError',
      message: JSON.stringify({
        error: { type: 'permission_error', message: 'Your API key does not have permission.' },
      }),
    },
    'auth',
  ],
  ['another service’s authentication failure', new Error('GitHub authentication failed: token expired'), 'unknown'],
  [
    'another service’s 403 in free text',
    new Error('MCP tool call failed: 403 Forbidden from mcp.linear.app'),
    'unknown',
  ],
  ['a bare unauthorized provider code', { type: 'error', error: { code: 'unauthorized', message: 'Denied.' } }, 'auth'],
  [
    'OpenAI insufficient_quota on 429',
    apiError(429, 'You exceeded your current quota, please check your plan and billing details.', undefined, {
      error: { code: 'insufficient_quota', type: 'insufficient_quota' },
    }),
    'quota',
  ],
  [
    'Anthropic low credit balance on 400',
    apiError(400, 'Your credit balance is too low to access the Anthropic API.', undefined, {
      error: { type: 'invalid_request_error' },
    }),
    'quota',
  ],
  ['402', apiError(402, 'Payment Required'), 'quota'],
  [
    'message-only insufficient balance',
    { name: 'AI_APICallError', message: 'Insufficient balance to complete this request' },
    'quota',
  ],
  ['message-only credits exhausted', { name: 'AI_APICallError', message: 'API credits exhausted' }, 'quota'],
  [
    'message-only weekly limit',
    { name: 'AI_APICallError', message: 'Your weekly limit has been reached, try again later' },
    'quota',
  ],
  [
    'message-only usage limit',
    { name: 'AI_APICallError', message: 'You have exceeded your usage limit for Claude Max' },
    'quota',
  ],
  [
    'request size limit is not a quota',
    { name: 'AI_APICallError', message: 'You exceeded your request size limit' },
    'unknown',
  ],
  [
    'Google per-minute quota on 429',
    {
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message:
          "Quota exceeded for quota metric 'Generate Content API requests per minute' and limit 'GenerateContent request limit per minute per region'.",
      },
    },
    'rate_limited',
  ],
  [
    'Responses rate_limit_exceeded frame worded as a quota',
    {
      type: 'error',
      error: {
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
        message: 'Quota exceeded for requests per minute. Please try again in 20s.',
      },
    },
    'rate_limited',
  ],
  [
    'Responses insufficient_quota frame',
    {
      type: 'error',
      error: {
        type: 'insufficient_quota',
        code: 'insufficient_quota',
        message: 'You exceeded your current quota, please check your plan and billing details.',
      },
    },
    'quota',
  ],
  [
    'persisted identity whose reason came from the body',
    {
      name: 'AI_APICallError',
      message: 'Bad Request',
      statusCode: 400,
      code: 'invalid_request_error',
      reason: 'prompt is too long: 210345 tokens > 200000 maximum',
    },
    'context_overflow',
  ],
  [
    'Anthropic not_found_error envelope',
    {
      name: 'AI_APICallError',
      message: JSON.stringify({ error: { type: 'not_found_error', message: 'model: claude-x' } }),
    },
    'model_rejected',
  ],
  [
    'unsupported parameter',
    { name: 'AI_APICallError', message: "Unsupported_parameter: 'reasoning.effort'" },
    'model_rejected',
  ],
  [
    'Codex model the ChatGPT plan does not include',
    apiError(
      400,
      'Bad Request',
      JSON.stringify({ detail: "The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account." }),
    ),
    'model_rejected',
  ],
  [
    'tool call without its result',
    { name: 'AI_APICallError', message: 'No tool output found for function call call_123.' },
    'tool_history_rejected',
  ],
  [
    'invalid_request_error whose value mentions a timeout',
    {
      name: 'AI_APICallError',
      message: JSON.stringify({
        error: { type: 'invalid_request_error', message: 'Invalid value for parameter timeout.' },
      }),
    },
    'invalid_request',
  ],
  [
    'invalid_request_error whose value mentions a server error',
    {
      name: 'AI_APICallError',
      message: JSON.stringify({
        error: { type: 'invalid_request_error', message: "Invalid value 'server_error' for parameter mode." },
      }),
    },
    'invalid_request',
  ],
  ['408', apiError(408, 'Request Timeout'), 'timeout'],
  ['timed out APICallError', { name: 'AI_APICallError', message: 'Request timed out.' }, 'timeout'],
  ['TimeoutError name', { name: 'TimeoutError', message: 'The operation was aborted due to timeout' }, 'timeout'],
  ['Bedrock ThrottlingException', { name: 'AI_APICallError', message: 'ThrottlingException' }, 'rate_limited'],
  [
    'Google RESOURCE_EXHAUSTED status',
    {
      error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Resource has been exhausted (e.g. check quota).' },
    },
    'rate_limited',
  ],
  ['500', apiError(500, 'The server had an error while processing your request'), 'unavailable'],
  ['503 that mentions authentication', apiError(503, 'Upstream authentication service unavailable'), 'unavailable'],
  ['504 that mentions authentication', apiError(504, 'authentication backend timed out'), 'timeout'],
  ['529 overloaded', apiError(529, 'Overloaded', undefined, { error: { type: 'overloaded_error' } }), 'unavailable'],
  ['Responses server_error frame', responsesServerErrorFrame, 'unavailable'],
  [
    'Responses server_error frame persisted under a plain Error',
    { name: 'Error', message: JSON.stringify(responsesServerErrorFrame) },
    'unavailable',
  ],
  [
    'Bedrock ServiceUnavailableException',
    { name: 'AI_APICallError', message: 'ServiceUnavailableException' },
    'unavailable',
  ],
  [
    'Responses server_error frame that mentions authentication',
    {
      type: 'error',
      error: { type: 'server_error', code: 'server_error', message: 'Upstream authentication service unavailable' },
    },
    'unavailable',
  ],
  [
    'invalid_prompt frame worded as a renewing cap',
    {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        code: 'invalid_prompt',
        message: "Invalid value 'quota exceeded per minute' for parameter mode.",
      },
    },
    'invalid_request',
  ],
  [
    'invalid_prompt frame worded as a monthly limit',
    {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        code: 'invalid_prompt',
        message: "Invalid value 'monthly limit' for parameter mode.",
      },
    },
    'invalid_request',
  ],
  ['plain 400 weekly limit', apiError(400, 'Your weekly limit has been reached, try again later'), 'quota'],
  [
    'Codex usage limit in a detail body',
    apiError(400, 'Bad Request', '{"detail":"You have exceeded your usage limit for Codex"}'),
    'quota',
  ],
  [
    'saved facts that kept every code',
    {
      name: 'AI_APICallError',
      message: 'Bad Request',
      statusCode: 404,
      codes: ['model_not_found', 'invalid_request_error'],
    },
    'model_rejected',
  ],
  ['plain 400 Claude Max usage limit', apiError(400, 'You have exceeded your usage limit for Claude Max'), 'quota'],
  [
    'usage-limit wording on a 404',
    apiError(404, 'You have exceeded your usage limit for Claude Max'),
    'invalid_request',
  ],
  [
    'Anthropic-shaped 400 weekly limit',
    apiError(
      400,
      'Your weekly limit has been reached, try again later',
      '{"type":"error","error":{"type":"invalid_request_error","message":"Your weekly limit has been reached, try again later"}}',
    ),
    'quota',
  ],
  [
    '400 invalid_prompt frame quoting a monthly limit',
    apiError(
      400,
      "Invalid value 'monthly limit' for parameter mode.",
      '{"error":{"type":"invalid_request_error","code":"invalid_prompt","message":"Invalid value \'monthly limit\' for parameter mode."}}',
    ),
    'invalid_request',
  ],
  [
    '400 invalid_prompt that mentions a timeout',
    apiError(400, 'Invalid timeout parameter', undefined, { error: { code: 'invalid_prompt' } }),
    'invalid_request',
  ],
  [
    'invalid_prompt frame that mentions a timeout',
    { type: 'error', error: { code: 'invalid_prompt', message: 'Invalid timeout parameter' } },
    'invalid_request',
  ],
  [
    'generic code before the decisive type',
    { code: 'bad_request', type: 'invalid_request_error', message: 'Invalid timeout parameter' },
    'invalid_request',
  ],
  [
    'outage behind an outer failure code',
    Object.assign(new Error('Upstream call failed'), { code: 'upstream_failure', cause: responsesServerErrorFrame }),
    'unavailable',
  ],
  [
    'overflow in the body behind three wrapping causes',
    new Error('a', {
      cause: new Error('b', {
        cause: new Error('c', {
          cause: apiError(400, 'Bad Request', '{"error":{"message":"prompt is too long: 1 > 0 maximum"}}'),
        }),
      }),
    }),
    'context_overflow',
  ],
  [
    'OpenAI model_not_found under invalid_request_error',
    apiError(
      404,
      'The model `gpt-9` does not exist or you do not have access to it.',
      '{"error":{"message":"The model `gpt-9` does not exist or you do not have access to it.","type":"invalid_request_error","param":null,"code":"model_not_found"}}',
    ),
    'model_rejected',
  ],
  [
    'dual-code overflow body behind a bare Bad Request',
    apiError(400, 'Bad Request', '{"error":{"type":"invalid_request_error","code":"context_length_exceeded"}}'),
    'context_overflow',
  ],
  [
    'code-only context_length_exceeded under invalid_request_error',
    {
      type: 'error',
      error: { type: 'invalid_request_error', code: 'context_length_exceeded', message: 'Request too large.' },
    },
    'context_overflow',
  ],
  [
    'unsupported_parameter under invalid_request_error',
    apiError(
      400,
      "'temperature' is not supported with this model.",
      '{"error":{"message":"\'temperature\' is not supported with this model.","type":"invalid_request_error","param":"temperature","code":"unsupported_parameter"}}',
    ),
    'model_rejected',
  ],
  ['400 without a reason', apiError(400, 'Bad Request'), 'invalid_request'],
  ['persisted "Bad Request" without a status', { name: 'AI_APICallError', message: 'Bad Request' }, 'invalid_request'],
  ['persisted "Unauthorized" without a status', { name: 'AI_APICallError', message: 'Unauthorized' }, 'auth'],
  ['persisted "Forbidden" without a status', { name: 'APICallError', message: 'Forbidden' }, 'auth'],
  ['a bare "Unauthorized" outside a provider call', new Error('Unauthorized'), 'invalid_request'],
  ['plain error', new Error('Network connection lost'), 'unknown'],
  ['undefined', undefined, 'unknown'],
];

describe('classifyProviderError', () => {
  it.each(classifications)('%s → %s', (_name, error, kind) => {
    expect(classifyProviderError(error)).toBe(kind);
  });

  it('survives a throwing getter and a cycle', () => {
    const hostile: Record<string, unknown> = { message: 'Bad Request', statusCode: 400 };
    Object.defineProperty(hostile, 'code', {
      get() {
        throw new Error('nope');
      },
      enumerable: true,
    });
    hostile.cause = hostile;
    expect(classifyProviderError(hostile)).toBe('invalid_request');
  });
});

describe('toPersistedErrorIdentity', () => {
  it.each(classifications)('classifies %s like the live error, as %s', (_name, error, kind) => {
    expect(classifyProviderError(toPersistedErrorIdentity(error))).toBe(kind);
  });

  it('keeps the ordinary identity of an error whose reason points back at itself', () => {
    const circular: Error & { statusCode: number; reason?: unknown } = Object.assign(
      new Error('Provider rejected the request'),
      { statusCode: 400 },
    );
    circular.reason = circular;
    expect(toPersistedErrorIdentity(circular)).toEqual({
      name: 'Error',
      message: 'Provider rejected the request',
      statusCode: 400,
    });
    expect(classifyProviderError(circular)).toBe('invalid_request');
  });

  it('keeps the provider sentence that sits behind a wrapping cause', () => {
    const wrapped = new Error('Model call failed', { cause: apiError(400, 'prompt is too long: 1 > 0 maximum') });

    expect(toPersistedErrorIdentity(wrapped)).toEqual({
      name: 'Error',
      message: 'Model call failed',
      statusCode: 400,
      reason: 'prompt is too long: 1 > 0 maximum',
    });
  });

  it('leaves a cause that holds no provider response out of history', () => {
    const wrapped = new Error('Tool failed', { cause: new Error('ENOENT: open /Users/me/.config/acme/token.json') });

    expect(toPersistedErrorIdentity(wrapped)).toEqual({ name: 'Error', message: 'Tool failed' });
  });
});

describe('providerErrorFacts', () => {
  it('keeps the status and every provider code, once each, in the order found', () => {
    const error = apiError(429, 'quota', undefined, {
      error: { type: 'insufficient_quota', code: 'insufficient_quota' },
    });
    expect(providerErrorFacts(error)).toEqual({ statusCode: 429, codes: ['insufficient_quota'] });
    expect(providerErrorFacts({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } })).toEqual({
      codes: ['rate_limit_error'],
      reason: 'slow down',
    });
    expect(providerErrorFacts({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } })).toEqual({
      statusCode: 429,
      codes: ['RESOURCE_EXHAUSTED'],
    });
    expect(
      providerErrorFacts({
        type: 'response.failed',
        response: { status: 'failed', error: { code: 'server_error', message: 'An internal error occurred.' } },
      }),
    ).toEqual({ codes: ['server_error'], reason: 'An internal error occurred.' });
    expect(
      providerErrorFacts({ code: 'bad_request', type: 'invalid_request_error', message: 'Invalid timeout' }),
    ).toEqual({ codes: ['bad_request', 'invalid_request_error'] });
    expect(
      providerErrorFacts({ type: 'invalid_request_error', code: 'model_not_found', message: 'Request rejected.' }),
    ).toEqual({ codes: ['model_not_found', 'invalid_request_error'] });
    expect(
      providerErrorFacts(
        Object.assign(new Error('Upstream call failed'), {
          code: 'upstream_failure',
          cause: responsesServerErrorFrame,
        }),
      ),
    ).toEqual({ codes: ['upstream_failure', 'internal_error', 'server_error'] });
  });

  it('keeps the body sentence as the reason when the message is only an HTTP phrase', () => {
    const bodyOnly = apiError(
      400,
      'Bad Request',
      JSON.stringify({ error: { type: 'invalid_request_error', message: 'prompt is too long: 1 > 0 maximum' } }),
    );
    expect(providerErrorFacts(bodyOnly)).toEqual({
      statusCode: 400,
      codes: ['invalid_request_error'],
      reason: 'prompt is too long: 1 > 0 maximum',
    });
    expect(providerErrorFacts(apiError(400, 'prompt is too long: 1 > 0 maximum'))).toEqual({ statusCode: 400 });
  });

  it('keeps a detail sentence as the reason and a non-JSON body out of history', () => {
    expect(
      providerErrorFacts(apiError(400, 'Bad Request', '{"detail":"You have exceeded your usage limit for Codex"}')),
    ).toEqual({ statusCode: 400, reason: 'You have exceeded your usage limit for Codex' });
    expect(
      providerErrorFacts(apiError(400, 'Bad Request', 'prompt is too long: 210345 tokens > 200000 maximum')),
    ).toEqual({ statusCode: 400 });
  });

  it('never persists a bare HTTP phrase as the reason, wherever it sits', () => {
    for (const phrase of ['Internal Server Error', 'Unauthorized', 'Not Implemented', 'HTTP Version Not Supported']) {
      expect(providerErrorFacts({ name: 'AI_APICallError', message: 'Request failed', data: phrase })).toEqual({});
      expect(providerErrorFacts(Object.assign(new Error('Request failed'), { cause: new Error(phrase) }))).toEqual({});
    }
  });

  it('returns no keys for an error without provider facts', () => {
    expect(providerErrorFacts(new Error('boom'))).toEqual({});
    expect(providerErrorFacts('boom')).toEqual({});
  });
});

describe('providerErrorReason', () => {
  it('unwraps envelopes and stringified layers down to the provider sentence', () => {
    const nested = JSON.stringify({
      message: JSON.stringify({
        type: 'response.failed',
        response: { error: { code: 'invalid_request_error', message: 'Invalid schema for function search.' } },
      }),
    });
    expect(providerErrorReason(nested)).toBe('Invalid schema for function search.');
    expect(
      providerErrorReason(apiError(400, 'Bad Request', '{"error":{"message":"Unsupported value: temperature"}}')),
    ).toBe('Unsupported value: temperature');
    expect(providerErrorReason({ name: 'Error', message: '  Something broke  ' })).toBe('Something broke');
    expect(providerErrorReason({ name: 'Error', message: '' })).toBeUndefined();
    expect(
      providerErrorReason({
        name: 'Error',
        message: '{"error":{"type":"invalid_request_error","message":"Bad Request"}}',
      }),
    ).toBeUndefined();
  });
});
