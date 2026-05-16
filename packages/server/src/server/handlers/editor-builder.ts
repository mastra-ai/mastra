import type { Mastra } from '@mastra/core';

import { HTTPException } from '../http-exception';
import { agentFeaturesSchema } from '../schemas/editor-builder';
import type { AgentFeatures } from '../schemas/editor-builder';

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
