// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateAnnotationInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.number().describe('Annotation ID. Example: 339256'),
  content: z.string().nullable().optional().describe('Annotation text content'),
  date_marker: z
    .string()
    .nullable()
    .optional()
    .describe('ISO timestamp for the annotation marker. Example: "2024-01-15T00:00:00Z"'),
  creation_type: z.string().optional().describe('Creation type. Example: "USR"'),
  dashboard_item: z
    .number()
    .nullable()
    .optional()
    .describe('Dashboard item (insight) ID this annotation is attached to'),
  dashboard_id: z.number().nullable().optional().describe('Dashboard ID this annotation is attached to'),
  deleted: z.boolean().optional().describe('Whether the annotation is deleted'),
  scope: z.string().optional().describe('Scope of the annotation. Example: "dashboard_item" or "project"'),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string().nullable().optional(),
  distinct_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  is_email_verified: z.boolean().nullable().optional(),
  hedgehog_config: z.record(z.string(), z.unknown()).nullable().optional(),
  role_at_organization: z.string().nullable().optional(),
});

const ProviderAnnotationSchema = z.object({
  id: z.number(),
  content: z.string().nullable().optional(),
  date_marker: z.string().nullable().optional(),
  creation_type: z.string().nullable().optional(),
  dashboard_item: z.number().nullable().optional(),
  dashboard_id: z.number().nullable().optional(),
  dashboard_name: z.string().nullable().optional(),
  insight_short_id: z.string().nullable().optional(),
  insight_name: z.string().nullable().optional(),
  insight_derived_name: z.string().nullable().optional(),
  created_by: CreatedBySchema.nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  deleted: z.boolean().nullable().optional(),
  scope: z.string().nullable().optional(),
});

export const updateAnnotationOutputSchema = z.object({
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
  created_by: z
    .object({
      id: z.number(),
      uuid: z.string().optional(),
      distinct_id: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      is_email_verified: z.boolean().optional(),
      hedgehog_config: z.record(z.string(), z.unknown()).optional(),
      role_at_organization: z.string().optional(),
    })
    .optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted: z.boolean().optional(),
  scope: z.string().optional(),
});

export function updateAnnotationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_annotation',
    description: 'Update an annotation in PostHog',
    inputSchema: updateAnnotationInputSchema,
    outputSchema: updateAnnotationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateAnnotationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const payload: {
        content?: string | null;
        date_marker?: string | null;
        creation_type?: string;
        dashboard_item?: number | null;
        dashboard_id?: number | null;
        deleted?: boolean;
        scope?: string;
      } = {};
      if (input.content !== undefined) {
        payload.content = input.content;
      }
      if (input.date_marker !== undefined) {
        payload.date_marker = input.date_marker;
      }
      if (input.creation_type !== undefined) {
        payload.creation_type = input.creation_type;
      }
      if (input.dashboard_item !== undefined) {
        payload.dashboard_item = input.dashboard_item;
      }
      if (input.dashboard_id !== undefined) {
        payload.dashboard_id = input.dashboard_id;
      }
      if (input.deleted !== undefined) {
        payload.deleted = input.deleted;
      }
      if (input.scope !== undefined) {
        payload.scope = input.scope;
      }

      // https://posthog.com/docs/api/annotations
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/annotations/${encodeURIComponent(String(input.id))}/`,
        data: payload,
        retries: 3,
      });

      const parsed = ProviderAnnotationSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Provider returned an unexpected response shape',
          details: parsed.error.format(),
        });
      }

      return {
        id: parsed.data.id,
        ...(parsed.data.content != null && { content: parsed.data.content }),
        ...(parsed.data.date_marker != null && { date_marker: parsed.data.date_marker }),
        ...(parsed.data.creation_type != null && { creation_type: parsed.data.creation_type }),
        ...(parsed.data.dashboard_item != null && { dashboard_item: parsed.data.dashboard_item }),
        ...(parsed.data.dashboard_id != null && { dashboard_id: parsed.data.dashboard_id }),
        ...(parsed.data.dashboard_name != null && { dashboard_name: parsed.data.dashboard_name }),
        ...(parsed.data.insight_short_id != null && { insight_short_id: parsed.data.insight_short_id }),
        ...(parsed.data.insight_name != null && { insight_name: parsed.data.insight_name }),
        ...(parsed.data.insight_derived_name != null && { insight_derived_name: parsed.data.insight_derived_name }),
        ...(parsed.data.created_by != null && {
          created_by: {
            id: parsed.data.created_by.id,
            ...(parsed.data.created_by.uuid != null && { uuid: parsed.data.created_by.uuid }),
            ...(parsed.data.created_by.distinct_id != null && { distinct_id: parsed.data.created_by.distinct_id }),
            ...(parsed.data.created_by.first_name != null && { first_name: parsed.data.created_by.first_name }),
            ...(parsed.data.created_by.last_name != null && { last_name: parsed.data.created_by.last_name }),
            ...(parsed.data.created_by.email != null && { email: parsed.data.created_by.email }),
            ...(parsed.data.created_by.is_email_verified != null && {
              is_email_verified: parsed.data.created_by.is_email_verified,
            }),
            ...(parsed.data.created_by.hedgehog_config != null && {
              hedgehog_config: parsed.data.created_by.hedgehog_config,
            }),
            ...(parsed.data.created_by.role_at_organization != null && {
              role_at_organization: parsed.data.created_by.role_at_organization,
            }),
          },
        }),
        ...(parsed.data.created_at != null && { created_at: parsed.data.created_at }),
        ...(parsed.data.updated_at != null && { updated_at: parsed.data.updated_at }),
        ...(parsed.data.deleted != null && { deleted: parsed.data.deleted }),
        ...(parsed.data.scope != null && { scope: parsed.data.scope }),
      };
    },
  });
}
