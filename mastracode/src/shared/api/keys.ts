/**
 * Stable, scoped React Query keys for the settings API.
 *
 * Resource-scoped lists (model packs, OM) include the `resourceId` so switching
 * projects yields a distinct cache entry instead of leaking another project's
 * data. Keeping every key in one place makes invalidation in the mutation hooks
 * unambiguous.
 */
export const queryKeys = {
  webAuth: () => ['web-auth'] as const,
  providers: () => ['providers'] as const,
  customProviders: () => ['custom-providers'] as const,
  modelPacks: (resourceId: string | undefined) => ['model-packs', resourceId ?? null] as const,
  /** Prefix that matches every `modelPacks(*)` entry — pack CRUD is global, so it invalidates all of them. */
  modelPacksAll: () => ['model-packs'] as const,
  om: (resourceId: string | undefined) => ['om', resourceId ?? null] as const,
  fsList: (path: string | undefined) => ['fs-list', path ?? null] as const,
  agentControllerModels: (agentControllerId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'models'] as const,
  agentControllerSession: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'sessions', resourceId ?? null] as const,
  agentControllerSettings: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    [...queryKeys.agentControllerSession(agentControllerId, resourceId), 'settings'] as const,
  agentControllerPermissions: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    [...queryKeys.agentControllerSession(agentControllerId, resourceId), 'permissions'] as const,
  agentControllerThreads: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => [...queryKeys.agentControllerSession(agentControllerId, resourceId), 'threads', projectPath ?? null] as const,
} as const;
