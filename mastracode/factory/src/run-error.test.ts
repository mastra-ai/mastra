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

  describe('Mastra Gateway v1 billing refusals', () => {
    // The v1 reply as the gateway sends it: a billing `type`, a `help_url`, and no `code`. The live
    // error is called without a gateway URL or `mastra/` model, so only the reply can identify it.
    const v1Refusal = (error: Record<string, string>) => ({
      name: 'AI_APICallError',
      message: error.message!,
      statusCode: 402,
      responseBody: JSON.stringify({ error }),
      requestBodyValues: { model: 'anthropic/claude-opus-4-5' },
    });
    const outOfCredits = {
      message: "You don't have inference credits left. Add credits at https://projects.mastra.ai/",
      type: 'billing_error',
      help_url: 'https://projects.mastra.ai/',
    };
    const outOfMemoryTokens = {
      message: "You don't have memory tokens left. Add credits or upgrade your plan at https://projects.mastra.ai/",
      type: 'billing_error',
      help_url: 'https://projects.mastra.ai/',
    };
    const spendLimit = {
      message: 'Your organization reached its monthly Gateway spend limit. Raise it at https://projects.mastra.ai/',
      type: 'spend_limit_reached',
      help_url: 'https://projects.mastra.ai/',
    };

    it.each([
      ['inference credits', outOfCredits],
      ['memory tokens', outOfMemoryTokens],
    ])('offers credits when %s run out, live and rebuilt from history', (_what, error) => {
      const live = v1Refusal(error);
      for (const failure of [live, toPersistedErrorIdentity(live)]) {
        expect(describeRunError(failure)).toMatchObject({
          title: 'Out of Mastra Gateway credits',
          recoveries: ['credits', 'continue', 'model'],
        });
      }
    });

    it('sends a monthly spend limit to an organization admin instead of offering credits', () => {
      const live = v1Refusal(spendLimit);
      for (const failure of [live, toPersistedErrorIdentity(live)]) {
        expect(describeRunError(failure)).toMatchObject({
          title: 'Mastra Gateway spend limit reached',
          recoveries: ['model'],
        });
      }
    });

    it('still recognizes the older replies that linked to the gateway host', () => {
      const olderSpendLimit = v1Refusal({
        message: 'Your organization reached its monthly Gateway spend limit. Raise it at https://gateway.mastra.ai/',
        type: 'spend_limit_reached',
        help_url: 'https://gateway.mastra.ai/',
      });
      expect(describeRunError(toPersistedErrorIdentity(olderSpendLimit))).toMatchObject({
        title: 'Mastra Gateway spend limit reached',
      });
    });

    it.each([
      ['a billing type with a help link elsewhere', { ...outOfCredits, help_url: 'https://billing.example.com/' }],
      ['a dashboard link in its text only', { message: outOfCredits.message, type: 'insufficient_quota' }],
      ['a look-alike help host', { ...outOfCredits, help_url: 'https://projects.mastra.ai.example.com/' }],
    ])("keeps another provider's 402 with %s a provider quota error", (_shape, error) => {
      expect(describeRunError(toPersistedErrorIdentity(v1Refusal(error)))).toMatchObject({
        title: 'Provider quota exhausted',
        recoveries: ['credentials', 'model'],
      });
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

    it.each([
      [401, 'some_new_key_reason'],
      [403, 'identity_policy_denied'],
      [403, 'byok_connection_inactive'],
    ])('keeps the credential recovery for a %i %s refusal of the key or connection', (status, code) => {
      expect(describeRunError(gatewayRefusal(status, code))).toMatchObject({
        title: 'Provider access failed',
        recoveries: ['credentials', 'model'],
      });
    });

    it('offers another model when no route in the key’s region serves it', () => {
      expect(describeRunError(gatewayRefusal(403, 'no_route_in_region'))).toMatchObject({
        title: 'Model not available through the Mastra Gateway',
        recoveries: ['model'],
      });
    });

    it('names the provider behind the gateway when it is the one limiting requests', () => {
      const limited = toPersistedErrorIdentity({
        name: 'AI_APICallError',
        message: 'Upstream provider rate limit reached. Try again shortly.',
        statusCode: 429,
        responseBody: JSON.stringify({
          error: {
            type: 'rate_limit_error',
            code: 'provider_rate_limited',
            message: 'Upstream provider rate limit reached. Try again shortly.',
          },
        }),
      });
      expect(describeRunError(limited)).toMatchObject({
        title: 'Model provider rate limit reached',
        recoveries: ['continue', 'model'],
      });
    });

    it.each(['key_budget_capacity_held', 'organization_budget_capacity_held'])(
      'asks to continue in a few seconds when %s',
      code => {
        expect(describeRunError(gatewayRefusal(429, code))).toMatchObject({
          title: 'Mastra Gateway budget busy',
          recoveries: ['continue', 'model'],
        });
      },
    );

    it('recognizes the gateway from the saved codes alone when the body is gone', () => {
      const withoutBody = {
        name: 'AI_APICallError',
        message: 'key_budget_exhausted',
        statusCode: 402,
        codes: ['gateway_error', 'key_budget_exhausted'],
      };
      expect(describeRunError(withoutBody)).toMatchObject({ title: 'Mastra Gateway spend limit reached' });
    });

    it.each([
      [
        'an OpenAI-style',
        { type: 'requests', code: 'rate_limit_exceeded', message: 'Rate limit reached for requests' },
      ],
      ['an uncoded', { message: 'rate limited', type: 'rate_limit_error', code: null }],
    ])(
      "names the provider behind the gateway, not the session's credential, for %s 429 it relayed",
      (_shape, error) => {
        const relayed = {
          name: 'AI_APICallError',
          message: error.message,
          statusCode: 429,
          url: 'https://gateway-api.mastra.ai/v1/chat/completions',
          responseBody: JSON.stringify({ error }),
        };
        expect(describeRunError(relayed)).toEqual({
          title: 'Model provider rate limit reached',
          message:
            'The model provider behind the Mastra Gateway is limiting requests. Continue shortly, or choose another model.',
          recoveries: ['continue', 'model'],
          model: undefined,
        });
      },
    );

    describe('a saved 429, rebuilt from history', () => {
      // History keeps no request URL. Versions of core that record the request's origin save it as
      // `requestOrigin`; this core does not emit it yet, so the tests add it to the real saved part.
      const saved429 = (url: string, error: Record<string, unknown>, requestOrigin?: string) => ({
        ...toPersistedErrorIdentity({
          name: 'AI_APICallError',
          message: String(error.message),
          statusCode: 429,
          url,
          responseBody: JSON.stringify({ error }),
        }),
        ...(requestOrigin ? { requestOrigin } : {}),
      });
      const gatewayLimit = {
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
        message: 'Gateway key requests limit exceeded. Retry in 12s.',
      };
      const relayedLimit = { message: 'rate limited', type: 'rate_limit_error', code: null };

      it('stays a provider rate limit without a request origin, since its type and code are shared', () => {
        const saved = saved429('https://gateway-api.mastra.ai/v1/chat/completions', gatewayLimit);
        expect(saved).not.toHaveProperty('url');
        expect(describeRunError(saved)).toMatchObject({ title: 'Provider rate limit reached' });
      });

      it("names the gateway's own limit when the request went to the production gateway", () => {
        const saved = saved429(
          'https://gateway-api.mastra.ai/v1/chat/completions',
          gatewayLimit,
          'https://gateway-api.mastra.ai',
        );
        expect(describeRunError(saved)).toMatchObject({
          title: 'Mastra Gateway rate limit reached',
          recoveries: ['continue', 'model'],
        });
      });

      it('names the provider behind the gateway for a limit the gateway relayed', () => {
        const saved = saved429(
          'https://gateway-api.mastra.ai/v1/chat/completions',
          relayedLimit,
          'https://gateway-api.mastra.ai',
        );
        expect(describeRunError(saved)).toMatchObject({
          title: 'Model provider rate limit reached',
          recoveries: ['continue', 'model'],
        });
      });

      it('recognizes a non-production gateway only when the configured origin is passed', () => {
        const saved = saved429('http://127.0.0.1:4180/v1/chat/completions', gatewayLimit, 'http://127.0.0.1:4180');
        expect(describeRunError(saved)).toMatchObject({ title: 'Provider rate limit reached' });
        expect(describeRunError(saved, { gatewayBaseUrl: 'http://127.0.0.1:4180' })).toMatchObject({
          title: 'Mastra Gateway rate limit reached',
        });
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
