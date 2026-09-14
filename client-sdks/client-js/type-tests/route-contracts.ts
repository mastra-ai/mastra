import type { Body, ClientRequest, PathParams, QueryParams, RouteRequest, RouteResponse } from '../src/index.js';

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

const scoreRequest = {
  params: { runId: 'run-1' },
  query: {},
} satisfies RouteRequest<'GET /scores/run/:runId'>;

void scoreRequest;

// @ts-expect-error Route path parameters remain strings.
const invalidScoreRequest: RouteRequest<'GET /scores/run/:runId'> = { params: { runId: 1 }, query: {} };

void invalidScoreRequest;
