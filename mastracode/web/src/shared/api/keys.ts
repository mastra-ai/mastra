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
  projects: () => ['projects'] as const,
  githubStatus: () => ['github', 'status'] as const,
  githubRepos: (query: string | undefined) => ['github', 'repos', query ?? null] as const,
  workspaces: (projectId: string | undefined) => ['workspaces', projectId ?? null] as const,
  providers: () => ['providers'] as const,
  customProviders: () => ['custom-providers'] as const,
  modelPacks: (resourceId: string | undefined) => ['model-packs', resourceId ?? null] as const,
  /** Prefix that matches every `modelPacks(*)` entry — pack CRUD is global, so it invalidates all of them. */
  modelPacksAll: () => ['model-packs'] as const,
  om: (resourceId: string | undefined) => ['om', resourceId ?? null] as const,
  fsList: (path: string | undefined) => ['fs-list', path ?? null] as const,
  agentControllerModels: (agentControllerId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'models'] as const,
  agentControllerModes: (agentControllerId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'modes'] as const,
  agentControllerSession: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'sessions', resourceId ?? null] as const,
  // Keep connection state outside agentControllerSession: mutation hooks invalidate that prefix,
  // and a sync refetch would bump dataUpdatedAt and wipe the live transcript.
  agentControllerConnection: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => ['agent-controller', agentControllerId ?? null, 'connection', resourceId ?? null, projectPath ?? null] as const,
  agentControllerSettings: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    [...queryKeys.agentControllerSession(agentControllerId, resourceId), 'settings'] as const,
  agentControllerPermissions: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    [...queryKeys.agentControllerSession(agentControllerId, resourceId), 'permissions'] as const,
  agentControllerThreads: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => [...queryKeys.agentControllerSession(agentControllerId, resourceId), 'threads', projectPath ?? null] as const,
  agentControllerThreadMessages: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    threadId: string | undefined,
    syncEpoch?: number,
  ) =>
    [
      ...queryKeys.agentControllerSession(agentControllerId, resourceId),
      'threads',
      threadId ?? null,
      'messages',
      syncEpoch ?? 0,
    ] as const,
} as const;
