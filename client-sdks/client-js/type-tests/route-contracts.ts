import type {
  Body,
  ClientRequest,
  Conversation,
  ConversationItemsPage,
  CreateConversationParams,
  CreateResponseParams,
  GetAgentResponse,
  GetToolResponse,
  GetWorkflowResponse,
  ListWorkflowRunsParams,
  ListWorkflowRunsResponse,
  PathParams,
  QueryParams,
  ResponsesDeleteResponse,
  ResponsesResponse,
  RouteRequest,
  RouteResponse,
} from '../src/index.js';

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

void scoreRequest;
void createResponse;
void createConversation;
void workflowRunQuery;

// @ts-expect-error Route path parameters remain strings.
const invalidScoreRequest: RouteRequest<'GET /scores/run/:runId'> = { params: { runId: 1 }, query: {} };

// @ts-expect-error Responses input must use the route's string-or-message-list contract.
const invalidCreateResponse: CreateResponseParams = { input: 1 };

void invalidScoreRequest;
void invalidCreateResponse;
