import type { IntegrationAuthField } from './api.js';

/**
 * Headless Nango auth for the CLI, ported from the platform frontend's
 * `headless-connect.ts`.
 *
 * For OAuth (including MCP, which is OAuth 2 under the hood) Nango exposes a
 * plain URL — `/oauth/connect/:integrationId?connect_session_token=…` — that
 * redirects straight to the provider's own consent screen, so the CLI opens
 * it in the user's browser with no intermediate Nango-branded page. Any
 * params the provider needs first (e.g. an MCP server URL) come from
 * `authFields` and are collected in the terminal before the browser opens.
 *
 * For API key / Basic auth no browser is involved at all: the credentials are
 * POSTed to Nango's `/api-auth/*` endpoints keyed by the connect session
 * token, and Nango validates them with the provider.
 *
 * Remaining auth types (two-step, app, …) still need the forms and setup
 * guides Nango's hosted Connect UI renders, so the CLI falls back to opening
 * the session's `connectUrl`.
 */

export const NANGO_HOST = process.env.MASTRA_NANGO_HOST || 'https://api.nango.dev';

const OAUTH_AUTH_TYPES = new Set(['OAUTH1', 'OAUTH2', 'MCP_OAUTH2', 'MCP_OAUTH2_GENERIC']);

const DEFAULT_FIELD: Omit<IntegrationAuthField, 'name' | 'target' | 'label' | 'placeholder' | 'secret' | 'order'> = {
  description: null,
  defaultValue: null,
  options: null,
  documentationUrl: null,
  visibleWhen: null,
  required: true,
};

const CREDENTIAL_FIELDS_BY_AUTH_TYPE = new Map<string, IntegrationAuthField[]>([
  [
    'API_KEY',
    [
      {
        ...DEFAULT_FIELD,
        name: 'apiKey',
        target: 'credentials',
        label: 'API key',
        placeholder: 'Paste your API key',
        secret: true,
        order: 0,
      },
    ],
  ],
  [
    'BASIC',
    [
      {
        ...DEFAULT_FIELD,
        name: 'username',
        target: 'credentials',
        label: 'Username',
        placeholder: 'Enter your username',
        secret: false,
        order: 0,
      },
      {
        ...DEFAULT_FIELD,
        name: 'password',
        target: 'credentials',
        label: 'Password',
        placeholder: 'Enter your password',
        secret: true,
        order: 1,
      },
    ],
  ],
]);

export function isOAuthAuthType(authType: string | null): boolean {
  return authType !== null && OAUTH_AUTH_TYPES.has(authType);
}

export function isCredentialAuthType(authType: string | null): boolean {
  return authType !== null && CREDENTIAL_FIELDS_BY_AUTH_TYPE.has(authType);
}

/** The form fields to collect before auth can start. */
export function authFieldsFor(authType: string | null, authFields: IntegrationAuthField[]): IntegrationAuthField[] {
  if (authFields.length > 0) return [...authFields].sort((a, b) => a.order - b.order);
  if (authType === null) return [];
  return CREDENTIAL_FIELDS_BY_AUTH_TYPE.get(authType) ?? [];
}

export function isAuthFieldVisible(
  fields: IntegrationAuthField[],
  field: IntegrationAuthField,
  values: Readonly<Record<string, string | undefined>>,
): boolean {
  if (!field.visibleWhen) return true;
  const controlling =
    fields.find(candidate => candidate.target === field.target && candidate.name === field.visibleWhen?.field) ??
    fields.find(candidate => candidate.name === field.visibleWhen?.field);
  if (!controlling) return false;
  return values[authFieldKey(controlling)] === field.visibleWhen.equals;
}

/** Fields can share a name across targets, so values are keyed by both. */
export function authFieldKey(field: IntegrationAuthField): string {
  return `${field.target}:${field.name}`;
}

export interface HeadlessAuthValues {
  credentials?: Record<string, string>;
  params?: Record<string, string>;
}

export function splitAuthValues(fields: IntegrationAuthField[], values: Record<string, string>): HeadlessAuthValues {
  const credentials: Record<string, string> = {};
  const params: Record<string, string> = {};

  for (const field of fields) {
    if (!isAuthFieldVisible(fields, field, values)) continue;
    const value = values[authFieldKey(field)];
    if (!value) continue;
    if (field.target === 'credentials') credentials[field.name] = value;
    else params[field.name] = value;
  }

  return {
    credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

function connectQuery(sessionToken: string, params?: Record<string, string>): string {
  const query = [`connect_session_token=${encodeURIComponent(sessionToken)}`];
  for (const [name, value] of Object.entries(params ?? {})) {
    query.push(`params[${encodeURIComponent(name)}]=${encodeURIComponent(value)}`);
  }
  return `?${query.join('&')}`;
}

/**
 * The URL that sends the user straight to the provider's consent screen.
 * Same URL Nango's frontend SDK opens in its OAuth popup; completion is
 * detected by polling the platform's connection list rather than the SDK's
 * websocket channel.
 */
export function oauthConnectUrl(integrationId: string, sessionToken: string, params?: Record<string, string>): string {
  return `${NANGO_HOST}/oauth/connect/${encodeURIComponent(integrationId)}${connectQuery(sessionToken, params)}`;
}

/**
 * Submit API key / Basic credentials to Nango, mirroring the frontend SDK's
 * `customAuth` fetch for the two credential shapes the CLI supports.
 */
export async function submitCredentialAuth(input: {
  integrationId: string;
  authType: string | null;
  sessionToken: string;
  credentials: Record<string, string>;
  params?: Record<string, string>;
}): Promise<void> {
  const path = input.authType === 'API_KEY' ? 'api-auth/api-key' : 'api-auth/basic';
  const url = `${NANGO_HOST}/${path}/${encodeURIComponent(input.integrationId)}${connectQuery(input.sessionToken, input.params)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.credentials),
  });
  if (!resp.ok) {
    const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
    if (body.error?.code === 'connection_test_failed') {
      throw new Error('The provider rejected these credentials. Check them and try again.');
    }
    throw new Error(body.error?.message || 'Could not authorize this connection.');
  }
}
