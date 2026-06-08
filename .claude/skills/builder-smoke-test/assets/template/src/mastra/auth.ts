/**
 * Auth provider switchboard.
 *
 * Reads AUTH_PROVIDER from the environment at module init. When unset,
 * exports undefined for every provider — the Mastra constructor receives
 * `server.auth: undefined` and the editor's permission checks short-circuit
 * to "no caller authorId".
 *
 * The .env emitted by scripts/scaffold.sh controls whether this is "on":
 *   AUTH_PROVIDER=workos   ← auth-on run
 *   (no entry)             ← auth-off run
 *
 * Because mastra dev's dotenv loader overwrites process.env from .env,
 * inline shell overrides are not honoured. Re-run scripts/scaffold.sh to
 * toggle modes; never hand-edit this file.
 */

import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';
import type { MastraAuthProvider } from '@mastra/core/server';

interface AuthBundle {
  mastraAuth?: MastraAuthProvider<unknown>;
  rbacProvider?: MastraRBACWorkos;
}

async function initAuth(): Promise<AuthBundle> {
  switch (process.env.AUTH_PROVIDER) {
    case 'workos': {
      const mastraAuth = new MastraAuthWorkos({
        redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/callback',
      });
      const rbacProvider = new MastraRBACWorkos({
        // Intentional: smoke tests assert live RBAC behavior on every request.
        // A 1ms TTL effectively disables caching so each call re-fetches roles
        // and permissions from WorkOS, ensuring scaffold roleMapping edits and
        // upstream role changes take effect immediately during a run.
        cache: { ttlMs: 1 },
        roleMapping: {
          admin: ['*'],
          // Members get read + execute, plus narrow write on the user-content
          // stored families so the smoke test can exercise create/PATCH/copy/
          // star flows under a non-admin role. Publish/delete/share remain
          // admin-only (note matchesPermission's owner check still applies, so
          // members can only edit their own rows).
          member: ['*:read', '*:execute', 'stored-agents:write', 'stored-skills:write', 'stored-workspaces:write'],
          viewer: ['*:read'],
          _default: [],
        },
      });
      console.log('[Auth] WorkOS auth enabled');
      return { mastraAuth, rbacProvider };
    }
    default:
      return {};
  }
}

const { mastraAuth, rbacProvider } = await initAuth();

export { mastraAuth, rbacProvider };
