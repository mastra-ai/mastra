import type { ApiRoute } from '@mastra/core/server';
import { findMatchingCustomRoute } from '@mastra/server/auth';
import { z } from 'zod';
import {
  CREATE_WORKFLOW_RUN_ROUTE,
  GET_WORKFLOW_BY_ID_ROUTE,
  GET_WORKFLOW_RUN_BY_ID_ROUTE,
  LIST_WORKFLOWS_ROUTE,
  LIST_WORKFLOW_RUNS_ROUTE,
  STREAM_WORKFLOW_ROUTE,
  START_ASYNC_WORKFLOW_ROUTE,
  RESUME_ASYNC_WORKFLOW_ROUTE,
  RESUME_STREAM_WORKFLOW_ROUTE,
  RESTART_ASYNC_WORKFLOW_ROUTE,
} from '@mastra/server/handlers/workflows';
import type { Profile } from '../identity.ts';
import {
  approvalSchema,
  decisionSchema,
  publicationSchema,
  publicationRetryInputSchema,
  proposalSchema,
  reviewStartInputSchema,
  sameDecision,
} from '../review/contracts.ts';
import type { ReviewerAuthority } from '../review/service.ts';
import type { ReviewWorkflow } from '../workflows/review-workflow.ts';

type ReviewRun = Awaited<ReturnType<ReviewWorkflow['getWorkflowRunById']>>;
type ReadPolicy = (input: { url: URL; owner: string; params: Record<string, string> }) => boolean | Promise<boolean>;
type WritePolicy = (input: {
  body: unknown;
  owner: string;
  actorId: string;
  runId: string | null;
  run: ReviewRun;
}) => boolean;

const runIdPattern = /^[0-9a-f-]{36}$/iu;
const startFields = [
  'inputData',
  'resourceId',
  'requestContext',
  'tracingOptions',
  'initialState',
  'perStep',
  'closeOnSuspend',
];
const resumeFields = ['step', 'resumeData', 'requestContext', 'tracingOptions', 'perStep'];

function onlyKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key))
  );
}

const emptyObjectOption = (value: unknown) => value === undefined || onlyKeys(value, []);
const onlyQueryKeys = (query: URLSearchParams, keys: readonly string[]) =>
  [...query.keys()].every(key => keys.includes(key));

function queryField(schema: typeof LIST_WORKFLOW_RUNS_ROUTE.queryParamSchema, name: string) {
  if (!(schema instanceof z.ZodObject) || !schema.shape[name])
    throw new Error(`Missing workflow route query field ${name}`);
  return schema.shape[name];
}

const summaryQuery = queryField(LIST_WORKFLOW_RUNS_ROUTE.queryParamSchema, 'summary');
const withNestedWorkflowsQuery = queryField(GET_WORKFLOW_RUN_BY_ID_ROUTE.queryParamSchema, 'withNestedWorkflows');

const createRun: WritePolicy = ({ body, owner, runId, run }) =>
  (!runId || !!run) && onlyKeys(body, ['resourceId']) && (body.resourceId === undefined || body.resourceId === owner);

const startRun: WritePolicy = ({ body, owner, run }) =>
  run?.status === 'pending' &&
  onlyKeys(body, startFields) &&
  reviewStartInputSchema.safeParse(body.inputData).success &&
  (body.resourceId === undefined || body.resourceId === owner) &&
  [body.requestContext, body.tracingOptions, body.initialState].every(emptyObjectOption) &&
  (body.perStep === undefined || body.perStep === false) &&
  (body.closeOnSuspend === undefined || body.closeOnSuspend === true);

const restartRun: WritePolicy = ({ body, owner, actorId, run }) => {
  if (run?.status !== 'running' || !onlyKeys(body, ['requestContext']) || !emptyObjectOption(body.requestContext))
    return false;

  const decision = run.steps?.['review-decision'];
  if (!decision || Array.isArray(decision) || decision.status !== 'success') return false;

  const approved = approvalSchema.safeParse(decision.output);
  if (!approved.success || approved.data.proposal.owner !== owner || approved.data.reviewerId !== actorId) return false;

  // Native persistence has running checkpoints both before and after the publication step.
  const publication = run.steps?.['publish-review'];
  if (!publication) return true;
  if (Array.isArray(publication)) return false;
  if (publication.status === 'running') return true;
  if (publication.status !== 'success') return false;

  const completed = publicationSchema.safeParse(publication.output);
  if (!completed.success) return false;
  const { proposal } = approved.data;
  const expectedStatus =
    approved.data.decision.decision === 'reject'
      ? 'rejected'
      : ['page', 'note', 'update'].includes(proposal.candidate.action)
        ? 'published'
        : proposal.candidate.action;
  const reference = `${proposal.destination.scope}#${proposal.destination.path}`;
  return (
    completed.data.proposalId === proposal.id &&
    completed.data.revision === proposal.revision &&
    completed.data.reviewerId === approved.data.reviewerId &&
    completed.data.status === expectedStatus &&
    sameDecision(completed.data.decision, approved.data.decision) &&
    (expectedStatus !== 'published'
      ? completed.data.reference === null
      : proposal.candidate.action === 'note'
        ? completed.data.reference?.startsWith(`${reference}?note=`) === true
        : completed.data.reference === reference)
  );
};

const resumeRun: WritePolicy = ({ body, owner, actorId, run }) => {
  if (
    run?.status !== 'suspended' ||
    !onlyKeys(body, resumeFields) ||
    !emptyObjectOption(body.requestContext) ||
    !emptyObjectOption(body.tracingOptions) ||
    (body.perStep !== undefined && body.perStep !== false)
  )
    return false;

  const step = Array.isArray(body.step) && body.step.length === 1 ? body.step[0] : body.step;
  if (step !== 'review-decision' && step !== 'publish-review') return false;

  const decision = decisionSchema.safeParse(body.resumeData);
  const stored = run.steps?.[step];
  if (!decision.success || !stored || Array.isArray(stored) || stored.status !== 'suspended') return false;

  if (step === 'review-decision') {
    const proposal = proposalSchema.safeParse(stored.suspendPayload);
    return (
      proposal.success &&
      proposal.data.owner === owner &&
      proposal.data.reviewer.actorId === actorId &&
      proposal.data.revision === decision.data.revision
    );
  }

  const retry = publicationRetryInputSchema.safeParse({
    approval: stored.suspendPayload,
    retryDecision: decision.data,
  });
  return retry.success && retry.data.approval.proposal.owner === owner && retry.data.approval.reviewerId === actorId;
};

export function createReviewAccess(workflow: ReviewWorkflow, authority: ReviewerAuthority) {
  const readPolicies = new Map<ApiRoute, ReadPolicy>([
    [
      LIST_WORKFLOWS_ROUTE,
      ({ url: { searchParams } }) => {
        const partial = searchParams.get('partial');
        return (
          onlyQueryKeys(searchParams, ['partial']) && (partial === null || partial === 'true' || partial === 'false')
        );
      },
    ],
    [GET_WORKFLOW_BY_ID_ROUTE, ({ url }) => !url.search],
    [
      LIST_WORKFLOW_RUNS_ROUTE,
      ({ url: { searchParams } }) =>
        onlyQueryKeys(searchParams, ['page', 'perPage', 'status', 'limit', 'offset', 'summary']) &&
        summaryQuery.safeParse(searchParams.get('summary') ?? undefined).success,
    ],
    [
      GET_WORKFLOW_RUN_BY_ID_ROUTE,
      async ({ url: { searchParams }, owner, params }) =>
        onlyQueryKeys(searchParams, ['fields', 'withNestedWorkflows']) &&
        withNestedWorkflowsQuery.safeParse(searchParams.get('withNestedWorkflows') ?? undefined).success &&
        (await workflow.getWorkflowRunById(params.runId!))?.resourceId === owner,
    ],
  ]);

  const writePolicies = new Map<ApiRoute, WritePolicy>([
    [CREATE_WORKFLOW_RUN_ROUTE, createRun],
    [STREAM_WORKFLOW_ROUTE, startRun],
    [START_ASYNC_WORKFLOW_ROUTE, startRun],
    [RESUME_ASYNC_WORKFLOW_ROUTE, resumeRun],
    [RESUME_STREAM_WORKFLOW_ROUTE, resumeRun],
    [RESTART_ASYNC_WORKFLOW_ROUTE, restartRun],
  ]);
  const routes = { GET: [...readPolicies.keys()], POST: [...writePolicies.keys()] };

  return async (path: string, method: string, request: Request, owner: string, profile: Profile) => {
    if (method !== 'GET' && method !== 'POST') return undefined;
    const match = findMatchingCustomRoute(path.startsWith('/api/') ? path.slice(4) : path, method, routes[method]);
    if (!match) return undefined;
    if (!authority(profile)?.review || (match.params.workflowId && match.params.workflowId !== 'review')) return false;

    const url = new URL(request.url);
    const query = url.searchParams;
    const requestContext = query.get('requestContext');
    if (requestContext !== null) {
      if (requestContext !== 'e30=' && requestContext !== 'e30') return false;
      query.delete('requestContext');
    }

    if (method === 'GET') return readPolicies.get(match.route)?.({ url, owner, params: match.params }) ?? false;

    if (!onlyQueryKeys(query, ['runId'])) return false;
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      return false;
    }
    const runId = query.get('runId');
    if (runId && !runIdPattern.test(runId)) return false;
    const run = runId ? await workflow.getWorkflowRunById(runId) : null;
    if (run && run.resourceId !== owner) return false;

    return writePolicies.get(match.route)?.({ body, owner, actorId: profile.actorId, runId, run }) ?? false;
  };
}
