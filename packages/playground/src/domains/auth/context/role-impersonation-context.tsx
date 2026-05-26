/**
 * Role impersonation context for "View as role" feature.
 *
 * Lets admin users preview the Studio UI as if they had a different role.
 * This is a UI-only override — server calls still use real admin permissions.
 */

import type { MastraClient, RouteResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useState  } from 'react';
import type {ReactNode} from 'react';

export type RoleImpersonationState = {
  /** The role currently being impersonated, or null */
  impersonatedRole: { id: string; name: string } | null;
  /** Overridden permissions for the impersonated role */
  impersonatedPermissions: string[] | null;
  /** Whether impersonation is active */
  isImpersonating: boolean;
  /** Start impersonating a role */
  startImpersonation: (role: { id: string; name: string }) => Promise<void>;
  /** Stop impersonating */
  stopImpersonation: () => void;
  /** Whether a role switch is in progress */
  isSwitching: boolean;
};

export const RoleImpersonationContext = createContext<RoleImpersonationState | null>(null);

type RolePermissionsResponse = RouteResponse<'GET /auth/roles/:roleId/permissions'>;

/**
 * Makes a request to fetch the resolved permissions for a role.
 * Exported for testing purposes.
 *
 * @internal
 */
export async function makeFetchRolePermissionsRequest(
  client: MastraClient,
  { roleId }: { roleId: string },
): Promise<RolePermissionsResponse> {
  const { baseUrl = '', apiPrefix, headers: clientHeaders = {} } = client.options || {};
  const raw = (apiPrefix ?? '/api').trim();
  const normalized = raw === '' ? '' : raw.startsWith('/') ? raw : `/${raw}`;
  const prefix = normalized.replace(/\/+$/, '');

  const response = await fetch(`${baseUrl}${prefix}/auth/roles/${encodeURIComponent(roleId)}/permissions`, {
    credentials: 'include',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch role permissions: ${response.status}`);
  }

  return response.json();
}

type ImpersonationMutationResult = {
  role: { id: string; name: string };
  permissions: string[];
};

export function RoleImpersonationProvider({ children }: { children: ReactNode }) {
  const client = useMastraClient();
  const [impersonatedRole, setImpersonatedRole] = useState<{ id: string; name: string } | null>(null);
  const [impersonatedPermissions, setImpersonatedPermissions] = useState<string[] | null>(null);

  const mutation = useMutation<ImpersonationMutationResult, Error, { role: { id: string; name: string } }>({
    mutationFn: async ({ role }) => {
      const data = await makeFetchRolePermissionsRequest(client, { roleId: role.id });
      return { role, permissions: data.permissions };
    },
    onSuccess: ({ role, permissions }) => {
      setImpersonatedRole(role);
      setImpersonatedPermissions(permissions);
    },
  });

  const { mutateAsync, reset, isPending } = mutation;

  const startImpersonation = useCallback(
    async (role: { id: string; name: string }) => {
      await mutateAsync({ role });
    },
    [mutateAsync],
  );

  const stopImpersonation = useCallback(() => {
    setImpersonatedRole(null);
    setImpersonatedPermissions(null);
    reset();
  }, [reset]);

  return (
    <RoleImpersonationContext.Provider
      value={{
        impersonatedRole,
        impersonatedPermissions,
        isImpersonating: impersonatedRole !== null,
        startImpersonation,
        stopImpersonation,
        isSwitching: isPending,
      }}
    >
      {children}
    </RoleImpersonationContext.Provider>
  );
}

export function useRoleImpersonation(): RoleImpersonationState {
  const ctx = useContext(RoleImpersonationContext);
  if (!ctx) {
    // Return a no-op implementation when outside the provider
    return {
      impersonatedRole: null,
      impersonatedPermissions: null,
      isImpersonating: false,
      startImpersonation: async () => {},
      stopImpersonation: () => {},
      isSwitching: false,
    };
  }
  return ctx;
}
