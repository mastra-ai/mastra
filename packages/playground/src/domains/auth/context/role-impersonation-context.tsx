/**
 * Role impersonation context for "View as role" feature.
 *
 * Lets admin users preview the Studio UI as if they had a different role.
 * This is a UI-only override — server calls still use real admin permissions.
 */

import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchRolePermissionsRequest } from '../services/fetch-role-permissions';

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

// eslint-disable-next-line react-refresh/only-export-components
export const RoleImpersonationContext = createContext<RoleImpersonationState | null>(null);

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
      const data = await fetchRolePermissionsRequest(client, { roleId: role.id });
      return { role, permissions: data.permissions };
    },
    onSuccess: ({ role, permissions }) => {
      setImpersonatedRole(role);
      setImpersonatedPermissions(permissions);
    },
  });

  const { mutateAsync, reset, isPending } = mutation;

  const value = useMemo(() => {
    const startImpersonation = async (role: { id: string; name: string }) => {
      await mutateAsync({ role });
    };

    const stopImpersonation = () => {
      setImpersonatedRole(null);
      setImpersonatedPermissions(null);
      reset();
    };

    return {
      impersonatedRole,
      impersonatedPermissions,
      isImpersonating: impersonatedRole !== null,
      startImpersonation,
      stopImpersonation,
      isSwitching: isPending,
    };
  }, [impersonatedRole, impersonatedPermissions, isPending, mutateAsync, reset]);

  return <RoleImpersonationContext.Provider value={value}>{children}</RoleImpersonationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
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
