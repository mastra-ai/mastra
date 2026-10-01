import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { safeUpstreamErrorForLog } from './safe-upstream-error';

describe('safeUpstreamErrorForLog', () => {
  it('omits provider request, response, header, and URL data', () => {
    const error = new APICallError({
      message: 'provider echoed secret-response-body',
      url: 'https://provider.example.test/models?key=secret-query-key',
      requestBodyValues: { prompt: 'private prompt', authorization: 'secret-request-token' },
      statusCode: 429,
      responseHeaders: {
        authorization: 'Bearer secret-header-token',
        'set-cookie': 'provider-session=secret-cookie',
        'x-provider-session-state': 'secret-session-state',
      },
      responseBody: 'secret-response-body',
      isRetryable: true,
    });

    const safe = safeUpstreamErrorForLog(error);

    expect(safe).toEqual({
      name: 'AI_APICallError',
      message: 'Upstream provider request failed.',
      statusCode: 429,
      isRetryable: true,
    });
    expect(JSON.stringify(safe)).not.toMatch(/secret|authorization|cookie|prompt|session-state/i);
  });
});
