import type { Mastra } from '@mastra/core/mastra';

import { HTTPException } from '../http-exception';
import {
  dynamicWorkflowIdPathParams,
  listDynamicWorkflowsQuerySchema,
  upsertDynamicWorkflowBodySchema,
  listDynamicWorkflowsResponseSchema,
  getDynamicWorkflowResponseSchema,
  upsertDynamicWorkflowResponseSchema,
  deleteDynamicWorkflowResponseSchema,
} from '../schemas/dynamic-workflows';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

/**
 * GET /stored/workflows — list stored static workflow definitions.
 *
 * Mirrors `LIST_STORED_AGENTS_ROUTE` but without favorites/visibility/authorship
 * scoping (which the workflow-definitions domain doesn't carry in v1).
 */
export const LIST_DYNAMIC_WORKFLOWS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/workflows',
  responseType: 'json',
  queryParamSchema: listDynamicWorkflowsQuerySchema,
  responseSchema: listDynamicWorkflowsResponseSchema,
  summary: 'List dynamic workflow definitions',
  description: 'Returns workflow definitions persisted to storage. Filterable by status and authorId.',
  tags: ['Dynamic Workflows'],
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
      return handleError(error, 'Error listing dynamic workflows');
    }
  },
});

/**
 * GET /stored/workflows/:dynamicWorkflowId — get one dynamic workflow.
 */
export const GET_DYNAMIC_WORKFLOW_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/workflows/:dynamicWorkflowId',
  responseType: 'json',
  pathParamSchema: dynamicWorkflowIdPathParams,
  responseSchema: getDynamicWorkflowResponseSchema,
  summary: 'Get a dynamic workflow definition by id',
  description: 'Returns a single workflow definition persisted to storage.',
  tags: ['Dynamic Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:read',
  handler: async ({ mastra, dynamicWorkflowId }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      const def = await store.get(dynamicWorkflowId);
      if (!def) throw new HTTPException(404, { message: `Dynamic workflow "${dynamicWorkflowId}" not found` });
      return def;
    } catch (error) {
      return handleError(error, 'Error getting dynamic workflow');
    }
  },
});

/**
 * POST /stored/workflows — upsert a static workflow definition and live-register
 * it on the Mastra instance.
 *
 * Calls `mastra.addDynamicWorkflow(def)` which persists the row + rehydrates a
 * runnable workflow + registers it via `mastra.addWorkflow(workflow, id)`.
 * After this returns, `GET /workflows/:id` and `POST /workflows/:id/run` work
 * immediately — no server restart needed.
 */
export const UPSERT_DYNAMIC_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/workflows',
  responseType: 'json',
  bodySchema: upsertDynamicWorkflowBodySchema,
  responseSchema: upsertDynamicWorkflowResponseSchema,
  summary: 'Upsert a dynamic workflow definition and live-register it',
  description:
    'Persists a static workflow definition and live-registers it on the running Mastra instance. Idempotent — same id updates in place.',
  tags: ['Dynamic Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:write',
  handler: async ({
    mastra,
    id,
    description,
    metadata,
    inputSchema,
    outputSchema,
    stateSchema,
    requestContextSchema,
    graph,
    dependencies,
  }) => {
    try {
      // Pick the body fields explicitly — handler args also carry server
      // context (requestContext, abortSignal, ...) which must not leak into
      // the stored definition.
      const def = { id, description, metadata, inputSchema, outputSchema, stateSchema, requestContextSchema, graph };
      // Helpers are saved with the root as one unit so a nested workflow that
      // does not exist yet resolves, and so a rejected root can never leave
      // its helpers behind as orphans. Order within the bundle is derived
      // from the graphs, not from the order the client sent them in.
      const bundle = [...(dependencies ?? []), def];
      // The wire schema is deliberately looser than the core authoring type:
      // it admits `mapping` entries as children of parallel/conditional/loop,
      // which `WorkflowBuilderExecutableInnerEntry` excludes. That is not
      // drift. Letting those through means a misplaced mapping surfaces from
      // the validation domain as a structured `invalid-map-placement` issue —
      // pointed at the offending path and carrying a machine-applicable
      // `remove-workflow-step` repair action that Studio's draft UI consumes —
      // instead of dying at the boundary as an opaque discriminated-union
      // error. `foreach` is excluded from this on purpose: core rejects a
      // foreach mapping body with an unstructured throw during rehydration,
      // so there is no repairable issue to preserve and the wire schema is
      // the better place to catch it.
      //
      // `addDynamicWorkflows` runs a full registry pre-flight before
      // rehydration, so nothing reaches the engine unvalidated; the cast
      // documents this boundary. Narrowing the schema to delete the cast
      // would trade a repairable issue for a generic 400.
      await mastra.addDynamicWorkflows(bundle as Parameters<Mastra['addDynamicWorkflows']>[0]);
      return {
        ok: true as const,
        id: def.id,
        ...(dependencies?.length ? { dependencyIds: dependencies.map(dependency => dependency.id) } : {}),
      };
    } catch (error) {
      return handleError(error, 'Error upserting dynamic workflow');
    }
  },
});

/**
 * DELETE /stored/workflows/:dynamicWorkflowId — delete a dynamic workflow.
 *
 * Removes the row from storage AND un-registers the live Workflow instance so
 * a subsequent POST with the same id starts from a clean slate. Idempotent.
 */
export const DELETE_DYNAMIC_WORKFLOW_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/workflows/:dynamicWorkflowId',
  responseType: 'json',
  pathParamSchema: dynamicWorkflowIdPathParams,
  responseSchema: deleteDynamicWorkflowResponseSchema,
  summary: 'Delete a dynamic workflow definition',
  description: 'Removes a dynamic workflow definition and unregisters the live workflow instance. Idempotent.',
  tags: ['Dynamic Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:write',
  handler: async ({ mastra, dynamicWorkflowId }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      await store.delete(dynamicWorkflowId);
      (mastra as Mastra).removeWorkflow(dynamicWorkflowId);
      return { success: true as const, message: `Workflow ${dynamicWorkflowId} deleted` };
    } catch (error) {
      return handleError(error, 'Error deleting dynamic workflow');
    }
  },
});
