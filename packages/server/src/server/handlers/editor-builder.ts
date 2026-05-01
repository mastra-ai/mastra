import type { Mastra } from '@mastra/core';

import { builderToModelPolicy, resolvePickerVisibility } from '@mastra/core/agent-builder/ee';
import { HTTPException } from '../http-exception';
import { agentFeaturesSchema, builderSettingsResponseSchema } from '../schemas/editor-builder';
import type { AgentFeatures } from '../schemas/editor-builder';
import { createRoute } from '../server-adapter/routes/route-builder';
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
 * starred-only / pin-starred params) when the feature is off.
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
