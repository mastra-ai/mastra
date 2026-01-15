/**
 * Mastra Cloud API client.
 */

/**
 * API response types for type-safe JSON parsing.
 */
interface VerifyTokenResponse {
  user: Record<string, unknown>;
}

interface ValidateSessionResponse {
  session: Record<string, unknown>;
}

interface CreateSessionResponse {
  session: Record<string, unknown>;
}

interface GetUserResponse {
  user: Record<string, unknown>;
}

interface GetPermissionsResponse {
  permissions?: string[];
}

interface ExchangeCodeResponse {
  user: Record<string, unknown>;
  session: Record<string, unknown>;
}

/**
 * User from Mastra Cloud.
 */
export interface CloudUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  roles: string[];
  createdAt: Date;
  metadata?: Record<string, unknown>;
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
}

/**
 * Mastra Cloud API client.
 *
 * Handles all communication with Mastra Cloud for authentication.
 */
export class MastraCloudClient {
  private projectId: string;
  private baseUrl: string;

  constructor(config: MastraCloudClientConfig) {
    this.projectId = config.projectId;
    this.baseUrl = config.baseUrl ?? 'https://cloud.mastra.ai';
  }

  /**
   * Verify a token and get the user.
   */
  async verifyToken(token: string): Promise<CloudUser | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-ID': this.projectId,
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as VerifyTokenResponse;
      return this.parseUser(data.user);
    } catch {
      return null;
    }
  }

  /**
   * Validate a session.
   */
  async validateSession(sessionToken: string): Promise<CloudSession | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/session/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-ID': this.projectId,
        },
        body: JSON.stringify({ token: sessionToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as ValidateSessionResponse;
      return this.parseSession(data.session);
    } catch {
      return null;
    }
  }

  /**
   * Create a new session for a user.
   */
  async createSession(userId: string): Promise<CloudSession> {
    const response = await fetch(`${this.baseUrl}/api/auth/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-ID': this.projectId,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    const data = (await response.json()) as CreateSessionResponse;
    return this.parseSession(data.session);
  }

  /**
   * Destroy a session.
   */
  async destroySession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/auth/session/destroy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-ID': this.projectId,
      },
      body: JSON.stringify({ sessionId }),
    });
  }

  /**
   * Get a user by ID.
   */
  async getUser(userId: string): Promise<CloudUser | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/users/${userId}`, {
        headers: {
          'X-Project-ID': this.projectId,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as GetUserResponse;
      return this.parseUser(data.user);
    } catch {
      return null;
    }
  }

  /**
   * Get permissions for a user.
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/users/${userId}/permissions`, {
        headers: {
          'X-Project-ID': this.projectId,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as GetPermissionsResponse;
      return data.permissions ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Get SSO login URL.
   */
  getLoginUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      project_id: this.projectId,
      redirect_uri: redirectUri,
      state,
    });

    return `${this.baseUrl}/auth/login?${params}`;
  }

  /**
   * Exchange authorization code for session.
   */
  async exchangeCode(code: string): Promise<{ user: CloudUser; session: CloudSession }> {
    const response = await fetch(`${this.baseUrl}/api/auth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-ID': this.projectId,
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.status}`);
    }

    const data = (await response.json()) as ExchangeCodeResponse;

    return {
      user: this.parseUser(data.user),
      session: this.parseSession(data.session),
    };
  }

  /**
   * Parse user from API response.
   */
  private parseUser(data: Record<string, unknown>): CloudUser {
    return {
      id: data['id'] as string,
      email: data['email'] as string,
      name: data['name'] as string | undefined,
      avatarUrl: data['avatar_url'] as string | undefined,
      roles: (data['roles'] as string[]) ?? ['member'],
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
