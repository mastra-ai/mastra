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
  getStoredAgentDependentsResponseSchema,
  exportStoredAgentBodySchema,
  openStoredAgentChangeRequestBodySchema,
  exportStoredAgentResponseSchema,
  openStoredAgentChangeRequestResponseSchema,
  previewInstructionsBodySchema,
  previewInstructionsResponseSchema,
} from '../schemas/stored-agents';
import type { ServerRoute, RouteSchemas, InferParams } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { assertStoredResourceScope, getStoredResourceScope, scopeStoredResourceMetadata, toSlug } from '../utils';

import { attachAuthor, prepareAuthorEnrichment } from './author-enrichment';
import {
  assertReadAccess,
  assertWriteAccess,
  getCallerAuthorId,
  matchesAuthorFilter,
  resolveAuthorFilter,
} from './authorship';
import { isBuilderFeatureEnabled } from './editor-builder';
import { handleError } from './error';
import { enrichOrStripFavorites, prepareFavoritesEnrichment, stripFavoriteFields } from './favorites-enrichment';
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
  'toolProviders',
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

const CODE_AGENT_OVERRIDE_FIELDS = [
  'instructions',
  'tools',
  'integrationTools',
  'mcpClients',
  'requestContextSchema',
] as const;

/**
 * Derive ownership flags from a code agent's editor config.
 * Mirrors the semantics of `editor.agent.applyStoredOverrides` so that
 * client save payloads, persisted snapshots, and export output all agree
 * on which fields Studio is allowed to own.
 */
function getCodeAgentOwnership(editorConfig: unknown): {
  ownsInstructions: boolean;
  ownsTools: boolean;
  ownsToolDescriptionsOnly: boolean;
} {
  if (editorConfig === false) {
    return { ownsInstructions: false, ownsTools: false, ownsToolDescriptionsOnly: false };
  }
  if (editorConfig === undefined || editorConfig === null) {
    // Legacy default: code agents without explicit editor config behave as fully editable.
    return { ownsInstructions: true, ownsTools: true, ownsToolDescriptionsOnly: false };
  }
  if (typeof editorConfig !== 'object') {
    return { ownsInstructions: false, ownsTools: false, ownsToolDescriptionsOnly: false };
  }
  const cfg = editorConfig as { instructions?: unknown; tools?: unknown };
  const ownsInstructions = cfg.instructions === true;
  const toolsCfg = cfg.tools;
  const ownsTools = toolsCfg === true;
  const ownsToolDescriptionsOnly =
    typeof toolsCfg === 'object' && toolsCfg !== null && (toolsCfg as { description?: unknown }).description === true;
  return { ownsInstructions, ownsTools, ownsToolDescriptionsOnly };
}

function hasNonEmptyInstructions(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (!Array.isArray(value)) {
    return false;
  }

  return value.some(block => {
    if (!block || typeof block !== 'object') {
      return false;
    }

    const typedBlock = block as { type?: unknown; id?: unknown; content?: unknown };
    if (typedBlock.type === 'prompt_block_ref') {
      return typeof typedBlock.id === 'string' && typedBlock.id.length > 0;
    }

    return typeof typedBlock.content === 'string' && typedBlock.content.trim().length > 0;
  });
}

function assertOwnedInstructionsNotEmpty(instructions: unknown) {
  if (!hasNonEmptyInstructions(instructions)) {
    throw new HTTPException(400, { message: 'Instructions are required' });
  }
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableJson);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForStableJson(entry)]),
    );
  }

  return value;
}

function buildExportConfig(
  input: Record<string, unknown>,
  agent?: { __getEditorConfig?: () => unknown; source?: string },
) {
  const editorConfig = agent?.__getEditorConfig?.();
  const isCodeAgent = agent?.source === 'code';
  const allowedFields = isCodeAgent ? CODE_AGENT_OVERRIDE_FIELDS : AGENT_SNAPSHOT_CONFIG_FIELDS;
  const ownership = isCodeAgent ? getCodeAgentOwnership(editorConfig) : null;
  const config: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (input[field] === undefined) continue;
    if (ownership) {
      if (field === 'instructions' && !ownership.ownsInstructions) continue;
      if (
        (field === 'tools' || field === 'integrationTools' || field === 'mcpClients') &&
        !ownership.ownsTools &&
        !ownership.ownsToolDescriptionsOnly
      ) {
        continue;
      }
    }
    config[field] = input[field];
  }

  return sortForStableJson(config) as Record<string, unknown>;
}

function agentExportFilename(agentId: string) {
  return `agents/${encodeURIComponent(agentId)}.json`;
}

function sourceChangeRequestHeadRef(agentId: string) {
  const safeAgentId = agentId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'agent';
  return `mastra/${safeAgentId}`;
}

function sourceChangeRequestMessage(agentId: string, userName?: string, changeMessage?: string) {
  const normalizedUserName = userName?.replace(/\s+/g, ' ').trim();
  const normalizedMessage = changeMessage?.replace(/\s+/g, ' ').trim();
  const message = normalizedMessage || `Update ${agentId} agent override`;
  return normalizedUserName ? `${message} by ${normalizedUserName}` : message;
}

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
    favoritedOnly,
    pinFavoritedFor,
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
        resource: 'stored-agents',
        queryAuthorId: authorId,
        queryVisibility: visibility === 'public' ? 'public' : undefined,
      });

      const scope = await getStoredResourceScope(mastra, requestContext);
      const scopedMetadata = scopeStoredResourceMetadata(metadata, scope);

      const callerId = getCallerAuthorId(requestContext);
      const favoritesEnabled = await isBuilderFeatureEnabled(mastra, 'favorites');
      const honoredStarredOnly = favoritesEnabled && favoritedOnly === true;
      const favoriteSubjectId = pinFavoritedFor ?? callerId;

      // `?favoritedOnly=true`: fetch caller's favorited IDs, then refilter + recompute total.
      if (honoredStarredOnly) {
        const effectivePerPage: number = perPage ?? 100;
        if (!favoriteSubjectId) {
          return { agents: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const favoritesStore = await storage.getStore('favorites');
        if (!favoritesStore) {
          throw new HTTPException(500, { message: 'Favorites storage domain is not available' });
        }
        const starredIds = await favoritesStore.listFavoritedIds({ userId: favoriteSubjectId, entityType: 'agent' });
        if (starredIds.length === 0) {
          return { agents: [], total: 0, page, perPage: effectivePerPage, hasMore: false };
        }
        const allMatching = await agentsStore.listResolved({
          perPage: false,
          orderBy,
          status,
          authorId: filter.kind === 'exact' ? filter.authorId : undefined,
          metadata: scopedMetadata,
          entityIds: starredIds,
        });
        const visible = allMatching.agents.filter(record => matchesAuthorFilter(record, filter));
        const total = visible.length;
        const startIdx = effectivePerPage === 0 ? 0 : page * effectivePerPage;
        const endIdx = effectivePerPage === 0 ? 0 : startIdx + effectivePerPage;
        const sliced = effectivePerPage === 0 ? [] : visible.slice(startIdx, endIdx);
        const annotated = sliced.map(record => ({ ...record, isFavorited: true }));
        const authors = await prepareAuthorEnrichment(
          mastra,
          requestContext,
          annotated.map(a => a.authorId),
        );
        const withAuthors = authors ? annotated.map(record => attachAuthor(record, authors)) : annotated;
        const hasMore = effectivePerPage > 0 && endIdx < total;
        return { agents: withAuthors, total, page, perPage: effectivePerPage, hasMore };
      }

      const result = await agentsStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId: filter.kind === 'exact' ? filter.authorId : undefined,
        metadata: scopedMetadata,
      });

      // Post-filter to enforce ownership + visibility rules across all backends.
      // Storage adapters can only do an equality filter on authorId, so we apply
      // the ownedOrPublic / publicOnly logic here.
      // Note: `total` is left as the storage-reported count to keep pagination
      // math working. For `unrestricted` / `exact` filters nothing is removed.
      // For `ownedOrPublic` / `publicOnly`, downstream UIs should treat the
      // filter as a view over the caller's scope — an approximation is OK.
      const visibleAgents = result.agents.filter(record => matchesAuthorFilter(record, filter));

      const authors = await prepareAuthorEnrichment(
        mastra,
        requestContext,
        visibleAgents.map(a => a.authorId),
      );

      if (!favoritesEnabled) {
        const stripped = visibleAgents.map(stripFavoriteFields);
        const withAuthors = authors ? stripped.map(record => attachAuthor(record, authors)) : stripped;
        return { ...result, agents: withAuthors };
      }

      const enrichment = await prepareFavoritesEnrichment(
        mastra,
        requestContext,
        'agent',
        visibleAgents.map(a => a.id),
      );
      const annotated = enrichment
        ? visibleAgents.map(record => ({ ...record, isFavorited: enrichment.starredIds.has(record.id) }))
        : visibleAgents.map(stripFavoriteFields);
      const withAuthors = authors ? annotated.map(record => attachAuthor(record, authors)) : annotated;

      return { ...result, agents: withAuthors };
    } catch (error) {
      return handleError(error, 'Error listing stored agents');
    }
  },
});

async function buildStoredAgentExport({
  mastra,
  requestContext,
  storedAgentId,
  body,
}: {
  mastra: any;
  requestContext: any;
  storedAgentId: string;
  body: Record<string, unknown>;
}) {
  const storage = mastra.getStorage();
  const agentsStore = storage ? await storage.getStore('agents') : undefined;
  const storedAgent = await agentsStore?.getByIdResolved(storedAgentId, { status: 'draft' });
  if (storedAgent) {
    assertStoredResourceScope(storedAgent, await getStoredResourceScope(mastra, requestContext));
    assertReadAccess({ requestContext, resource: 'stored-agents', resourceId: storedAgentId, record: storedAgent });
  }

  let codeAgent: { __getEditorConfig?: () => unknown; source?: string } | undefined;
  try {
    codeAgent = mastra.getAgentById?.(storedAgentId) as typeof codeAgent;
  } catch {
    codeAgent = undefined;
  }

  if (!storedAgent && !codeAgent) {
    throw new HTTPException(404, { message: `Agent with id ${storedAgentId} not found` });
  }

  const config = buildExportConfig(body, codeAgent);
  const content = `${JSON.stringify(config, null, 2)}\n`;

  return {
    agentId: storedAgentId,
    fileName: agentExportFilename(storedAgentId),
    content,
    config,
  };
}

export const EXPORT_STORED_AGENT_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/:storedAgentId/export',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  bodySchema: exportStoredAgentBodySchema,
  responseSchema: exportStoredAgentResponseSchema,
  summary: 'Export stored agent override JSON',
  description: 'Returns deterministic JSON for an agent configuration or code-agent override without mutating storage',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, storedAgentId, ...body }) => {
    try {
      return await buildStoredAgentExport({ mastra, requestContext, storedAgentId, body });
    } catch (error) {
      return handleError(error, 'Error exporting stored agent');
    }
  },
});

export const OPEN_STORED_AGENT_CHANGE_REQUEST_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/:storedAgentId/change-request',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  bodySchema: openStoredAgentChangeRequestBodySchema,
  responseSchema: openStoredAgentChangeRequestResponseSchema,
  summary: 'Open stored agent source change request',
  description: 'Opens a source-provider change request for deterministic agent override JSON without mutating storage',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, storedAgentId, ...body }) => {
    try {
      const provider = mastra.getEditor?.()?.getSourceControlProvider?.();
      if (!provider?.openChangeRequest) {
        throw new HTTPException(400, { message: 'Source control provider cannot open change requests' });
      }

      const openChangeRequest = provider.openChangeRequest.bind(provider);
      const { changeMessage, userName, inspectOnly, ...exportBody } = body;
      const headRef = sourceChangeRequestHeadRef(storedAgentId);
      const title = `Update ${storedAgentId} agent override`;
      const result = inspectOnly
        ? await openChangeRequest({
            title,
            headRef,
            files: [],
          })
        : await (async () => {
            const response = await buildStoredAgentExport({ mastra, requestContext, storedAgentId, body: exportBody });
            const message = sourceChangeRequestMessage(storedAgentId, userName, changeMessage);
            return openChangeRequest({
              title,
              body: `Updates ${response.fileName} from Mastra Studio.`,
              headRef,
              files: [
                {
                  path: response.fileName,
                  content: response.content,
                  message,
                },
              ],
            });
          })();

      const storage = mastra.getStorage();
      const agentsStore = storage ? await storage.getStore('agents') : undefined;
      await (
        agentsStore as { useProviderRef?: (agentId: string, ref: string) => Promise<void> } | undefined
      )?.useProviderRef?.(storedAgentId, result.ref ?? headRef);
      mastra.getEditor?.()?.agent?.clearCache?.(storedAgentId);

      return result;
    } catch (error) {
      return handleError(error, 'Error opening stored agent change request');
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
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

      // Throws 404 if the caller isn't the owner, admin, `stored-agents:read[:<id>]`
      // holder, and the record isn't public/legacy-unowned.
      assertReadAccess({ requestContext, resource: 'stored-agents', resourceId: storedAgentId, record: agent });

      const authors = await prepareAuthorEnrichment(mastra, requestContext, [agent.authorId]);
      const withFavorite = await enrichOrStripFavorites(mastra, requestContext, 'agent', agent);
      return attachAuthor(withFavorite, authors);
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
    toolProviders,
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
      // No owner = always public (no auth / no user context).
      // With an owner, respect the client's choice, defaulting to 'private'.
      const authorId = getCallerAuthorId(requestContext) ?? undefined;
      const visibility = authorId ? (bodyVisibility ?? 'private') : 'public';

      // Reject oversized avatar images before writing to storage.
      validateMetadataAvatarUrl(metadata);

      // Model policy enforcement is intentionally not done on save: each UI
      // surface gates its own model picker via ModelPolicyProvider, and the
      // policy is surface-scoped (builder vs editor). Re-introducing a single
      // server-side check here would either over-enforce on the editor or
      // under-enforce on the builder until per-surface enforcement lands.

      const resolvedBrowser = await resolveBrowserField(browser, mastra);

      let createInstructions: typeof instructions | undefined = instructions;
      let createTools = tools;
      let createIntegrationTools = integrationTools;
      let createMcpClients = mcpClients;
      let codeAgentForCreate: { __getEditorConfig?: () => unknown; source?: string } | undefined;
      try {
        codeAgentForCreate = mastra.getAgentById?.(id) as typeof codeAgentForCreate;
      } catch {
        codeAgentForCreate = undefined;
      }
      if (codeAgentForCreate?.source === 'code') {
        const ownership = getCodeAgentOwnership(codeAgentForCreate.__getEditorConfig?.());
        if (ownership.ownsInstructions) {
          assertOwnedInstructionsNotEmpty(createInstructions);
        } else {
          createInstructions = undefined;
        }
        if (!ownership.ownsTools && !ownership.ownsToolDescriptionsOnly) {
          createTools = undefined;
          createIntegrationTools = undefined;
          createMcpClients = undefined;
        }
      }

      const input = {
        id,
        authorId,
        visibility,
        metadata: scopeStoredResourceMetadata(metadata, await getStoredResourceScope(mastra, requestContext)),
        name,
        description,
        instructions: createInstructions,
        model,
        tools: createTools,
        defaultOptions,
        workflows,
        agents,
        integrationTools: createIntegrationTools,
        toolProviders,
        mcpClients: createMcpClients,
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

      return enrichOrStripFavorites(mastra, requestContext, 'agent', resolved);
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
    toolProviders,
    mcpClients,
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
    skills,
    workspace,
    browser,
    requestContextSchema,
    // Version options
    changeMessage,
    autoPublish = false,
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
      const scope = await getStoredResourceScope(mastra, requestContext);
      assertStoredResourceScope(existing, scope);

      // Throws 404 if the caller isn't the owner, admin, or `agents:edit[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'stored-agents',
        resourceId: storedAgentId,
        action: 'edit',
        record: existing,
      });

      // Reject oversized avatar images before writing to storage.
      validateMetadataAvatarUrl(metadata);

      // No owner = always public, regardless of what the client sent.
      const callerAuthorId = getCallerAuthorId(requestContext) ?? undefined;
      const resolvedVisibility = callerAuthorId ? visibility : visibility != null ? 'public' : undefined;

      // Model policy enforcement is intentionally not done on save: each UI
      // surface gates its own model picker via ModelPolicyProvider, and the
      // policy is surface-scoped (builder vs editor). Re-introducing a single
      // server-side check here would either over-enforce on the editor or
      // under-enforce on the builder until per-surface enforcement lands.

      // Resolve boolean browser shorthand from the UI
      const resolvedBrowser = await resolveBrowserField(browser, mastra);

      // For code-defined agents, strip fields the editor config does not allow
      // Studio to own. This keeps stored snapshots (and the per-entity files
      // they get persisted to) free of fields the server never reads back.
      let codeAgentForUpdate: { __getEditorConfig?: () => unknown; source?: string } | undefined;
      try {
        codeAgentForUpdate = mastra.getAgentById?.(storedAgentId) as typeof codeAgentForUpdate;
      } catch {
        codeAgentForUpdate = undefined;
      }
      if (codeAgentForUpdate?.source === 'code') {
        const ownership = getCodeAgentOwnership(codeAgentForUpdate.__getEditorConfig?.());
        if (ownership.ownsInstructions) {
          if (instructions !== undefined) {
            assertOwnedInstructionsNotEmpty(instructions);
          }
        } else {
          instructions = undefined;
        }
        if (!ownership.ownsTools && !ownership.ownsToolDescriptionsOnly) {
          tools = undefined;
          integrationTools = undefined;
          mcpClients = undefined;
        }
      }

      const mergedMetadata: Record<string, unknown> = { ...(existing.metadata ?? {}), ...(metadata ?? {}) };
      const scopedMetadata = scopeStoredResourceMetadata(mergedMetadata, scope);

      // Update the agent with both metadata-level and config-level fields
      // The storage layer handles separating these into agent-record updates vs new-version creation
      // Cast needed because Zod's passthrough() output types don't exactly match the handwritten TS interfaces
      const updatedAgent = await agentsStore.update({
        id: storedAgentId,
        authorId,
        metadata: scopedMetadata,
        visibility: resolvedVisibility,
        name,
        description,
        instructions,
        model,
        tools,
        defaultOptions,
        workflows,
        agents,
        integrationTools,
        toolProviders,
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
        toolProviders,
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

      // In code mode, local saves should overwrite the most recent saved
      // snapshot rather than creating new draft versions on every keystroke
      // batch. Version history is intended to track commits, not raw saves.
      // We collapse the freshly created version onto the previous one by
      // deleting the prior latest version, leaving a single rolling snapshot.
      // When the user explicitly provides a changeMessage we treat that as a
      // commit and keep the new version as a discrete history entry.
      const isCodeSource = mastra.getEditor?.()?.getSource?.() === 'code';
      if (isCodeSource && autoVersionResult.versionCreated && !changeMessage) {
        const { versions } = await agentsStore.listVersions({ agentId: storedAgentId, perPage: 2 });
        const previousVersion = versions[1];
        const isPublishedVersion = previousVersion?.id === existing.activeVersionId;
        if (previousVersion && !isPublishedVersion) {
          await agentsStore.deleteVersion(previousVersion.id);
        }
      }

      // Publication remains opt-in so Classic Studio can save drafts without moving the active version,
      // while Agent Builder can preserve immediate runtime updates by sending autoPublish: true.
      // This flag is a bridge until version creation and publication move to dedicated APIs.
      if (autoVersionResult.versionCreated && autoPublish) {
        const { versions } = await agentsStore.listVersions({ agentId: storedAgentId, perPage: 1 });
        const latestVersion = versions[0];
        if (latestVersion) {
          await agentsStore.update({
            id: storedAgentId,
            activeVersionId: latestVersion.id,
          });
        }
      }

      // Clear the cached agent instance so the next request gets the updated config
      const editor = mastra.getEditor();
      if (editor) {
        editor.agent.clearCache(storedAgentId);
      }

      // Return the resolved agent with the latest version
      const resolved = await agentsStore.getByIdResolved(storedAgentId, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated agent' });
      }

      return enrichOrStripFavorites(mastra, requestContext, 'agent', resolved);
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
      assertStoredResourceScope(existing, await getStoredResourceScope(mastra, requestContext));

      // Throws 404 if the caller isn't the owner, admin, or `agents:delete[:<id>]` holder.
      assertWriteAccess({
        requestContext,
        resource: 'stored-agents',
        resourceId: storedAgentId,
        action: 'delete',
        record: existing,
      });

      await agentsStore.delete(storedAgentId);

      // Cascade: drop any favorite rows referencing this agent so they don't
      // resurrect if the same id is reused. Failure must not abort the delete.
      try {
        const favoritesStore = await storage.getStore('favorites');
        await favoritesStore?.deleteFavoritesForEntity({ entityType: 'agent', entityId: storedAgentId });
      } catch (cascadeError) {
        mastra
          .getLogger?.()
          ?.warn?.('Failed to cascade-delete favorites for agent', { storedAgentId, error: cascadeError });
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
 * GET /stored/agents/:storedAgentId/dependents - List agents that reference
 * the target agent as a sub-agent.
 *
 * Returns `dependents` for caller-visible references (named) and `hiddenCount`
 * for references from agents the caller can't read (count only, no leak).
 * `hiddenCount` is only populated when the target is public — private targets
 * can't legitimately be referenced from other workspaces.
 */
export const GET_STORED_AGENT_DEPENDENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:storedAgentId/dependents',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: getStoredAgentDependentsResponseSchema,
  summary: 'List dependents of a stored agent',
  description:
    'Returns agents that reference the target as a sub-agent. Used to warn before deleting or unsharing. Caller-readable references appear in `dependents` (id + name); cross-workspace references the caller cannot read are aggregated in `hiddenCount` and only surfaced when the target is public.',
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

      // Mirrors GET: 404 if the caller can't read the target. Prevents the
      // dependents endpoint from being usable as a sub-agent reference oracle.
      const target = await agentsStore.getById(storedAgentId);
      if (!target) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }
      assertStoredResourceScope(target, await getStoredResourceScope(mastra, requestContext));
      assertReadAccess({ requestContext, resource: 'stored-agents', resourceId: storedAgentId, record: target });

      // Full scan (no authorId filter) so a public target can detect
      // cross-workspace private dependents. We split into caller-visible
      // `dependents` vs `hiddenCount` so private agents owned by other users
      // are counted but never named.
      const filter = resolveAuthorFilter({ requestContext, resource: 'stored-agents' });
      const all = await agentsStore.listResolved({
        perPage: false,
        status: 'published',
      });

      const targetIsPublic = (target as { visibility?: string }).visibility === 'public';

      // Caller-readable dependents are surfaced by name (the caller already
      // has access to them). Cross-workspace dependents the caller cannot
      // read are aggregated into hiddenCount, only when the target is public.
      const dependents: Array<{ id: string; name: string }> = [];
      let hiddenCount = 0;

      for (const record of all.agents) {
        if (record.id === storedAgentId) continue;
        if (!referencesTarget((record as { agents?: unknown }).agents, storedAgentId)) continue;

        if (matchesAuthorFilter(record, filter)) {
          dependents.push({
            id: record.id,
            name: (record as { name?: string }).name ?? record.id,
          });
        } else if (targetIsPublic) {
          hiddenCount += 1;
        }
        // Private target: drop hidden refs silently — they shouldn't exist
        // and surfacing the count would leak cross-workspace structure.
      }

      return { dependents, hiddenCount };
    } catch (error) {
      return handleError(error, 'Error listing stored agent dependents');
    }
  },
});

/**
 * Does the resolved `agents` snapshot field reference `targetId`?
 * The field can be either a static `Record<string, toolConfig>` or an array of
 * conditional variants (`{ value, rules? }`). Match if any variant's value
 * (or the static object) contains a matching key.
 */
function referencesTarget(subAgents: unknown, targetId: string): boolean {
  if (!subAgents) return false;
  if (Array.isArray(subAgents)) {
    return subAgents.some(variant => {
      const value = (variant as { value?: unknown })?.value;
      return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, targetId));
    });
  }
  if (typeof subAgents === 'object') {
    return Object.prototype.hasOwnProperty.call(subAgents, targetId);
  }
  return false;
}

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
