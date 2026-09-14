import type {
  Body,
  ClientRequest,
  Conversation,
  ConversationItemsPage,
  CreateConversationParams,
  CreateDatasetParams,
  CreateResponseParams,
  DatasetExperiment,
  DatasetRecord,
  GetAgentResponse,
  GetToolResponse,
  GetWorkflowResponse,
  ListMemoryThreadsParams,
  ListSchedulesParams,
  McpServerListResponse,
  ScheduleResponse,
  ScheduleTriggerResponse,
  McpToolInfo,
  QueryVectorParams,
  ExecuteProcessorParams,
  GetProcessorDetailResponse,
  ListScoresByRunIdParams,
  ListWorkflowRunsParams,
  ListWorkflowRunsResponse,
  PathParams,
  QueryParams,
  ResponsesDeleteResponse,
  ResponsesResponse,
  RouteRequest,
  RouteResponse,
  StoredAgentResponse,
  ListStoredAgentsParams,
  StoredSkillResponse,
  ListStoredSkillsResponse,
  StoredWorkspaceResponse,
  ListStoredWorkspacesParams,
  StoredMCPClientResponse,
  StoredScorerResponse,
  StoredPromptBlockResponse,
  BuilderSettingsResponse,
  InfrastructureStatusResponse,
  BuilderRegistrySearchResponse,
  BuilderRegistryInstallBody,
  GetAgentBuilderActionsResponse,
  AgentControllerSessionState,
  AgentControllerThreadInfo,
} from '../src/index.js';
import type { AgentBuilder } from '../src/resources/agent-builder.js';
import type { Agent } from '../src/resources/agent.js';
import type { MCPTool } from '../src/resources/mcp-tool.js';
import type { MemoryThread } from '../src/resources/memory-thread.js';
import type {
  ListTracesArgs as ObservabilityListTracesArgs,
  ListTracesResponse as ObservabilityListTracesResponse,
} from '../src/resources/observability-route-types.js';
import type { Vector } from '../src/resources/vector.js';

type Equal<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type _DefaultedResponsesInput = Expect<
  Equal<
    Pick<Body<'POST /v1/responses'>, 'stream' | 'store'>,
    { stream?: boolean | undefined; store?: boolean | undefined }
  >
>;

type _ScoresPaginationInput = Expect<
  Equal<QueryParams<'GET /scores/run/:runId'>, { page?: number | undefined; perPage?: number | undefined }>
>;

type _PreprocessedMemoryThreadsInput = Expect<
  Equal<
    QueryParams<'GET /memory/threads'>['orderBy'],
    { field?: 'createdAt' | 'updatedAt' | undefined; direction?: 'ASC' | 'DESC' | undefined } | undefined
  >
>;

type _ResponsesOutput = Expect<
  Equal<
    Pick<RouteResponse<'POST /v1/responses'>, 'created_at' | 'status'>,
    { created_at: number; status: 'in_progress' | 'completed' | 'incomplete' }
  >
>;

type _ScoreRoutePathParams = Expect<Equal<PathParams<'GET /scores/run/:runId'>, { runId: string }>>;
type _ScoreClientRequest = Expect<
  Equal<ClientRequest<'/scores/run/:runId', 'GET'>, RouteRequest<'GET /scores/run/:runId'>>
>;

type _ResponsesHydration = Expect<Equal<Omit<ResponsesResponse, 'output_text'>, RouteResponse<'POST /v1/responses'>>>;
type _ResponsesDelete = Expect<Equal<ResponsesDeleteResponse, RouteResponse<'DELETE /v1/responses/:responseId'>>>;
type _ConversationResponse = Expect<Equal<Conversation['thread']['createdAt'], string>>;
type _ConversationItems = Expect<
  Equal<ConversationItemsPage, RouteResponse<'GET /v1/conversations/:conversationId/items'>>
>;
type _AgentDetails = Expect<Equal<GetAgentResponse, RouteResponse<'GET /agents/:agentId'>>>;
type _AgentDetailsDoNotExposeHandlerAbsentId = Expect<Equal<'id' extends keyof GetAgentResponse ? true : false, false>>;
type _ToolDetails = Expect<Equal<GetToolResponse, RouteResponse<'GET /tools/:toolId'>>>;
type _WorkflowDetails = Expect<Equal<GetWorkflowResponse, RouteResponse<'GET /workflows/:workflowId'>>>;
type _WorkflowRunDates = Expect<Equal<ListWorkflowRunsResponse['runs'][number]['createdAt'], string>>;

const scoreRequest = {
  params: { runId: 'run-1' },
  query: {},
} satisfies RouteRequest<'GET /scores/run/:runId'>;

const createResponse = {
  input: 'hello',
} satisfies CreateResponseParams;

const createConversation = {
  agent_id: 'agent-1',
} satisfies CreateConversationParams;

const workflowRunQuery = {
  fromDate: new Date(),
  limit: false,
} satisfies ListWorkflowRunsParams;

const vectorQuery = {
  indexName: 'index-1',
  queryVector: [0.1],
} satisfies QueryVectorParams;

const memoryThreads = {
  page: 1,
  orderBy: { field: 'createdAt', direction: 'DESC' },
} satisfies ListMemoryThreadsParams;

const processorExecution = {
  phase: 'input',
  messages: [],
} satisfies ExecuteProcessorParams;

type _ProcessorDetails = Expect<Equal<GetProcessorDetailResponse, RouteResponse<'GET /processors/:processorId'>>>;
type _McpServers = Expect<Equal<McpServerListResponse, RouteResponse<'GET /mcp/v0/servers'>>>;
type _McpTool = Expect<Equal<McpToolInfo, RouteResponse<'GET /mcp/:serverId/tools/:toolId'>>>;
type _ScheduleQuery = Expect<Equal<ListSchedulesParams, QueryParams<'GET /schedules'>>>;
type _ScheduleResponse = Expect<Equal<ScheduleResponse, RouteResponse<'GET /schedules'>['schedules'][number]>>;
type _ScheduleTrigger = Expect<
  Equal<ScheduleTriggerResponse, RouteResponse<'GET /schedules/:scheduleId/triggers'>['triggers'][number]>
>;
type _DatasetCreateInput = Expect<CreateDatasetParams extends Body<'POST /datasets'> ? true : false>;
type _DatasetRecord = Expect<Equal<keyof DatasetRecord, keyof RouteResponse<'GET /datasets/:datasetId'>>>;
type _DatasetExperiment = Expect<
  Equal<DatasetExperiment['id'], RouteResponse<'GET /experiments'>['experiments'][number]['id']>
>;
type _ObservabilityTraceQuery = Expect<Equal<QueryParams<'GET /observability/traces'>['page'], number | undefined>>;
type _ObservabilityTraceResponse = Expect<
  Equal<NonNullable<RouteResponse<'GET /observability/traces'>['pagination']>['page'], number>
>;
type _ObservabilityNestedFilter = Expect<
  Equal<
    NonNullable<ObservabilityListTracesArgs['filters']>['dateRange'],
    QueryParams<'GET /observability/traces'>['dateRange']
  >
>;
type _ObservabilitySerializedResponse = Expect<
  Equal<ObservabilityListTracesResponse['spans'][number]['startedAt'], string>
>;
const observabilityTraceQuery = {
  filters: { dateRange: { start: new Date() } },
  pagination: { page: 1 },
  orderBy: { field: 'startedAt', direction: 'DESC' },
} satisfies ObservabilityListTracesArgs;
type _ScoreListInput = Expect<
  ListScoresByRunIdParams extends PathParams<'GET /scores/run/:runId'> & QueryParams<'GET /scores/run/:runId'>
    ? true
    : false
>;
type _StoredAgent = Expect<Equal<StoredAgentResponse['id'], RouteResponse<'GET /stored/agents/:storedAgentId'>['id']>>;
type _StoredAgentListInput = Expect<
  Equal<ListStoredAgentsParams['favoritedOnly'], QueryParams<'GET /stored/agents'>['favoritedOnly']>
>;
type _StoredSkill = Expect<Equal<StoredSkillResponse['id'], RouteResponse<'GET /stored/skills/:storedSkillId'>['id']>>;
type _StoredSkillList = Expect<Equal<ListStoredSkillsResponse['total'], RouteResponse<'GET /stored/skills'>['total']>>;
type _StoredWorkspace = Expect<
  Equal<StoredWorkspaceResponse['id'], RouteResponse<'GET /stored/workspaces/:storedWorkspaceId'>['id']>
>;
type _StoredWorkspaceListInput = Expect<
  Equal<ListStoredWorkspacesParams['page'], QueryParams<'GET /stored/workspaces'>['page']>
>;
type _StoredMcpClient = Expect<
  Equal<StoredMCPClientResponse['id'], RouteResponse<'GET /stored/mcp-clients/:storedMCPClientId'>['id']>
>;
type _VectorDelete = Expect<
  Equal<ReturnType<Vector['delete']>, Promise<RouteResponse<'DELETE /vector/:vectorName/indexes/:indexName'>>>
>;
type _VectorUpsert = Expect<
  Equal<ReturnType<Vector['upsert']>, Promise<RouteResponse<'POST /vector/:vectorName/upsert'>>>
>;
type _MemoryThreadDelete = Expect<
  Equal<ReturnType<MemoryThread['delete']>, Promise<RouteResponse<'DELETE /memory/threads/:threadId'>>>
>;
type _MemoryMessagesDelete = Expect<
  Equal<ReturnType<MemoryThread['deleteMessages']>, Promise<RouteResponse<'POST /memory/messages/delete'>>>
>;
type _McpToolExecute = Expect<
  Equal<ReturnType<MCPTool['execute']>, Promise<RouteResponse<'POST /mcp/:serverId/tools/:toolId/execute'>>>
>;
type _AgentMessage = Expect<
  Equal<ReturnType<Agent['sendMessage']>, Promise<RouteResponse<'POST /agents/:agentId/send-message'>>>
>;
type _AgentSignal = Expect<
  Equal<ReturnType<Agent['sendSignal']>, Promise<RouteResponse<'POST /agents/:agentId/signals'>>>
>;
type _AgentBuilderStart = Expect<
  Equal<ReturnType<AgentBuilder['startActionRun']>, Promise<RouteResponse<'POST /agent-builder/:actionId/start'>>>
>;
type _AgentBuilderResume = Expect<
  Equal<ReturnType<AgentBuilder['resume']>, Promise<RouteResponse<'POST /agent-builder/:actionId/resume'>>>
>;
type _StoredScorer = Expect<
  Equal<StoredScorerResponse['id'], RouteResponse<'GET /stored/scorers/:storedScorerId'>['id']>
>;
type _StoredPromptBlock = Expect<
  Equal<StoredPromptBlockResponse['id'], RouteResponse<'GET /stored/prompt-blocks/:storedPromptBlockId'>['id']>
>;
type _BuilderActions = Expect<Equal<GetAgentBuilderActionsResponse, RouteResponse<'GET /agent-builder'>>>;
type _BuilderSettings = Expect<Equal<BuilderSettingsResponse, RouteResponse<'GET /editor/builder/settings'>>>;
type _BuilderInfrastructure = Expect<
  Equal<InfrastructureStatusResponse, RouteResponse<'GET /editor/builder/infrastructure'>>
>;
type _BuilderRegistrySearch = Expect<
  Equal<BuilderRegistrySearchResponse, RouteResponse<'GET /editor/builder/registries/:registryId/search'>>
>;
type _BuilderRegistryInstall = Expect<
  BuilderRegistryInstallBody extends Body<'POST /editor/builder/registries/:registryId/install'> ? true : false
>;
type _AgentControllerSession = Expect<
  Equal<AgentControllerSessionState, RouteResponse<'GET /agent-controller/:controllerId/sessions/:resourceId'>>
>;
type _AgentControllerThread = Expect<
  Equal<
    AgentControllerThreadInfo,
    RouteResponse<'GET /agent-controller/:controllerId/sessions/:resourceId/threads'>['threads'][number]
  >
>;
void scoreRequest;
void createResponse;
void createConversation;
void workflowRunQuery;
void vectorQuery;
void memoryThreads;
void processorExecution;

// @ts-expect-error Route path parameters remain strings.
const invalidScoreRequest: RouteRequest<'GET /scores/run/:runId'> = { params: { runId: 1 }, query: {} };

// @ts-expect-error Responses input must use the route's string-or-message-list contract.
const invalidCreateResponse: CreateResponseParams = { input: 1 };

void invalidScoreRequest;
void invalidCreateResponse;
