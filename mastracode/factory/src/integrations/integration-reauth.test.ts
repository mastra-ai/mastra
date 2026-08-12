import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { IntegrationReauthRequiredError, integrationFetchError } from './base.js';
import { LinearReauthRequiredError } from './linear/integration.js';

describe('IntegrationReauthRequiredError', () => {
  it('carries integrationId and connectPath', () => {
    const err = new IntegrationReauthRequiredError('linear', '/auth/linear/connect');
    expect(err.integrationId).toBe('linear');
    expect(err.connectPath).toBe('/auth/linear/connect');
    expect(err.message).toBe('linear authorization expired. Reconnect to continue.');
  });

  it('accepts a custom message', () => {
    const err = new IntegrationReauthRequiredError('slack', '/auth/slack/connect', 'Slack token revoked.');
    expect(err.integrationId).toBe('slack');
    expect(err.message).toBe('Slack token revoked.');
  });
});

describe('LinearReauthRequiredError extends IntegrationReauthRequiredError', () => {
  it('is an instance of IntegrationReauthRequiredError', () => {
    const err = new LinearReauthRequiredError();
    expect(err).toBeInstanceOf(IntegrationReauthRequiredError);
    expect(err.integrationId).toBe('linear');
    expect(err.connectPath).toBe('/auth/linear/connect');
  });
});

describe('integrationFetchError', () => {
  function callHelper(err: unknown) {
    const app = new Hono();
    let captured: Response | undefined;
    app.get('/test', c => {
      captured = integrationFetchError(c, 'linear', '/auth/linear/connect', err);
      return captured;
    });
    return app.request('/test');
  }

  it('returns 409 with integration_reauth_required for IntegrationReauthRequiredError', async () => {
    const res = await callHelper(new LinearReauthRequiredError());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'integration_reauth_required',
      integration: 'linear',
      connectPath: '/auth/linear/connect',
    });
    expect(body.message).toContain('Linear authorization expired');
  });

  it('returns 409 for errors with status 401', async () => {
    const err = new Error('Unauthorized');
    (err as any).status = 401;
    const res = await callHelper(err);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'integration_reauth_required',
      integration: 'linear',
      connectPath: '/auth/linear/connect',
    });
  });

  it('returns 502 for other errors', async () => {
    const res = await callHelper(new Error('API timeout'));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'integration_fetch_failed',
      integration: 'linear',
      message: 'API timeout',
    });
  });

  it('returns 502 for non-Error values', async () => {
    const res = await callHelper('string error');
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'integration_fetch_failed',
      integration: 'linear',
      message: 'string error',
    });
  });
});
