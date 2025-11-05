import z from 'zod';
import {
  createWorkflowRunHandler,
  getWorkflowByIdHandler,
  getWorkflowRunByIdHandler,
  listWorkflowRunsHandler,
  listWorkflowsHandler,
  resumeStreamWorkflowHandler,
  streamWorkflowHandler,
} from '../../handlers/workflows';
import {
  listWorkflowRunsQuerySchema,
  listWorkflowsResponseSchema,
  resumeStreamBodySchema,
  streamWorkflowBodySchema,
  workflowInfoSchema,
  workflowRunResponseSchema,
  workflowRunsResponseSchema,
} from '../../schemas/workflows';
import type { ServerRoute, ServerRouteHandler } from '.';

export const WORKFLOWS_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: listWorkflowsHandler as unknown as ServerRouteHandler,
    path: '/api/workflows',
    responseSchema: listWorkflowsResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkflowByIdHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId',
    responseSchema: workflowInfoSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: listWorkflowRunsHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/runs',
    queryParamSchema: listWorkflowRunsQuerySchema,
    responseSchema: workflowRunsResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkflowRunByIdHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/runs/:runId',
    responseSchema: workflowRunResponseSchema,
  },
  {
    method: 'POST',
    responseType: 'json',
    handler: createWorkflowRunHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/create-run',
    bodySchema: z.object({
      runId: z.string().optional(),
    }),
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: streamWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/stream',
    bodySchema: streamWorkflowBodySchema,
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: streamWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/streamVNext',
    bodySchema: streamWorkflowBodySchema,
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: resumeStreamWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/resume-stream',
    bodySchema: resumeStreamBodySchema,
  },
];
