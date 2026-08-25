import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { usePermissions } from '../use-permissions';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import { useRoleImpersonation } from '@/domains/auth/hooks/use-role-impersonation';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const CAPABILITIES_URL = `${BASE_URL}/api/auth/capabilities`;

/** RBAC on, signed in, granting exactly the permissions and roles listed. */
const rbac = (permissions: string[], roles: string[] = ['member']): AuthCapabilities => ({
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles, permissions },
});

/** Signed in, but the deployment has no RBAC provider configured. */
const rbacOff: AuthCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: { roles: ['viewer'], permissions: ['agents:read'] },
};

const signedOut: AuthCapabilities = { enabled: true, login: null };

const renderPermissions = ({
  capabilities = rbacOff,
  delayMs,
  withImpersonation = false,
}: { capabilities?: AuthCapabilities; delayMs?: number; withImpersonation?: boolean } = {}) => {
  server.use(
    http.get(CAPABILITIES_URL, async () => {
      if (delayMs) await delay(delayMs);
      return HttpResponse.json(capabilities);
    }),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        {withImpersonation ? <RoleImpersonationProvider>{children}</RoleImpersonationProvider> : children}
      </QueryClientProvider>
    </MastraReactProvider>
  );

  return { ...renderHook(() => usePermissions(), { wrapper }), queryClient };
};

/** Resolved capabilities are the precondition for every RBAC assertion. */
const settled = (queryClient: QueryClient) =>
  waitFor(() => expect(queryClient.getQueryData(['auth', 'capabilities'])).toBeDefined());

afterEach(() => cleanup());

describe('usePermissions, when RBAC is not configured', () => {
  it('allows everything, so a local single-user studio is not locked out', async () => {
    const { result, queryClient } = renderPermissions();
    await settled(queryClient);

    expect(result.current.rbacEnabled).toBe(false);
    expect(result.current.hasPermission('agents:delete')).toBe(true);
    expect(result.current.hasAllPermissions(['agents:delete', 'anything:at-all'])).toBe(true);
    expect(result.current.hasAnyPermission(['nothing:granted'])).toBe(true);
    expect(result.current.hasRole('admin')).toBe(true);
    expect(result.current.canEdit('agents')).toBe(true);
    expect(result.current.canDelete('agents')).toBe(true);
    expect(result.current.canExecute('agents')).toBe(true);
  });

  it('still reports the roles and permissions the server sent', async () => {
    const { result, queryClient } = renderPermissions();
    await settled(queryClient);

    expect(result.current.roles).toEqual(['viewer']);
    expect(result.current.permissions).toEqual(['agents:read']);
    expect(result.current.isAuthenticated).toBe(true);
  });
});

describe('usePermissions, when nobody is signed in', () => {
  it('reports no access and no RBAC', async () => {
    const { result, queryClient } = renderPermissions({ capabilities: signedOut });
    await settled(queryClient);

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.rbacEnabled).toBe(false);
    expect(result.current.roles).toEqual([]);
    expect(result.current.permissions).toEqual([]);
  });
});

describe('usePermissions, while the capabilities are loading', () => {
  it('says so, so callers can hold off on gating the UI', async () => {
    const { result, queryClient } = renderPermissions({ delayMs: 60 });

    expect(result.current.isLoading).toBe(true);
    await settled(queryClient);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('usePermissions, when RBAC is on', () => {
  const render = (permissions: string[], roles?: string[]) =>
    renderPermissions({ capabilities: rbac(permissions, roles) });

  it('grants exactly what was granted', async () => {
    const { result, queryClient } = render(['agents:read']);
    await settled(queryClient);

    expect(result.current.rbacEnabled).toBe(true);
    expect(result.current.hasPermission('agents:read')).toBe(true);
    expect(result.current.hasPermission('agents:write')).toBe(false);
    expect(result.current.hasPermission('workflows:read')).toBe(false);
  });

  describe('the wildcards it understands', () => {
    it('lets a bare * stand in for every permission', async () => {
      const { result, queryClient } = render(['*']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:delete')).toBe(true);
      expect(result.current.hasPermission('anything')).toBe(true);
    });

    it('lets *:* stand in for every permission', async () => {
      const { result, queryClient } = render(['*:*']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:delete')).toBe(true);
      expect(result.current.hasPermission('tools:execute')).toBe(true);
    });

    it('lets an action wildcard cover every action on one resource', async () => {
      const { result, queryClient } = render(['agents:*']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:delete')).toBe(true);
      expect(result.current.hasPermission('agents:read:agent-1')).toBe(true);
      expect(result.current.hasPermission('workflows:delete')).toBe(false);
    });

    it('lets a resource wildcard cover one action on every resource', async () => {
      const { result, queryClient } = render(['*:execute']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:execute')).toBe(true);
      expect(result.current.hasPermission('tools:execute')).toBe(true);
      expect(result.current.hasPermission('agents:delete')).toBe(false);
    });
  });

  describe('the resource ids it scopes to', () => {
    it('lets an unscoped grant cover any single resource', async () => {
      const { result, queryClient } = render(['agents:read']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:read:agent-1')).toBe(true);
    });

    it('holds a scoped grant to its own resource', async () => {
      const { result, queryClient } = render(['agents:read:agent-1']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:read:agent-1')).toBe(true);
      expect(result.current.hasPermission('agents:read:agent-2')).toBe(false);
      expect(result.current.hasPermission('agents:read')).toBe(false);
    });

    it('holds a scoped action wildcard to its own resource', async () => {
      const { result, queryClient } = render(['agents:*:agent-1']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:delete:agent-1')).toBe(true);
      expect(result.current.hasPermission('agents:delete:agent-2')).toBe(false);
    });

    it('lets an unscoped resource wildcard cover a scoped request', async () => {
      const { result, queryClient } = render(['*:execute']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:execute:agent-1')).toBe(true);
      expect(result.current.hasPermission('tools:execute:tool-9')).toBe(true);
    });

    it('holds a scoped resource wildcard to its own resource', async () => {
      const { result, queryClient } = render(['*:execute:agent-1']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents:execute:agent-1')).toBe(true);
      expect(result.current.hasPermission('agents:execute:agent-2')).toBe(false);
    });
  });

  describe('a grant that is not in resource:action form', () => {
    it('only matches itself, exactly', async () => {
      const { result, queryClient } = render(['legacy-admin']);
      await settled(queryClient);

      expect(result.current.hasPermission('legacy-admin')).toBe(true);
      expect(result.current.hasPermission('legacy')).toBe(false);
      expect(result.current.hasPermission('legacy-admin:read')).toBe(false);
    });

    it('is not matched by a well-formed grant either', async () => {
      const { result, queryClient } = render(['agents:read']);
      await settled(queryClient);

      expect(result.current.hasPermission('agents')).toBe(false);
    });
  });

  describe('checking several permissions at once', () => {
    it('requires every one for hasAllPermissions', async () => {
      const { result, queryClient } = render(['agents:read', 'agents:write']);
      await settled(queryClient);

      expect(result.current.hasAllPermissions(['agents:read', 'agents:write'])).toBe(true);
      expect(result.current.hasAllPermissions(['agents:read', 'agents:delete'])).toBe(false);
    });

    it('requires only one for hasAnyPermission', async () => {
      const { result, queryClient } = render(['agents:read']);
      await settled(queryClient);

      expect(result.current.hasAnyPermission(['agents:delete', 'agents:read'])).toBe(true);
      expect(result.current.hasAnyPermission(['agents:delete', 'agents:write'])).toBe(false);
    });

    it('treats an empty list as satisfied for all, and unsatisfied for any', async () => {
      const { result, queryClient } = render(['agents:read']);
      await settled(queryClient);

      expect(result.current.hasAllPermissions([])).toBe(true);
      expect(result.current.hasAnyPermission([])).toBe(false);
    });
  });

  describe('the convenience checks', () => {
    it('reads canEdit, canDelete and canExecute off the matching action', async () => {
      const { result, queryClient } = render(['agents:write', 'tools:execute']);
      await settled(queryClient);

      expect(result.current.canEdit('agents')).toBe(true);
      expect(result.current.canDelete('agents')).toBe(false);
      expect(result.current.canExecute('agents')).toBe(false);
      expect(result.current.canExecute('tools')).toBe(true);
    });

    it('reads a granted delete', async () => {
      const { result, queryClient } = render(['agents:delete']);
      await settled(queryClient);

      expect(result.current.canDelete('agents')).toBe(true);
      expect(result.current.canDelete('workflows')).toBe(false);
      expect(result.current.canEdit('agents')).toBe(false);
    });
  });

  describe('roles', () => {
    it('reports a role the user holds', async () => {
      const { result, queryClient } = render(['agents:read'], ['editor', 'reviewer']);
      await settled(queryClient);

      expect(result.current.roles).toEqual(['editor', 'reviewer']);
      expect(result.current.hasRole('editor')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);
    });
  });
});

describe('usePermissions, while impersonating a role', () => {
  const renderWithImpersonation = (capabilities: AuthCapabilities) => {
    server.use(
      http.get(CAPABILITIES_URL, () => HttpResponse.json(capabilities)),
      http.get(`${BASE_URL}/api/auth/roles/viewer/permissions`, () =>
        HttpResponse.json({ permissions: ['agents:read'] }),
      ),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <RoleImpersonationProvider>{children}</RoleImpersonationProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );

    const { result } = renderHook(() => ({ permissions: usePermissions(), impersonation: useRoleImpersonation() }), {
      wrapper,
    });
    return { result, queryClient };
  };

  it('answers as the impersonated role rather than the real admin', async () => {
    const { result, queryClient } = renderWithImpersonation(rbac(['*'], ['admin']));
    await settled(queryClient);
    expect(result.current.permissions.hasPermission('agents:delete')).toBe(true);

    await act(async () => {
      await result.current.impersonation.startImpersonation({ id: 'viewer', name: 'Viewer' });
    });

    expect(result.current.permissions.permissions).toEqual(['agents:read']);
    expect(result.current.permissions.roles).toEqual(['viewer']);
    expect(result.current.permissions.hasPermission('agents:read')).toBe(true);
    expect(result.current.permissions.hasPermission('agents:delete')).toBe(false);
  });

  it('enforces the impersonated role even where RBAC is off', async () => {
    const { result, queryClient } = renderWithImpersonation(rbacOff);
    await settled(queryClient);
    expect(result.current.permissions.hasPermission('agents:delete')).toBe(true);

    await act(async () => {
      await result.current.impersonation.startImpersonation({ id: 'viewer', name: 'Viewer' });
    });

    // Without this, "view as viewer" would show an admin's UI on a deployment
    // that has no RBAC provider — the preview would be meaningless.
    expect(result.current.permissions.hasPermission('agents:delete')).toBe(false);
    expect(result.current.permissions.hasAnyPermission(['agents:delete'])).toBe(false);
    expect(result.current.permissions.hasAllPermissions(['agents:read'])).toBe(true);
    expect(result.current.permissions.hasRole('viewer')).toBe(true);
    expect(result.current.permissions.hasRole('admin')).toBe(false);
  });

  it('gives the real permissions back when impersonation stops', async () => {
    const { result, queryClient } = renderWithImpersonation(rbac(['*'], ['admin']));
    await settled(queryClient);

    await act(async () => {
      await result.current.impersonation.startImpersonation({ id: 'viewer', name: 'Viewer' });
    });
    expect(result.current.permissions.hasPermission('agents:delete')).toBe(false);

    act(() => result.current.impersonation.stopImpersonation());

    expect(result.current.permissions.roles).toEqual(['admin']);
    expect(result.current.permissions.hasPermission('agents:delete')).toBe(true);
  });
});
