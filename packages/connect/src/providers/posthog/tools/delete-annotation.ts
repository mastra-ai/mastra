// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAnnotationInputSchema = z.object({
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
  annotation_id: z.number().describe('Annotation ID to delete. Example: 339256'),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean(),
  hedgehog_config: z.record(z.string(), z.unknown()).nullable().optional(),
  role_at_organization: z.string().optional(),
});

const ProviderAnnotationSchema = z.object({
  id: z.number(),
  content: z.string().nullable().optional(),
  date_marker: z.string().nullable().optional(),
  creation_type: z.string().optional(),
  dashboard_item: z.number().nullable().optional(),
  dashboard_id: z.number().nullable().optional(),
  dashboard_name: z.string().nullable().optional(),
  insight_short_id: z.string().nullable().optional(),
  insight_name: z.string().nullable().optional(),
  insight_derived_name: z.string().nullable().optional(),
  created_by: CreatedBySchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted: z.boolean().optional(),
  scope: z.string().optional(),
});

export const deleteAnnotationOutputSchema = z.object({
  id: z.number(),
  content: z.string().optional(),
  date_marker: z.string().optional(),
  creation_type: z.string().optional(),
  dashboard_item: z.number().optional(),
  dashboard_id: z.number().optional(),
  dashboard_name: z.string().optional(),
  insight_short_id: z.string().optional(),
  insight_name: z.string().optional(),
  insight_derived_name: z.string().optional(),
  created_by: CreatedBySchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted: z.boolean().optional(),
  scope: z.string().optional(),
});

export function deleteAnnotationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_annotation',
    description: 'Delete or archive an annotation in PostHog by setting it as deleted.',
    inputSchema: deleteAnnotationInputSchema,
    outputSchema: deleteAnnotationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAnnotationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://posthog.com/docs/api/annotations
      // Hard delete is not allowed; PATCH with deleted: true archives the annotation.
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(String(input.project_id))}/annotations/${encodeURIComponent(String(input.annotation_id))}/`,
        data: {
          deleted: true,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Annotation not found or could not be archived.',
          project_id: input.project_id,
          annotation_id: input.annotation_id,
        });
      }

      const providerAnnotation = ProviderAnnotationSchema.parse(response.data);

      return {
        id: providerAnnotation.id,
        ...(providerAnnotation.content !== undefined &&
          providerAnnotation.content !== null && { content: providerAnnotation.content }),
        ...(providerAnnotation.date_marker !== undefined &&
          providerAnnotation.date_marker !== null && { date_marker: providerAnnotation.date_marker }),
        ...(providerAnnotation.creation_type !== undefined && { creation_type: providerAnnotation.creation_type }),
        ...(providerAnnotation.dashboard_item !== undefined &&
          providerAnnotation.dashboard_item !== null && { dashboard_item: providerAnnotation.dashboard_item }),
        ...(providerAnnotation.dashboard_id !== undefined &&
          providerAnnotation.dashboard_id !== null && { dashboard_id: providerAnnotation.dashboard_id }),
        ...(providerAnnotation.dashboard_name !== undefined &&
          providerAnnotation.dashboard_name !== null && { dashboard_name: providerAnnotation.dashboard_name }),
        ...(providerAnnotation.insight_short_id !== undefined &&
          providerAnnotation.insight_short_id !== null && { insight_short_id: providerAnnotation.insight_short_id }),
        ...(providerAnnotation.insight_name !== undefined &&
          providerAnnotation.insight_name !== null && { insight_name: providerAnnotation.insight_name }),
        ...(providerAnnotation.insight_derived_name !== undefined &&
          providerAnnotation.insight_derived_name !== null && {
            insight_derived_name: providerAnnotation.insight_derived_name,
          }),
        ...(providerAnnotation.created_by !== undefined && { created_by: providerAnnotation.created_by }),
        ...(providerAnnotation.created_at !== undefined && { created_at: providerAnnotation.created_at }),
        ...(providerAnnotation.updated_at !== undefined && { updated_at: providerAnnotation.updated_at }),
        ...(providerAnnotation.deleted !== undefined && { deleted: providerAnnotation.deleted }),
        ...(providerAnnotation.scope !== undefined && { scope: providerAnnotation.scope }),
      };
    },
  });
}
