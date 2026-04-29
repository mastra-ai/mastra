import type { SlackAppManifest, SlackAppCredentials } from './types';

const SLACK_API_BASE = 'https://slack.com/api';

export interface SlackManifestClientConfig {
  appConfigToken: string;
  appConfigRefreshToken: string;
  onTokenRotation?: (tokens: { appConfigToken: string; appConfigRefreshToken: string }) => Promise<void>;
}

/**
 * Client for Slack's App Manifest API.
 * Handles programmatic app creation, deletion, and token rotation.
 */
export class SlackManifestClient {
  #appConfigToken: string;
  #appConfigRefreshToken: string;
  #onTokenRotation?: (tokens: { appConfigToken: string; appConfigRefreshToken: string }) => Promise<void>;

  constructor(config: SlackManifestClientConfig) {
    this.#appConfigToken = config.appConfigToken;
    this.#appConfigRefreshToken = config.appConfigRefreshToken;
    this.#onTokenRotation = config.onTokenRotation;
  }

  /**
   * Get current tokens (after potential rotation).
   */
  getTokens(): { appConfigToken: string; appConfigRefreshToken: string } {
    return {
      appConfigToken: this.#appConfigToken,
      appConfigRefreshToken: this.#appConfigRefreshToken,
    };
  }

  /**
   * Update tokens (e.g., from storage on startup).
   */
  setTokens(tokens: { appConfigToken: string; appConfigRefreshToken: string }): void {
    this.#appConfigToken = tokens.appConfigToken;
    this.#appConfigRefreshToken = tokens.appConfigRefreshToken;
  }

  /**
   * Rotate the configuration tokens.
   * Slack config tokens expire after 12 hours and must be rotated.
   */
  async rotateToken(): Promise<void> {
    const response = await fetch(`${SLACK_API_BASE}/tooling.tokens.rotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: this.#appConfigRefreshToken,
      }),
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
          'Slack refresh token expired. Get fresh tokens from https://api.slack.com/apps > "Your App Configuration Tokens". ' +
          'Slack config tokens expire after 12 hours of inactivity.',
        );
      }
      throw new Error(`Token rotation failed: ${data.error}`);
    }

    this.#appConfigToken = data.token!;
    this.#appConfigRefreshToken = data.refresh_token!;

    if (this.#onTokenRotation) {
      await this.#onTokenRotation({
        appConfigToken: this.#appConfigToken,
        appConfigRefreshToken: this.#appConfigRefreshToken,
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
        Authorization: `Bearer ${this.#appConfigToken}`,
      },
      body: JSON.stringify({ manifest }),
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
        errorDetails += ': ' + data.errors.map((e) => `${e.pointer}: ${e.message}`).join(', ');
      }
      if (data.response_metadata?.messages?.length) {
        errorDetails += ' - ' + data.response_metadata.messages.join(', ');
      }
      throw new Error(`App creation failed: ${errorDetails}`);
    }

    return {
      appId: data.app_id!,
      clientId: data.credentials!.client_id,
      clientSecret: data.credentials!.client_secret,
      signingSecret: data.credentials!.signing_secret,
      oauthAuthorizeUrl: data.oauth_authorize_url!,
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
        Authorization: `Bearer ${this.#appConfigToken}`,
      },
      body: JSON.stringify({ app_id: appId }),
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
        Authorization: `Bearer ${this.#appConfigToken}`,
      },
      body: JSON.stringify({ app_id: appId, manifest }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      errors?: Array<{ message: string; pointer: string }>;
    };

    if (!data.ok) {
      let errorDetails = data.error ?? 'unknown_error';
      if (data.errors?.length) {
        errorDetails += ': ' + data.errors.map((e) => `${e.pointer}: ${e.message}`).join(', ');
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
        Authorization: `Bearer ${this.#appConfigToken}`,
      },
      body: formData,
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
