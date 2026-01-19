import { MastraAuthProvider } from '@mastra/core/ee';
import type { ISSOProvider, IRBACProvider, SSOLoginConfig, SSOCallbackResult } from '@mastra/core/ee';
import type { CloudAuthConfig, CloudUser } from './types.js';

/**
 * Default Mastra Cloud API endpoint
 */
const DEFAULT_ENDPOINT = 'https://api.mastra.cloud';

/**
 * API response types
 */
interface CloudAPIUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  metadata?: Record<string, any>;
  organization_id?: string;
  role?: string;
  email_verified?: boolean;
  created_at: string;
  updated_at: string;
}

interface CloudSSOCallbackResponse {
  user: CloudAPIUser;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_at: string;
  session_token: string;
}

interface CloudRolesResponse {
  roles: string[];
}

interface CloudPermissionsResponse {
  permissions: string[];
}

/**
 * Mastra Cloud authentication provider
 *
 * Zero-configuration authentication provider that connects to Mastra Cloud's
 * hosted authentication service. Bypasses license checks and provides
 * SSO, session management, and RBAC out of the box.
 *
 * @example
 * ```ts
 * import { MastraAuthCloud } from '@mastra/auth-cloud';
 *
 * // Zero config - works immediately
 * const auth = new MastraAuthCloud();
 *
 * // Custom configuration
 * const auth = new MastraAuthCloud({
 *   apiKey: process.env.MASTRA_CLOUD_API_KEY,
 *   endpoint: 'https://api.mastra.cloud',
 * });
 *
 * // Use in Mastra
 * const mastra = new Mastra({
 *   auth,
 * });
 * ```
 */
export class MastraAuthCloud extends MastraAuthProvider<CloudUser> {
  private apiKey: string | undefined;
  private endpoint: string;
  private customDomain: string | undefined;

  /**
   * Mastra Cloud Auth bypasses license checks
   * @readonly
   */
  readonly isMastraCloudAuth = true;

  /**
   * SSO provider for Mastra Cloud authentication
   */
  sso: ISSOProvider<CloudUser>;

  /**
   * RBAC provider for Mastra Cloud permissions
   */
  rbac: IRBACProvider<CloudUser>;

  constructor(config: CloudAuthConfig = {}) {
    super({ name: 'mastra-cloud' });

    // Use environment variable or provided API key
    this.apiKey = config.apiKey || process.env.MASTRA_CLOUD_API_KEY;
    this.endpoint = config.endpoint || DEFAULT_ENDPOINT;
    this.customDomain = config.customDomain;

    // Initialize SSO provider
    this.sso = new CloudSSOProvider(this.endpoint, this.customDomain);

    // Initialize RBAC provider
    this.rbac = new CloudRBACProvider(this.endpoint, this.apiKey);
  }

  /**
   * Get current authenticated user from request
   *
   * Validates session token from cookie and fetches user from Mastra Cloud API
   */
  async getCurrentUser(request: Request): Promise<CloudUser | null> {
    try {
      // Extract session token from cookie
      const cookieHeader = request.headers.get('cookie');
      if (!cookieHeader) {
        return null;
      }

      const sessionToken = this.extractSessionToken(cookieHeader);
      if (!sessionToken) {
        return null;
      }

      // Validate session and fetch user from Mastra Cloud API
      const response = await fetch(`${this.endpoint}/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { user: CloudAPIUser };
      return this.mapToCloudUser(data.user);
    } catch (error) {
      console.error('Error fetching current user from Mastra Cloud:', error);
      return null;
    }
  }

  /**
   * Extract session token from cookie header
   */
  private extractSessionToken(cookieHeader: string): string | null {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('mastra_cloud_session='));

    if (!sessionCookie) {
      return null;
    }

    // Preserve = characters in the value (common in base64-encoded tokens)
    const firstEqualIndex = sessionCookie.indexOf('=');
    if (firstEqualIndex === -1) {
      return null;
    }

    const value = sessionCookie.slice(firstEqualIndex + 1);
    return value || null;
  }

  /**
   * Map Mastra Cloud API user response to CloudUser
   */
  private mapToCloudUser(data: CloudAPIUser): CloudUser {
    return {
      id: data.id,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      avatarUrl: data.avatar_url,
      metadata: data.metadata || {},
      cloud: {
        userId: data.id,
        organizationId: data.organization_id,
        role: data.role,
        emailVerified: data.email_verified || false,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      },
    };
  }
}

/**
 * SSO provider for Mastra Cloud authentication
 *
 * Handles OAuth/OIDC redirect flows via Mastra Cloud
 */
class CloudSSOProvider implements ISSOProvider<CloudUser> {
  constructor(
    private endpoint: string,
    private customDomain?: string,
  ) {}

  getLoginUrl(redirectUri: string, state?: string): string {
    // Use customDomain for browser-facing URLs, fallback to endpoint
    const baseUrl = this.customDomain ?? this.endpoint;
    const url = new URL(`${baseUrl}/v1/auth/sso/login`);
    url.searchParams.set('redirect_uri', redirectUri);
    if (state) {
      url.searchParams.set('state', state);
    }
    return url.toString();
  }

  async handleCallback(code: string, state?: string): Promise<SSOCallbackResult<CloudUser>> {
    const response = await fetch(`${this.endpoint}/v1/auth/sso/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
    });

    if (!response.ok) {
      throw new Error(`SSO callback failed: ${response.statusText}`);
    }

    const data = (await response.json()) as CloudSSOCallbackResponse;

    // Determine if we're using HTTPS (for Secure flag)
    const isSecure = (this.customDomain || this.endpoint).startsWith('https://');

    // Build Set-Cookie value with security attributes
    const cookieAttributes = [`mastra_cloud_session=${data.session_token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];

    if (isSecure) {
      cookieAttributes.push('Secure');
    }

    return {
      user: this.mapToCloudUser(data.user),
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresAt: new Date(data.expires_at).getTime(),
      },
      cookies: {
        mastra_cloud_session: cookieAttributes.join('; '),
      },
    };
  }

  getLogoutUrl(redirectUri?: string): string {
    // Use customDomain for browser-facing URLs, fallback to endpoint
    const baseUrl = this.customDomain ?? this.endpoint;
    const url = new URL(`${baseUrl}/v1/auth/sso/logout`);
    if (redirectUri) {
      url.searchParams.set('redirect_uri', redirectUri);
    }
    return url.toString();
  }

  getLoginButtonConfig(): SSOLoginConfig {
    return {
      provider: 'mastra-cloud',
      text: 'Sign in with Mastra Cloud',
      icon: 'https://mastra.ai/logo.svg',
      url: '', // URL is dynamically generated in getLoginUrl
    };
  }

  private mapToCloudUser(data: CloudAPIUser): CloudUser {
    return {
      id: data.id,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      avatarUrl: data.avatar_url,
      metadata: data.metadata || {},
      cloud: {
        userId: data.id,
        organizationId: data.organization_id,
        role: data.role,
        emailVerified: data.email_verified || false,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      },
    };
  }
}

/**
 * RBAC provider for Mastra Cloud permissions
 *
 * Fetches roles and permissions from Mastra Cloud API
 */
class CloudRBACProvider implements IRBACProvider<CloudUser> {
  constructor(
    private endpoint: string,
    private apiKey?: string,
  ) {}

  async getRoles(user: CloudUser): Promise<string[]> {
    try {
      const response = await fetch(`${this.endpoint}/v1/rbac/users/${user.cloud.userId}/roles`, {
        headers: {
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
        },
      });

      if (!response.ok) {
        // Fallback to user's organization role if API fails
        return user.cloud.role ? [user.cloud.role] : ['viewer'];
      }

      const data = (await response.json()) as CloudRolesResponse;
      return data.roles || [];
    } catch (error) {
      console.error('Error fetching roles from Mastra Cloud:', error);
      return user.cloud.role ? [user.cloud.role] : ['viewer'];
    }
  }

  async hasRole(user: CloudUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  async getPermissions(user: CloudUser): Promise<string[]> {
    try {
      const response = await fetch(`${this.endpoint}/v1/rbac/users/${user.cloud.userId}/permissions`, {
        headers: {
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as CloudPermissionsResponse;
      return data.permissions || [];
    } catch (error) {
      console.error('Error fetching permissions from Mastra Cloud:', error);
      return [];
    }
  }

  async hasPermission(user: CloudUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);

    // Check for exact match
    if (permissions.includes(permission)) {
      return true;
    }

    // Check for wildcard match (e.g., 'agents:*' matches 'agents:read')
    const [namespace] = permission.split(':');
    if (permissions.includes(`${namespace}:*`)) {
      return true;
    }

    // Check for super admin wildcard
    if (permissions.includes('*')) {
      return true;
    }

    return false;
  }

  async hasAllPermissions(user: CloudUser, permissions: string[]): Promise<boolean> {
    const results = await Promise.all(permissions.map(permission => this.hasPermission(user, permission)));
    return results.every(result => result);
  }

  async hasAnyPermission(user: CloudUser, permissions: string[]): Promise<boolean> {
    const results = await Promise.all(permissions.map(permission => this.hasPermission(user, permission)));
    return results.some(result => result);
  }
}
