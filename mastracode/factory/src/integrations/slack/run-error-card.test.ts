import { ProviderAuthRequiredError } from '@mastra/code-sdk/auth/provider-auth-error';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { slackRunErrorCard } from './run-error-card.js';

const PUBLIC_URL = 'https://factory.example.com';

function slackRun() {
  const requestContext = new RequestContext();
  requestContext.set('controller', {
    sessionId: 'session-1',
    resourceId: 'resource-1',
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
  it('links a refused model to the session, where the model can be changed', () => {
    const card = rendered(slackRunErrorCard(codexPlanRefusal(), slackRun(), PUBLIC_URL));

    expect(card).toContain('Model not available');
    expect(card).toContain("The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.");
    expect(card).toContain('Change model');
    expect(card).toContain(`${PUBLIC_URL}/factories/factory-1/workspaces/session-1/threads/thread-1`);
  });

  it('links a missing credential to the Factory model settings', () => {
    const error = new ProviderAuthRequiredError(
      "No usable openai credential is available for openai/gpt-5.5. This Factory uses organization credentials only, so personal provider sign-ins don't apply. Add an organization credential, then try again.",
    );
    const card = rendered(slackRunErrorCard(error, slackRun(), PUBLIC_URL));

    expect(card).toContain('Provider sign-in required');
    expect(card).toContain('Add an organization credential');
    expect(card).toContain('Review credentials');
    expect(card).toContain(`${PUBLIC_URL}/factories/factory-1/settings/models`);
  });

  it('opens the session for a failure nothing in settings fixes', () => {
    const card = rendered(slackRunErrorCard(new Error('Request timed out.'), slackRun(), PUBLIC_URL));

    expect(card).toContain('Request timed out');
    expect(card).toContain('Open session');
    expect(card).toContain(`${PUBLIC_URL}/factories/factory-1/workspaces/session-1/threads/thread-1`);
  });

  it('still explains the failure when the run has no Factory session or no public URL', () => {
    for (const card of [
      rendered(slackRunErrorCard(codexPlanRefusal(), { requestContext: new RequestContext() }, PUBLIC_URL)),
      rendered(slackRunErrorCard(codexPlanRefusal(), slackRun(), undefined)),
    ]) {
      expect(card).toContain('Model not available');
      expect(card).not.toContain('Change model');
      expect(card).not.toContain('https://');
    }
  });
});
