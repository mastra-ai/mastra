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
import type { ServerRoute, ServerRouteHandler } from '.';

export const WORKFLOWS_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: listWorkflowsHandler as unknown as ServerRouteHandler,
    path: '/api/workflows',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkflowByIdHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: listWorkflowRunsHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/runs',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkflowRunByIdHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/runs/:runId',
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
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: streamWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/streamVNext',
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: resumeStreamWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/resume-stream',
  },
];
