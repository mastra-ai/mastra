import type { Mastra } from '@mastra/core/mastra';
import { WorkflowDefinitionOwnershipConflictError } from '@mastra/core/storage';

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

import { getCallerAuthorId, hasAdminBypass } from './authorship';
import { handleError } from './error';

const DYNAMIC_WORKFLOW_RESOURCE = 'stored-workflows';

type DynamicWorkflowPrincipal = {
  authorId: string;
  isAdmin: boolean;
};

function getDynamicWorkflowPrincipal(
  requestContext: Parameters<typeof getCallerAuthorId>[0],
): DynamicWorkflowPrincipal {
  const authorId = getCallerAuthorId(requestContext);
  if (!authorId) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  return {
    authorId,
    isAdmin: hasAdminBypass(requestContext, DYNAMIC_WORKFLOW_RESOURCE),
  };
}

function throwDynamicWorkflowNotFound(): never {
  throw new HTTPException(404, { message: 'Not found' });
}

function throwDynamicWorkflowConflict(): never {
  throw new HTTPException(409, { message: 'Dynamic workflow conflicts with an existing definition' });
}

/**
 * GET /stored/workflows — list stored static workflow definitions.
 *
 * Non-admin callers are scoped to the author derived from RequestContext.
 */
export const LIST_DYNAMIC_WORKFLOWS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/workflows',
  responseType: 'json',
  queryParamSchema: listDynamicWorkflowsQuerySchema,
  responseSchema: listDynamicWorkflowsResponseSchema,
  summary: 'List dynamic workflow definitions',
  description:
    'Returns workflow definitions persisted to storage. Non-admin callers only receive their own definitions.',
  tags: ['Dynamic Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:read',
  handler: async ({ mastra, requestContext, status, authorId }) => {
    try {
      const principal = getDynamicWorkflowPrincipal(requestContext);
      if (!principal.isAdmin && authorId !== undefined && authorId !== principal.authorId) {
        throw new HTTPException(400, { message: 'authorId can only select the authenticated caller' });
      }

      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      const result = await store.list({
        status: status ?? 'active',
        authorId: principal.isAdmin ? authorId : principal.authorId,
      });
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
  handler: async ({ mastra, requestContext, dynamicWorkflowId }) => {
    try {
      const principal = getDynamicWorkflowPrincipal(requestContext);
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      const def = await store.get(dynamicWorkflowId);
      if (!def || (!principal.isAdmin && (!def.authorId || def.authorId !== principal.authorId))) {
        throwDynamicWorkflowNotFound();
      }
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
    requestContext,
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
      const principal = getDynamicWorkflowPrincipal(requestContext);
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      // Pick the body fields explicitly — handler args also carry server
      // context (requestContext, abortSignal, ...) which must not leak into
      // the stored definition.
      const def = { id, description, metadata, inputSchema, outputSchema, stateSchema, requestContextSchema, graph };
      // Helpers are saved with the root as one unit so a nested workflow that
      // does not exist yet resolves, and so a rejected root can never leave
      // its helpers behind as orphans. Order within the bundle is derived
      // from the graphs, not from the order the client sent them in.
      const bundle = [...(dependencies ?? []), def];

      // Ownership is supplied by the server, outside the untrusted graph.
      // Existing rows are read only to choose the expected immutable owner;
      // storage enforces that owner again in the write predicate so a
      // concurrent delete/recreate can't turn this check into a takeover.
      const existing = await Promise.all(bundle.map(member => store.get(member.id)));
      if (existing.some(member => member && !member.authorId)) {
        // Legacy rows have no trusted owner to preserve. Administrators may
        // inspect them through GET/list, but mutation stays quarantined until
        // an explicit migration assigns an owner.
        throwDynamicWorkflowConflict();
      }

      const existingOwners = new Set(existing.flatMap(member => (member?.authorId ? [member.authorId] : [])));
      let registrationAuthorId = principal.authorId;
      if (principal.isAdmin) {
        if (existingOwners.size > 1) throwDynamicWorkflowConflict();
        const existingRoot = existing.at(-1);
        if (!existingRoot && existingOwners.size > 0) {
          // An existing helper must not choose the owner of a new root. Admins
          // may extend an owned root with new helpers, but creating a new root
          // that references someone else's helper requires a separate,
          // explicit ownership design.
          if (!existingOwners.has(principal.authorId)) throwDynamicWorkflowConflict();
        }
        registrationAuthorId = existingRoot?.authorId ?? principal.authorId;
      } else if (existingOwners.size > 1 || (existingOwners.size === 1 && !existingOwners.has(principal.authorId))) {
        throwDynamicWorkflowConflict();
      }
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
      await mastra.addDynamicWorkflows(bundle as Parameters<Mastra['addDynamicWorkflows']>[0], {
        authorId: registrationAuthorId,
      });
      return {
        ok: true as const,
        id: def.id,
        ...(dependencies?.length ? { dependencyIds: dependencies.map(dependency => dependency.id) } : {}),
      };
    } catch (error) {
      if (error instanceof WorkflowDefinitionOwnershipConflictError) {
        throwDynamicWorkflowConflict();
      }
      return handleError(error, 'Error upserting dynamic workflow');
    }
  },
});

/**
 * DELETE /stored/workflows/:dynamicWorkflowId — delete a dynamic workflow.
 *
 * Removes the caller-owned row from storage and un-registers the matching live
 * dynamic Workflow instance. Missing and cross-owner ids are indistinguishable.
 */
export const DELETE_DYNAMIC_WORKFLOW_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/workflows/:dynamicWorkflowId',
  responseType: 'json',
  pathParamSchema: dynamicWorkflowIdPathParams,
  responseSchema: deleteDynamicWorkflowResponseSchema,
  summary: 'Delete a dynamic workflow definition',
  description: 'Removes a caller-owned dynamic workflow definition and unregisters its live workflow instance.',
  tags: ['Dynamic Workflows'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:write',
  handler: async ({ mastra, requestContext, dynamicWorkflowId }) => {
    try {
      const principal = getDynamicWorkflowPrincipal(requestContext);
      const storage = mastra.getStorage();
      if (!storage) throw new HTTPException(500, { message: 'Storage is not configured' });

      const store = await storage.getStore('workflowDefinitions');
      if (!store) throw new HTTPException(500, { message: 'workflowDefinitions storage domain is not available' });

      let expectedAuthorId = principal.authorId;
      if (principal.isAdmin) {
        const existing = await store.get(dynamicWorkflowId);
        if (!existing) throwDynamicWorkflowNotFound();
        if (!existing.authorId) throwDynamicWorkflowConflict();
        expectedAuthorId = existing.authorId;
      }

      const deleted = await mastra.deleteDynamicWorkflow(dynamicWorkflowId, {
        authorId: expectedAuthorId,
      });
      if (!deleted) throwDynamicWorkflowNotFound();
      return { success: true as const, message: `Workflow ${dynamicWorkflowId} deleted` };
    } catch (error) {
      return handleError(error, 'Error deleting dynamic workflow');
    }
  },
});
