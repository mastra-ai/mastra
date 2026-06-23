import type { BuilderSettingsResponse } from '@mastra/client-js';
import type { AuthCapabilities, CurrentUser } from '@/domains/auth/types';

/** The signed-in user that owns the seeded stored agent. */
export const currentUser = {
  id: 'user-1',
  email: 'user-1@example.com',
} satisfies CurrentUser;

/**
 * Auth disabled → `rbacEnabled` is false, so every capability flag in
 * `useBuilderAgentAccess` resolves to `true` (canWrite/canExecute/etc.).
 */
export const authDisabledCapabilities = {
  enabled: false,
  login: null,
} satisfies AuthCapabilities;

/**
 * Auth enabled but RBAC off. `capabilities.rbac` is false, so `usePermissions`
 * treats every check as allowed (canWrite true) while `capabilities.enabled`
 * still gates auth-aware UI like the library visibility button.
 */
export const authEnabledNoRbacCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1', email: 'user-1@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: null,
} satisfies AuthCapabilities;

/**
 * Auth enabled with RBAC and an explicit permission set. Pass `[]` for a
 * read-only/denied user, or include `stored-agents:write` to grant write
 * access through the real `usePermissions` → `useBuilderAgentAccess` path.
 */
export const rbacCapabilities = (permissions: string[]) =>
  ({
    enabled: true,
    login: null,
    user: { id: 'user-1', email: 'user-1@example.com' },
    capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
    access: { roles: [], permissions },
  }) satisfies AuthCapabilities;

/**
 * Builder settings with no agent features enabled — matches the view page's
 * expectation that the configure panel and feature tabs never render.
 */
export const builderSettingsDisabled = {
  enabled: false,
} satisfies BuilderSettingsResponse;
