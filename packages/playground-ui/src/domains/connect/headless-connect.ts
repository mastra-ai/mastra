import Nango, { AuthError } from '@nangohq/frontend';
import type { AuthOptions, ConnectionConfig } from '@nangohq/frontend';

import type { UserConnectAuthField, UserConnectProvider } from './types';

/**
 * Headless Nango authorization for the end-user connect surface, ported from
 * the platform dashboard's `headless-connect` lib so Studio and the platform
 * share one flow. Keyed by the connect session token the launch gate releases
 * to the proven owner — never by a vendor URL, so no Nango-branded page is
 * ever shown.
 */

// Auth types the browser can complete without Nango's hosted Connect UI.
// For OAuth (including MCP, which is OAuth 2 under the hood, and CUSTOM —
// Nango's OAuth-plus-extra-config scheme) and GitHub App installs (`APP`),
// `nango.auth()` opens the provider's own consent or install popup directly.
// Flow params the provider needs first (e.g. an MCP server URL) come from
// `authFields` and are collected in our own form before `nango.auth()` runs.
// For API key / Basic auth we collect the values ourselves and submit them
// through `nango.auth()` — no popup at all. Anything else still needs the
// forms the hosted Connect UI renders, so it keeps going through the launch
// gate's 302.
const POPUP_AUTH_TYPES = new Set(['OAUTH1', 'OAUTH2', 'MCP_OAUTH2', 'MCP_OAUTH2_GENERIC', 'APP', 'CUSTOM']);

// Two-step providers exchange user-supplied credentials against the
// provider's token endpoint. The fields come entirely from the catalog
// schema, so the flow is headless only when the catalog exposes a
// credentials field — otherwise the SDK would treat the call as OAuth and
// open its own popup.
const CREDENTIAL_SCHEMA_AUTH_TYPES = new Set(['TWO_STEP']);

const API_KEY_FIELDS: UserConnectAuthField[] = [
  {
    name: 'apiKey',
    target: 'credentials',
    label: 'API key',
    placeholder: 'Paste your API key',
    secret: true,
    required: true,
    order: 0,
  },
];

const BASIC_FIELDS: UserConnectAuthField[] = [
  {
    name: 'username',
    target: 'credentials',
    label: 'Username',
    placeholder: 'Enter your username',
    secret: false,
    required: true,
    order: 0,
  },
  {
    name: 'password',
    target: 'credentials',
    label: 'Password',
    placeholder: 'Enter your password',
    secret: true,
    required: true,
    order: 1,
  },
];

const CREDENTIAL_FIELDS_BY_AUTH_TYPE = new Map<string, UserConnectAuthField[]>([
  ['API_KEY', API_KEY_FIELDS],
  ['BASIC', BASIC_FIELDS],
]);

function fieldTarget(field: UserConnectAuthField): 'credentials' | 'params' {
  // Older servers don't send `target`; a collected value without one is a
  // credential (the common case for API key / Basic fields).
  return field.target ?? 'credentials';
}

export function supportsHeadlessAuth(
  authType: string | null | undefined,
  authFields?: readonly UserConnectAuthField[] | null,
): boolean {
  if (authType == null) return false;
  if (CREDENTIAL_SCHEMA_AUTH_TYPES.has(authType)) {
    // Params-only fields produce no credentials, and the SDK treats a
    // credential-less TWO_STEP auth call as OAuth — it would open its own
    // popup instead of exchanging tokens. Require a credentials field.
    return authFields?.some(field => fieldTarget(field) === 'credentials') ?? false;
  }
  return POPUP_AUTH_TYPES.has(authType) || CREDENTIAL_FIELDS_BY_AUTH_TYPE.has(authType);
}

/** The fields to collect before authorizing, catalog first, synthesized for API key / Basic. */
export function headlessAuthFields(
  provider: Partial<Pick<UserConnectProvider, 'authType' | 'authFields'>>,
): UserConnectAuthField[] {
  if (provider.authFields && provider.authFields.length > 0) return provider.authFields;
  if (provider.authType == null) return [];
  return CREDENTIAL_FIELDS_BY_AUTH_TYPE.get(provider.authType) ?? [];
}

/**
 * True when the flow needs user-collected fields before `nango.auth()` can
 * run (API key / Basic / two-step credentials, required flow params). A caller
 * without a form falls back to the hosted flow, whose page renders them.
 */
export function headlessAuthRequiresForm(
  provider: Partial<Pick<UserConnectProvider, 'authType' | 'authFields'>>,
): boolean {
  return headlessAuthFields(provider).some(field => !!field.required);
}

export interface HeadlessAuthValues {
  credentials?: Record<string, string>;
  params?: Record<string, string>;
}

export function headlessAuthFieldKey(field: UserConnectAuthField): string {
  return `${fieldTarget(field)}:${field.name}`;
}

/** Splits collected form values into the SDK's credentials vs flow params. */
export function splitHeadlessAuthValues(
  fields: UserConnectAuthField[],
  values: Record<string, string>,
): HeadlessAuthValues {
  const credentials: Record<string, string> = {};
  const params: Record<string, string> = {};

  for (const field of fields) {
    const value = values[headlessAuthFieldKey(field)];
    if (!value) continue;
    if (fieldTarget(field) === 'credentials') credentials[field.name] = value;
    else params[field.name] = value;
  }

  return {
    credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

export interface HeadlessAuthHandle {
  /** Resolves when the user completes the provider's consent screen. */
  result: Promise<void>;
  /** Closes the provider popup, e.g. when the user cancels the flow. */
  close: () => void;
}

export type HeadlessAuthFailure = 'popup_blocked' | 'window_closed' | 'failed';

export class HeadlessAuthError extends Error {
  constructor(
    message: string,
    readonly reason: HeadlessAuthFailure,
  ) {
    super(message);
    this.name = 'HeadlessAuthError';
  }
}

/**
 * Starts a headless Nango auth flow keyed by the session token the launch
 * gate released. For OAuth this opens the provider's consent popup and
 * reports the outcome Nango echoes back over its websocket channel. When
 * `credentials` are provided (API key / Basic / two-step) no popup opens —
 * the SDK submits the credentials to Nango, which validates them with the
 * provider.
 */
export function startHeadlessAuth(input: {
  sessionToken: string;
  integrationId: string;
  authType?: string | null;
  credentials?: Record<string, string>;
  params?: Record<string, string>;
}): HeadlessAuthHandle {
  if (input.authType != null && CREDENTIAL_SCHEMA_AUTH_TYPES.has(input.authType) && !input.credentials) {
    // Without credentials the SDK would route this through its OAuth popup
    // instead of the token-exchange endpoint. Fail fast instead.
    return {
      result: Promise.reject(new HeadlessAuthError('Enter the provider credentials to connect.', 'failed')),
      close: () => {},
    };
  }
  const nango = new Nango({ connectSessionToken: input.sessionToken });
  const options: AuthOptions = {};
  const credentials = headlessCredentials(input.authType ?? undefined, input.credentials);
  if (credentials) options.credentials = credentials;
  if (input.params) options.params = input.params;
  if (!input.credentials) options.detectClosedAuthWindow = true;
  const result = nango
    .auth(input.integrationId, options)
    .then(() => undefined)
    .catch((error: unknown) => {
      throw toHeadlessAuthError(error);
    });
  return { result, close: () => nango.win?.close() };
}

function headlessCredentials(
  authType: string | undefined,
  credentials: Record<string, string> | undefined,
): ConnectionConfig['credentials'] | undefined {
  if (!credentials) return undefined;
  // Two-step credentials need the discriminator so the SDK routes them to
  // Nango's `/auth/two-step` endpoint instead of the API-key/Basic paths.
  if (authType === 'TWO_STEP') return { type: 'TWO_STEP', ...credentials };
  return credentials;
}

function toHeadlessAuthError(error: unknown): HeadlessAuthError {
  if (error instanceof AuthError && error.type === 'blocked_by_browser') {
    return new HeadlessAuthError('Popup was blocked. Allow popups for this site and try again.', 'popup_blocked');
  }
  if (error instanceof AuthError && error.type === 'window_closed') {
    return new HeadlessAuthError('Authorization window was closed before the connection finished.', 'window_closed');
  }
  if (error instanceof AuthError && error.type === 'connection_test_failed') {
    return new HeadlessAuthError('The provider rejected these credentials. Check them and try again.', 'failed');
  }
  const message = error instanceof Error && error.message ? error.message : 'Could not authorize this connection.';
  return new HeadlessAuthError(message, 'failed');
}
