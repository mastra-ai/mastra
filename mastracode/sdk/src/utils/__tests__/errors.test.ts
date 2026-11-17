import { describe, expect, it } from 'vitest';

import { ProviderAuthRequiredError } from '../../auth/provider-auth-error.js';
import { parseError } from '../errors.js';

describe('parseError', () => {
  it('classifies a provider credential failure as auth without rewriting its message', () => {
    const parsed = parseError(new ProviderAuthRequiredError('Not logged in to Anthropic.'));

    expect(parsed.type).toBe('auth');
    expect(parsed.message).toBe('Not logged in to Anthropic.');
  });

  it('classifies a credential failure that reached the host as a flattened wire payload', () => {
    const parsed = parseError({ name: 'ProviderAuthRequiredError', message: 'Not logged in to Anthropic.' });

    expect(parsed.type).toBe('auth');
    expect(parsed.message).toBe('Not logged in to Anthropic.');
    expect(parsed.retryable).toBe(false);
  });

  it('preserves useful detail for network-style errors', () => {
    const error = new Error('fetch failed: socket hang up');

    const parsed = parseError(error);

    expect(parsed.type).toBe('network');
    expect(parsed.message).toBe('Network error while contacting the provider or gateway.');
    expect(parsed.detail).toBe('fetch failed: socket hang up');
  });

  it('prefers the cause message when available', () => {
    const error = new Error('fetch failed') as Error & { cause?: unknown };
    error.cause = new Error('self-signed certificate in certificate chain');

    const parsed = parseError(error);

    expect(parsed.type).toBe('network');
    expect(parsed.detail).toBe('self-signed certificate in certificate chain');
  });

  it('includes the request URL when available', () => {
    const error = Object.assign(new Error('authentication failed'), {
      requestUrl: 'https://server.mastra.ai/v1/messages',
    });

    const parsed = parseError(error);

    expect(parsed.type).toBe('auth');
    expect(parsed.requestUrl).toBe('https://server.mastra.ai/v1/messages');
  });

  it('includes the request URL for access denied errors', () => {
    const error = Object.assign(new Error('forbidden'), {
      status: 403,
      requestUrl: 'https://gateway-api.mastra.ai/v1/responses',
    });

    const parsed = parseError(error);

    expect(parsed.type).toBe('auth');
    expect(parsed.message).toBe('Access denied. You may not have permission to use this model.');
    expect(parsed.requestUrl).toBe('https://gateway-api.mastra.ai/v1/responses');
  });

  it('classifies an exhausted quota apart from a rate limit, without a retry delay', () => {
    const error = Object.assign(new Error('You exceeded your current quota, please check your plan and billing.'), {
      statusCode: 429,
    });

    const parsed = parseError(error);

    expect(parsed.type).toBe('quota');
    expect(parsed.retryable).toBe(false);
    expect(parsed.retryDelay).toBeUndefined();
  });

  it('classifies a context overflow named only in the provider body', () => {
    const error = Object.assign(new Error('Bad Request'), {
      statusCode: 400,
      responseBody: '{"error":{"code":"context_length_exceeded","message":"Input exceeds the context window."}}',
    });

    expect(parseError(error).type).toBe('context_length');
  });

  it.each([
    ['usage-limit wording under a numeric status 503', { status: 503 }, 'Your weekly limit has been reached'],
    ['auth wording under a provider outage', { statusCode: 503 }, 'Upstream authentication service unavailable'],
  ])('retries %s as a server error', (_label, status, message) => {
    const parsed = parseError(Object.assign(new Error(message), status));

    expect(parsed.type).toBe('server_error');
    expect(parsed.retryable).toBe(true);
  });

  it("surfaces the provider's wording for a Claude safety rejection", () => {
    const error = Object.assign(
      new Error(
        'Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowed by our safety system.',
      ),
      { statusCode: 400, requestUrl: 'https://api.anthropic.com/v1/messages' },
    );

    const parsed = parseError(error);

    expect(parsed.type).toBe('content_filter');
    expect(parsed.message).toContain('safety system blocked this request');
    expect(parsed.detail).toContain('rejected as a result of our safety system');
    expect(parsed.requestUrl).toBe('https://api.anthropic.com/v1/messages');
  });

  it("keeps the provider's safety wording when the rejection has a generic cause", () => {
    const providerMessage = 'Your request was rejected as a result of our safety system.';
    const error = new Error(providerMessage, { cause: new Error('Bad Request') });

    const parsed = parseError(error);

    expect(parsed.type).toBe('content_filter');
    expect(parsed.detail).toBe(providerMessage);
  });

  describe('Mastra Gateway refusals', () => {
    const gatewayBaseUrl = 'https://gateway.example.test';

    // The provider SDKs set `data` to the body as their own error schema parsed it, which keeps only
    // the fields that schema declares, and `responseBody` to the raw text.
    it('keeps the gateway code that a provider error schema dropped from the parsed data', () => {
      const responseBody = JSON.stringify({
        type: 'error',
        error: {
          type: 'gateway_error',
          code: 'organization_budget_insufficient',
          message: 'The budget cannot cover this request.',
        },
      });
      const error = Object.assign(new Error('The budget cannot cover this request.'), {
        statusCode: 402,
        url: `${gatewayBaseUrl}/v1/messages`,
        data: { type: 'error', error: { type: 'gateway_error', message: 'The budget cannot cover this request.' } },
        responseBody,
      });

      const parsed = parseError(error, { gatewayBaseUrl });

      expect(parsed.source).toBe('gateway');
      expect(parsed.detail).toBe('The budget cannot cover this request. (organization_budget_insufficient)');
    });

    it('recognises a gateway refusal whose parsed data lost the gateway marker', () => {
      const error = Object.assign(new Error('no_eligible_route'), {
        statusCode: 403,
        url: `${gatewayBaseUrl}/v1/chat/completions`,
        data: { error: { message: 'no_eligible_route' } },
        responseBody: JSON.stringify({
          error: { type: 'gateway_error', code: 'no_eligible_route', message: 'no_eligible_route' },
        }),
      });

      const parsed = parseError(error, { gatewayBaseUrl });

      expect(parsed.source).toBe('gateway');
      expect(parsed.detail).toBe('no_eligible_route');
    });

    it('reads the gateway marker from parsed data when no raw body is kept', () => {
      const error = Object.assign(new Error('no_eligible_route'), {
        statusCode: 403,
        url: `${gatewayBaseUrl}/v1/chat/completions`,
        data: { error: { type: 'gateway_error', code: 'no_eligible_route', message: 'no_eligible_route' } },
      });

      expect(parseError(error, { gatewayBaseUrl }).source).toBe('gateway');
    });

    it('keeps provider wording when both the parsed data and the raw body carry a provider type', () => {
      const body = {
        error: {
          type: 'request_forbidden',
          code: 'unsupported_country_region_territory',
          message: 'Country not supported',
        },
      };
      const error = Object.assign(new Error('Country not supported'), {
        statusCode: 403,
        url: `${gatewayBaseUrl}/v1/responses`,
        data: body,
        responseBody: JSON.stringify(body),
      });

      expect(parseError(error, { gatewayBaseUrl }).source).toBeUndefined();
    });

    function gatewayError(status: number, code: string, message = code, url = `${gatewayBaseUrl}/v1/chat/completions`) {
      return Object.assign(new Error(message), {
        statusCode: status,
        url,
        responseBody: JSON.stringify({ error: { type: 'gateway_error', code, message } }),
      });
    }

    it('words a gateway 402 as a credit or budget refusal and keeps the gateway code', () => {
      const parsed = parseError(gatewayError(402, 'organization_budget_unbounded_request'), { gatewayBaseUrl });

      expect(parsed.type).toBe('quota');
      expect(parsed.source).toBe('gateway');
      expect(parsed.message).toBe('The Mastra Gateway refused this request because of your credits or a budget.');
      expect(parsed.message).not.toContain('provider account');
      expect(parsed.detail).toBe('organization_budget_unbounded_request');
      expect(parsed.retryable).toBe(false);
    });

    it('shows a readable gateway message alongside its code', () => {
      const parsed = parseError(
        gatewayError(402, 'organization_budget_insufficient', 'The organization budget cannot cover this request.'),
        { gatewayBaseUrl: `${gatewayBaseUrl}/v1/` },
      );

      expect(parsed.detail).toBe(
        'The organization budget cannot cover this request. (organization_budget_insufficient)',
      );
    });

    it.each(['no_eligible_route', 'model_not_allowed'])(
      'words a gateway 403 %s as a policy or routing refusal',
      code => {
        const parsed = parseError(gatewayError(403, code), { gatewayBaseUrl });

        expect(parsed.type).toBe('auth');
        expect(parsed.source).toBe('gateway');
        expect(parsed.message).toBe(
          "The Mastra Gateway's policy or routing does not allow this model or feature for your key.",
        );
        expect(parsed.detail).toBe(code);
      },
    );

    it('reads the gateway status and body from a wrapped cause', () => {
      const error = new Error('Agent stream failed', { cause: gatewayError(402, 'organization_credits_exhausted') });

      const parsed = parseError(error, { gatewayBaseUrl });

      expect(parsed.source).toBe('gateway');
      expect(parsed.detail).toBe('organization_credits_exhausted');
    });

    it('keeps the provider wording for the same errors from another origin', () => {
      const quota = parseError(
        gatewayError(402, 'insufficient_quota', 'Payment Required', 'https://api.openai.com/v1/responses'),
        {
          gatewayBaseUrl,
        },
      );
      const denied = parseError(
        gatewayError(403, 'permission_denied', 'forbidden', 'https://api.anthropic.com/v1/messages'),
        {
          gatewayBaseUrl,
        },
      );

      expect(quota.source).toBeUndefined();
      expect(quota.message).toBe('Usage quota exhausted for this provider account.');
      expect(denied.source).toBeUndefined();
      expect(denied.message).toBe('Access denied. You may not have permission to use this model.');
    });

    it.each([
      [403, 'request_forbidden', 'unsupported_country_region_territory'],
      [402, 'invalid_request_error', 'insufficient_quota'],
    ])('keeps the provider wording for a provider %i the gateway forwarded with type %s', (status, type, code) => {
      const error = Object.assign(new Error(code), {
        statusCode: status,
        url: `${gatewayBaseUrl}/v1/responses`,
        responseBody: JSON.stringify({ error: { type, code, message: code } }),
      });

      const parsed = parseError(error, { gatewayBaseUrl });

      expect(parsed.source).toBeUndefined();
      expect(parsed.message).not.toContain('Mastra Gateway');
    });

    it('words a gateway 403 from the messages endpoint, which sends the code as the message', () => {
      const error = Object.assign(new Error('model_not_allowed'), {
        statusCode: 403,
        url: `${gatewayBaseUrl}/v1/messages`,
        responseBody: JSON.stringify({ type: 'error', error: { type: 'gateway_error', message: 'model_not_allowed' } }),
      });

      const parsed = parseError(error, { gatewayBaseUrl });

      expect(parsed.source).toBe('gateway');
      expect(parsed.detail).toBe('model_not_allowed');
    });

    it('keeps the access-denied wording for a gateway 403 without a gateway code', () => {
      const error = Object.assign(new Error('forbidden'), {
        status: 403,
        requestUrl: `${gatewayBaseUrl}/v1/responses`,
      });

      const parsed = parseError(error, { gatewayBaseUrl });

      expect(parsed.source).toBeUndefined();
      expect(parsed.message).toBe('Access denied. You may not have permission to use this model.');
    });
  });
});
