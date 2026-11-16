import { toPersistedErrorIdentity } from '@mastra/core/error';
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

  it('names the Mastra Gateway and offers to add credits when its credits run out', () => {
    const outOfCredits = {
      name: 'AI_APICallError',
      message: "You don't have inference credits left. Add credits at https://gateway.mastra.ai/",
      statusCode: 402,
    };
    expect(describeRunError(outOfCredits)).toMatchObject({
      title: 'Out of Mastra Gateway credits',
      recoveries: ['credits', 'continue', 'model'],
    });
  });

  it('recognizes the gateway by the host it called when its reply names no gateway', () => {
    const outOfCredits = {
      name: 'AI_APICallError',
      message: "You don't have inference credits left.",
      statusCode: 402,
      url: 'https://gateway-api.mastra.ai/v1/chat/completions',
      requestBodyValues: { model: 'anthropic/claude-opus-5-5' },
    };
    expect(describeRunError(outOfCredits)).toMatchObject({
      title: 'Out of Mastra Gateway credits',
      recoveries: ['credits', 'continue', 'model'],
    });
  });

  it('recognizes the gateway host on a provider error the run wrapped', () => {
    const wrapped = {
      name: 'Error',
      message: "You don't have inference credits left.",
      cause: {
        name: 'AI_APICallError',
        message: "You don't have inference credits left.",
        statusCode: 402,
        url: 'https://gateway-api.mastra.ai/v1/chat/completions',
      },
    };
    expect(describeRunError(wrapped)).toMatchObject({ title: 'Out of Mastra Gateway credits' });
  });

  it('keeps a look-alike host a provider quota error', () => {
    const outOfCredits = {
      name: 'AI_APICallError',
      message: "You don't have inference credits left.",
      statusCode: 402,
      url: 'https://gateway-api.mastra.ai.example.com/v1/chat/completions',
    };
    expect(describeRunError(outOfCredits)).toMatchObject({ title: 'Provider quota exhausted' });
  });

  describe('Mastra Gateway v2 refusals', () => {
    // What v2 sends for a reason code it has no special reply for, and what history keeps of it:
    // no request URL, and the model the request named without the `mastra/` prefix.
    const gatewayRefusal = (status: number, code: string, message = code) => {
      const responseBody = JSON.stringify({ error: { type: 'gateway_error', code, message } });
      const live = {
        name: 'AI_APICallError',
        message,
        statusCode: status,
        responseBody,
        requestBodyValues: { model: 'anthropic/claude-opus-4-5' },
      };
      return toPersistedErrorIdentity(live);
    };

    it('keeps no request URL or gateway prefix in the saved part these cases are rebuilt from', () => {
      const saved = gatewayRefusal(402, 'insufficient_credit');
      expect(saved).not.toHaveProperty('url');
      expect(saved).toMatchObject({
        modelId: 'anthropic/claude-opus-4-5',
        codes: expect.arrayContaining(['gateway_error', 'insufficient_credit']),
      });
    });

    it('offers to add credits when the organization is out of credits', () => {
      expect(describeRunError(gatewayRefusal(402, 'insufficient_credit'))).toEqual({
        title: 'Out of Mastra Gateway credits',
        message:
          'Your organization has no gateway credits left. Add credits, then continue the run, or choose another model.',
        recoveries: ['credits', 'continue', 'model'],
        model: 'anthropic/claude-opus-4-5',
      });
    });

    it('names the organization budget, and still offers credits, which lift a starting budget', () => {
      const description = describeRunError(gatewayRefusal(402, 'organization_budget_exhausted'));
      expect(description).toMatchObject({
        title: 'Mastra Gateway budget reached',
        recoveries: ['credits', 'continue', 'model'],
      });
      expect(description.message).toContain('used its Mastra Gateway budget');
      expect(description.message).toContain('adding credits lifts it');
    });

    it.each(['organization_budget_insufficient', 'organization_budget_unbounded_request'])(
      'says a %s request needs more than the budget has left',
      code => {
        const description = describeRunError(gatewayRefusal(402, code));
        expect(description).toMatchObject({
          title: 'Mastra Gateway budget reached',
          recoveries: ['credits', 'continue', 'model'],
        });
        expect(description.message).toContain('This request needs more than your organization has left');
      },
    );

    it.each(['key_budget_exhausted', 'spend_limit_reached'])(
      'sends %s to an organization admin, without offering credits that would not help',
      code => {
        const description = describeRunError(gatewayRefusal(402, code));
        expect(description).toMatchObject({ title: 'Mastra Gateway spend limit reached', recoveries: ['model'] });
        expect(description.message).toContain('Ask an organization admin to raise the limit');
      },
    );

    it('refuses usage the billing plan does not cover, without offering credits', () => {
      expect(describeRunError(gatewayRefusal(402, 'billing_overage_unsupported'))).toMatchObject({
        title: 'Usage not covered by the billing plan',
        recoveries: ['model'],
      });
    });

    it('keeps offering credits for a 402 code it does not know yet', () => {
      expect(describeRunError(gatewayRefusal(402, 'some_new_billing_code'))).toMatchObject({
        title: 'Out of Mastra Gateway credits',
        recoveries: ['credits', 'continue', 'model'],
      });
    });

    it('quotes the sentence the gateway wrote instead of the code', () => {
      const description = describeRunError(
        gatewayRefusal(402, 'spend_limit_reached', 'This key reached its monthly spend limit of $50.'),
      );
      expect(description.message).toBe(
        'This key reached its monthly spend limit of $50. Ask an organization admin to raise the limit, or choose another model.',
      );
    });

    it.each(['no_eligible_route', 'model_not_allowed'])(
      'offers another model, not credentials, when routing policy refuses with %s',
      code => {
        expect(describeRunError(gatewayRefusal(403, code))).toMatchObject({
          title: 'Model not available through the Mastra Gateway',
          recoveries: ['model'],
        });
      },
    );

    it.each([
      [413, 'context_too_large'],
      [422, 'context_unaccountable'],
    ])('treats a %i %s as a conversation over the model limit', (status, code) => {
      expect(describeRunError(gatewayRefusal(status, code))).toMatchObject({
        title: 'Conversation exceeds the model’s limit',
        recoveries: ['model', 'new_session'],
      });
    });

    it('reads the code from a Messages route reply, which repeats it as the message', () => {
      const messagesReply = {
        name: 'AI_APICallError',
        message: 'organization_budget_exhausted',
        statusCode: 402,
        responseBody: JSON.stringify({
          type: 'error',
          error: { type: 'gateway_error', message: 'organization_budget_exhausted' },
        }),
      };
      expect(describeRunError(toPersistedErrorIdentity(messagesReply))).toMatchObject({
        title: 'Mastra Gateway budget reached',
      });
    });

    it("describes the gateway's own rate limit as the key's or organization's, not the provider account's", () => {
      const limited = {
        name: 'AI_APICallError',
        message: 'Gateway key requests limit exceeded. Retry in 12s.',
        statusCode: 429,
        url: 'https://gateway-api.mastra.ai/v1/chat/completions',
        responseBody: JSON.stringify({
          error: {
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded',
            message: 'Gateway key requests limit exceeded. Retry in 12s.',
          },
        }),
      };
      expect(describeRunError(limited)).toEqual({
        title: 'Mastra Gateway rate limit reached',
        message: 'Gateway key requests limit exceeded. Retry in 12s. Continue once it resets, or choose another model.',
        recoveries: ['continue', 'model'],
        model: undefined,
      });
    });

    it('recognizes a gateway at the configured base URL', () => {
      const staging = {
        name: 'AI_APICallError',
        message: 'Payment required',
        statusCode: 402,
        url: 'http://localhost:8787/v1/chat/completions',
      };
      expect(describeRunError(staging)).toMatchObject({ title: 'Provider quota exhausted' });
      expect(describeRunError(staging, { gatewayBaseUrl: 'http://localhost:8787' })).toMatchObject({
        title: 'Out of Mastra Gateway credits',
      });
      expect(describeRunError(staging, { gatewayBaseUrl: 'http://localhost:9999' })).toMatchObject({
        title: 'Provider quota exhausted',
      });
    });

    it('keeps an Anthropic 403 a credential problem', () => {
      const anthropicDenied = {
        name: 'AI_APICallError',
        message: 'Your API key does not have permission to use the specified resource.',
        statusCode: 403,
        responseBody: JSON.stringify({
          type: 'error',
          error: {
            type: 'permission_error',
            message: 'Your API key does not have permission to use the specified resource.',
          },
        }),
      };
      expect(describeRunError(anthropicDenied)).toMatchObject({
        title: 'Provider access failed',
        recoveries: ['credentials', 'model'],
      });
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

  it('leaves an unrelated error unclassified', () => {
    expect(describeRunError({ name: 'Error', message: 'Something unexpected happened' })).toEqual({
      title: 'Run stopped',
      message: 'Something unexpected happened',
      recoveries: [],
    });
  });
});
