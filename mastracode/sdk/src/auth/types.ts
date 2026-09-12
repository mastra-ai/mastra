/**
 * OAuth types for authentication providers
 */

export interface OAuthCredentials {
  refresh: string;
  access: string;
  expires: number;
  [key: string]: unknown;
}

export type OAuthProviderId = string;

export interface OAuthAuthInfo {
  url: string;
  instructions?: string;
}

export interface OAuthPrompt {
  message: string;
  placeholder?: string;
  allowEmpty?: boolean;
}

/**
 * A selectable authentication mode for an OAuth provider.
 * Providers that support multiple flows (e.g. browser callback vs. device code)
 * advertise them via `OAuthProviderInterface.authModes`. The TUI shows a
 * sub-selector when more than one mode is available so users don't need to
 * discover the flow through environment variables.
 */
export interface AuthMode {
  id: string;
  name: string;
  description?: string;
}

export interface OAuthLoginCallbacks {
  onAuth: (info: OAuthAuthInfo) => void;
  onPrompt: (prompt: OAuthPrompt) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
  signal?: AbortSignal;
  /** Selected authentication mode id (matches one of `OAuthProviderInterface.authModes`). */
  authMode?: string;
}

export interface OAuthProviderInterface {
  readonly id: OAuthProviderId;
  readonly name: string;

  /** Whether this provider uses a local callback server (vs manual code paste) */
  readonly usesCallbackServer?: boolean;

  /**
   * Optional list of selectable auth flows. When set with two or more entries,
   * the TUI prompts the user to pick a mode before starting the login flow and
   * forwards the choice via `OAuthLoginCallbacks.authMode`.
   */
  readonly authModes?: ReadonlyArray<AuthMode>;

  /** Run the login flow, return credentials to persist */
  login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;

  /** Refresh expired credentials, return updated credentials to persist */
  refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;

  /** Convert credentials to API key string for the provider */
  getApiKey(credentials: OAuthCredentials): string;

  /**
   * Optional human-readable label for an account (e.g. the user's email),
   * captured when the account is registered in the multi-account registry.
   */
  getAccountLabel?(credentials: OAuthCredentials): Promise<string | undefined>;
}

export type ApiKeyCredential = {
  type: 'api_key';
  key: string;
};

export type OAuthCredential = {
  type: 'oauth';
} & OAuthCredentials;

export type AuthCredential = ApiKeyCredential | OAuthCredential;

/**
 * A registered OAuth account in a provider's multi-account registry.
 *
 * Registry entries live in auth.json under `accounts:<id>` keys (where `id` is
 * `${providerId}:${sha256(refresh).slice(0,8)}`), separate from the provider's
 * legacy slot. Exactly one entry per provider is `active`; its tokens are
 * single-homed in the legacy slot, with this record mirroring them so a later
 * activation moves fresh tokens back in.
 */
export interface OAuthAccountRecord extends OAuthCredentials {
  type: 'oauth-account';
  id: string;
  label: string;
  /** ISO timestamp of when the account was added. */
  addedAt: string;
  active: boolean;
}

export type AuthStorageData = Record<string, AuthCredential | OAuthAccountRecord>;

/**
 * The read surface model resolution and the OAuth fetch wrappers need from a
 * credential source. `AuthStorage` satisfies it structurally (file-backed,
 * server-global); deployed web injects a per-tenant implementation backed by
 * the app database so each caller's own credentials are used.
 */
export interface CredentialStore {
  /** Whether model resolution may fall back to process environment credentials. */
  readonly allowEnvironmentFallback?: boolean;
  /** Refresh any cached view (no-op for sources that are always fresh). */
  reload(): void;
  /** Credential in the provider's main slot (`anthropic`, `openai-codex`, …). */
  get(provider: string): AuthCredential | undefined;
  /** Dedicated stored API key for a provider, if any. */
  getStoredApiKey(provider: string): string | undefined;
  /**
   * Ready-to-use key/token for a provider, refreshing expired OAuth
   * credentials first. Implementations own refresh serialization.
   */
  getApiKey(provider: string): Promise<string | undefined>;

  /**
   * Registered OAuth accounts for a provider, in insertion order. Optional so
   * deployed per-tenant stores need no change.
   */
  listAccounts?(providerId: string): OAuthAccountRecord[];

  /** The provider's active registry entry, if a registry exists. */
  getActiveAccount?(providerId: string): OAuthAccountRecord | undefined;

  /**
   * Activate an account: rotate to the next instance (insertion order,
   * wrapping once), or to `instanceId` when given. Moves the active tokens
   * between the legacy slot and the registry entries. Returns the newly
   * active record, or undefined when there is no other instance to rotate to
   * (or `instanceId` is unknown).
   */
  activateAccount?(providerId: string, instanceId?: string): OAuthAccountRecord | undefined;

  /** Remove one account from the registry (activating the next if it was active). */
  removeAccount?(providerId: string, instanceId: string): void;
}
