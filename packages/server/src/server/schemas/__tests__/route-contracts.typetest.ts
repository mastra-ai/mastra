/**
 * Type-level tests for route contract utilities.
 * These tests verify that the RouteMap and Infer* utilities correctly
 * extract schema types from the SERVER_ROUTES tuple.
 *
 * This file is NOT executed — it's only type-checked by `tsc --noEmit`.
 * If this file compiles without errors, the route contract types work correctly.
 */
import { z } from 'zod/v4';

import { createRoute } from '../../server-adapter/routes/route-builder';
import type {
  agentIdPathParams,
  serializedAgentSchema,
  listAgentsResponseSchema,
  agentExecutionBodySchema,
} from '../agents';
import type {
  RouteMap,
  RouteContract,
  InferPathParams,
  InferQueryParams,
  InferBody,
  InferResponse,
} from '../route-contracts';
import type { workflowIdPathParams, createWorkflowRunBodySchema, createWorkflowRunResponseSchema } from '../workflows';

// ============================================================================
// Helpers
// ============================================================================

/** Assert that a type resolves to `true` */
type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;

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

// Conversation routes
type _CreateConversation = RouteContract<'POST /v1/conversations'>;
type _GetConversation = RouteContract<'GET /v1/conversations/:conversationId'>;
type _GetConversationItems = RouteContract<'GET /v1/conversations/:conversationId/items'>;
type _DeleteConversation = RouteContract<'DELETE /v1/conversations/:conversationId'>;

// Auth routes
type _AuthCapabilities = RouteContract<'GET /auth/capabilities'>;

// Invalid route keys should be rejected
type _Invalid1 = RouteContract<'GET /this/does/not/exist'>;

type _Invalid2 = RouteContract<'INVALID /agents'>;

// ============================================================================
// InferPathParams tests — exact schema type assertions
// ============================================================================

type GetAgentPathParams = InferPathParams<RouteMap['GET /agents/:agentId']>;
type _TestAgentPathParams = Expect<Equal<GetAgentPathParams, z.infer<typeof agentIdPathParams>>>;

// Routes without path params should return never
type AuthCapPathParams = InferPathParams<RouteMap['GET /auth/capabilities']>;
type _TestAuthCapPathParams = Expect<IsNever<AuthCapPathParams>>;

// Workflow path params pinned to exact schema output
type CreateRunPathParams = InferPathParams<RouteMap['POST /workflows/:workflowId/create-run']>;
type _TestWorkflowPathParams = Expect<Equal<CreateRunPathParams, z.infer<typeof workflowIdPathParams>>>;

// ============================================================================
// InferResponse tests — exact schema type assertions
// ============================================================================

// GET /agents response pinned to listAgentsResponseSchema output
type ListAgentsResponse = InferResponse<RouteMap['GET /agents']>;
type _AssertListAgentsResponse = Expect<Equal<ListAgentsResponse, z.infer<typeof listAgentsResponseSchema>>>;

// GET /agents/:agentId response pinned to serializedAgentSchema output
type GetAgentResponse = InferResponse<RouteMap['GET /agents/:agentId']>;
type _AssertGetAgentResponse = Expect<Equal<GetAgentResponse, z.infer<typeof serializedAgentSchema>>>;

// POST /workflows/:workflowId/create-run response pinned to exact schema
type CreateRunResponse = InferResponse<RouteMap['POST /workflows/:workflowId/create-run']>;
type _AssertCreateRunResponse = Expect<Equal<CreateRunResponse, z.infer<typeof createWorkflowRunResponseSchema>>>;

// ============================================================================
// InferBody tests — exact schema type assertions
// ============================================================================

// POST generate body pinned to agentExecutionBodySchema output
type GenerateBody = InferBody<RouteMap['POST /agents/:agentId/generate']>;
type _AssertGenerateBody = Expect<Equal<GenerateBody, z.infer<typeof agentExecutionBodySchema>>>;

// POST create-run body pinned to exact schema
type CreateRunBody = InferBody<RouteMap['POST /workflows/:workflowId/create-run']>;
type _AssertCreateRunBody = Expect<Equal<CreateRunBody, z.infer<typeof createWorkflowRunBodySchema>>>;

// GET routes without body should return never
type ListAgentsBody = InferBody<RouteMap['GET /agents']>;
type _AssertListAgentsBodyNever = Expect<IsNever<ListAgentsBody>>;

// ============================================================================
// InferQueryParams tests — exact schema type assertions
// ============================================================================

// GET /agents has an inline query schema — pin to exact shape
type ListAgentsQuery = InferQueryParams<RouteMap['GET /agents']>;
type _AssertListAgentsQuery = Expect<
  Equal<ListAgentsQuery, { partial?: string; authorId?: string; visibility?: 'public' }>
>;

// POST routes without query params should return never
type GenerateQuery = InferQueryParams<RouteMap['POST /agents/:agentId/generate']>;
type _AssertGenerateQueryNever = Expect<IsNever<GenerateQuery>>;

// ============================================================================
// Route method/path verification — ensure route metadata is preserved
// ============================================================================

type GetAgentRoute = RouteMap['GET /agents/:agentId'];
type _TestGetAgentMethod = Expect<Equal<GetAgentRoute['method'], 'GET'>>;
type _TestGetAgentPath = Expect<Equal<GetAgentRoute['path'], '/agents/:agentId'>>;

// ============================================================================
// Custom route tests — Infer* helpers work on routes outside SERVER_ROUTES
// ============================================================================

const _CUSTOM_ROUTE = createRoute({
  method: 'POST',
  path: '/custom/:itemId',
  responseType: 'json',
  pathParamSchema: z.object({ itemId: z.string() }),
  bodySchema: z.object({ title: z.string(), count: z.number() }),
  responseSchema: z.object({ ok: z.boolean() }),
  handler: async () => ({ ok: true }),
});

type CustomPathParams = InferPathParams<typeof _CUSTOM_ROUTE>;
type _TestCustomPath = Expect<Equal<CustomPathParams, { itemId: string }>>;

type CustomBody = InferBody<typeof _CUSTOM_ROUTE>;
type _TestCustomBody = Expect<Equal<CustomBody, { title: string; count: number }>>;

type CustomResponse = InferResponse<typeof _CUSTOM_ROUTE>;
type _TestCustomResponse = Expect<Equal<CustomResponse, { ok: boolean }>>;

type CustomQuery = InferQueryParams<typeof _CUSTOM_ROUTE>;
type _TestCustomQueryNever = Expect<IsNever<CustomQuery>>;
