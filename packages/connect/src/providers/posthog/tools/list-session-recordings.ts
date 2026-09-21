// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSessionRecordingsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  limit: z.number().optional().describe('Number of results to return per page.'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
});

const PersonSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  distinct_ids: z.array(z.string()).optional(),
  properties: z.unknown().optional(),
  created_at: z.string().optional(),
  uuid: z.string().optional(),
  last_seen_at: z.string().optional(),
});

const SummaryOutcomeSchema = z.object({
  description: z.string().optional(),
  success: z.boolean().optional(),
});

const SessionRecordingSchema = z.object({
  id: z.string(),
  distinct_id: z.string(),
  viewed: z.boolean().optional(),
  viewers: z.array(z.string()).optional(),
  recording_duration: z.number().optional(),
  active_seconds: z.number().optional(),
  inactive_seconds: z.number().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  click_count: z.number().optional(),
  keypress_count: z.number().optional(),
  mouse_activity_count: z.number().optional(),
  console_log_count: z.number().optional(),
  console_warn_count: z.number().optional(),
  console_error_count: z.number().optional(),
  start_url: z.string().optional(),
  person: PersonSchema.optional(),
  retention_period_days: z.number().optional(),
  expiry_time: z.string().optional(),
  recording_ttl: z.number().optional(),
  snapshot_source: z.string().optional(),
  snapshot_library: z.string().optional(),
  ongoing: z.boolean().optional(),
  activity_score: z.number().optional(),
  has_summary: z.boolean().optional(),
  summary_outcome: SummaryOutcomeSchema.optional(),
  external_references: z.array(z.unknown()).optional(),
});

const ProviderPersonSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  distinct_ids: z.array(z.string()).nullable().optional(),
  properties: z.unknown().nullable().optional(),
  created_at: z.string().nullable().optional(),
  uuid: z.string().nullable().optional(),
  last_seen_at: z.string().nullable().optional(),
});

const ProviderSummaryOutcomeSchema = z.object({
  description: z.string().nullable().optional(),
  success: z.boolean().nullable().optional(),
});

const ProviderSessionRecordingSchema = z.object({
  id: z.string(),
  distinct_id: z.string(),
  viewed: z.boolean().nullable().optional(),
  viewers: z.array(z.string()).nullable().optional(),
  recording_duration: z.number().nullable().optional(),
  active_seconds: z.number().nullable().optional(),
  inactive_seconds: z.number().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  click_count: z.number().nullable().optional(),
  keypress_count: z.number().nullable().optional(),
  mouse_activity_count: z.number().nullable().optional(),
  console_log_count: z.number().nullable().optional(),
  console_warn_count: z.number().nullable().optional(),
  console_error_count: z.number().nullable().optional(),
  start_url: z.string().nullable().optional(),
  person: ProviderPersonSchema.nullable().optional(),
  retention_period_days: z.number().nullable().optional(),
  expiry_time: z.string().nullable().optional(),
  recording_ttl: z.number().nullable().optional(),
  snapshot_source: z.string().nullable().optional(),
  snapshot_library: z.string().nullable().optional(),
  ongoing: z.boolean().nullable().optional(),
  activity_score: z.number().nullable().optional(),
  has_summary: z.boolean().nullable().optional(),
  summary_outcome: ProviderSummaryOutcomeSchema.nullable().optional(),
  external_references: z.array(z.unknown()).nullable().optional(),
});

const ProviderResponseSchema = z.object({
  results: z.array(ProviderSessionRecordingSchema),
  has_next: z.boolean().optional(),
  version: z.unknown().optional(),
});

export const listSessionRecordingsOutputSchema = z.object({
  items: z.array(SessionRecordingSchema),
  next_cursor: z.string().optional(),
});

export function listSessionRecordingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_session_recordings',
    description: 'List session recordings from PostHog.',
    inputSchema: listSessionRecordingsInputSchema,
    outputSchema: listSessionRecordingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSessionRecordingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const limit = input.limit ?? 100;
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;

      if (Number.isNaN(offset)) {
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'cursor must be a valid offset string.',
        });
      }

      // https://posthog.com/docs/api/session-recordings
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/session_recordings/`,
        params: {
          limit: String(limit),
          offset: String(offset),
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      const items = providerData.results.map(item => ({
        id: item.id,
        distinct_id: item.distinct_id,
        ...(item.viewed != null ? { viewed: item.viewed } : {}),
        ...(item.viewers != null ? { viewers: item.viewers } : {}),
        ...(item.recording_duration != null ? { recording_duration: item.recording_duration } : {}),
        ...(item.active_seconds != null ? { active_seconds: item.active_seconds } : {}),
        ...(item.inactive_seconds != null ? { inactive_seconds: item.inactive_seconds } : {}),
        ...(item.start_time != null ? { start_time: item.start_time } : {}),
        ...(item.end_time != null ? { end_time: item.end_time } : {}),
        ...(item.click_count != null ? { click_count: item.click_count } : {}),
        ...(item.keypress_count != null ? { keypress_count: item.keypress_count } : {}),
        ...(item.mouse_activity_count != null ? { mouse_activity_count: item.mouse_activity_count } : {}),
        ...(item.console_log_count != null ? { console_log_count: item.console_log_count } : {}),
        ...(item.console_warn_count != null ? { console_warn_count: item.console_warn_count } : {}),
        ...(item.console_error_count != null ? { console_error_count: item.console_error_count } : {}),
        ...(item.start_url != null ? { start_url: item.start_url } : {}),
        ...(item.person != null
          ? {
              person: {
                ...(item.person.id != null ? { id: item.person.id } : {}),
                ...(item.person.name != null ? { name: item.person.name } : {}),
                ...(item.person.distinct_ids != null ? { distinct_ids: item.person.distinct_ids } : {}),
                ...(item.person.properties != null ? { properties: item.person.properties } : {}),
                ...(item.person.created_at != null ? { created_at: item.person.created_at } : {}),
                ...(item.person.uuid != null ? { uuid: item.person.uuid } : {}),
                ...(item.person.last_seen_at != null ? { last_seen_at: item.person.last_seen_at } : {}),
              },
            }
          : {}),
        ...(item.retention_period_days != null ? { retention_period_days: item.retention_period_days } : {}),
        ...(item.expiry_time != null ? { expiry_time: item.expiry_time } : {}),
        ...(item.recording_ttl != null ? { recording_ttl: item.recording_ttl } : {}),
        ...(item.snapshot_source != null ? { snapshot_source: item.snapshot_source } : {}),
        ...(item.snapshot_library != null ? { snapshot_library: item.snapshot_library } : {}),
        ...(item.ongoing != null ? { ongoing: item.ongoing } : {}),
        ...(item.activity_score != null ? { activity_score: item.activity_score } : {}),
        ...(item.has_summary != null ? { has_summary: item.has_summary } : {}),
        ...(item.summary_outcome != null
          ? {
              summary_outcome: {
                ...(item.summary_outcome.description != null ? { description: item.summary_outcome.description } : {}),
                ...(item.summary_outcome.success != null ? { success: item.summary_outcome.success } : {}),
              },
            }
          : {}),
        ...(item.external_references != null ? { external_references: item.external_references } : {}),
      }));

      let nextCursor: string | undefined;
      if (providerData.has_next === true) {
        const nextOffset = offset + providerData.results.length;
        nextCursor = String(nextOffset);
      }

      return {
        items,
        ...(nextCursor !== undefined ? { next_cursor: nextCursor } : {}),
      };
    },
  });
}
