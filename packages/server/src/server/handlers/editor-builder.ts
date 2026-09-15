import type { Mastra } from '@mastra/core';

import { HTTPException } from '../http-exception';
import {
  agentFeaturesSchema,
  builderAvailableModelsResponseSchema,
  builderSettingsResponseSchema,
  infrastructureStatusResponseSchema,
} from '../schemas/editor-builder';
import type { AgentFeatures, InfrastructureStatus } from '../schemas/editor-builder';
import { createRoute } from '../server-adapter/routes/route-builder';
import { resolveBuilderModelPolicy } from '../utils/resolve-builder-model-policy';
import { buildProvidersList } from './agents';
import { handleError } from './error';

/**
 * Resolve the active builder feature flags. Returns `null` when the editor is
 * absent, the builder is disabled, or no features are configured.
 */
async function resolveBuilderFeatures(mastra: Mastra): Promise<AgentFeatures | null> {
  const editor = mastra.getEditor();
  if (!editor || typeof editor.resolveBuilder !== 'function') return null;
  if (!editor.hasEnabledBuilderConfig?.()) return null;
  const builder = await editor.resolveBuilder();
  if (!builder || !builder.enabled) return null;
  const features = builder.getFeatures?.()?.agent;
  if (!features) return null;
  // Validate the shape so unknown keys cannot smuggle through.
  const parsed = agentFeaturesSchema.safeParse(features);
  return parsed.success ? parsed.data : null;
}

/**
 * Returns whether a given agent-builder feature is enabled. Used by list /
 * get-by-id handlers to soft-gate response enrichment (omit fields, ignore
 * favoritedOnly / pinFavoritedFor params) when the feature is off.
 */
export async function isBuilderFeatureEnabled(mastra: Mastra, feature: keyof AgentFeatures): Promise<boolean> {
  const features = await resolveBuilderFeatures(mastra);
  return features?.[feature] === true;
}

/**
 * Hard-gate helper for mutation routes that must not exist when the feature
 * is off. Throws `HTTPException(404)` so we don't leak the existence of the
 * feature surface (matches behavior of unregistered routes).
 */
export async function requireBuilderFeature(mastra: Mastra, feature: keyof AgentFeatures): Promise<void> {
  if (!(await isBuilderFeatureEnabled(mastra, feature))) {
    throw new HTTPException(404, { message: 'Not Found' });
  }
}

/**
 * GET /editor/builder/settings
 *
 * Returns the agent builder settings configured by the admin.
 * Used by frontend to determine which features to display.
 */
export const GET_EDITOR_BUILDER_SETTINGS_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/builder/settings',
  responseType: 'json',
  responseSchema: builderSettingsResponseSchema,
  summary: 'Get agent builder settings',
  description: 'Returns the agent builder feature flags and configuration for UI gating',
  tags: ['Editor'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra }) => {
    try {
      const editor = mastra.getEditor();

      // No editor configured
      if (!editor) {
        return { enabled: false, modelPolicy: { active: false } };
      }

      // Editor doesn't support builder (older version or OSS)
      if (typeof editor.resolveBuilder !== 'function') {
        return { enabled: false, modelPolicy: { active: false } };
      }

      // Check if builder is enabled in config
      if (!editor.hasEnabledBuilderConfig?.()) {
        return { enabled: false, modelPolicy: { active: false } };
      }

      // Resolve the builder instance
      const builder = await editor.resolveBuilder();
      if (!builder || !builder.enabled) {
        return { enabled: false, modelPolicy: { active: false } };
      }

      const baseWarnings = builder.getModelPolicyWarnings?.() ?? [];
      const configuration = builder.getConfiguration();

      // Picker allowlists are written against entity `.id` (what users see in
      // the UI, URLs, traces). The client filters list responses by their
      // response keys, which are not always `.id`:
      //   - GET /agents     keys by `agent.id`
      //   - GET /tools      keys by registration key (values include `id`)
      //   - GET /workflows  keys by registration key (values omit `id`)
      // To keep the client filter simple, we accept `.id` (fallback to
      // registration key) for matching, but emit visible IDs as response keys
      // so `Object.keys(data)` lines up.
      type AliasPair = { id: string; key: string };
      const collectAliases = (registry: Record<string, unknown>): AliasPair[] =>
        Object.entries(registry).map(([key, entity]) => ({
          id: (entity as { id?: string }).id || key,
          key,
        }));

      const toolAliases = collectAliases(mastra.listTools() ?? {});
      const agentAliases = collectAliases(mastra.listAgents() ?? {});
      const workflowAliases = collectAliases(mastra.listWorkflows() ?? {});

      // Tools/workflows responses are keyed by registration key. Agents
      // response is keyed by `.id`.
      const toResponseKey = (aliases: AliasPair[], byId: 'id' | 'key') => {
        const map = new Map<string, string>();
        for (const a of aliases) {
          map.set(a.id, byId === 'id' ? a.id : a.key);
          map.set(a.key, byId === 'id' ? a.id : a.key);
        }
        return map;
      };
      const toolKeyMap = toResponseKey(toolAliases, 'key');
      const agentKeyMap = toResponseKey(agentAliases, 'id');
      const workflowKeyMap = toResponseKey(workflowAliases, 'key');

      // Lazy-load the EE subpath so this module remains importable on
      // `@mastra/core` versions that pre-date it (added in core 1.34.0).
      // We only reach here after `builder.enabled` is true, which guarantees
      // a compatible core.
      const { builderToModelPolicy, resolvePickerVisibility } = await import('@mastra/core/agent-builder/ee');

      const picker = resolvePickerVisibility({
        config: configuration?.agent,
        registeredToolIds: toolAliases.flatMap(a => [a.id, a.key]),
        registeredAgentIds: agentAliases.flatMap(a => [a.id, a.key]),
        registeredWorkflowIds: workflowAliases.flatMap(a => [a.id, a.key]),
      });

      const normalize = (visible: string[] | null, map: Map<string, string>): string[] | null => {
        if (visible === null) return null;
        const out: string[] = [];
        const seen = new Set<string>();
        for (const id of visible) {
          const mapped = map.get(id);
          if (mapped && !seen.has(mapped)) {
            seen.add(mapped);
            out.push(mapped);
          }
        }
        return out;
      };

      const modelPolicyWarnings = [...baseWarnings, ...picker.warnings];

      return {
        enabled: true,
        features: builder.getFeatures(),
        configuration,
        modelPolicy: builderToModelPolicy(builder),
        picker: {
          visibleTools: normalize(picker.visibleTools, toolKeyMap),
          visibleAgents: normalize(picker.visibleAgents, agentKeyMap),
          visibleWorkflows: normalize(picker.visibleWorkflows, workflowKeyMap),
        },
        ...(modelPolicyWarnings.length > 0 ? { modelPolicyWarnings } : {}),
      };
    } catch (error) {
      return handleError(error, 'Error getting builder settings');
    }
  },
});

/**
 * GET /editor/builder/models/available
 *
 * Returns the configured AI providers/models the agent builder may use. The
 * server is the single authority: it scopes the list to providers with a
 * configured API key (`connected`) and applies the active builder model
 * policy via `isModelAllowed`, so the Studio surfaces can render the response
 * verbatim without importing any EE matcher into the browser.
 *
 * - Providers without a configured API key are always omitted — the builder
 *   decides the agent's model from this list, so an unconnected provider would
 *   produce an agent that can never run.
 * - Policy inactive (or no allowlist) ⇒ all connected providers are returned.
 * - Policy active with an allowlist ⇒ each connected provider's models are
 *   filtered, and providers left with no allowed models are omitted entirely.
 */
export const GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/builder/models/available',
  responseType: 'json',
  responseSchema: builderAvailableModelsResponseSchema,
  summary: 'List builder-available AI models',
  description: 'Returns AI providers/models filtered by the active agent-builder model policy.',
  tags: ['Editor'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra }) => {
    try {
      // Only surface providers whose API key is configured (`connected`). The
      // agent builder decides the agent's model from this list, so including
      // providers without a key lets it pick a model that can never run. We
      // scope to connected providers so every choice is actually usable.
      const providers = (await buildProvidersList(mastra)).filter(provider => provider.connected);
      const policy = await resolveBuilderModelPolicy(mastra.getEditor());

      // Inactive policy (or no allowlist) ⇒ no allowlist filtering to apply.
      if (!policy.active || !policy.allowed || policy.allowed.length === 0) {
        return { providers };
      }

      // Lazy-load the EE matcher (server-only); mirrors the convention used by
      // resolve-builder-model-policy and the settings handler.
      const { isModelAllowed } = await import('@mastra/core/agent-builder/ee');

      const filtered = providers
        .map(provider => ({
          ...provider,
          models: provider.models.filter(modelId => isModelAllowed(policy.allowed, { provider: provider.id, modelId })),
        }))
        .filter(provider => provider.models.length > 0);

      return { providers: filtered };
    } catch (error) {
      return handleError(error, 'Error fetching available models');
    }
  },
});

/**
 * GET /editor/builder/infrastructure
 *
 * Returns the runtime status of Mastra-opinionated primitives (channels,
 * browser providers, workspaces). Admin-only; surfaced in Studio Settings so
 * admins can sanity-check what's wired up to the running server.
 */
export const GET_INFRASTRUCTURE_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/builder/infrastructure',
  responseType: 'json',
  responseSchema: infrastructureStatusResponseSchema,
  summary: 'Get infrastructure status',
  description: 'Agent Builder infrastructure configuration and lightweight runtime status.',
  tags: ['Editor'],
  requiresAuth: true,
  requiresPermission: 'infrastructure:read',
  handler: async ({ mastra }) => {
    try {
      const formatConfigValue = (value: unknown): string => {
        if (value === null || value === undefined) return 'not set';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
        return value.constructor?.name && value.constructor.name !== 'Object' ? value.constructor.name : 'configured';
      };

      const getProviderName = (value: unknown): string | null => {
        if (!value) return null;
        if (typeof value === 'object' && 'provider' in value && typeof value.provider === 'string')
          return value.provider;
        if (typeof value === 'object' && 'constructor' in value) {
          const name = (value as { constructor?: { name?: string } }).constructor?.name;
          return name && name !== 'Object' ? name : 'configured';
        }
        return null;
      };

      const getConfigEntries = (config: Record<string, unknown>, omittedKeys: string[] = []) =>
        Object.entries(config)
          .filter(([key, value]) => !omittedKeys.includes(key) && value !== undefined && value !== null)
          .map(([key, value]) => ({ key, value: formatConfigValue(value) }));

      const channelProviders = mastra.getChannelProviders() ?? {};
      const channels: InfrastructureStatus['channels'] = {
        providers: Object.entries(channelProviders)
          .map(([id, provider]) => {
            const info = provider.getInfo?.();
            const routes = provider.getRoutes?.() ?? [];
            return {
              id: info?.id ?? id,
              name: info?.name ?? id,
              isConfigured: info?.isConfigured ?? false,
              routeCount: routes.length,
            };
          })
          .filter(provider => provider.isConfigured),
      };

      const editor = mastra.getEditor();
      let browser: InfrastructureStatus['browser'] = {
        type: null,
        provider: null,
        env: null,
        registered: false,
        availableProviders: [],
        config: [],
      };
      let workspace: InfrastructureStatus['workspace'] = {
        type: null,
        workspaceId: null,
        name: null,
        source: null,
        registered: false,
        hasFilesystem: false,
        hasSandbox: false,
        filesystemProvider: null,
        sandboxProvider: null,
        config: [],
      };
      let registries: InfrastructureStatus['registries'] = {
        skillsSh: { enabled: false },
      };

      if (editor?.resolveBuilder) {
        const browsers = (editor as unknown as { __browsers?: Map<string, unknown> }).__browsers;
        const builder = await editor.resolveBuilder();
        const builderRegistries = builder?.getRegistries?.();
        registries = {
          skillsSh: { enabled: builderRegistries?.skillsSh?.enabled === true },
        };
        const configuration = builder?.getConfiguration?.()?.agent as
          | {
              browser?: { type?: string; config?: { provider?: string; env?: string } };
              workspace?: {
                type?: string;
                workspaceId?: string;
                config?: { name?: string; filesystem?: unknown; sandbox?: unknown };
              };
            }
          | undefined;

        const browserRef = configuration?.browser;
        const browserConfig = browserRef?.config ?? {};
        const providerId = browserConfig.provider ?? null;
        browser = {
          type: browserRef?.type ?? null,
          provider: providerId,
          env: browserConfig.env ?? null,
          registered: providerId ? !!browsers?.has(providerId) : false,
          availableProviders: browsers ? Array.from(browsers.keys()) : [],
          config: getConfigEntries(browserConfig, ['provider', 'env']),
        };

        const workspaceRef = configuration?.workspace;
        const workspaceConfig = workspaceRef?.config ?? {};
        const registeredWorkspaces = mastra.listWorkspaces();
        const registeredWorkspace = workspaceRef?.workspaceId
          ? registeredWorkspaces[workspaceRef.workspaceId]
          : undefined;
        const filesystem = registeredWorkspace?.workspace.filesystem ?? workspaceConfig.filesystem;
        const sandbox = registeredWorkspace?.workspace.sandbox ?? workspaceConfig.sandbox;
        const filesystemConfig =
          typeof workspaceConfig.filesystem === 'object' &&
          workspaceConfig.filesystem &&
          'config' in workspaceConfig.filesystem
            ? (workspaceConfig.filesystem.config as Record<string, unknown>)
            : {};
        const sandboxConfig =
          typeof workspaceConfig.sandbox === 'object' && workspaceConfig.sandbox && 'config' in workspaceConfig.sandbox
            ? (workspaceConfig.sandbox.config as Record<string, unknown>)
            : {};
        workspace = {
          type: workspaceRef?.type ?? null,
          workspaceId: workspaceRef?.workspaceId ?? null,
          name: workspaceConfig.name ?? registeredWorkspace?.workspace.name ?? null,
          source: registeredWorkspace?.source ?? null,
          registered: !!registeredWorkspace,
          hasFilesystem: !!filesystem,
          hasSandbox: !!sandbox,
          filesystemProvider: getProviderName(filesystem),
          sandboxProvider: getProviderName(sandbox),
          config: [
            ...getConfigEntries(filesystemConfig).map(entry => ({ ...entry, key: `filesystem.${entry.key}` })),
            ...getConfigEntries(sandboxConfig).map(entry => ({ ...entry, key: `sandbox.${entry.key}` })),
          ],
        };
      }

      return { channels, browser, workspace, registries };
    } catch (error) {
      return handleError(error, 'Error getting infrastructure status');
    }
  },
});
