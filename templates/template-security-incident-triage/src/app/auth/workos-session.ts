import { WorkOS } from '@workos-inc/node';

import type { DashboardConfig } from '../../env.js';
import {
  dashboardRoleFromWorkosSlug,
  type DashboardRole,
  type VerifiedDashboardSession,
} from './dashboard-principal.js';

export type LoginIntent = 'sign-in' | 'sign-up';
export type DashboardOrganization = Readonly<{
  organizationId: string;
  organizationName: string;
  role: DashboardRole;
}>;

export interface DashboardSessionClient {
  startLogin(
    input: Readonly<{ intent: LoginIntent }>,
  ): Promise<Readonly<{ authorizationUrl: string; state: string; codeVerifier: string }>>;
  completeLogin(
    input: Readonly<{ code: string; codeVerifier: string }>,
  ): Promise<Readonly<{ sealedSession: string; session: VerifiedDashboardSession }>>;
  authenticate(sealedSession: string): Promise<VerifiedDashboardSession | null>;
  refresh(
    sealedSession: string,
    organizationId?: string,
  ): Promise<
    | Readonly<{
        kind: 'ok';
        sealedSession: string;
        session: VerifiedDashboardSession;
      }>
    | Readonly<{ kind: 'terminal' }>
  >;
  getLogoutUrl(sessionId: string, returnTo: string): Promise<string | null>;
  listOrganizations(userId: string): Promise<readonly DashboardOrganization[]>;
}

/** AuthKit returns an external URL; never make the SDK response redirectable. */
export function safeWorkosRedirect(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      ['api.workos.com', 'authkit.workos.com'].includes(url.hostname) &&
      /^\/(?:user_management\/|sso\/|logout)/u.test(url.pathname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** The only direct AuthKit SDK integration used by dashboard routes. */
export function createWorkosDashboardSessionClient(config: DashboardConfig): DashboardSessionClient | null {
  if (
    !config.enabled ||
    !config.workosApiKey ||
    !config.workosClientId ||
    !config.workosRedirectUri ||
    !config.workosCookiePassword
  ) {
    return null;
  }
  const apiKey = config.workosApiKey;
  const clientId = config.workosClientId;
  const redirectUri = config.workosRedirectUri;
  const cookiePassword = config.workosCookiePassword;
  const workos = new WorkOS({
    apiKey,
    clientId,
  });
  const session = (
    result: Readonly<{
      user: Readonly<{ id: string }>;
      sessionId: string;
      organizationId?: string;
      role?: string;
      roles?: readonly string[];
    }>,
  ): VerifiedDashboardSession => ({
    userId: result.user.id,
    sessionId: result.sessionId,
    organizationId: result.organizationId,
    roles: result.roles && result.roles.length > 0 ? result.roles : result.role ? [result.role] : [],
  });
  return {
    startLogin: async ({ intent }) => {
      const started = await workos.userManagement.getAuthorizationUrlWithPKCE({
        clientId,
        redirectUri,
        provider: 'authkit',
        prompt: 'login',
        screenHint: intent,
      });
      return {
        authorizationUrl: started.url,
        state: started.state,
        codeVerifier: started.codeVerifier,
      };
    },
    completeLogin: async ({ code, codeVerifier }) => {
      const response = await workos.userManagement.authenticateWithCode({
        clientId,
        code,
        codeVerifier,
        session: { sealSession: true, cookiePassword },
      });
      if (!response.sealedSession) throw new Error('AuthKit did not seal a session.');
      const authenticated = await workos.userManagement
        .loadSealedSession({
          sessionData: response.sealedSession,
          cookiePassword,
        })
        .authenticate();
      if (!authenticated.authenticated) throw new Error('AuthKit session rejected.');
      return {
        sealedSession: response.sealedSession,
        session: session(authenticated),
      };
    },
    authenticate: async sealedSession => {
      const authenticated = await workos.userManagement
        .loadSealedSession({ sessionData: sealedSession, cookiePassword })
        .authenticate();
      return authenticated.authenticated ? session(authenticated) : null;
    },
    refresh: async (sealedSession, organizationId) => {
      const refreshed = await workos.userManagement
        .loadSealedSession({ sessionData: sealedSession, cookiePassword })
        .refresh({ cookiePassword, organizationId });
      if (!refreshed.authenticated || !refreshed.sealedSession) return { kind: 'terminal' };
      return {
        kind: 'ok',
        sealedSession: refreshed.sealedSession,
        session: session(refreshed),
      };
    },
    getLogoutUrl: async (sessionId, returnTo) => workos.userManagement.getLogoutUrl({ sessionId, returnTo }),
    listOrganizations: async userId => {
      const memberships = await workos.userManagement.listOrganizationMemberships({
        userId,
        limit: 100,
      });
      return memberships.data.flatMap(membership => {
        const role = dashboardRoleFromWorkosSlug(membership.role.slug);
        return membership.status === 'active' && role
          ? [
              {
                organizationId: membership.organizationId,
                organizationName: membership.organizationName.slice(0, 128),
                role,
              },
            ]
          : [];
      });
    },
  };
}
