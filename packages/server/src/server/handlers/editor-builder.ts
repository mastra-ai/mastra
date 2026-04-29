import type { Mastra } from '@mastra/core';

import { builderToModelPolicy } from '@mastra/core/agent-builder/ee';
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
  requiresPermission: 'agents:read',
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

      const modelPolicyWarnings = builder.getModelPolicyWarnings?.() ?? [];

      return {
        enabled: true,
        features: builder.getFeatures(),
        configuration: builder.getConfiguration(),
        modelPolicy: builderToModelPolicy(builder),
        ...(modelPolicyWarnings.length > 0 ? { modelPolicyWarnings } : {}),
      };
    } catch (error) {
      return handleError(error, 'Error getting builder settings');
    }
  },
});
