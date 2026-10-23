import type { WorkspaceChangesScope } from './types';

/**
 * Stable, scoped React Query keys for the settings API.
 *
 * Resource-scoped lists such as OM include the `resourceId` so switching
 * factories yields a distinct cache entry instead of leaking another factory's
 * data. Personal settings such as the default model use one user-scoped key. Keeping
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

export interface AvailableModelsFilter {
  factoryProjectId?: string;
  scope?: 'org' | 'user';
  sessionId?: string;
  resourceId?: string;
  threadId?: string;
}

export const queryKeys = {
  serverFeatures: () => ['server-features'] as const,
  factoryAuth: () => ['factory-auth'] as const,
  factories: () => ['factories'] as const,
  boardCatalog: (factoryProjectId: string | undefined) => ['factory', 'boards', factoryProjectId ?? null] as const,
  persistedFactories: () => ['factories', 'persisted'] as const,
  factoryCreateFlow: () => ['factories', 'create-flow'] as const,
  factoryProject: (factoryProjectId: string | undefined) => ['factory', 'project', factoryProjectId ?? null] as const,
  factoryEnvironment: (factoryProjectId: string | undefined) =>
    ['factory', 'environment', factoryProjectId ?? null] as const,
  // Not under `factoryEnvironment`: the build query invalidates the environment when a build settles, and a
  // shared prefix would cancel and restart that same fetch.
  factoryEnvironmentBuilds: (factoryProjectId: string | undefined) =>
    ['factory', 'environment-builds', factoryProjectId ?? null] as const,
  factoryEnvironmentBuild: (factoryProjectId: string | undefined, buildId: string | undefined) =>
    ['factory', 'environment-build', factoryProjectId ?? null, buildId ?? null] as const,
  githubStatus: () => ['github', 'status'] as const,
  githubPat: () => ['github', 'pat'] as const,
  githubRepos: (query: string | undefined) => ['github', 'repos', query ?? null] as const,
  githubIssues: (projectRepositoryIds: readonly string[], label?: string) =>
    ['github', 'issues', projectRepositoryIds, label ?? null] as const,
  githubIssue: (githubProjectId: string | undefined, number: number | undefined) =>
    ['github', 'issue', githubProjectId ?? null, number ?? null] as const,
  githubPulls: (projectRepositoryIds: readonly string[]) => ['github', 'prs', projectRepositoryIds] as const,
  githubPull: (githubProjectId: string | undefined, number: number | undefined) =>
    ['github', 'pr', githubProjectId ?? null, number ?? null] as const,
  repositorySettings: (projectRepositoryId: string | undefined) =>
    ['source-control', 'repository-settings', projectRepositoryId ?? null] as const,
  gitlabStatus: (baseUrl: string) => ['gitlab', 'status', baseUrl] as const,
  gitlabProjects: (baseUrl: string) => ['gitlab', 'projects', baseUrl] as const,
  gitlabIssuesAll: (baseUrl: string) => ['gitlab', 'issues', baseUrl] as const,
  gitlabIssues: (baseUrl: string, factoryProjectId: string | undefined, board: string | undefined) =>
    [...queryKeys.gitlabIssuesAll(baseUrl), factoryProjectId ?? null, board ?? null] as const,
  gitlabIssue: (baseUrl: string, factoryProjectId: string | undefined, issueId: string | undefined) =>
    ['gitlab', 'issue', baseUrl, factoryProjectId ?? null, issueId ?? null] as const,
  gitlabPulls: (baseUrl: string, factoryProjectId: string | undefined, projectRepositoryId: string | undefined) =>
    ['gitlab', 'prs', baseUrl, factoryProjectId ?? null, projectRepositoryId ?? null] as const,
  gitlabPull: (
    baseUrl: string,
    factoryProjectId: string | undefined,
    projectRepositoryId: string | undefined,
    number: number | undefined,
  ) => ['gitlab', 'pr', baseUrl, factoryProjectId ?? null, projectRepositoryId ?? null, number ?? null] as const,
  linearStatus: () => ['linear', 'status'] as const,
  linearProjects: () => ['linear', 'projects'] as const,
  linearTeams: () => ['linear', 'teams'] as const,
  linearIssuesAll: () => ['linear', 'issues'] as const,
  linearIssues: (githubProjectId: string | undefined) =>
    [...queryKeys.linearIssuesAll(), githubProjectId ?? null] as const,
  linearIssue: (factoryProjectId: string | undefined, identifier: string | undefined, issueId: string | undefined) =>
    ['linear', 'issue', factoryProjectId ?? null, identifier ?? null, issueId ?? null] as const,
  jiraStatus: () => ['jira', 'status'] as const,
  platformConnections: (provider: string) => ['platform-connections', provider] as const,
  jiraProjects: () => ['jira', 'projects'] as const,
  jiraIssuesAll: () => ['jira', 'issues'] as const,
  jiraIssues: (factoryProjectId: string | undefined) =>
    [...queryKeys.jiraIssuesAll(), factoryProjectId ?? null] as const,
  jiraIssue: (factoryProjectId: string | undefined, identifier: string | undefined, issueRef: string | undefined) =>
    ['jira', 'issue', factoryProjectId ?? null, identifier ?? null, issueRef ?? null] as const,
  incidentioSources: () => ['incidentio', 'sources'] as const,
  incidentioStatus: () => ['incidentio', 'status'] as const,
  incidentioIssuesAll: () => ['incidentio', 'issues'] as const,
  incidentioIssues: (factoryProjectId: string | undefined) =>
    [...queryKeys.incidentioIssuesAll(), factoryProjectId ?? null] as const,
  incidentioIssue: (factoryProjectId: string | undefined, issueRef: string | undefined) =>
    ['incidentio', 'issue', factoryProjectId ?? null, issueRef ?? null] as const,
  intakeConfig: () => ['intake', 'config'] as const,
  intakeBindings: () => ['intake', 'bindings'] as const,
  intakeLabelRoutes: (factoryProjectId: string | undefined) =>
    ['intake', 'label-routes', factoryProjectId ?? null] as const,
  channelAccounts: () => ['channel-accounts'] as const,
  workItems: (factoryProjectId: string | undefined) => ['factory', 'work-items', factoryProjectId ?? null] as const,
  /** Every comment read, all work items — the catch-up target after a stream drop. */
  workItemCommentsAll: () => ['factory', 'work-item-comments'] as const,
  /** Every comment read for a work item — the invalidation target for a feed event. */
  workItemCommentsRoot: (workItemId: string | undefined) =>
    [...queryKeys.workItemCommentsAll(), workItemId ?? null] as const,
  // Page size is baked into the service, so feed surfaces share one cache entry
  // per anchor: a deep link opens on a different first page than a plain read.
  workItemComments: (workItemId: string | undefined, aroundCommentId?: string) =>
    [...queryKeys.workItemCommentsRoot(workItemId), 'list', aroundCommentId ?? null] as const,
  factoryMembers: (factoryProjectId: string | undefined) =>
    ['factory', 'mention-roster', factoryProjectId ?? null] as const,
  knowledgeScopes: (factoryProjectId: string | undefined, threadId?: string) =>
    ['factory', 'knowledge-scopes', factoryProjectId ?? null, threadId ?? null] as const,
  knowledgeSearch: (factoryProjectId: string | undefined, query: string, threadId?: string) =>
    ['factory', 'knowledge-search', factoryProjectId ?? null, query, threadId ?? null] as const,
  knowledgeGraph: (factoryProjectId: string | undefined, scopeLevel: string | undefined, threadId?: string) =>
    ['factory', 'knowledge-subgraph', factoryProjectId ?? null, scopeLevel ?? null, threadId ?? null] as const,
  knowledgeActivity: (factoryProjectId: string | undefined, scopeLevel: string | undefined, threadId?: string) =>
    ['factory', 'knowledge-activity', factoryProjectId ?? null, scopeLevel ?? null, threadId ?? null] as const,
  knowledgeNode: (
    factoryProjectId: string | undefined,
    nodeId: string | undefined,
    scopeLevel: string | undefined,
    threadId?: string,
  ) => ['factory', 'knowledge-node', factoryProjectId ?? null, nodeId ?? null, scopeLevel, threadId ?? null] as const,
  /** Every decision list for a project, whatever status filter it was fetched with. */
  factoryDecisionsRoot: (githubProjectId: string | undefined) =>
    ['factory', 'decisions', githubProjectId ?? null] as const,
  factoryDecisions: (githubProjectId: string | undefined, statusKey: string) =>
    ['factory', 'decisions', githubProjectId ?? null, statusKey] as const,
  factoryAudit: (githubProjectId: string | undefined, group: string, actorKey?: string) =>
    ['factory', 'audit', githubProjectId ?? null, group, actorKey ?? null] as const,
  sessions: (factoryId: string | undefined) => ['sessions', factoryId ?? null] as const,
  userSession: (sessionId: string | undefined) => ['user-session', sessionId ?? null] as const,
  providers: () => ['providers'] as const,
  availableModels: (filter?: AvailableModelsFilter) =>
    filter ? (['available-models', filter] as const) : (['available-models'] as const),
  customProviders: () => ['custom-providers'] as const,
  defaultModel: () => ['default-model'] as const,
  om: (sessionId: string | undefined, factoryId?: string) => ['om', sessionId ?? null, factoryId ?? null] as const,
  factorySkills: () => ['factory', 'skills'] as const,
  fsList: (path: string | undefined) => ['fs-list', path ?? null] as const,
  artifactsList: (path: string | undefined) => ['artifacts-list', path ?? null] as const,
  workspaceRenderedList: (workspacePath: string | undefined, renderedRoot: string | undefined) =>
    ['workspace-rendered-list', workspacePath ?? null, renderedRoot ?? null] as const,
  workspaceTreeScope: (workspacePath: string | undefined) => ['workspace-tree', workspacePath ?? null] as const,
  workspaceTree: (workspacePath: string | undefined, path: string) =>
    ['workspace-tree', workspacePath ?? null, path] as const,
  workspaceFileScope: (workspacePath: string | undefined) => ['workspace-file', workspacePath ?? null] as const,
  workspaceFile: (workspacePath: string | undefined, filePath: string | undefined) =>
    ['workspace-file', workspacePath ?? null, filePath ?? null] as const,
  // Keyed by toolCallId so each plan (re)submission fetches the file fresh
  // instead of reusing the previous submission's cached content.
  planFile: (workspacePath: string | undefined, filePath: string | undefined, toolCallId: string | undefined) =>
    ['plan-file', workspacePath ?? null, filePath ?? null, toolCallId ?? null] as const,
  workspaceChanges: (workspacePath: string | undefined) => ['workspace-changes', workspacePath ?? null] as const,
  workspacePatches: (workspacePath: string | undefined, scope: WorkspaceChangesScope) =>
    ['workspace-changes', workspacePath ?? null, 'patches', scope] as const,
  // Session-derived keys are addressed by the session id: sessions that share a
  // memory resource (a Factory's runs, a user's sessions) keep independent state.
  agentControllerSession: (agentControllerId: string | undefined, sessionId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'sessions', sessionId ?? null] as const,
  // Keep connection state outside agentControllerSession: mutation hooks invalidate that prefix,
  // and a sync refetch would bump dataUpdatedAt and wipe the live transcript.
  agentControllerConnection: (agentControllerId: string | undefined, sessionId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'connection', sessionId ?? null] as const,
  agentControllerConnectionInit: (agentControllerId: string | undefined, sessionId: string | undefined) =>
    [...queryKeys.agentControllerConnection(agentControllerId, sessionId), 'init'] as const,
  agentControllerConnectionState: (
    agentControllerId: string | undefined,
    sessionId: string | undefined,
    threadId?: string,
  ) =>
    [
      ...queryKeys.agentControllerConnection(agentControllerId, sessionId),
      'state',
      ...(threadId ? [threadId] : []),
    ] as const,
  // Session state must stay out of the key: it would reset the query on navigation, and a reset reads as every run going idle.
  agentControllerActivity: (agentControllerId: string | undefined, baseUrl: string) =>
    ['agent-controller', agentControllerId ?? null, 'activity', baseUrl] as const,
  agentControllerSettings: (agentControllerId: string | undefined, sessionId: string | undefined) =>
    [...queryKeys.agentControllerSession(agentControllerId, sessionId), 'settings'] as const,
  agentControllerPermissions: (agentControllerId: string | undefined, sessionId: string | undefined) =>
    [...queryKeys.agentControllerSession(agentControllerId, sessionId), 'permissions'] as const,
  agentControllerThreads: (agentControllerId: string | undefined, sessionId: string | undefined) =>
    [...queryKeys.agentControllerSession(agentControllerId, sessionId), 'threads'] as const,
  // Prefix over every thread's messages for a session — invalidation target
  // when an SSE gap may have dropped events for any thread of the session. Kept
  // outside agentControllerSession so session invalidation leaves transcripts alone.
  agentControllerSessionThreadMessages: (agentControllerId: string | undefined, sessionId: string | undefined) =>
    ['agent-controller', agentControllerId ?? null, 'thread-messages', sessionId ?? null] as const,
  // Thread ids are unique, so messages are keyed by session and thread id.
  agentControllerThreadMessages: (
    agentControllerId: string | undefined,
    sessionId: string | undefined,
    threadId: string | undefined,
    // The transcript is fetched as a bounded newest-N window; the limit is part
    // of the cache key so read (`useAgentControllerThreadMessages`) and write
    // (optimistic seed / prefetch) paths hydrate the same entry. Callers that
    // seed a thread's initial transcript must pass `INITIAL_THREAD_MESSAGE_LIMIT`
    // so the value matches the hook's first read.
    limit?: number,
  ) =>
    [
      ...queryKeys.agentControllerSessionThreadMessages(agentControllerId, sessionId),
      threadId ?? null,
      'messages',
      ...(limit === undefined ? [] : [limit]),
    ] as const,
} as const;
