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

export interface OAuthLoginCallbacks {
  onAuth: (info: OAuthAuthInfo) => void;
  onPrompt: (prompt: OAuthPrompt) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
  signal?: AbortSignal;
}

export interface OAuthProviderInterface {
  readonly id: OAuthProviderId;
  readonly name: string;

  /** Whether this provider uses a local callback server (vs manual code paste) */
  readonly usesCallbackServer?: boolean;

  /** Run the login flow, return credentials to persist */
  login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;

  /** Refresh expired credentials, return updated credentials to persist */
  refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;

  /** Convert credentials to API key string for the provider */
  getApiKey(credentials: OAuthCredentials): string;
}

export type ApiKeyCredential = {
  type: 'api_key';
  key: string;
};

export type OAuthCredential = {
  type: 'oauth';
} & OAuthCredentials;

export type AuthCredential = ApiKeyCredential | OAuthCredential;

export type AuthStorageData = Record<string, AuthCredential>;
