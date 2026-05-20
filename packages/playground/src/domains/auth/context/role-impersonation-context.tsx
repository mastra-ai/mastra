/**
 * Role impersonation context for "View as role" feature.
 *
 * Lets admin users preview the Studio UI as if they had a different role.
 * This is a UI-only override — server calls still use real admin permissions.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useMastraClient } from '@mastra/react';

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

export function RoleImpersonationProvider({ children }: { children: ReactNode }) {
  const client = useMastraClient();
  const [impersonatedRole, setImpersonatedRole] = useState<{ id: string; name: string } | null>(null);
  const [impersonatedPermissions, setImpersonatedPermissions] = useState<string[] | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const startImpersonation = useCallback(
    async (role: { id: string; name: string }) => {
      setIsSwitching(true);
      try {
        const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options as any;
        const raw = (apiPrefix || '/api').trim();
        const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

        const response = await fetch(`${baseUrl}${prefix}/auth/roles/${encodeURIComponent(role.id)}/permissions`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...clientHeaders,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch role permissions: ${response.status}`);
        }

        const data = await response.json();
        setImpersonatedRole(role);
        setImpersonatedPermissions(data.permissions);
      } finally {
        setIsSwitching(false);
      }
    },
    [client],
  );

  const stopImpersonation = useCallback(() => {
    setImpersonatedRole(null);
    setImpersonatedPermissions(null);
  }, []);

  return (
    <RoleImpersonationContext.Provider
      value={{
        impersonatedRole,
        impersonatedPermissions,
        isImpersonating: impersonatedRole !== null,
        startImpersonation,
        stopImpersonation,
        isSwitching,
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
