/**
 * Stable, scoped React Query keys for the settings API.
 *
 * Resource-scoped lists (model packs, OM) include the `resourceId` so switching
 * factories yields a distinct cache entry instead of leaking another factory's
 * data. Keeping every key in one place makes invalidation in the mutation hooks
 * unambiguous.
 */
/**
 * Initial (and grow-step) size of the bounded transcript window. Opening a long
 * thread fetches only the newest N messages so the un-virtualized list doesn't
 * freeze; scroll-to-top grows the window by this amount. Cache writers that seed
 * a thread's initial transcript key on this so the hook's first read hits the
 * same entry.
 */
export const INITIAL_THREAD_MESSAGE_LIMIT = 100;

export const queryKeys = {
  factoryAuth: () => ['factory-auth'] as const,
  factories: () => ['factories'] as const,
  persistedFactories: () => ['factories', 'persisted'] as const,
  factoryCreateFlow: () => ['factories', 'create-flow'] as const,
  factoryProject: (factoryProjectId: string | undefined) => ['factory', 'project', factoryProjectId ?? null] as const,
  githubStatus: () => ['github', 'status'] as const,
  githubPat: () => ['github', 'pat'] as const,
  githubRepos: (query: string | undefined) => ['github', 'repos', query ?? null] as const,
  githubIssues: (githubProjectId: string | undefined, label?: string) =>
    ['github', 'issues', githubProjectId ?? null, label ?? null] as const,
  githubPulls: (githubProjectId: string | undefined) => ['github', 'prs', githubProjectId ?? null] as const,
  githubRepositorySettings: (githubProjectId: string | undefined) =>
    ['github', 'repository-settings', githubProjectId ?? null] as const,
  linearStatus: () => ['linear', 'status'] as const,
  linearProjects: () => ['linear', 'projects'] as const,
  linearIssuesAll: () => ['linear', 'issues'] as const,
  linearIssues: (githubProjectId: string | undefined) =>
    [...queryKeys.linearIssuesAll(), githubProjectId ?? null] as const,
  intakeConfig: () => ['intake', 'config'] as const,
  workItems: (factoryProjectId: string | undefined) => ['factory', 'work-items', factoryProjectId ?? null] as const,
  factoryMetrics: (githubProjectId: string | undefined, from: string, to: string) =>
    ['factory', 'metrics', githubProjectId ?? null, from, to] as const,
  factoryHealthThresholds: (githubProjectId: string | undefined) =>
    ['factory', 'health-thresholds', githubProjectId ?? null] as const,
  factoryDecisions: (githubProjectId: string | undefined, statusKey: string) =>
    ['factory', 'decisions', githubProjectId ?? null, statusKey] as const,
  factoryAudit: (githubProjectId: string | undefined, group: string) =>
    ['factory', 'audit', githubProjectId ?? null, group] as const,
  factoryAuditPortal: () => ['factory', 'audit-portal'] as const,
  sessions: (projectRepositoryId: string | undefined) => ['sessions', projectRepositoryId ?? null] as const,
  workspaces: (projectRepositoryId: string | undefined) => ['sessions', projectRepositoryId ?? null] as const,
  userSession: (sessionId: string | undefined) => ['user-session', sessionId ?? null] as const,
  ensureSandbox: (projectRepositoryId: string | undefined) => ['ensure-sandbox', projectRepositoryId ?? null] as const,
  ensureSandboxProgress: (projectRepositoryId: string | undefined) =>
    ['ensure-sandbox-progress', projectRepositoryId ?? null] as const,
  providers: () => ['providers'] as const,
  availableModels: () => ['available-models'] as const,
  customProviders: () => ['custom-providers'] as const,
  modelPacks: (resourceId: string | undefined) => ['model-packs', resourceId ?? null] as const,
  /** Prefix that matches every `modelPacks(*)` entry — pack CRUD is global, so it invalidates all of them. */
  modelPacksAll: () => ['model-packs'] as const,
  om: (resourceId: string | undefined) => ['om', resourceId ?? null] as const,
  fsList: (path: string | undefined) => ['fs-list', path ?? null] as const,
  artifactsList: (path: string | undefined) => ['artifacts-list', path ?? null] as const,
  workspaceRenderedList: (workspacePath: string | undefined, renderedRoot: string | undefined) =>
    ['workspace-rendered-list', workspacePath ?? null, renderedRoot ?? null] as const,
  workspaceFile: (workspacePath: string | undefined, filePath: string | undefined) =>
    ['workspace-file', workspacePath ?? null, filePath ?? null] as const,
  planFile: (workspacePath: string | undefined, filePath: string | undefined) =>
    ['plan-file', workspacePath ?? null, filePath ?? null] as const,
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
  agentControllerConnectionInit: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => [...queryKeys.agentControllerConnection(agentControllerId, resourceId, projectPath), 'init'] as const,
  agentControllerConnectionState: (
    agentControllerId: string | undefined,
    resourceId: string | undefined,
    projectPath: string | undefined,
  ) => [...queryKeys.agentControllerConnection(agentControllerId, resourceId, projectPath), 'state'] as const,
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
    // The transcript is fetched as a bounded newest-N window; the limit is part
    // of the cache key so read (`useAgentControllerThreadMessages`) and write
    // (optimistic seed / prefetch) paths hydrate the same entry. Callers that
    // seed a thread's initial transcript must pass `INITIAL_THREAD_MESSAGE_LIMIT`
    // so the value matches the hook's first read.
    limit?: number,
  ) =>
    [
      'agent-controller',
      agentControllerId ?? null,
      'sessions',
      resourceId ?? null,
      'threads',
      threadId ?? null,
      'messages',
      ...(limit === undefined ? [] : [limit]),
    ] as const,
} as const;
