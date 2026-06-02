import type { SlackAppManifest, SlackAppCredentials } from './types';

const SLACK_API_BASE = 'https://slack.com/api';
const SLACK_API_TIMEOUT_MS = 30_000;

export interface SlackManifestClientConfig {
  token: string;
  refreshToken: string;
  onTokenRotation?: (tokens: { token: string; refreshToken: string }) => Promise<void>;
}

/**
 * Client for Slack's App Manifest API.
 * Handles programmatic app creation, deletion, and token rotation.
 */
export class SlackManifestClient {
  #token: string;
  #refreshToken: string;
  #onTokenRotation?: (tokens: { token: string; refreshToken: string }) => Promise<void>;
  #rotationPromise: Promise<void> | null = null;

  constructor(config: SlackManifestClientConfig) {
    this.#token = config.token;
    this.#refreshToken = config.refreshToken;
    this.#onTokenRotation = config.onTokenRotation;
  }

  /**
   * Get current tokens (after potential rotation).
   */
  getTokens(): { token: string; refreshToken: string } {
    return {
      token: this.#token,
      refreshToken: this.#refreshToken,
    };
  }

  /**
   * Update tokens (e.g., from storage on startup).
   */
  setTokens(tokens: { token: string; refreshToken: string }): void {
    this.#token = tokens.token;
    this.#refreshToken = tokens.refreshToken;
  }

  /**
   * Rotate the configuration tokens.
   * Slack config access tokens expire after 12 hours; the refresh token is single-use
   * and each rotation returns a new access token + refresh token pair.
   *
   * Concurrent callers share the same in-flight rotation to avoid burning
   * single-use refresh tokens.
   */
  async rotateToken(): Promise<void> {
    if (this.#rotationPromise) return this.#rotationPromise;

    this.#rotationPromise = this.#doRotateToken().finally(() => {
      this.#rotationPromise = null;
    });

    return this.#rotationPromise;
  }

  async #doRotateToken(): Promise<void> {
    const response = await fetch(`${SLACK_API_BASE}/tooling.tokens.rotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: this.#refreshToken,
      }),
      signal: AbortSignal.timeout(SLACK_API_TIMEOUT_MS),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      token?: string;
      refresh_token?: string;
    };

    if (!data.ok) {
      if (data.error === 'invalid_refresh_token') {
        throw new Error(
          'Slack refresh token is invalid. Get fresh tokens from https://api.slack.com/apps > "Your App Configuration Tokens". ' +
            'This can happen if storage was lost or the token was already used.',
        );
      }
      throw new Error(`Token rotation failed: ${data.error}`);
    }

    if (!data.token || !data.refresh_token) {
      throw new Error('Token rotation returned incomplete data');
    }

    this.#token = data.token;
    this.#refreshToken = data.refresh_token;

    if (this.#onTokenRotation) {
      await this.#onTokenRotation({
        token: this.#token,
        refreshToken: this.#refreshToken,
      });
    }
  }

  /**
   * Create a new Slack app from a manifest.
   */
  async createApp(manifest: SlackAppManifest): Promise<SlackAppCredentials> {
    // Ensure tokens are fresh
    await this.rotateToken();

    const response = await fetch(`${SLACK_API_BASE}/apps.manifest.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#token}`,
      },
      body: JSON.stringify({ manifest }),
      signal: AbortSignal.timeout(SLACK_API_TIMEOUT_MS),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      errors?: Array<{ message: string; pointer: string }>;
      response_metadata?: { messages?: string[] };
      app_id?: string;
      credentials?: {
        client_id: string;
        client_secret: string;
        signing_secret: string;
      };
      oauth_authorize_url?: string;
    };

    if (!data.ok) {
      // Slack may include detailed error info
      let errorDetails = data.error ?? 'unknown_error';
      if (data.errors?.length) {
        errorDetails += ': ' + data.errors.map(e => `${e.pointer}: ${e.message}`).join(', ');
      }
      if (data.response_metadata?.messages?.length) {
        errorDetails += ' - ' + data.response_metadata.messages.join(', ');
      }
      throw new Error(`App creation failed: ${errorDetails}`);
    }

    if (!data.app_id || !data.credentials || !data.oauth_authorize_url) {
      throw new Error('App creation returned incomplete data');
    }

    return {
      appId: data.app_id,
      clientId: data.credentials.client_id,
      clientSecret: data.credentials.client_secret,
      signingSecret: data.credentials.signing_secret,
      oauthAuthorizeUrl: data.oauth_authorize_url,
    };
  }

  /**
   * Delete a Slack app.
   */
  async deleteApp(appId: string): Promise<void> {
    await this.rotateToken();

    const response = await fetch(`${SLACK_API_BASE}/apps.manifest.delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#token}`,
      },
      body: JSON.stringify({ app_id: appId }),
      signal: AbortSignal.timeout(SLACK_API_TIMEOUT_MS),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
    };

    if (!data.ok) {
      throw new Error(`App deletion failed: ${data.error}`);
    }
  }

  /**
   * Update an existing Slack app's manifest.
   */
  async updateApp(appId: string, manifest: SlackAppManifest): Promise<void> {
    await this.rotateToken();

    const response = await fetch(`${SLACK_API_BASE}/apps.manifest.update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#token}`,
      },
      body: JSON.stringify({ app_id: appId, manifest }),
      signal: AbortSignal.timeout(SLACK_API_TIMEOUT_MS),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      errors?: Array<{ message: string; pointer: string }>;
    };

    if (!data.ok) {
      let errorDetails = data.error ?? 'unknown_error';
      if (data.errors?.length) {
        errorDetails += ': ' + data.errors.map(e => `${e.pointer}: ${e.message}`).join(', ');
      }
      throw new Error(`App manifest update failed: ${errorDetails}`);
    }
  }

  /**
   * Set the app icon via undocumented apps.icon.set API.
   */
  async setAppIcon(appId: string, imageData: ArrayBuffer): Promise<void> {
    await this.rotateToken();

    const formData = new FormData();
    formData.append('app_id', appId);
    formData.append('image', new Blob([imageData], { type: 'image/png' }), 'icon.png');

    const response = await fetch(`${SLACK_API_BASE}/apps.icon.set`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#token}`,
      },
      body: formData,
      signal: AbortSignal.timeout(SLACK_API_TIMEOUT_MS),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
    };

    if (!data.ok) {
      // Non-fatal — icon is cosmetic
      console.warn(`[Slack] Failed to set app icon: ${data.error}`);
    }
  }
}
