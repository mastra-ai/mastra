export type AgentVersionRouteMode =
  | 'resolved-read'
  | 'new-execution'
  | 'continuation'
  | 'passive-observation'
  | 'management';

export type AgentVersionRoutePolicy =
  | 'query-selector'
  | 'body-selector'
  | 'selector-and-persisted-pin'
  | 'persisted-pin'
  | 'default-only'
  | 'core-owned';

export type AgentVersionRouteMatrixEntry = {
  method: string;
  path: string;
  modes: readonly AgentVersionRouteMode[];
  policy: AgentVersionRoutePolicy;
  note?: string;
};

const route = (
  method: string,
  path: string,
  modes: readonly AgentVersionRouteMode[],
  policy: AgentVersionRoutePolicy,
  note?: string,
): AgentVersionRouteMatrixEntry => ({ method, path, modes, policy, ...(note ? { note } : {}) });

/**
 * Maintained inventory for every public server surface that directly hydrates
 * an Agent or delegates execution to an Agent-owning core controller.
 *
 * `default-only` and `core-owned` are deliberate exclusions: they distinguish
 * management/passive behavior from a missed version-selection boundary.
 */
export const AGENT_VERSION_ROUTE_MATRIX = [
  // Resolved reads whose returned configuration changes with the selected version.
  route('GET', '/agents/:agentId', ['resolved-read'], 'query-selector'),
  route('GET', '/agents/:agentId/tools/:toolId', ['resolved-read'], 'query-selector'),
  route('GET', '/agents/:agentId/plans/file', ['resolved-read'], 'query-selector'),
  route('GET', '/agents/:agentId/skills/:skillName', ['resolved-read'], 'query-selector'),
  route('GET', '/.well-known/:agentId/agent-card.json', ['resolved-read'], 'query-selector'),
  route('GET', '/stored/agents/:storedAgentId', ['resolved-read'], 'query-selector'),

  // New executions select once at the HTTP root and forward only dependency overrides.
  route('POST', '/agents/:agentId/generate', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/generate/vnext', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/generate-legacy', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/stream', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/stream-legacy', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/stream-until-idle', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/stream/vnext', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/network', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/tools/:toolId/execute', ['new-execution'], 'body-selector'),
  route('POST', '/agents/:agentId/instructions/enhance', ['new-execution'], 'query-selector'),
  route('POST', '/datasets/:datasetId/experiments', ['new-execution', 'management'], 'body-selector'),

  // A previous Responses turn and an interrupted A2A task become continuations.
  route('POST', '/v1/responses', ['new-execution', 'continuation'], 'selector-and-persisted-pin'),
  route(
    'POST',
    '/a2a/:agentId',
    ['new-execution', 'continuation', 'passive-observation'],
    'selector-and-persisted-pin',
  ),
  route('POST', '/agents/:agentId/signals', ['new-execution', 'continuation'], 'selector-and-persisted-pin'),
  route('POST', '/agents/:agentId/send-message', ['new-execution', 'continuation'], 'selector-and-persisted-pin'),
  route('POST', '/agents/:agentId/queue-message', ['new-execution', 'continuation'], 'selector-and-persisted-pin'),

  // Server-owned continuation routes hydrate from the immutable workflow pin.
  route('POST', '/agents/:agentId/approve-tool-call', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/decline-tool-call', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/resume-stream', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/recover', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/resume-stream-until-idle', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/approve-tool-call-generate', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/decline-tool-call-generate', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/approve-network-tool-call', ['continuation'], 'persisted-pin'),
  route('POST', '/agents/:agentId/decline-network-tool-call', ['continuation'], 'persisted-pin'),

  // AgentController sessions select/pin the current mode agent for each new
  // turn. Live approval/suspension continuations remain on the already-pinned
  // in-process Session stream; the remaining routes are storage/session state.
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/messages', ['new-execution'], 'body-selector'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/steer', ['new-execution'], 'body-selector'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/follow-up', ['new-execution'], 'body-selector'),
  route(
    'POST',
    '/agent-controller/:controllerId/sessions/:resourceId/notifications',
    ['new-execution'],
    'body-selector',
  ),
  route(
    'POST',
    '/agent-controller/:controllerId/sessions/:resourceId/tool-approval',
    ['continuation'],
    'core-owned',
    'The live Session resumes its already-resolved stream; it does not hydrate an agent.',
  ),
  route(
    'POST',
    '/agent-controller/:controllerId/sessions/:resourceId/tool-suspension',
    ['continuation'],
    'core-owned',
    'The live Session resumes its already-resolved stream; it does not hydrate an agent.',
  ),
  route('GET', '/agent-controller', ['management'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions', ['management'], 'default-only'),
  route('GET', '/agent-controller/:controllerId/sessions/:resourceId/stream', ['passive-observation'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/abort', ['management'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/mode', ['management'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/model', ['management'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/thread', ['management'], 'default-only'),
  route('GET', '/agent-controller/:controllerId/sessions/:resourceId', ['passive-observation'], 'default-only'),
  route('GET', '/agent-controller/:controllerId/modes', ['management'], 'default-only'),
  route('GET', '/agent-controller/:controllerId/active-runs', ['passive-observation'], 'default-only'),
  route('GET', '/agent-controller/:controllerId/sessions/:resourceId/threads', ['passive-observation'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/threads', ['management'], 'default-only'),
  route(
    'DELETE',
    '/agent-controller/:controllerId/sessions/:resourceId/threads/:threadId',
    ['management'],
    'default-only',
  ),
  route(
    'PUT',
    '/agent-controller/:controllerId/sessions/:resourceId/threads/:threadId',
    ['management'],
    'default-only',
  ),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/threads/clone', ['management'], 'default-only'),
  route(
    'GET',
    '/agent-controller/:controllerId/sessions/:resourceId/threads/:threadId/messages',
    ['passive-observation'],
    'default-only',
  ),
  route('GET', '/agent-controller/:controllerId/models', ['management'], 'default-only'),
  route('GET', '/agent-controller/:controllerId/workspace', ['passive-observation'], 'default-only'),
  route('GET', '/agent-controller/:controllerId/sessions/:resourceId/om', ['passive-observation'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/resource', ['management'], 'default-only'),
  route(
    'GET',
    '/agent-controller/:controllerId/sessions/:resourceId/resources',
    ['passive-observation'],
    'default-only',
  ),
  route('GET', '/agent-controller/:controllerId/sessions/:resourceId/goal', ['passive-observation'], 'default-only'),
  route('POST', '/agent-controller/:controllerId/sessions/:resourceId/goal', ['management'], 'default-only'),
  route('PUT', '/agent-controller/:controllerId/sessions/:resourceId/goal', ['management'], 'default-only'),
  route('DELETE', '/agent-controller/:controllerId/sessions/:resourceId/goal', ['management'], 'default-only'),
  route(
    'GET',
    '/agent-controller/:controllerId/sessions/:resourceId/permissions',
    ['passive-observation'],
    'default-only',
  ),
  route(
    'PUT',
    '/agent-controller/:controllerId/sessions/:resourceId/permissions/category',
    ['management'],
    'default-only',
  ),
  route('PUT', '/agent-controller/:controllerId/sessions/:resourceId/permissions/tool', ['management'], 'default-only'),
  route('PUT', '/agent-controller/:controllerId/sessions/:resourceId/state', ['management'], 'default-only'),

  // Passive/thread-session routes need identity or pubsub, not a mutable config selection.
  route('POST', '/agents/:agentId/observe', ['passive-observation'], 'default-only'),
  route('POST', '/agents/:agentId/threads/abort', ['passive-observation'], 'default-only'),
  route('POST', '/agents/:agentId/threads/subscribe', ['passive-observation'], 'default-only'),
  route('GET', '/agents/:agentId/suspended-runs', ['passive-observation'], 'default-only'),
  route(
    'POST',
    '/agents/:agentId/send-tool-approval',
    ['continuation'],
    'selector-and-persisted-pin',
    'An optional source runId hydrates workflow-backed or retained-history pins before every approval continuation, including cross-process message continuations.',
  ),

  // Agent metadata/mutation surfaces intentionally target the default configured agent.
  route('GET', '/agents', ['management'], 'default-only'),
  route('GET', '/agents/providers', ['management'], 'default-only'),
  route('POST', '/agents/:agentId/clone', ['management'], 'default-only'),
  route('POST', '/agents/:agentId/model', ['management'], 'default-only'),
  route('POST', '/agents/:agentId/model/reset', ['management'], 'default-only'),
  route('POST', '/agents/:agentId/models/reorder', ['management'], 'default-only'),
  route('POST', '/agents/:agentId/models/:modelConfigId', ['management'], 'default-only'),
  route('POST', '/agents/:agentId/streamVNext', ['management'], 'default-only', 'Deprecated no-op.'),
  route('POST', '/agents/:agentId/stream/vnext/ui', ['management'], 'default-only', 'Deprecated no-op.'),
  route('POST', '/agents/:agentId/stream/ui', ['management'], 'default-only', 'Deprecated no-op.'),

  // Server wrappers resolve once before delegating to the core-owned voice behavior.
  route('GET', '/agents/:agentId/voice/speakers', ['resolved-read'], 'query-selector'),
  route('GET', '/agents/:agentId/speakers', ['resolved-read'], 'query-selector'),
  route('POST', '/agents/:agentId/voice/speak', ['new-execution'], 'query-selector'),
  route('POST', '/agents/:agentId/speak', ['new-execution'], 'query-selector'),
  route('POST', '/agents/:agentId/voice/listen', ['new-execution'], 'query-selector'),
  route('POST', '/agents/:agentId/listen', ['new-execution'], 'query-selector'),
  route('GET', '/agents/:agentId/voice/listener', ['resolved-read'], 'query-selector'),

  // Responses/conversations scan agent memory but do not execute hydrated behavior.
  route('GET', '/v1/responses/:responseId', ['passive-observation'], 'default-only'),
  route('DELETE', '/v1/responses/:responseId', ['management'], 'default-only'),
  route('POST', '/v1/conversations', ['management'], 'default-only'),
  route('GET', '/v1/conversations/:conversationId', ['passive-observation'], 'default-only'),
  route('GET', '/v1/conversations/:conversationId/items', ['passive-observation'], 'default-only'),
  route('DELETE', '/v1/conversations/:conversationId', ['management'], 'default-only'),

  // Scoring enumerates agent-associated scorer metadata; it never runs the agents.
  route('GET', '/scores/scorers', ['management'], 'default-only'),
  route('GET', '/scores/scorers/:scorerId', ['management'], 'default-only'),
  route('GET', '/scores/run/:runId', ['passive-observation'], 'default-only'),
  route('GET', '/scores/scorer/:scorerId', ['passive-observation'], 'default-only'),
  route('GET', '/scores/entity/:entityType/:entityId', ['passive-observation'], 'default-only'),
  route('POST', '/scores', ['management'], 'default-only'),
] as const satisfies readonly AgentVersionRouteMatrixEntry[];

/** Audited agent-owning route families without a per-request version contract. */
export const AGENT_VERSION_DEFAULT_ONLY_FAMILIES = [
  { prefix: '/memory', mode: 'management', reason: 'Memory/thread storage is agent-version neutral.' },
  { prefix: '/channels', mode: 'management', reason: 'Channel installation state targets agent identity.' },
  { prefix: '/schedules', mode: 'management', reason: 'Schedules persist an agent id, not hydrated behavior.' },
  {
    prefix: '/stored/agents',
    mode: 'management',
    reason: 'Except for the inventoried resolved detail read, stored-agent CRUD and explicit version routes are management.',
  },
] as const;
