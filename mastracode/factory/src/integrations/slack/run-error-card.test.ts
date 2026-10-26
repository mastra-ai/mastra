import { ProviderAuthRequiredError } from '@mastra/code-sdk/auth/provider-auth-error';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { slackRunErrorCard } from './run-error-card.js';

const PUBLIC_URL = 'https://factory.example.com';
const SLACK_SESSION = 'channel:slack:C-1:1700.42';
const SLACK_SESSION_URL = `${PUBLIC_URL}/factories/factory-1/workspaces/channel/threads/thread-1?sessionId=${encodeURIComponent(SLACK_SESSION)}`;

function slackRun() {
  const requestContext = new RequestContext();
  requestContext.set('controller', {
    sessionId: SLACK_SESSION,
    resourceId: SLACK_SESSION,
    threadId: 'thread-1',
    getState: () => ({ factoryProjectId: 'factory-1' }),
  });
  return { requestContext };
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
  });

  it('links a refused model to the Slack session, where the model can be changed', () => {
    const card = rendered(slackRunErrorCard(codexPlanRefusal(), slackRun()));

    expect(card).toContain('Model not available');
    expect(card).toContain("The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.");
    expect(card).toContain('Change model');
    expect(card).toContain(SLACK_SESSION_URL);
  });

  it('links a missing credential to the Factory model settings', () => {
    const error = new ProviderAuthRequiredError(
      "No usable openai credential is available for openai/gpt-5.5. This Factory uses organization credentials only, so personal provider sign-ins don't apply. Add an organization credential, then try again.",
    );
    const card = rendered(slackRunErrorCard(error, slackRun()));

    expect(card).toContain('Provider sign-in required');
    expect(card).toContain('Add an organization credential');
    expect(card).toContain('Review credentials');
    expect(card).toContain(`${PUBLIC_URL}/factories/factory-1/settings/models`);
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
