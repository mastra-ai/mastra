import type { Mastra } from '@mastra/core/mastra';

import { HTTPException } from '../http-exception';
import {
  storedWorkflowIdPathParams,
  listStoredWorkflowsQuerySchema,
  upsertStoredWorkflowBodySchema,
  listStoredWorkflowsResponseSchema,
  getStoredWorkflowResponseSchema,
  upsertStoredWorkflowResponseSchema,
  deleteStoredWorkflowResponseSchema,
} from '../schemas/stored-workflows';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

/**
 * GET /stored/workflows — list stored static workflow definitions.
 *
 * Mirrors `LIST_STORED_AGENTS_ROUTE` but without favorites/visibility/authorship
 * scoping (which the workflow-definitions domain doesn't carry in v1).
 */
export const LIST_STORED_WORKFLOWS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/workflows',
  responseType: 'json',
  queryParamSchema: listStoredWorkflowsQuerySchema,
  responseSchema: listStoredWorkflowsResponseSchema,
  summary: 'List stored workflow definitions',
  description: 'Returns workflow definitions persisted to storage. Filterable by status and authorId.',
  tags: ['Stored Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:read',
  handler: async ({ mastra, status, authorId }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      const result = await store.list({ status: status ?? 'active', authorId });
      return { workflows: result.definitions, total: result.total };
    } catch (error) {
      return handleError(error, 'Error listing stored workflows');
    }
  },
});

/**
 * GET /stored/workflows/:storedWorkflowId — get one stored workflow.
 */
export const GET_STORED_WORKFLOW_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/workflows/:storedWorkflowId',
  responseType: 'json',
  pathParamSchema: storedWorkflowIdPathParams,
  responseSchema: getStoredWorkflowResponseSchema,
  summary: 'Get a stored workflow definition by id',
  description: 'Returns a single workflow definition persisted to storage.',
  tags: ['Stored Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:read',
  handler: async ({ mastra, storedWorkflowId }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      const def = await store.get(storedWorkflowId);
      if (!def) throw new HTTPException(404, { message: `Stored workflow "${storedWorkflowId}" not found` });
      return def;
    } catch (error) {
      return handleError(error, 'Error getting stored workflow');
    }
  },
});

/**
 * POST /stored/workflows — upsert a static workflow definition and live-register
 * it on the Mastra instance.
 *
 * Calls `mastra.addStoredWorkflow(def)` which persists the row + rehydrates a
 * runnable workflow + registers it via `mastra.addWorkflow(workflow, id)`.
 * After this returns, `GET /workflows/:id` and `POST /workflows/:id/run` work
 * immediately — no server restart needed.
 */
export const UPSERT_STORED_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/workflows',
  responseType: 'json',
  bodySchema: upsertStoredWorkflowBodySchema,
  responseSchema: upsertStoredWorkflowResponseSchema,
  summary: 'Upsert a stored workflow definition and live-register it',
  description:
    'Persists a static workflow definition and live-registers it on the running Mastra instance. Idempotent — same id updates in place.',
  tags: ['Stored Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:write',
  handler: async ({ mastra, ...def }) => {
    try {
      // The Zod schema output is structurally compatible with
      // StoredWorkflowGraph but TS can't prove every arm:
      //   - sleepUntil.date is an ISO string on the wire, Date on the
      //     runtime type; the rehydrator parses it via `new Date(...)`.
      //   - conditional/loop's `serializedConditions`/`serializedCondition`
      //     debug labels are emitted by the fluent builder at rehydration
      //     time; clients don't send them.
      // `addStoredWorkflow` runs a full registry pre-flight before
      // rehydration; the cast documents this boundary.
      await (mastra as Mastra).addStoredWorkflow(def as Parameters<Mastra['addStoredWorkflow']>[0]);
      return { ok: true as const, id: def.id };
    } catch (error) {
      return handleError(error, 'Error upserting stored workflow');
    }
  },
});

/**
 * DELETE /stored/workflows/:storedWorkflowId — delete a stored workflow.
 *
 * Removes the row from storage AND un-registers the live Workflow instance so
 * a subsequent POST with the same id starts from a clean slate. Idempotent.
 */
export const DELETE_STORED_WORKFLOW_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/workflows/:storedWorkflowId',
  responseType: 'json',
  pathParamSchema: storedWorkflowIdPathParams,
  responseSchema: deleteStoredWorkflowResponseSchema,
  summary: 'Delete a stored workflow definition',
  description: 'Removes a stored workflow definition and unregisters the live workflow instance. Idempotent.',
  tags: ['Stored Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:write',
  handler: async ({ mastra, storedWorkflowId }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      await store.delete(storedWorkflowId);
      (mastra as Mastra).removeWorkflow(storedWorkflowId);
      return { success: true as const, message: `Workflow ${storedWorkflowId} deleted` };
    } catch (error) {
      return handleError(error, 'Error deleting stored workflow');
    }
  },
});
