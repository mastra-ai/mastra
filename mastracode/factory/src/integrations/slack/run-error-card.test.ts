import { prepareCredentialTenant, setCredentialStoreProvider } from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import { ProviderAuthRequiredError } from '@mastra/code-sdk/auth/provider-auth-error';
import type { AuthCredential } from '@mastra/code-sdk/auth/types';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { slackRunErrorCard } from './run-error-card.js';

const PUBLIC_URL = 'https://factory.example.com';
const SLACK_SESSION = 'channel:slack:C-1:1700.42';
const SLACK_SESSION_URL = `${PUBLIC_URL}/factories/factory-1/workspaces/channel/threads/thread-1?sessionId=${encodeURIComponent(SLACK_SESSION)}`;

type SlackControllerContext = Pick<
  AgentControllerRequestContext,
  'sessionId' | 'resourceId' | 'threadId' | 'getState'
> & {
  session: Pick<AgentControllerRequestContext['session'], 'modelId'>;
};

function slackRun(sessionModelId?: string) {
  const requestContext = new RequestContext();
  requestContext.set('controller', {
    sessionId: SLACK_SESSION,
    resourceId: SLACK_SESSION,
    threadId: 'thread-1',
    getState: () => ({ factoryProjectId: 'factory-1' }),
    session: { modelId: sessionModelId },
  } satisfies SlackControllerContext);
  return { requestContext };
}

const claudeSubscription: AuthCredential = { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 60_000 };

async function slackRunOn(sessionModelId: string, credentialScope: CredentialTenant['credentialScope']) {
  setCredentialStoreProvider(
    () => ({
      allowEnvironmentFallback: false,
      reload() {},
      get: provider => (provider === 'anthropic' ? claudeSubscription : undefined),
      getStoredApiKey: () => undefined,
      getApiKey: async () => undefined,
    }),
    async () => ({ orgId: 'org-1', userId: 'user-1', credentialScope }),
  );
  const run = slackRun(sessionModelId);
  await prepareCredentialTenant(run.requestContext);
  return run;
}

function accountRateLimit() {
  return Object.assign(new Error("This request would exceed your account's rate limit. Please try again later."), {
    name: 'AI_APICallError',
    statusCode: 429,
    requestBodyValues: { model: 'claude-opus-4-5' },
  });
}

function codexPlanRefusal() {
  return Object.assign(new Error('Bad Request'), {
    name: 'AI_APICallError',
    statusCode: 400,
    responseBody: JSON.stringify({
      detail: "The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.",
    }),
  });
}

function rendered(card: unknown) {
  return JSON.stringify(card);
}

describe('slackRunErrorCard', () => {
  beforeEach(() => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', PUBLIC_URL);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setCredentialStoreProvider(undefined);
  });

  it('names the organization’s subscription behind a rate limit, so nobody reconnects their own account', async () => {
    const card = rendered(
      slackRunErrorCard(accountRateLimit(), await slackRunOn('anthropic/claude-opus-4-5', 'factory')),
    );

    expect(card).toContain('Provider rate limit reached');
    expect(card).toContain('Runs on Claude Pro/Max · Shared by the organization');
  });

  it('says a rate limit hit a personal subscription when the session runs on one', async () => {
    const card = rendered(slackRunErrorCard(accountRateLimit(), await slackRunOn('anthropic/claude-opus-4-5', 'user')));

    expect(card).toContain('Runs on Claude Pro/Max · Personal credential');
  });

  it('names no credential once the session runs on a model other than the one that failed', async () => {
    const card = rendered(
      slackRunErrorCard(accountRateLimit(), await slackRunOn('anthropic/claude-sonnet-4-5', 'factory')),
    );

    expect(card).toContain('Provider rate limit reached');
    expect(card).not.toContain('Runs on');
  });

  it('links a refused model to the Slack session, where the model can be changed', () => {
    const card = rendered(slackRunErrorCard(codexPlanRefusal(), slackRun()));

    expect(card).toContain('Model not available');
    expect(card).toContain("The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.");
    expect(card).toContain('Change model');
    expect(card).toContain(SLACK_SESSION_URL);
  });

  it('offers the Factory model settings and another model for a missing credential', () => {
    const error = new ProviderAuthRequiredError(
      "No usable openai credential is available for openai/gpt-5.5. This Factory uses organization credentials only, so personal provider sign-ins don't apply. Add an organization credential, then try again.",
    );
    const card = rendered(slackRunErrorCard(error, slackRun()));

    expect(card).toContain('Provider sign-in required');
    expect(card).toContain('Add an organization credential');
    expect(card).toContain('Review credentials');
    expect(card).toContain(`${PUBLIC_URL}/factories/factory-1/settings/models`);
    expect(card).toContain('Change model');
    expect(card).toContain(SLACK_SESSION_URL);
  });

  it('names the model the provider refused the key for, without the rest of the request', () => {
    const invalidKey = Object.assign(new Error('invalid x-api-key'), {
      name: 'AI_APICallError',
      statusCode: 401,
      responseBody: JSON.stringify({
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' },
      }),
      requestBodyValues: { model: 'claude-opus-4-5', messages: [{ role: 'user', content: 'secret prompt' }] },
    });
    const card = rendered(slackRunErrorCard(invalidKey, slackRun()));

    expect(card).toContain('Provider access failed');
    expect(card).toContain('Model: claude-opus-4-5');
    expect(card).not.toContain('secret prompt');
  });

  it('keeps the provider’s sentence and request id on a quota failure, where Slack has no error details', () => {
    const weeklyLimit = Object.assign(new Error('Bad Request'), {
      name: 'AI_APICallError',
      statusCode: 400,
      responseBody: JSON.stringify({
        error: { message: 'Your weekly limit has been reached. It resets Monday at 9:00 AM.' },
      }),
      responseHeaders: { 'request-id': 'req_abc' },
    });
    const card = rendered(slackRunErrorCard(weeklyLimit, slackRun()));

    expect(card).toContain('Provider quota exhausted');
    expect(card).toContain('It resets Monday at 9:00 AM.');
    expect(card).toContain('Request id: req_abc');
    expect(card).toContain(`${PUBLIC_URL}/factories/factory-1/settings/models`);
  });

  it('explains a raw stream error frame the channel could only wrap', () => {
    const frame = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        code: 'invalid_prompt',
        message: 'Invalid value for parameter timeout.',
      },
    };
    const card = rendered(slackRunErrorCard(new Error('[object Object]', { cause: frame }), slackRun()));

    expect(card).toContain('Model request rejected');
    expect(card).toContain('Invalid value for parameter timeout.');
    expect(card).not.toContain('[object Object]');
  });

  it('keeps the request id of a provider failure the channel wrapped', () => {
    const serializedCallError = {
      name: 'AI_APICallError',
      message: 'Bad Request',
      statusCode: 400,
      responseBody: JSON.stringify({ error: { message: 'Invalid schema for function search.' } }),
      responseHeaders: { 'request-id': 'req_123' },
    };
    const wrapped = new Error('Bad Request (HTTP 400): Invalid schema for function search.', {
      cause: serializedCallError,
    });
    const card = rendered(slackRunErrorCard(wrapped, slackRun()));

    expect(card).toContain('Invalid schema for function search.');
    expect(card).toContain('Request id: req_123');
  });

  it('opens the session for a failure nothing in settings fixes', () => {
    const card = rendered(slackRunErrorCard(new Error('Request timed out.'), slackRun()));

    expect(card).toContain('Request timed out');
    expect(card).toContain('Open session');
    expect(card).toContain(SLACK_SESSION_URL);
  });

  it('still explains the failure when the run has no session or no public URL', () => {
    const withoutSession = rendered(slackRunErrorCard(codexPlanRefusal(), { requestContext: new RequestContext() }));
    vi.stubEnv('MASTRACODE_PUBLIC_URL', '');
    const withoutPublicUrl = rendered(slackRunErrorCard(codexPlanRefusal(), slackRun()));

    for (const card of [withoutSession, withoutPublicUrl]) {
      expect(card).toContain('Model not available');
      expect(card).not.toContain('Change model');
      expect(card).not.toContain('https://');
    }
  });
});
