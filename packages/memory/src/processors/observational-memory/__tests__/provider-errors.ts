import { APICallError } from '@internal/ai-sdk-v5';

// Errors as the providers sent them in production. OpenAI answers an account with no credits
// left with HTTP 429, the same status as a rate limit, so only the body tells them apart.

export function openAiNoCredits() {
  return new APICallError({
    message:
      'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({
      error: { message: 'You have no credits remaining.', type: 'insufficient_quota', code: 'insufficient_quota' },
    }),
  });
}

export function anthropicRateLimit() {
  return new APICallError({
    message: "This request would exceed your account's rate limit. Please try again later.",
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({ type: 'error', error: { type: 'rate_limit_error' } }),
  });
}

export function gatewayUpstreamRateLimit() {
  return new APICallError({
    message:
      'Upstream provider rate limit reached. Try again shortly. Manage gateway keys, credits and budgets: https://projects.mastra.ai/',
    url: 'https://gateway.mastra.ai/v1/chat/completions',
    requestBodyValues: {},
    statusCode: 429,
  });
}

export function openAiRateLimit() {
  return new APICallError({
    message:
      'Rate limit reached for gpt-5.4-mini in organization org-test on tokens per min (TPM): Limit 200000, Used 199500, Requested 1200. Please try again in 210ms.',
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({
      error: { message: 'Rate limit reached for gpt-5.4-mini', type: 'tokens', code: 'rate_limit_exceeded' },
    }),
  });
}
