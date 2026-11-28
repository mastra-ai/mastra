import { factoryKeys, factoryWebKeys } from '@mastra/react/hooks/factory';
import type { BoardPhasesRequest, SessionRowsRequest } from './types';

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

export type { AvailableModelsFilter } from '@mastra/react/hooks/factory';

export const queryKeys = {
  serverFeatures: () => ['server-features'] as const,
  serverVersions: () => ['server-versions'] as const,
  serverStatus: () => ['server-status'] as const,
  factoryAuth: () => ['factory-auth'] as const,
  factories: () => ['factories'] as const,
  boardCatalog: factoryKeys.boardCatalog,
  board: factoryKeys.board,
  boardWrite: factoryKeys.boardWrite,
  persistedFactories: () => ['factories', 'persisted'] as const,
  factoryProject: (factoryProjectId: string | undefined) => ['factory', 'project', factoryProjectId ?? null] as const,
  factoryEnvironment: (factoryProjectId: string | undefined) =>
    ['factory', 'environment', factoryProjectId ?? null] as const,
  // Not under `factoryEnvironment`: the build query invalidates the environment when a build settles, and a
  // shared prefix would cancel and restart that same fetch.
  factoryEnvironmentBuilds: (factoryProjectId: string | undefined) =>
    ['factory', 'environment-builds', factoryProjectId ?? null] as const,
  factoryEnvironmentBuild: (factoryProjectId: string | undefined, buildId: string | undefined) =>
    ['factory', 'environment-build', factoryProjectId ?? null, buildId ?? null] as const,
  factorySandboxEnvs: (factoryProjectId: string | undefined) =>
    ['factory', 'sandbox-envs', factoryProjectId ?? null] as const,
  githubStatus: () => ['github', 'status'] as const,
  githubPat: () => ['github', 'pat'] as const,
  githubRepos: (query: string | undefined) => ['github', 'repos', query ?? null] as const,
  githubIssue: (githubProjectId: string | undefined, number: number | undefined) =>
    ['github', 'issue', githubProjectId ?? null, number ?? null] as const,
  githubPull: (githubProjectId: string | undefined, number: number | undefined) =>
    ['github', 'pr', githubProjectId ?? null, number ?? null] as const,
  repositorySettings: (projectRepositoryId: string | undefined) =>
    ['source-control', 'repository-settings', projectRepositoryId ?? null] as const,
  gitlabStatus: (baseUrl: string) => ['gitlab', 'status', baseUrl] as const,
  gitlabProjects: (baseUrl: string) => ['gitlab', 'projects', baseUrl] as const,
  gitlabIssue: (baseUrl: string, factoryProjectId: string | undefined, issueId: string | undefined) =>
    ['gitlab', 'issue', baseUrl, factoryProjectId ?? null, issueId ?? null] as const,
  gitlabPull: (
    baseUrl: string,
    factoryProjectId: string | undefined,
    projectRepositoryId: string | undefined,
    number: number | undefined,
  ) => ['gitlab', 'pr', baseUrl, factoryProjectId ?? null, projectRepositoryId ?? null, number ?? null] as const,
  linearStatus: () => ['linear', 'status'] as const,
  linearProjects: () => ['linear', 'projects'] as const,
  linearTeams: () => ['linear', 'teams'] as const,
  linearIssue: (factoryProjectId: string | undefined, identifier: string | undefined, issueId: string | undefined) =>
    ['linear', 'issue', factoryProjectId ?? null, identifier ?? null, issueId ?? null] as const,
  jiraStatus: () => ['jira', 'status'] as const,
  platformConnections: (provider: string) => ['platform-connections', provider] as const,
  connectTools: () => ['connect-tools'] as const,
  connectToolList: () => ['connect-tools', 'tools'] as const,
  jiraProjects: () => ['jira', 'projects'] as const,
  jiraIssue: (factoryProjectId: string | undefined, identifier: string | undefined, issueRef: string | undefined) =>
    ['jira', 'issue', factoryProjectId ?? null, identifier ?? null, issueRef ?? null] as const,
  incidentioSources: () => ['incidentio', 'sources'] as const,
  incidentioStatus: () => ['incidentio', 'status'] as const,
  incidentioIssue: (factoryProjectId: string | undefined, issueRef: string | undefined) =>
    ['incidentio', 'issue', factoryProjectId ?? null, issueRef ?? null] as const,
  intakeConfig: () => ['intake', 'config'] as const,
  intakeBindings: () => ['intake', 'bindings'] as const,
  intakeRoutes: factoryKeys.intakeRoutes,
  // Under the routes' key: a rule or order change refreshes the counts.
  intakeDryRun: (factoryProjectId: string | undefined) =>
    [...queryKeys.intakeRoutes(factoryProjectId), 'dry-run'] as const,
  // Under the routes' key: a rule change re-tests the item.
  intakeTest: (factoryProjectId: string | undefined, subject: string) =>
    [...queryKeys.intakeRoutes(factoryProjectId), 'test', subject] as const,
  intakeOrder: (factoryProjectId: string | undefined) => ['intake', 'order', factoryProjectId ?? null] as const,
  // Under the routes' key: a rule change refreshes its skips.
  intakeSkipped: (factoryProjectId: string | undefined) =>
    [...queryKeys.intakeRoutes(factoryProjectId), 'skipped'] as const,
  // Under the routes' key: a rule change refreshes which cards would move.
  intakeReroute: (factoryProjectId: string | undefined) =>
    [...queryKeys.intakeRoutes(factoryProjectId), 'reroute'] as const,
  intakeNotRouted: (factoryProjectId: string | undefined) =>
    ['intake', 'not-routed', factoryProjectId ?? null] as const,
  channelAccounts: () => ['channel-accounts'] as const,
  // Not under the board's key: card rewrites there expect a board snapshot.
  workItemSessionRepository: (
    factoryProjectId: string | undefined,
    workItemId: string | undefined,
    cardUpdatedAt: string | undefined,
  ) =>
    [
      'factory',
      'work-item-session-repository',
      factoryProjectId ?? null,
      workItemId ?? null,
      cardUpdatedAt ?? null,
    ] as const,
  workItems: factoryKeys.workItems,
  // Under the board's key: whatever refreshes or rewrites the board's cards reaches these too.
  sessionWorkItems: factoryKeys.sessionWorkItems,
  workItem: factoryKeys.workItem,
  workItemsWithSessions: factoryKeys.workItemsWithSessions,
  unstartedWorkItems: (factoryProjectId: string | undefined, search: string) =>
    [...queryKeys.workItems(factoryProjectId), 'unstarted', search] as const,
  /** Every view of one board the tab holds. */
  boardPhases: factoryKeys.boardPhases,
  /** One view of a board; `windows` is how deep each of its phases is listed. */
  boardPhasesView: factoryKeys.boardPhasesView,
  // Outside the board's key: these hold counts and dates, not cards, so a rewrite of the cached cards must not reach them.
  boardFacts: factoryKeys.boardFacts,
  workItemStarters: factoryKeys.workItemStarters,
  workItemActivity: factoryKeys.workItemActivity,
  workItemFilterOptions: factoryKeys.workItemFilterOptions,
  // Apart from a session page's read of the same route, so the feed refreshes only the sidebar's.
  sidebarPullRequestSubscriptionsAll: () => ['sidebar-pull-request-subscriptions'] as const,
  sidebarPullRequestSubscriptions: (provider: string, sessionId: string, threadId: string) =>
    [...queryKeys.sidebarPullRequestSubscriptionsAll(), provider, sessionId, threadId] as const,
  knowledgeGraph: (factoryProjectId: string | undefined) =>
    ['factory', 'knowledge-graph', factoryProjectId ?? null] as const,
  knowledgePage: (factoryProjectId: string | undefined, pageId: string | null, noteCursor?: string) =>
    ['factory', 'knowledge-page', factoryProjectId ?? null, pageId, noteCursor ?? null] as const,
  knowledgeTreeLevel: (factoryProjectId: string | undefined, parentId: string | null, cursor?: string) =>
    ['factory', 'knowledge-tree', factoryProjectId ?? null, parentId, cursor ?? null] as const,
  knowledgeActivity: (factoryProjectId: string | undefined, pageId: string) =>
    ['factory', 'knowledge-activity', factoryProjectId ?? null, pageId] as const,
  knowledgeSearch: (factoryProjectId: string | undefined, query: string) =>
    ['factory', 'knowledge-search', factoryProjectId ?? null, query] as const,
  /** Every decision list for a project, whatever status filter it was fetched with. */
  factoryDecisionsRoot: factoryKeys.decisionsRoot,
  factoryDecisions: factoryKeys.decisions,
  /** Under the decision lists, so whatever refreshes them refreshes the queue too. */
  factoryRunQueue: factoryKeys.runQueue,
  factoryAudit: factoryKeys.audit,
  sessions: (factoryId: string | undefined) => ['sessions', factoryId ?? null] as const,
  userSession: (sessionId: string | undefined) => ['user-session', sessionId ?? null] as const,
  // Outside `workItems`: a rewrite of the cached cards must not reach these, which hold no card.
  sessionRowsRoot: factoryKeys.sessionRowsRoot,
  sessionRows: (factoryId: string | undefined, request: SessionRowsRequest) =>
    [...queryKeys.sessionRowsRoot(factoryId), request] as const,
  sessionActivity: factoryKeys.sessionActivity,
  providers: factoryWebKeys.providers,
  mastraGatewayCredits: factoryWebKeys.mastraGatewayCredits,
  availableModels: factoryWebKeys.availableModels,
  customProviders: () => ['custom-providers'] as const,
  defaultModel: factoryWebKeys.defaultModel,
  voiceSettingsAll: factoryWebKeys.voiceSettingsAll,
  voiceSettings: factoryWebKeys.voiceSettings,
  om: (sessionId: string | undefined, factoryId?: string, threadId?: string, resourceId?: string) =>
    ['om', sessionId ?? null, factoryId ?? null, threadId ?? null, resourceId ?? null] as const,
  factorySkills: (factoryProjectId?: string) => ['factory', 'skills', factoryProjectId ?? null] as const,
  fsList: factoryWebKeys.fsList,
  artifactsList: factoryWebKeys.artifactsList,
  workspaceRenderedList: factoryWebKeys.workspaceRenderedList,
  workspaceTreeScope: factoryWebKeys.workspaceTreeScope,
  workspaceTree: factoryWebKeys.workspaceTree,
  workspaceFileIndex: factoryWebKeys.workspaceFileIndex,
  workspaceFileScope: factoryWebKeys.workspaceFileScope,
  workspaceFile: factoryWebKeys.workspaceFile,
  planFile: factoryWebKeys.planFile,
  workspaceChanges: factoryWebKeys.workspaceChanges,
  workspacePatches: factoryWebKeys.workspacePatches,
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
