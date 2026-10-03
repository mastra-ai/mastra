import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationAuthField } from './api.js';
import {
  authFieldKey,
  authFieldsFor,
  isAuthFieldVisible,
  isCredentialAuthType,
  isOAuthAuthType,
  oauthConnectUrl,
  splitAuthValues,
  submitCredentialAuth,
} from './nango.js';

function field(overrides: Partial<IntegrationAuthField> & Pick<IntegrationAuthField, 'name'>): IntegrationAuthField {
  return {
    target: 'credentials',
    label: overrides.name,
    description: null,
    placeholder: null,
    defaultValue: null,
    options: null,
    documentationUrl: null,
    visibleWhen: null,
    secret: false,
    required: true,
    order: 0,
    ...overrides,
  };
}

describe('auth type routing', () => {
  it('treats OAuth variants as browser flows', () => {
    for (const authType of ['OAUTH1', 'OAUTH2', 'MCP_OAUTH2', 'MCP_OAUTH2_GENERIC']) {
      expect(isOAuthAuthType(authType)).toBe(true);
    }
    expect(isOAuthAuthType('API_KEY')).toBe(false);
    expect(isOAuthAuthType(null)).toBe(false);
  });

  it('treats API key and Basic as terminal credential flows', () => {
    expect(isCredentialAuthType('API_KEY')).toBe(true);
    expect(isCredentialAuthType('BASIC')).toBe(true);
    expect(isCredentialAuthType('OAUTH2')).toBe(false);
    expect(isCredentialAuthType('TWO_STEP')).toBe(false);
  });
});

describe('authFieldsFor', () => {
  it('prefers catalog authFields, sorted by order', () => {
    const fields = [field({ name: 'b', order: 1 }), field({ name: 'a', order: 0 })];
    expect(authFieldsFor('API_KEY', fields).map(f => f.name)).toEqual(['a', 'b']);
  });

  it('falls back to a default API key field', () => {
    const fields = authFieldsFor('API_KEY', []);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ name: 'apiKey', target: 'credentials', secret: true, required: true });
  });

  it('falls back to default username/password fields for Basic', () => {
    expect(authFieldsFor('BASIC', []).map(f => f.name)).toEqual(['username', 'password']);
  });

  it('returns no fields for plain OAuth', () => {
    expect(authFieldsFor('OAUTH2', [])).toEqual([]);
    expect(authFieldsFor(null, [])).toEqual([]);
  });
});

describe('field visibility and splitting', () => {
  const region = field({ name: 'region', target: 'params' });
  const euHost = field({
    name: 'host',
    target: 'params',
    visibleWhen: { field: 'region', equals: 'eu' },
  });
  const apiKey = field({ name: 'apiKey', secret: true });

  it('hides fields whose controlling value does not match', () => {
    const fields = [region, euHost, apiKey];
    expect(isAuthFieldVisible(fields, euHost, { [authFieldKey(region)]: 'us' })).toBe(false);
    expect(isAuthFieldVisible(fields, euHost, { [authFieldKey(region)]: 'eu' })).toBe(true);
    expect(isAuthFieldVisible(fields, apiKey, {})).toBe(true);
  });

  it('splits values into credentials and params, dropping hidden fields', () => {
    const fields = [region, euHost, apiKey];
    const values = {
      [authFieldKey(region)]: 'us',
      [authFieldKey(euHost)]: 'https://eu.example.com',
      [authFieldKey(apiKey)]: 'sk-123',
    };
    expect(splitAuthValues(fields, values)).toEqual({
      credentials: { apiKey: 'sk-123' },
      params: { region: 'us' },
    });
  });

  it('omits empty groups entirely', () => {
    expect(splitAuthValues([apiKey], {})).toEqual({ credentials: undefined, params: undefined });
  });
});

describe('oauthConnectUrl', () => {
  it('builds the Nango consent URL with the session token', () => {
    expect(oauthConnectUrl('linear', 'tok_123')).toBe(
      'https://api.nango.dev/oauth/connect/linear?connect_session_token=tok_123',
    );
  });

  it('appends params the provider needs before consent', () => {
    expect(oauthConnectUrl('neon', 'tok', { serverUrl: 'https://mcp.example.com/sse' })).toBe(
      'https://api.nango.dev/oauth/connect/neon?connect_session_token=tok&params[serverUrl]=https%3A%2F%2Fmcp.example.com%2Fsse',
    );
  });
});

describe('submitCredentialAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts API keys to the api-key endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    await submitCredentialAuth({ integrationId: 'resend', sessionToken: 'tok', credentials: { apiKey: 'sk-1' } });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.nango.dev/api-auth/api-key/resend?connect_session_token=tok',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ apiKey: 'sk-1' }) }),
    );
  });

  it('posts username/password to the basic endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    await submitCredentialAuth({
      integrationId: 'jira',
      sessionToken: 'tok',
      credentials: { username: 'u', password: 'pw' },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.nango.dev/api-auth/basic/jira?connect_session_token=tok',
      expect.anything(),
    );
  });

  it('maps connection_test_failed to a friendly error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'connection_test_failed', message: 'nope' } }), { status: 400 }),
    );
    await expect(
      submitCredentialAuth({ integrationId: 'resend', sessionToken: 'tok', credentials: { apiKey: 'bad' } }),
    ).rejects.toThrow('The provider rejected these credentials. Check them and try again.');
  });

  it('surfaces the Nango error message otherwise', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'unknown_err', message: 'integration not found' } }), {
        status: 404,
      }),
    );
    await expect(
      submitCredentialAuth({ integrationId: 'ghost', sessionToken: 'tok', credentials: { apiKey: 'k' } }),
    ).rejects.toThrow('integration not found');
  });
});
