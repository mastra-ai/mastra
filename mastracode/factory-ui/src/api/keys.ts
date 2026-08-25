/**
 * Stable, scoped React Query keys for the settings API.
 *
 * Resource-scoped lists such as OM include the `resourceId` so switching
 * factories yields a distinct cache entry instead of leaking another factory's
 * data. Personal settings such as model packs use one user-scoped key. Keeping
 * every key in one place makes mutation invalidation unambiguous.
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
  serverFeatures: () => ['server-features'] as const,
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
  intakeBindings: () => ['intake', 'bindings'] as const,
  channelAccounts: () => ['channel-accounts'] as const,
  workItems: (factoryProjectId: string | undefined) => ['factory', 'work-items', factoryProjectId ?? null] as const,
  knowledgeGraph: (factoryProjectId: string | undefined, threadId?: string) =>
    ['factory', 'knowledge-graph', factoryProjectId ?? null, threadId ?? null] as const,
  knowledgeNode: (factoryProjectId: string | undefined, nodeId: string | undefined, threadId?: string) =>
    ['factory', 'knowledge-node', factoryProjectId ?? null, nodeId ?? null, threadId ?? null] as const,
  factoryMetrics: (githubProjectId: string | undefined, from: string, to: string) =>
    ['factory', 'metrics', githubProjectId ?? null, from, to] as const,
  factoryHealthThresholds: (githubProjectId: string | undefined) =>
    ['factory', 'health-thresholds', githubProjectId ?? null] as const,
  /** Every decision list for a project, whatever status filter it was fetched with. */
  factoryDecisionsRoot: (githubProjectId: string | undefined) =>
    ['factory', 'decisions', githubProjectId ?? null] as const,
  factoryDecisions: (githubProjectId: string | undefined, statusKey: string) =>
    ['factory', 'decisions', githubProjectId ?? null, statusKey] as const,
  factoryAttentionRoot: (factoryProjectId: string | undefined) =>
    ['factory', 'attention', factoryProjectId ?? null] as const,
  factoryAttention: (factoryProjectId: string | undefined, view: string, limit: number) =>
    [...queryKeys.factoryAttentionRoot(factoryProjectId), view, limit] as const,
  factoryAudit: (githubProjectId: string | undefined, group: string, actorKey?: string) =>
    ['factory', 'audit', githubProjectId ?? null, group, actorKey ?? null] as const,
  factoryAuditPortal: () => ['factory', 'audit-portal'] as const,
  sessions: (projectRepositoryId: string | undefined) => ['sessions', projectRepositoryId ?? null] as const,
  workspaces: (projectRepositoryId: string | undefined) => ['sessions', projectRepositoryId ?? null] as const,
  userSession: (sessionId: string | undefined) => ['user-session', sessionId ?? null] as const,
  workspaceAttention: (projectRepositoryId: string | undefined, sessionKind: 'factory' | 'user') =>
    ['workspace-attention', projectRepositoryId ?? null, sessionKind] as const,
  ensureSandbox: (projectRepositoryId: string | undefined) => ['ensure-sandbox', projectRepositoryId ?? null] as const,
  ensureSandboxProgress: (projectRepositoryId: string | undefined) =>
    ['ensure-sandbox-progress', projectRepositoryId ?? null] as const,
  providers: () => ['providers'] as const,
  availableModels: () => ['available-models'] as const,
  customProviders: () => ['custom-providers'] as const,
  modelPacksAll: () => ['model-packs'] as const,
  modelPacks: (resourceId: string | undefined, scope: string | undefined) =>
    [...queryKeys.modelPacksAll(), resourceId ?? null, scope ?? null] as const,
  om: (resourceId: string | undefined, factoryId?: string) => ['om', resourceId ?? null, factoryId ?? null] as const,
  thinkingConfig: () => ['thinking-config'] as const,
  factorySkills: () => ['factory', 'skills'] as const,
  fsList: (path: string | undefined) => ['fs-list', path ?? null] as const,
  artifactsList: (path: string | undefined) => ['artifacts-list', path ?? null] as const,
  workspaceRenderedList: (workspacePath: string | undefined, renderedRoot: string | undefined) =>
    ['workspace-rendered-list', workspacePath ?? null, renderedRoot ?? null] as const,
  workspaceFiles: (workspacePath: string | undefined, threadId: string | undefined) =>
    ['workspace-files', workspacePath ?? null, threadId ?? null] as const,
  workspaceFileScope: (workspacePath: string | undefined) => ['workspace-file', workspacePath ?? null] as const,
  workspaceFile: (workspacePath: string | undefined, filePath: string | undefined, threadId?: string) =>
    ['workspace-file', workspacePath ?? null, filePath ?? null, threadId ?? null] as const,
  // Keyed by toolCallId so each plan (re)submission fetches the file fresh
  // instead of reusing the previous submission's cached content.
  planFile: (workspacePath: string | undefined, filePath: string | undefined, toolCallId: string | undefined) =>
    ['plan-file', workspacePath ?? null, filePath ?? null, toolCallId ?? null] as const,
  workspaceChanges: (workspacePath: string | undefined) => ['workspace-changes', workspacePath ?? null] as const,
  workspaceDiff: (
    workspacePath: string | undefined,
    filePath: string | undefined,
    previousFilePath: string | undefined,
  ) => ['workspace-changes', workspacePath ?? null, 'diff', filePath ?? null, previousFilePath ?? null] as const,
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
    threadId?: string,
  ) =>
    [
      ...queryKeys.agentControllerConnection(agentControllerId, resourceId, projectPath),
      'state',
      ...(threadId ? [threadId] : []),
    ] as const,
  // Session state must stay out of the key: it would reset the query on navigation, and a reset reads as every run going idle.
  agentControllerActivity: (agentControllerId: string | undefined, baseUrl: string) =>
    ['agent-controller', agentControllerId ?? null, 'activity', baseUrl] as const,
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
  // Prefix over every thread's messages for a resource — invalidation target
  // when an SSE gap may have dropped events for any thread of the session.
  agentControllerResourceThreadMessages: (agentControllerId: string | undefined, resourceId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'sessions', resourceId ?? null, 'threads'] as const,
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
      ...queryKeys.agentControllerResourceThreadMessages(agentControllerId, resourceId),
      threadId ?? null,
      'messages',
      ...(limit === undefined ? [] : [limit]),
    ] as const,
} as const;
