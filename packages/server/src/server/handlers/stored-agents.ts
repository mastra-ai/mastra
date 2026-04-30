import { assertModelAllowed } from '@mastra/core/agent-builder/ee';
import type { StorageCreateAgentInput, StorageUpdateAgentInput } from '@mastra/core/storage';
import type { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import {
  storedAgentIdPathParams,
  statusQuerySchema,
  listStoredAgentsQuerySchema,
  createStoredAgentBodySchema,
  updateStoredAgentBodySchema,
  listStoredAgentsResponseSchema,
  getStoredAgentResponseSchema,
  createStoredAgentResponseSchema,
  updateStoredAgentResponseSchema,
  deleteStoredAgentResponseSchema,
  previewInstructionsBodySchema,
  previewInstructionsResponseSchema,
} from '../schemas/stored-agents';
import type { ServerRoute, RouteSchemas, InferParams } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';

import { resolveBuilderModelPolicy } from '../utils/resolve-builder-model-policy';
import {
  assertReadAccess,
  assertWriteAccess,
  getCallerAuthorId,
  matchesAuthorFilter,
  resolveAuthorFilter,
} from './authorship';
import { isBuilderFeatureEnabled } from './editor-builder';
import { handleError } from './error';
import { prepareStarsEnrichment, stripStarFields } from './stars-enrichment';
import { validateMetadataAvatarUrl } from './validate-avatar';
import { handleAutoVersioning } from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

/**
 * Resolve a `browser` field that may be a boolean shorthand from the UI.
 * - `true`  → look up the admin's builder default browser config
 * - `false` → `null` (explicit clear)
 * - object/null/undefined → pass through unchanged
 */
async function resolveBrowserField(browser: unknown, mastra: { getEditor?: () => unknown }): Promise<unknown> {
  if (browser === true) {
    const editor = mastra.getEditor?.() as any;
    const builder = await editor?.resolveBuilder?.();
    const defaultBrowser = builder?.getConfiguration?.()?.agent?.browser;
    if (!defaultBrowser) {
      console.warn(
        '[mastra:server] Browser enabled (browser: true) but no default browser config found ' +
          'in builder configuration. The agent will be created/updated without browser access. ' +
          'Set `editor.builder.configuration.agent.browser` to fix this.',
      );
    }
    return defaultBrowser ?? undefined;
  }
  if (browser === false) {
    return null;
  }
  return browser;
}

const AGENT_SNAPSHOT_CONFIG_FIELDS = [
  'name',
  'description',
  'instructions',
  'model',
  'tools',
  'defaultOptions',
  'workflows',
  'agents',
  'integrationTools',
  'inputProcessors',
  'outputProcessors',
  'memory',
  'scorers',
  'requestContextSchema',
  'mcpClients',
  'skills',
  'workspace',
  'browser',
] as const;

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/agents - List all stored agents
 */
export const LIST_STORED_AGENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents',
  responseType: 'json',
  queryParamSchema: listStoredAgentsQuerySchema,
  responseSchema: listStoredAgentsResponseSchema,
  summary: 'List stored agents',
  description: 'Returns a paginated list of all agents stored in the database',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({
    mastra,
    requestContext,
    page,
    perPage,
    orderBy,
    status,
    authorId,
    visibility,
    metadata,
    starredOnly,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Resolve the visibility scope for this caller. Non-owner queries for
      // another author return only that author's public rows; default lists
      // return the caller's rows plus legacy unowned records.
      const filter = resolveAuthorFilter({
        requestContext,
        resource: 'agents',
        queryAuthorId: authorId,
        queryVisibility: visibility === 'public' ? 'public' : undefined,
      });

      const callerId = getCallerAuthorId(requestContext);
      const starsEnabled = await isBuilderFeatureEnabled(mastra, 'stars');
      const honoredStarredOnly = starsEnabled && starredOnly === true;

      // `?starredOnly=true`: fetch caller's starred IDs, then refilter + recompute total.
      if (honoredStarredOnly) {
        const effectivePerPage: number = perPage ?? 100;
        if (!callerId) {
          return { agents: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const starsStore = await storage.getStore('stars');
        if (!starsStore) {
          throw new HTTPException(500, { message: 'Stars storage domain is not available' });
        }
        const starredIds = await starsStore.listStarredIds({ userId: callerId, entityType: 'agent' });
        if (starredIds.length === 0) {
          return { agents: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const allMatching = await agentsStore.listResolved({
          perPage: false,
          orderBy,
          status,
          authorId: filter.kind === 'exact' ? filter.authorId : undefined,
          metadata,
          entityIds: starredIds,
        });
        const visible = allMatching.agents.filter(record => matchesAuthorFilter(record, filter));
        const total = visible.length;
        const startIdx = effectivePerPage === 0 ? 0 : page * effectivePerPage;
        const endIdx = effectivePerPage === 0 ? 0 : startIdx + effectivePerPage;
        const sliced = effectivePerPage === 0 ? [] : visible.slice(startIdx, endIdx);
        const annotated = sliced.map(record => ({ ...record, isStarred: true }));
        const hasMore = effectivePerPage > 0 && endIdx < total;
        return { agents: annotated, total, page, perPage: effectivePerPage, hasMore };
      }

      const result = await agentsStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId: filter.kind === 'exact' ? filter.authorId : undefined,
        metadata,
      });

      // Post-filter to enforce ownership + visibility rules across all backends.
      // Storage adapters can only do an equality filter on authorId, so we apply
      // the ownedOrPublic / publicOnly logic here.
      // Note: `total` is left as the storage-reported count to keep pagination
      // math working. For `unrestricted` / `exact` filters nothing is removed.
      // For `ownedOrPublic` / `publicOnly`, downstream UIs should treat the
      // filter as a view over the caller's scope — an approximation is OK.
      const visibleAgents = result.agents.filter(record => matchesAuthorFilter(record, filter));

      if (!starsEnabled) {
        return { ...result, agents: visibleAgents.map(stripStarFields) };
      }

      const enrichment = await prepareStarsEnrichment(
        mastra,
        requestContext,
        'agent',
        visibleAgents.map(a => a.id),
      );
      const annotated = enrichment
        ? visibleAgents.map(record => ({ ...record, isStarred: enrichment.starredIds.has(record.id) }))
        : visibleAgents;

      return { ...result, agents: annotated };
    } catch (error) {
      return handleError(error, 'Error listing stored agents');
    }
  },
});

/**
 * GET /stored/agents/:storedAgentId - Get a stored agent by ID
 */
export const GET_STORED_AGENT_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:storedAgentId',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  queryParamSchema: statusQuerySchema,
  responseSchema: getStoredAgentResponseSchema,
  summary: 'Get stored agent by ID',
  description:
    'Returns a specific agent from storage by its unique identifier. Use ?status=draft to resolve with the latest (draft) version, or ?status=published (default) for the active published version.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, storedAgentId, status }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      const agent = await agentsStore.getByIdResolved(storedAgentId, { status });

      if (!agent) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      // Throws 404 if the caller isn't the owner, admin, `agents:read[:<id>]`
      // holder, and the record isn't public/legacy-unowned.
      assertReadAccess({ requestContext, resource: 'agents', resourceId: storedAgentId, record: agent });

      const enrichment = await prepareStarsEnrichment(mastra, requestContext, 'agent', [agent.id]);
      if (enrichment) {
        return { ...agent, isStarred: enrichment.starredIds.has(agent.id) };
      }
      return stripStarFields(agent);
    } catch (error) {
      return handleError(error, 'Error getting stored agent');
    }
  },
});

/**
 * POST /stored/agents - Create a new stored agent
 */
export const CREATE_STORED_AGENT_ROUTE: ServerRoute<
  InferParams<undefined, undefined, typeof createStoredAgentBodySchema>,
  z.infer<typeof createStoredAgentResponseSchema>,
  'json',
  RouteSchemas<undefined, undefined, typeof createStoredAgentBodySchema, typeof createStoredAgentResponseSchema>,
  'POST',
  '/stored/agents'
> = createRoute({
  method: 'POST',
  path: '/stored/agents',
  responseType: 'json',
  bodySchema: createStoredAgentBodySchema,
  responseSchema: createStoredAgentResponseSchema,
  summary: 'Create stored agent',
  description: 'Creates a new agent in storage with the provided configuration',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({
    mastra,
    requestContext,
    id: providedId,
    metadata,
    visibility: bodyVisibility,
    name,
    description,
    instructions,
    model,
    tools,
    defaultOptions,
    workflows,
    agents,
    integrationTools,
    mcpClients,
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
    skills,
    workspace,
    browser,
    requestContextSchema,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive agent ID from name. Please provide an explicit id.',
        });
      }

      // Check if agent with this ID already exists
      const existing = await agentsStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `Agent with id ${id} already exists` });
      }

      // Force authorId from the authenticated caller; ignore any body-provided value.
      // Default visibility: 'private' when there's an owner, 'public' when unowned
      // (no auth / no user context). Unowned resources should always be public.
      const authorId = getCallerAuthorId(requestContext) ?? undefined;
      const visibility = bodyVisibility ?? (authorId ? 'private' : 'public');

      // Reject oversized avatar images before writing to storage.
      validateMetadataAvatarUrl(metadata);

      const resolvedBrowser = await resolveBrowserField(browser, mastra);

      const input = {
        id,
        authorId,
        visibility,
        metadata,
        name,
        description,
        instructions,
        model,
        tools,
        defaultOptions,
        workflows,
        agents,
        integrationTools,
        mcpClients,
        inputProcessors,
        outputProcessors,
        memory,
        scorers,
        skills,
        workspace,
        browser: resolvedBrowser,
        requestContextSchema,
      } as StorageCreateAgentInput;

      // Use editor.agent.create() when available to apply builder defaults
      const editor = mastra.getEditor?.();
      if (editor) {
        await editor.agent.create(input);
      } else {
        // Fallback to direct storage create
        await agentsStore.create({ agent: input });
      }

      // Publish the initial version so the agent is immediately usable.
      // Without this, the thin record stays as status='draft' with activeVersionId=null,
      // which makes the agent unreachable via status='published' resolution.
      const { versions } = await agentsStore.listVersions({ agentId: id, perPage: 1 });
      const initialVersion = versions[0];
      if (initialVersion) {
        await agentsStore.update({
          id,
          activeVersionId: initialVersion.id,
          status: 'published',
        });
        editor?.agent.clearCache(id);
      }

      // Return the resolved agent (thin record + version config) using the newly published version
      const resolved = await agentsStore.getByIdResolved(id, { status: 'published' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created agent' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error creating stored agent');
    }
  },
});

/**
 * PATCH /stored/agents/:storedAgentId - Update a stored agent
 */
export const UPDATE_STORED_AGENT_ROUTE: ServerRoute<
  InferParams<typeof storedAgentIdPathParams, undefined, typeof updateStoredAgentBodySchema>,
  z.infer<typeof updateStoredAgentResponseSchema>,
  'json',
  RouteSchemas<
    typeof storedAgentIdPathParams,
    undefined,
    typeof updateStoredAgentBodySchema,
    typeof updateStoredAgentResponseSchema
  >,
  'PATCH',
  '/stored/agents/:storedAgentId'
> = createRoute({
  method: 'PATCH',
  path: '/stored/agents/:storedAgentId',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  bodySchema: updateStoredAgentBodySchema,
  responseSchema: updateStoredAgentResponseSchema,
  summary: 'Update stored agent',
  description: 'Updates an existing agent in storage with the provided fields',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({
    mastra,
    requestContext,
    storedAgentId,
    // Metadata-level fields
    authorId,
    metadata,
    visibility,
    // Config fields (snapshot-level)
    name,
    description,
    instructions,
    model,
    tools,
    defaultOptions,
    workflows,
    agents,
    integrationTools,
    mcpClients,
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
    skills,
    workspace,
    browser,
    requestContextSchema,
    // Version metadata
    changeMessage,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Check if agent exists
      const existing = await agentsStore.getById(storedAgentId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      // Throws 404 if the caller isn't the owner, admin, or `agents:edit[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'agents',
        resourceId: storedAgentId,
        action: 'edit',
        record: existing,
      });

      // Reject oversized avatar images before writing to storage.
      validateMetadataAvatarUrl(metadata);

      // Enforce admin model allowlist (Phase 6) before persisting.
      if (model !== undefined) {
        const policy = await resolveBuilderModelPolicy(mastra.getEditor?.());
        if (policy.active) {
          assertModelAllowed(policy.allowed, model as Parameters<typeof assertModelAllowed>[1]);
        }
      }

      // Resolve boolean browser shorthand from the UI
      const resolvedBrowser = await resolveBrowserField(browser, mastra);

      // Update the agent with both metadata-level and config-level fields
      // The storage layer handles separating these into agent-record updates vs new-version creation
      // Cast needed because Zod's passthrough() output types don't exactly match the handwritten TS interfaces
      const updatedAgent = await agentsStore.update({
        id: storedAgentId,
        authorId,
        metadata,
        visibility,
        name,
        description,
        instructions,
        model,
        tools,
        defaultOptions,
        workflows,
        agents,
        integrationTools,
        mcpClients,
        inputProcessors,
        outputProcessors,
        memory,
        scorers,
        skills,
        workspace,
        browser: resolvedBrowser,
        requestContextSchema,
      } as StorageUpdateAgentInput);

      // Build the snapshot config for auto-versioning comparison
      const configFields = {
        name,
        description,
        instructions,
        model,
        tools,
        defaultOptions,
        workflows,
        agents,
        integrationTools,
        mcpClients,
        inputProcessors,
        outputProcessors,
        memory,
        scorers,
        skills,
        workspace,
        browser: resolvedBrowser,
        requestContextSchema,
      };

      // Filter out undefined values to get only the config fields that were provided
      const providedConfigFields = Object.fromEntries(Object.entries(configFields).filter(([_, v]) => v !== undefined));

      // Handle auto-versioning with retry logic for race conditions
      // This creates a new version if there are meaningful config changes.
      // It does NOT update activeVersionId — the version stays as a draft until explicitly published.
      const autoVersionResult = await handleAutoVersioning(
        agentsStore as unknown as VersionedStoreInterface,
        storedAgentId,
        'agentId',
        AGENT_SNAPSHOT_CONFIG_FIELDS,
        existing,
        updatedAgent,
        providedConfigFields,
        changeMessage ? { changeMessage } : undefined,
      );

      if (!autoVersionResult) {
        throw new Error('handleAutoVersioning returned undefined');
      }

      // Clear the cached agent instance so the next request gets the updated config
      const editor = mastra.getEditor();
      if (editor) {
        editor.agent.clearCache(storedAgentId);
      }

      // Return the resolved agent with the latest (draft) version so the UI sees its edits
      const resolved = await agentsStore.getByIdResolved(storedAgentId, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated agent' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error updating stored agent');
    }
  },
});

/**
 * DELETE /stored/agents/:storedAgentId - Delete a stored agent
 */
export const DELETE_STORED_AGENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/agents/:storedAgentId',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: deleteStoredAgentResponseSchema,
  summary: 'Delete stored agent',
  description: 'Deletes an agent from storage by its unique identifier',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, storedAgentId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Check if agent exists
      const existing = await agentsStore.getById(storedAgentId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      // Throws 404 if the caller isn't the owner, admin, or `agents:delete[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'agents',
        resourceId: storedAgentId,
        action: 'delete',
        record: existing,
      });

      await agentsStore.delete(storedAgentId);

      // Cascade: drop any star rows referencing this agent so they don't
      // resurrect if the same id is reused. Failure must not abort the delete.
      try {
        const starsStore = await storage.getStore('stars');
        await starsStore?.deleteStarsForEntity({ entityType: 'agent', entityId: storedAgentId });
      } catch (cascadeError) {
        mastra
          .getLogger?.()
          ?.warn?.('Failed to cascade-delete stars for agent', { storedAgentId, error: cascadeError });
      }

      // Clear the cached agent instance
      mastra.getEditor()?.agent.clearCache(storedAgentId);

      return { success: true, message: `Agent ${storedAgentId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored agent');
    }
  },
});

/**
 * POST /stored/agents/preview-instructions - Preview resolved instructions
 */
export const PREVIEW_INSTRUCTIONS_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/preview-instructions',
  responseType: 'json',
  bodySchema: previewInstructionsBodySchema,
  responseSchema: previewInstructionsResponseSchema,
  summary: 'Preview resolved instructions',
  description:
    'Resolves an array of instruction blocks against a request context, evaluating rules, fetching prompt block references, and rendering template variables. Returns the final concatenated instruction string.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, blocks, context }) => {
    try {
      const editor = mastra.getEditor();
      if (!editor) {
        throw new HTTPException(500, { message: 'Editor is not configured' });
      }

      const result = await editor.prompt.preview(blocks, context ?? {});

      return { result };
    } catch (error) {
      return handleError(error, 'Error previewing instructions');
    }
  },
});
