/**
 * Type-level tests for route contract utilities.
 * These tests verify that the RouteMap and Infer* utilities correctly
 * extract schema types from the SERVER_ROUTES tuple.
 *
 * This file is NOT executed — it's only type-checked by `tsc --noEmit`.
 * If this file compiles without errors, the route contract types work correctly.
 */
import type {
  RouteMap,
  RouteContract,
  InferPathParams,
  InferQueryParams,
  InferBody,
  InferResponse,
} from '../route-contracts';

// ============================================================================
// Helpers
// ============================================================================

/** Assert that a type resolves to `true` */
type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type IsNotNever<T> = [T] extends [never] ? false : true;

// ============================================================================
// RouteMap key tests — verify that specific routes exist in the map
// ============================================================================

// Agent routes
type _ListAgents = RouteContract<'GET /agents'>;
type _GetAgent = RouteContract<'GET /agents/:agentId'>;
type _GenerateAgent = RouteContract<'POST /agents/:agentId/generate'>;

// Workflow routes
type _ListWorkflows = RouteContract<'GET /workflows'>;

// Tool routes
type _ListTools = RouteContract<'GET /tools'>;

// Memory routes
type _GetThreads = RouteContract<'GET /memory/threads'>;

// Auth routes
type _AuthCapabilities = RouteContract<'GET /auth/capabilities'>;

// Invalid route keys should be rejected
// @ts-expect-error - GET /this/does/not/exist is not a valid route
type _Invalid1 = RouteContract<'GET /this/does/not/exist'>;

// @ts-expect-error - INVALID is not a valid method
type _Invalid2 = RouteContract<'INVALID /agents'>;

// ============================================================================
// InferPathParams tests — verify path parameter inference
// ============================================================================

type GetAgentPathParams = InferPathParams<RouteMap['GET /agents/:agentId']>;
type _TestAgentPathParams = Expect<Equal<GetAgentPathParams, { agentId: string }>>;

// Routes without path params should return never
type AuthCapPathParams = InferPathParams<RouteMap['GET /auth/capabilities']>;
type _TestAuthCapPathParams = Expect<IsNever<AuthCapPathParams>>;

// Workflow path params
type CreateRunPathParams = InferPathParams<RouteMap['POST /workflows/:workflowId/create-run']>;
type _TestWorkflowPathParams = Expect<CreateRunPathParams extends { workflowId: string } ? true : false>;

// ============================================================================
// InferResponse tests — verify response type inference
// ============================================================================

// GET /agents should return an array-like response (not never)
type ListAgentsResponse = InferResponse<RouteMap['GET /agents']>;
type _AssertListAgentsResponse = Expect<IsNotNever<ListAgentsResponse>>;

// GET /agents/:agentId should return a single agent response (not never)
type GetAgentResponse = InferResponse<RouteMap['GET /agents/:agentId']>;
type _AssertGetAgentResponse = Expect<IsNotNever<GetAgentResponse>>;

// Agent response should have expected fields
type _TestAgentResponseHasName = Expect<GetAgentResponse extends { name: string } ? true : false>;

// ============================================================================
// InferBody tests — verify request body inference
// ============================================================================

// POST routes with body schemas should not be never
type GenerateBody = InferBody<RouteMap['POST /agents/:agentId/generate']>;
type _AssertGenerateBody = Expect<IsNotNever<GenerateBody>>;
type _TestGenerateBodyHasMessages = Expect<GenerateBody extends { messages: unknown } ? true : false>;

// GET routes without body should return never
type ListAgentsBody = InferBody<RouteMap['GET /agents']>;
type _AssertListAgentsBodyNever = Expect<IsNever<ListAgentsBody>>;

// ============================================================================
// InferQueryParams tests — verify query parameter inference
// ============================================================================

// GET /agents has a query param schema (partial)
type ListAgentsQuery = InferQueryParams<RouteMap['GET /agents']>;
type _AssertListAgentsQuery = Expect<IsNotNever<ListAgentsQuery>>;
type _TestListAgentsQueryHasPartial = Expect<ListAgentsQuery extends { partial?: unknown } ? true : false>;

// ============================================================================
// Route method/path verification — ensure route metadata is preserved
// ============================================================================

type GetAgentRoute = RouteMap['GET /agents/:agentId'];
type _TestGetAgentMethod = Expect<Equal<GetAgentRoute['method'], 'GET'>>;
type _TestGetAgentPath = Expect<Equal<GetAgentRoute['path'], '/agents/:agentId'>>;
