import { builderSettingsResponseSchema } from '../schemas/editor-builder';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

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
        return { enabled: false };
      }

      // Editor doesn't support builder (older version or OSS)
      if (typeof editor.resolveBuilder !== 'function') {
        return { enabled: false };
      }

      // Check if builder is enabled in config
      if (!editor.hasEnabledBuilderConfig?.()) {
        return { enabled: false };
      }

      // Resolve the builder instance
      const builder = await editor.resolveBuilder();
      if (!builder || !builder.enabled) {
        return { enabled: false };
      }

      return {
        enabled: true,
        features: builder.getFeatures(),
        configuration: builder.getConfiguration(),
      };
    } catch (error) {
      return handleError(error, 'Error getting builder settings');
    }
  },
});
