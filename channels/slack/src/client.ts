import type { SlackAppManifest, SlackAppCredentials } from './types';

const SLACK_API_BASE = 'https://slack.com/api';

export interface SlackManifestClientConfig {
  configToken: string;
  refreshToken: string;
  onTokenRotation?: (tokens: { configToken: string; refreshToken: string }) => Promise<void>;
}

/**
 * Client for Slack's App Manifest API.
 * Handles programmatic app creation, deletion, and token rotation.
 */
export class SlackManifestClient {
  #configToken: string;
  #refreshToken: string;
  #onTokenRotation?: (tokens: { configToken: string; refreshToken: string }) => Promise<void>;

  constructor(config: SlackManifestClientConfig) {
    this.#configToken = config.configToken;
    this.#refreshToken = config.refreshToken;
    this.#onTokenRotation = config.onTokenRotation;
  }

  /**
   * Get current tokens (after potential rotation).
   */
  getTokens(): { configToken: string; refreshToken: string } {
    return {
      configToken: this.#configToken,
      refreshToken: this.#refreshToken,
    };
  }

  /**
   * Update tokens (e.g., from storage on startup).
   */
  setTokens(tokens: { configToken: string; refreshToken: string }): void {
    this.#configToken = tokens.configToken;
    this.#refreshToken = tokens.refreshToken;
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
        refresh_token: this.#refreshToken,
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

    this.#configToken = data.token!;
    this.#refreshToken = data.refresh_token!;

    if (this.#onTokenRotation) {
      await this.#onTokenRotation({
        configToken: this.#configToken,
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

    // Debug: log manifest for troubleshooting
    if (process.env.DEBUG_SLACK_MANIFEST) {

    }

    const response = await fetch(`${SLACK_API_BASE}/apps.manifest.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#configToken}`,
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
        Authorization: `Bearer ${this.#configToken}`,
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
        Authorization: `Bearer ${this.#configToken}`,
      },
      body: JSON.stringify({ app_id: appId, manifest }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      errors?: Array<{ message: string; pointer: string }>;
      response_metadata?: { messages?: string[] };
    };

    if (!data.ok) {
      let errorDetails = data.error ?? 'unknown_error';
      if (data.errors?.length) {
        errorDetails += ': ' + data.errors.map((e) => `${e.pointer}: ${e.message}`).join(', ');
      }
      if (data.response_metadata?.messages?.length) {
        errorDetails += ' - ' + data.response_metadata.messages.join(', ');
      }
      throw new Error(`App update failed: ${errorDetails}`);
    }
  }

  /**
   * Set the app icon from a URL.
   * Downloads the image and uploads it to Slack.
   *
   * Note: This uses an undocumented Slack API (apps.icon.set) that the
   * Slack CLI uses internally. The image should be square (1:1 aspect ratio).
   *
   * @param appId - The Slack app ID
   * @param iconUrl - URL to the icon image (PNG/JPG, recommended 512x512)
   */
  async setAppIcon(appId: string, iconUrl: string): Promise<void> {
    // Download the image
    const imageResponse = await fetch(iconUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download icon from ${iconUrl}: ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Determine file extension from content type
    let ext = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      ext = 'jpg';
    } else if (contentType.includes('gif')) {
      ext = 'gif';
    }

    // Build multipart form data
    const formData = new FormData();
    formData.append('app_id', appId);
    formData.append('file', imageBlob, `icon.${ext}`);

    // Ensure tokens are fresh
    await this.rotateToken();

    const response = await fetch(`${SLACK_API_BASE}/apps.icon.set`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#configToken}`,
        // Note: Don't set Content-Type - fetch will set it with the boundary
      },
      body: formData,
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
    };

    if (!data.ok) {
      throw new Error(`Failed to set app icon: ${data.error}`);
    }
  }
}

/**
 * Exchange an OAuth code for bot tokens.
 */
export async function exchangeOAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  botToken: string;
  botUserId: string;
  teamId: string;
  teamName: string;
}> {
  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    bot_user_id?: string;
    team?: { id: string; name: string };
  };

  if (!data.ok) {
    throw new Error(`OAuth exchange failed: ${data.error}`);
  }

  return {
    botToken: data.access_token!,
    botUserId: data.bot_user_id!,
    teamId: data.team!.id,
    teamName: data.team!.name,
  };
}
