/**
 * Smithery OAuth Provider for browser applications
 *
 * Implements the OAuthClientProvider interface from the MCP SDK
 * to handle OAuth authentication with Smithery-hosted MCP servers.
 *
 * @see https://smithery.ai/docs/use/connect
 */

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

const STORAGE_PREFIX = 'smithery_oauth_';

/**
 * Browser-based OAuth provider for Smithery MCP servers.
 *
 * Stores OAuth state in localStorage for persistence across page reloads.
 * Uses sessionStorage for temporary state like code verifiers.
 */
export class SmitheryBrowserOAuthProvider implements OAuthClientProvider {
  private serverUrl: string;
  private clientName: string;
  private _clientInfo?: OAuthClientInformation;
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;

  constructor(serverUrl: string, clientName = 'Mastra Playground') {
    this.serverUrl = serverUrl;
    this.clientName = clientName;

    // Load persisted state
    this.loadPersistedState();
  }

  /**
   * The URL where Smithery will redirect after authorization.
   */
  get redirectUrl(): string {
    return `${window.location.origin}/oauth/callback`;
  }

  /**
   * OAuth client metadata for dynamic client registration.
   */
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: this.clientName,
      client_uri: window.location.origin,
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'read write',
      token_endpoint_auth_method: 'none',
    };
  }

  /**
   * Get stored client information (from dynamic registration).
   */
  clientInformation(): OAuthClientInformation | undefined {
    return this._clientInfo;
  }

  /**
   * Save client information after dynamic registration.
   */
  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    this._clientInfo = info;
    try {
      localStorage.setItem(this.getStorageKey('client_info'), JSON.stringify(info));
    } catch {
      // localStorage may be unavailable
    }
  }

  /**
   * Get stored OAuth tokens.
   */
  tokens(): OAuthTokens | undefined {
    return this._tokens;
  }

  /**
   * Save OAuth tokens after successful authorization.
   */
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this._tokens = tokens;
    try {
      localStorage.setItem(this.getStorageKey('tokens'), JSON.stringify(tokens));
    } catch {
      // localStorage may be unavailable
    }
  }

  /**
   * Open the authorization page in a popup window.
   *
   * Uses a popup instead of redirect to keep the main page state intact.
   */
  async redirectToAuthorization(url: URL): Promise<void> {
    // Store the server URL we're authenticating for
    try {
      sessionStorage.setItem(STORAGE_PREFIX + 'pending_server', this.serverUrl);
    } catch {
      // sessionStorage may be unavailable
    }

    // Calculate popup position (centered)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open OAuth in a popup window
    const popup = window.open(
      url.toString(),
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      // Popup blocked - fall back to redirect
      window.location.href = url.toString();
      return;
    }

    // Store reference to popup for cleanup
    (window as unknown as Record<string, unknown>).__oauthPopup = popup;
  }

  /**
   * Save the PKCE code verifier for the OAuth flow.
   */
  async saveCodeVerifier(verifier: string): Promise<void> {
    this._codeVerifier = verifier;
    try {
      sessionStorage.setItem(this.getStorageKey('code_verifier'), verifier);
    } catch {
      // sessionStorage may be unavailable
    }
  }

  /**
   * Get the stored PKCE code verifier.
   */
  async codeVerifier(): Promise<string> {
    if (!this._codeVerifier) {
      try {
        this._codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier')) || undefined;
      } catch {
        // sessionStorage may be unavailable
      }
    }
    if (!this._codeVerifier) {
      throw new Error('No code verifier stored');
    }
    return this._codeVerifier;
  }

  /**
   * Clear all stored OAuth state for this server.
   */
  clearState(): void {
    this._clientInfo = undefined;
    this._tokens = undefined;
    this._codeVerifier = undefined;

    try {
      localStorage.removeItem(this.getStorageKey('client_info'));
      localStorage.removeItem(this.getStorageKey('tokens'));
      sessionStorage.removeItem(this.getStorageKey('code_verifier'));
    } catch {
      // Storage may be unavailable
    }
  }

  /**
   * Check if we have valid tokens stored.
   */
  hasTokens(): boolean {
    return !!this._tokens?.access_token;
  }

  /**
   * Load persisted state from storage.
   */
  private loadPersistedState(): void {
    try {
      const clientInfoStr = localStorage.getItem(this.getStorageKey('client_info'));
      if (clientInfoStr) {
        this._clientInfo = JSON.parse(clientInfoStr);
      }

      const tokensStr = localStorage.getItem(this.getStorageKey('tokens'));
      if (tokensStr) {
        this._tokens = JSON.parse(tokensStr);
      }

      const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'));
      if (codeVerifier) {
        this._codeVerifier = codeVerifier;
      }
    } catch {
      // Storage may be unavailable or corrupted
    }
  }

  /**
   * Get storage key for this server URL.
   */
  private getStorageKey(key: string): string {
    // Create a safe key from the server URL
    const safeUrl = this.serverUrl.replace(/[^a-zA-Z0-9]/g, '_');
    return `${STORAGE_PREFIX}${safeUrl}_${key}`;
  }
}

/**
 * Pending OAuth state stored before redirect.
 */
export interface PendingOAuthState {
  serverUrl: string;
  serverQualifiedName: string;
  serverDisplayName: string;
  connectionType: 'http' | 'stdio';
}

/**
 * Store the pending OAuth state before redirect.
 */
export function storePendingOAuthState(state: PendingOAuthState): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + 'pending_server', state.serverUrl);
    sessionStorage.setItem(STORAGE_PREFIX + 'pending_state', JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Get the pending OAuth server URL from session storage.
 * Called on the OAuth callback page to know which server we're authenticating for.
 */
export function getPendingOAuthServer(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + 'pending_server');
  } catch {
    return null;
  }
}

/**
 * Get the full pending OAuth state from session storage.
 */
export function getPendingOAuthState(): PendingOAuthState | null {
  try {
    const stateStr = sessionStorage.getItem(STORAGE_PREFIX + 'pending_state');
    if (stateStr) {
      return JSON.parse(stateStr);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the pending OAuth server URL and state.
 */
export function clearPendingOAuthServer(): void {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + 'pending_server');
    sessionStorage.removeItem(STORAGE_PREFIX + 'pending_state');
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Store the OAuth authorization code temporarily.
 * Called on the OAuth callback page after receiving the code.
 */
export function storeOAuthCode(code: string): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + 'auth_code', code);
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Get and clear the stored OAuth authorization code.
 */
export function consumeOAuthCode(): string | null {
  try {
    const code = sessionStorage.getItem(STORAGE_PREFIX + 'auth_code');
    if (code) {
      sessionStorage.removeItem(STORAGE_PREFIX + 'auth_code');
    }
    return code;
  } catch {
    return null;
  }
}
