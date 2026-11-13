import Nango, { AuthError } from '@nangohq/frontend';
import type { AuthOptions, ConnectionConfig } from '@nangohq/frontend';

import type { UserConnectAuthField } from './types';

/**
 * Headless Nango authorization, shared by Studio's end-user connect surface
 * and the platform dashboard (which imports it from here). Keyed by a
 * Nango connect session token, never by a vendor URL, so no Nango-branded
 * page is ever shown.
 */

// Auth types the browser can complete without Nango's hosted Connect UI.
// For OAuth (including MCP, which is OAuth 2 under the hood, and CUSTOM —
// Nango's OAuth-plus-extra-config scheme) and GitHub App installs (`APP`),
// `nango.auth()` opens the provider's own consent or install popup directly.
// Flow params the provider needs first (e.g. an MCP server URL) come from
// `authFields` and are collected in our own form before `nango.auth()` runs.
// For API key / Basic / OAuth client credentials we collect the values
// ourselves and submit them through `nango.auth()` — no popup at all.
// Providers without auth (`NONE`) are created directly. Anything else still
// needs the forms the hosted Connect UI renders, so it keeps going through
// the launch gate's 302.
const POPUP_AUTH_TYPES = new Set(['OAUTH1', 'OAUTH2', 'MCP_OAUTH2', 'MCP_OAUTH2_GENERIC', 'APP', 'CUSTOM']);

// Providers that need no user authentication. `nango.auth()` would open an
// OAuth popup for them, so `startHeadlessAuth` calls `nango.create()` instead.
const UNAUTHENTICATED_AUTH_TYPES = new Set(['NONE']);

// Two-step providers exchange user-supplied credentials against the
// provider's token endpoint. The fields come entirely from the catalog
// schema, so the flow is headless only when the catalog exposes a
// credentials field — otherwise the SDK would treat the call as OAuth and
// open its own popup.
const CREDENTIAL_SCHEMA_AUTH_TYPES = new Set(['TWO_STEP']);

export type HeadlessAuthFieldFormat = 'hostname' | 'uri' | 'uuid' | 'email';

const HEADLESS_AUTH_FIELD_FORMATS = new Set<string>(['hostname', 'uri', 'uuid', 'email']);

/**
 * A field to collect before authorizing, with every property resolved.
 * `headlessAuthFields` produces these from the sparser wire shape
 * (`UserConnectAuthField`), so forms never have to default anything.
 */
export interface HeadlessAuthField {
  name: string;
  target: 'credentials' | 'params';
  label: string;
  description: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  format: HeadlessAuthFieldFormat | null;
  pattern: string | null;
  options: string[] | null;
  prefix: string | null;
  suffix: string | null;
  documentationUrl: string | null;
  warnings: Record<string, string>;
  visibleWhen: { field: string; equals: string } | null;
  secret: boolean;
  required: boolean;
  order: number;
}

function toHeadlessAuthField(field: UserConnectAuthField, fallbackOrder: number): HeadlessAuthField {
  return {
    name: field.name,
    target: fieldTarget(field),
    label: field.label || field.name,
    description: field.description ?? null,
    placeholder: field.placeholder ?? null,
    defaultValue: field.defaultValue ?? null,
    format:
      field.format && HEADLESS_AUTH_FIELD_FORMATS.has(field.format) ? (field.format as HeadlessAuthFieldFormat) : null,
    pattern: field.pattern ?? null,
    options: field.options ? [...field.options] : null,
    prefix: field.prefix ?? null,
    suffix: field.suffix ?? null,
    documentationUrl: field.documentationUrl ?? null,
    warnings: { ...field.warnings },
    visibleWhen: field.visibleWhen ?? null,
    secret: !!field.secret,
    required: !!field.required,
    order: field.order ?? fallbackOrder,
  };
}

function credentialField(
  name: string,
  label: string,
  placeholder: string,
  secret: boolean,
  order: number,
): HeadlessAuthField {
  return toHeadlessAuthField({ name, target: 'credentials', label, placeholder, secret, required: true, order }, order);
}

// Credentials Nango's hosted Connect UI collects for these auth types even
// when the provider catalog doesn't declare them. Field names are the keys
// the SDK routes on (e.g. `client_id` → the OAuth client credentials grant).
const CREDENTIAL_FIELDS_BY_AUTH_TYPE = new Map<string, HeadlessAuthField[]>([
  ['API_KEY', [credentialField('apiKey', 'API key', 'Paste your API key', true, 0)]],
  [
    'BASIC',
    [
      credentialField('username', 'Username', 'Enter your username', false, 0),
      credentialField('password', 'Password', 'Enter your password', true, 1),
    ],
  ],
  [
    'OAUTH2_CC',
    [
      credentialField('client_id', 'Client ID', 'Enter your client ID', false, 0),
      credentialField('client_secret', 'Client secret', 'Enter your client secret', true, 1),
    ],
  ],
]);

function fieldTarget(field: UserConnectAuthField): 'credentials' | 'params' {
  // Older servers don't send `target`; a collected value without one is a
  // credential (the common case for API key / Basic fields).
  return field.target ?? 'credentials';
}

/** The provider shape the headless helpers read: its auth type and catalog fields. */
export interface HeadlessAuthProvider {
  authType?: string | null;
  authFields?: readonly UserConnectAuthField[] | null;
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
  return (
    POPUP_AUTH_TYPES.has(authType) ||
    UNAUTHENTICATED_AUTH_TYPES.has(authType) ||
    CREDENTIAL_FIELDS_BY_AUTH_TYPE.has(authType)
  );
}

/**
 * The fields to collect before authorizing: the provider's catalog fields,
 * plus the built-in credential fields for its auth type when the catalog
 * declares no credentials of its own (e.g. a Basic auth provider whose
 * catalog only lists a subdomain).
 */
export function headlessAuthFields(provider: HeadlessAuthProvider): HeadlessAuthField[] {
  const catalogFields = (provider.authFields ?? []).map(toHeadlessAuthField);
  const builtInFields = provider.authType == null ? undefined : CREDENTIAL_FIELDS_BY_AUTH_TYPE.get(provider.authType);
  if (!builtInFields || catalogFields.some(field => field.target === 'credentials')) {
    return catalogFields;
  }
  const firstOrder = catalogFields.length === 0 ? 0 : Math.max(...catalogFields.map(field => field.order)) + 1;
  return [...catalogFields, ...builtInFields.map((field, index) => ({ ...field, order: firstOrder + index }))];
}

/**
 * True when the flow needs user-collected fields before `nango.auth()` can
 * run (API key / Basic / two-step credentials, required flow params). A caller
 * without a form falls back to the hosted flow, whose page renders them.
 */
export function headlessAuthRequiresForm(provider: HeadlessAuthProvider): boolean {
  return headlessAuthFields(provider).some(field => field.required);
}

export interface HeadlessAuthValues {
  credentials?: Record<string, string>;
  params?: Record<string, string>;
}

export function headlessAuthFieldKey(field: UserConnectAuthField): string {
  return `${fieldTarget(field)}:${field.name}`;
}

/**
 * Whether a field is shown given the current form values. A field with
 * `visibleWhen` is visible only while its controlling field (same target
 * first, then any target) holds the expected value.
 */
export function isHeadlessAuthFieldVisible(
  fields: readonly UserConnectAuthField[],
  field: UserConnectAuthField,
  values: Readonly<Record<string, string | undefined>>,
): boolean {
  const visibleWhen = field.visibleWhen;
  if (!visibleWhen) return true;
  const controllingField =
    fields.find(candidate => fieldTarget(candidate) === fieldTarget(field) && candidate.name === visibleWhen.field) ??
    fields.find(candidate => candidate.name === visibleWhen.field);
  if (!controllingField) return false;
  return values[headlessAuthFieldKey(controllingField)] === visibleWhen.equals;
}

/** Splits collected form values into the SDK's credentials vs flow params, skipping hidden fields. */
export function splitHeadlessAuthValues(
  fields: readonly UserConnectAuthField[],
  values: Record<string, string>,
): HeadlessAuthValues {
  const credentials: Record<string, string> = {};
  const params: Record<string, string> = {};

  for (const field of fields) {
    if (!isHeadlessAuthFieldVisible(fields, field, values)) continue;
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
 * `credentials` are provided (API key / Basic / OAuth client credentials /
 * two-step) no popup opens — the SDK submits the credentials to Nango, which
 * validates them with the provider. Unauthenticated providers are created
 * directly.
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
  const request =
    input.authType != null && UNAUTHENTICATED_AUTH_TYPES.has(input.authType)
      ? nango.create(input.integrationId, input.params ? { params: input.params } : {})
      : nango.auth(input.integrationId, authOptions(input));
  const result = request
    .then(() => undefined)
    .catch((error: unknown) => {
      throw toHeadlessAuthError(error);
    });
  return { result, close: () => nango.win?.close() };
}

function authOptions(input: {
  authType?: string | null;
  credentials?: Record<string, string>;
  params?: Record<string, string>;
}): AuthOptions {
  const options: AuthOptions = {};
  const credentials = headlessCredentials(input.authType ?? undefined, input.credentials);
  if (credentials) options.credentials = credentials;
  if (input.params) options.params = input.params;
  if (!input.credentials) options.detectClosedAuthWindow = true;
  return options;
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
