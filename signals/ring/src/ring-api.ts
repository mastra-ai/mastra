import type { RingTokens } from './types';

const API_BASE_URL = 'https://api.amazonvision.com';
const OAUTH_TOKEN_URL = 'https://oauth.ring.com/oauth/token';
const REQUEST_TIMEOUT_MS = 30_000;
// Long enough to download a 15-minute clip.
const MEDIA_TIMEOUT_MS = 5 * 60_000;

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type RingApiClientOptions = {
  clientId: string;
  clientSecret: string;
  userAgent: string;
};

/** Credentials for one linked Ring account. */
export type RingAuth = {
  accessToken: string;
  hardwareId: string;
};

export class RingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'RingApiError';
  }
}

/**
 * Thin client for the Ring Partner API.
 * See https://developer.amazon.com/docs/ring/api-documentation.html
 */
export class RingApiClient {
  readonly #options: RingApiClientOptions;

  constructor(options: RingApiClientOptions) {
    this.#options = options;
  }

  /** Exchange the authorization code Ring posts to the Token Exchange URL. */
  exchangeCode(code: string): Promise<RingTokens> {
    return this.#requestTokens({ grant_type: 'authorization_code', code });
  }

  /** Refresh an access token. Ring rotates the refresh token on every refresh. */
  refresh(refreshToken: string): Promise<RingTokens> {
    return this.#requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /** Get the Ring account ID for an access token. */
  async getAccountId(auth: RingAuth): Promise<string> {
    const body = (await this.#json('GET', '/v1/users/me', auth)) as { data: { id: string } };
    return body.data.id;
  }

  /** List the IDs of the devices the account has shared with the app. */
  async listDeviceIds(auth: RingAuth): Promise<string[]> {
    const body = (await this.#json('GET', '/v1/devices', auth)) as { data?: { id: string }[] };
    return (body.data ?? []).map(device => device.id);
  }

  /** Verify the link nonce and mark the integration `completed`. */
  async confirmLink(auth: RingAuth, nonce: string, accountIdentifier: string): Promise<void> {
    await this.#json('POST', '/v1/accounts/me/app-integrations', auth, {
      nonce,
      account_identifier: accountIdentifier,
    });
    await this.#json('PATCH', '/v1/accounts/me/app-integrations', auth, { status: 'completed' });
  }

  /**
   * Download the latest image in a time range.
   * Returns `undefined` when Ring has no image in the range or the range isn't authorized.
   */
  async downloadLatestImage(
    auth: RingAuth,
    deviceId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<Buffer | undefined> {
    const response = await this.#media(auth, deviceId, 'image', {
      type: 'latest_in_range',
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      image_options: { format: 'jpeg' },
    });
    if (!response.ok) return undefined;
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Download a recorded clip. Returns the response so callers can retry `416` and `425`
   * while Ring finishes processing the recording.
   */
  downloadClip(
    auth: RingAuth,
    deviceId: string,
    timestamp: number,
    durationMs: number,
    audio: boolean,
  ): Promise<Response> {
    return this.#media(auth, deviceId, 'video', {
      timestamp,
      duration: durationMs,
      audio_options: { audio_enabled: audio },
    });
  }

  #headers(auth: RingAuth): Record<string, string> {
    return {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': this.#options.userAgent,
      Hardware_Id: auth.hardwareId,
    };
  }

  #media(auth: RingAuth, deviceId: string, kind: 'image' | 'video', body: object): Promise<Response> {
    return fetch(`${API_BASE_URL}/v1/devices/${encodeURIComponent(deviceId)}/media/${kind}/download`, {
      method: 'POST',
      headers: this.#headers(auth),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    });
  }

  async #json(method: string, path: string, auth: RingAuth, body?: object): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: this.#headers(auth),
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new RingApiError(`[Ring] ${method} ${path} failed with ${response.status}`, response.status, text);
    }
    return text ? JSON.parse(text) : undefined;
  }

  async #requestTokens(params: Record<string, string>): Promise<RingTokens> {
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: this.#options.clientId,
        client_secret: this.#options.clientSecret,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new RingApiError(
        `[Ring] ${params.grant_type} token request failed with ${response.status}`,
        response.status,
        text,
      );
    }
    const tokens = JSON.parse(text) as TokenResponse;
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };
  }
}
