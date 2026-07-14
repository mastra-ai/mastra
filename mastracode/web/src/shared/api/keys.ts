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
  githubIssues: (githubProjectId: string | undefined) => ['github', 'issues', githubProjectId ?? null] as const,
  githubPulls: (githubProjectId: string | undefined) => ['github', 'prs', githubProjectId ?? null] as const,
  githubProjectSettings: (githubProjectId: string | undefined) =>
    ['github', 'project-settings', githubProjectId ?? null] as const,
  linearStatus: () => ['linear', 'status'] as const,
  linearProjects: () => ['linear', 'projects'] as const,
  linearIssues: () => ['linear', 'issues'] as const,
  intakeConfig: () => ['intake', 'config'] as const,
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
  // Sessions are scoped per worktree (projectPath), so every session-derived key
  // includes the projectPath — two worktrees over the same resourceId are
  // independent sessions with independent state.
  agentControllerSession: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => ['agent-controller', agentControllerId ?? null, 'sessions', resourceId ?? null, projectPath ?? null] as const,
  // Keep connection state outside agentControllerSession: mutation hooks invalidate that prefix,
  // and a sync refetch would bump dataUpdatedAt and wipe the live transcript.
  agentControllerConnection: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => ['agent-controller', agentControllerId ?? null, 'connection', resourceId ?? null, projectPath ?? null] as const,
  // Kept outside agentControllerSession for the same reason as connection:
  // this is a lightweight activity poll, not session state to invalidate. One
  // entry covers every worktree sharing the resource (single thread listing).
  agentControllerActivity: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'activity', resourceId ?? null] as const,
  agentControllerSettings: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => [...queryKeys.agentControllerSession(agentControllerId, resourceId, projectPath), 'settings'] as const,
  agentControllerPermissions: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => [...queryKeys.agentControllerSession(agentControllerId, resourceId, projectPath), 'permissions'] as const,
  agentControllerThreads: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => [...queryKeys.agentControllerSession(agentControllerId, resourceId, projectPath), 'threads'] as const,
  // Thread ids are unique across the resource, so messages are keyed by threadId
  // alone (no projectPath) — caches survive worktree switches and seeding does
  // not need to know the thread's scope.
  agentControllerThreadMessages: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    threadId: string | undefined,
  ) =>
    [
      'agent-controller',
      agentControllerId ?? null,
      'sessions',
      resourceId ?? null,
      'threads',
      threadId ?? null,
      'messages',
    ] as const,
} as const;
