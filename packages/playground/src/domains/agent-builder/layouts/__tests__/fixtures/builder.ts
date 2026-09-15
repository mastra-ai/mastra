import type { BuilderSettingsResponse } from '@mastra/client-js';

import type { AuthCapabilities } from '@/domains/auth/types';

/**
 * Auth disabled → `usePermissions` treats every check as allowed and
 * `useBuilderAgentAccess` resolves `canUseFavorites`/`canManageSkills` to true
 * without RBAC, so the Favorites link always renders.
 */
export const authDisabledCapabilities: AuthCapabilities = { enabled: false, login: null };

/**
 * Builder enabled with the agent feature present. The sidebar reads
 * `features.agent` via `useBuilderAgentFeatures`; only the `tools` flag matters
 * for link gating, and the asserted links (My agents / Favorites / Library) do
 * not depend on it.
 */
export const builderSettings: BuilderSettingsResponse = {
  enabled: true,
  features: { agent: { tools: true } },
};
