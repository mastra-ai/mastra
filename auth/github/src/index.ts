import { MastraAuthProvider } from '@mastra/core/server';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import type { ISSOProvider, IUserProvider, SSOLoginConfig, SSOCallbackResult } from '@mastra/core/auth';

export type GitHubUser = {
  id: string;
  login: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
};

export interface MastraAuthGitHubOptions extends MastraAuthProviderOptions<GitHubUser> {
  clientId?: string;
  clientSecret?: string;
  /** Only allow users with these GitHub usernames. */
  allowedUsers?: string[];
  /** Only allow members of these GitHub organizations (e.g. ['mastra-ai']). */
  allowedOrgs?: string[];
  /** Only allow members of these GitHub teams in org/team-slug format (e.g. ['mastra-ai/engineering']). */
  allowedTeams?: string[];
}

const COOKIE_NAME = 'mastra-token';

export class MastraAuthGitHub
  extends MastraAuthProvider<GitHubUser>
  implements ISSOProvider<GitHubUser>, IUserProvider<GitHubUser>
{
  private clientId: string;
  private clientSecret: string;
  private allowedUsers?: string[];
  private allowedOrgs?: string[];
  private allowedTeams?: string[];
  private _cachedToken: string | null = null;

  constructor(options?: MastraAuthGitHubOptions) {
    super({ name: options?.name ?? 'github' });

    const clientId = options?.clientId ?? process.env.GITHUB_CLIENT_ID;
    const clientSecret = options?.clientSecret ?? process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'GitHub client ID and client secret are required, please provide them in the options or set the environment variables GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET',
      );
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.allowedUsers = options?.allowedUsers;
    this.allowedOrgs = options?.allowedOrgs;
    this.allowedTeams = options?.allowedTeams;

    const hasRestriction =
      this.allowedUsers?.length || this.allowedOrgs?.length || this.allowedTeams?.length || options?.authorizeUser;

    if (!hasRestriction) {
      throw new Error(
        'At least one access restriction is required: provide allowedUsers, allowedOrgs, allowedTeams, or a custom authorizeUser function',
      );
    }

    this.registerOptions(options);
  }

  private getTokenFromCookie(request: Request): string | null {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(`${COOKIE_NAME}=`)) {
        return cookie.slice(COOKIE_NAME.length + 1);
      }
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async authenticateToken(token: string, request?: any): Promise<GitHubUser | null> {
    let resolvedToken = token;

    // Fall back to cookie if no Authorization header token
    if (!resolvedToken && request) {
      const cookieToken = this.getTokenFromCookie(request);
      if (cookieToken) {
        resolvedToken = cookieToken;
      }
    }

    if (!resolvedToken || typeof resolvedToken !== 'string') {
      return null;
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${resolvedToken}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        id: number;
        login: string;
        email: string | null;
        name: string | null;
        avatar_url: string | null;
      };
      this._cachedToken = resolvedToken;
      return {
        id: String(data.id),
        login: data.login,
        email: data.email ?? undefined,
        name: data.name ?? undefined,
        avatarUrl: data.avatar_url ?? undefined,
      };
    } catch {
      return null;
    }
  }

  async getCurrentUser(request: Request): Promise<GitHubUser | null> {
    // Check Authorization header first
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Then check cookie
    const token = headerToken || this.getTokenFromCookie(request);
    if (!token) return null;

    return this.authenticateToken(token, request);
  }

  async getUser(userId: string): Promise<GitHubUser | null> {
    const token = this._cachedToken;
    if (!token) return null;

    try {
      const response = await fetch(`https://api.github.com/user/${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        id: number;
        login: string;
        email: string | null;
        name: string | null;
        avatar_url: string | null;
      };
      return {
        id: String(data.id),
        login: data.login,
        email: data.email ?? undefined,
        name: data.name ?? undefined,
        avatarUrl: data.avatar_url ?? undefined,
      };
    } catch {
      return null;
    }
  }

  async authorizeUser(user: GitHubUser): Promise<boolean> {
    if (!user?.id) return false;

    const hasRestrictions = this.allowedUsers?.length || this.allowedOrgs?.length || this.allowedTeams?.length;
    if (!hasRestrictions) return true;

    if (this.allowedUsers?.length && this.allowedUsers.includes(user.login)) {
      return true;
    }

    const token = this._cachedToken;
    if (!token) return false;

    if (this.allowedOrgs?.length) {
      const isOrgMember = await this.checkOrgMembership(token);
      if (isOrgMember) return true;
    }

    if (this.allowedTeams?.length) {
      const isTeamMember = await this.checkTeamMembership(token);
      if (isTeamMember) return true;
    }

    return false;
  }

  private async checkOrgMembership(token: string): Promise<boolean> {
    if (!this.allowedOrgs?.length) return false;

    try {
      // Use GET /user/orgs which works for any authenticated user (doesn't require admin)
      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) return false;

      const orgs = (await response.json()) as Array<{ login: string }>;
      const userOrgNames = orgs.map(o => o.login.toLowerCase());

      return this.allowedOrgs.some(allowedOrg => userOrgNames.includes(allowedOrg.toLowerCase()));
    } catch {
      return false;
    }
  }

  private async checkTeamMembership(token: string): Promise<boolean> {
    if (!this.allowedTeams?.length) return false;

    try {
      // Use GET /user/teams which works for any authenticated user (doesn't require admin)
      const response = await fetch('https://api.github.com/user/teams', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) return false;

      const teams = (await response.json()) as Array<{ slug: string; organization: { login: string } }>;
      const userTeams = teams.map(t => `${t.organization.login}/${t.slug}`.toLowerCase());

      return this.allowedTeams.some(allowedTeam => userTeams.includes(allowedTeam.toLowerCase()));
    } catch {
      return false;
    }
  }

  getLoginUrl(redirectUri: string, state: string): string {
    // Only request read:org scope when org or team restrictions are configured
    const scopes = ['read:user', 'user:email'];
    if (this.allowedOrgs?.length || this.allowedTeams?.length) {
      scopes.push('read:org');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async handleCallback(code: string, _state: string): Promise<SSOCallbackResult<GitHubUser>> {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const accessToken = tokenData.access_token;

    this._cachedToken = accessToken;

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const data = (await userResponse.json()) as {
      id: number;
      login: string;
      email: string | null;
      name: string | null;
      avatar_url: string | null;
    };

    const cookie = `${COOKIE_NAME}=${accessToken}; HttpOnly; SameSite=Lax; Path=/`;

    return {
      user: {
        id: String(data.id),
        login: data.login,
        email: data.email ?? undefined,
        name: data.name ?? undefined,
        avatarUrl: data.avatar_url ?? undefined,
      },
      tokens: { accessToken },
      cookies: [cookie],
    };
  }

  getLoginButtonConfig(): SSOLoginConfig {
    return {
      provider: 'github',
      text: 'Sign in with GitHub',
    };
  }
}
