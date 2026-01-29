/**
 * Mastra Cloud API client.
 */

/**
 * Cloud API response envelope.
 * All responses wrapped with ok/data/error structure.
 */
interface CloudApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    status: number;
  };
}

/**
 * Error thrown by Cloud API requests.
 * Contains status code and optional error code for programmatic handling.
 */
export class CloudApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'CloudApiError';
    this.status = status;
    this.code = code;
    // Required for proper instanceof checks when extending Error in TypeScript
    Object.setPrototypeOf(this, CloudApiError.prototype);
  }
}

/**
 * User from Mastra Cloud.
 */
export interface CloudUser {
  id: string;
  email: string;
  sessionToken: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * JWT claims from Mastra Cloud tokens.
 */
export interface JWTClaims {
  sub: string;
  email: string;
  role: string;
  name?: string;
  avatar?: string;
  exp: number;
  iat: number;
}

/**
 * Session from Mastra Cloud.
 */
export interface CloudSession {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Configuration for Mastra Cloud client.
 */
export interface MastraCloudClientConfig {
  /** Project ID from cloud.mastra.ai */
  projectId: string;
  /** Base URL (defaults to https://cloud.mastra.ai) */
  baseUrl?: string;
  /** API prefix for versioned endpoints (defaults to /api/v1) */
  apiPrefix?: string;
  /** Auth path for login redirect (defaults to /auth/oss) */
  authPath?: string;
}

/**
 * Option interfaces for client methods.
 * Internal - not exported. All methods use options pattern.
 */
interface GetUserOptions {
  userId: string;
  token: string;
}

interface GetUserPermissionsOptions {
  userId: string;
  token: string;
}

interface DestroySessionOptions {
  sessionId: string;
  token?: string;
}

interface GetLoginUrlOptions {
  redirectUri: string;
  state: string;
}

interface ExchangeCodeOptions {
  code: string;
}

interface VerifyTokenOptions {
  token: string;
}

interface ValidateSessionOptions {
  sessionToken: string;
}

/**
 * Mastra Cloud API client.
 *
 * Handles all communication with Mastra Cloud for authentication.
 */
export class MastraCloudClient {
  private projectId: string;
  private baseUrl: string;
  private apiPrefix: string;
  private authPath: string;

  constructor(config: MastraCloudClientConfig) {
    this.projectId = config.projectId;
    // Normalize baseUrl to remove trailing slash if present
    const baseUrl = config.baseUrl ?? 'https://cloud.mastra.ai';
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.apiPrefix = config.apiPrefix ?? '/api/v1';
    this.authPath = config.authPath ?? '/auth/oss';
  }

  /**
   * Make authenticated request to Cloud API.
   * Handles Authorization header and response envelope unwrapping.
   */
  private async request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Project-ID': this.projectId,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Merge with any provided headers
    const mergedHeaders = {
      ...headers,
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: mergedHeaders,
    });

    // Handle non-JSON responses (network errors, etc)
    let json: CloudApiResponse<T>;
    try {
      json = (await response.json()) as CloudApiResponse<T>;
    } catch {
      throw new CloudApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
    }

    // Check BOTH response.ok AND json.ok (Cloud returns 200 with ok:false for some errors)
    if (!response.ok || !json.ok) {
      throw new CloudApiError(
        json.error?.message ?? `Request failed: ${response.status}`,
        json.error?.status ?? response.status,
        json.error?.code,
      );
    }

    if (json.data === undefined) {
      throw new CloudApiError('No data in response', 500);
    }

    return json.data;
  }

  /**
   * Verify a token and get the user.
   */
  async verifyToken(options: VerifyTokenOptions): Promise<CloudUser | null> {
    try {
      const data = await this.request<{ user: Record<string, unknown> }>(
        `${this.apiPrefix}/auth/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ token: options.token }),
        },
      );
      return this.parseUser(data.user);
    } catch {
      return null;
    }
  }

  /**
   * Validate a session.
   */
  async validateSession(options: ValidateSessionOptions): Promise<CloudSession | null> {
    try {
      const data = await this.request<{ session: Record<string, unknown> }>(
        `${this.apiPrefix}/auth/session/validate`,
        {
          method: 'POST',
          body: JSON.stringify({ token: options.sessionToken }),
        },
      );
      return this.parseSession(data.session);
    } catch {
      return null;
    }
  }

  /**
   * Destroy a session.
   */
  async destroySession(options: DestroySessionOptions): Promise<void> {
    await this.request<Record<string, unknown>>(
      `${this.apiPrefix}/auth/session/destroy`,
      {
        method: 'POST',
        body: JSON.stringify({ sessionId: options.sessionId }),
      },
      options.token,
    );
  }

  /**
   * Get a user by ID.
   */
  async getUser(options: GetUserOptions): Promise<CloudUser | null> {
    try {
      const data = await this.request<{ user: Record<string, unknown> }>(
        `${this.apiPrefix}/users/${options.userId}`,
        { method: 'GET' },
        options.token,
      );
      return this.parseUser(data.user);
    } catch {
      return null;
    }
  }

  /**
   * Get permissions for a user.
   */
  async getUserPermissions(options: GetUserPermissionsOptions): Promise<string[]> {
    try {
      const data = await this.request<{ permissions?: string[] }>(
        `${this.apiPrefix}/users/${options.userId}/permissions`,
        { method: 'GET' },
        options.token,
      );
      return data.permissions ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Get SSO login URL.
   */
  getLoginUrl(options: GetLoginUrlOptions): string {
    const params = new URLSearchParams({
      project_id: this.projectId,
      redirect_uri: options.redirectUri,
      state: options.state,
    });

    return `${this.baseUrl}${this.authPath}?${params}`;
  }

  /**
   * Exchange authorization code for session.
   * Cloud API returns JWT in response for sessionToken flow.
   */
  async exchangeCode(options: ExchangeCodeOptions): Promise<{ user: CloudUser; session: CloudSession; jwt: string }> {
    const data = await this.request<{
      user: Record<string, unknown>;
      session: Record<string, unknown>;
      jwt: string;
    }>(
      `${this.apiPrefix}/auth/callback`,
      {
        method: 'POST',
        body: JSON.stringify({ code: options.code }),
      },
    );

    return {
      user: this.parseUser(data.user, data.jwt),
      session: this.parseSession(data.session),
      jwt: data.jwt,
    };
  }

  /**
   * Parse user from API response.
   * When jwt provided, uses it as sessionToken for local JWT decode flow.
   */
  private parseUser(data: Record<string, unknown>, jwt?: string): CloudUser {
    return {
      id: data['id'] as string,
      email: data['email'] as string,
      sessionToken: jwt ?? '',
      name: data['name'] as string | undefined,
      avatarUrl: data['avatar_url'] as string | undefined,
      createdAt: new Date(data['created_at'] as string),
      metadata: data['metadata'] as Record<string, unknown> | undefined,
    };
  }

  /**
   * Parse session from API response.
   */
  private parseSession(data: Record<string, unknown>): CloudSession {
    return {
      id: data['id'] as string,
      userId: data['user_id'] as string,
      expiresAt: new Date(data['expires_at'] as string),
      createdAt: new Date(data['created_at'] as string),
    };
  }
}
