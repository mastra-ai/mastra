// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPipelinesInputSchema = z.object({
  project_id: z.number().describe('GitLab project ID. Example: 82599306'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (page number) from the previous response. Omit for the first page.'),
  per_page: z.number().optional().describe('Number of results per page. Default: 20, Max: 100.'),
  name: z.string().optional().describe('Return pipelines with the specified name.'),
  order_by: z.string().optional().describe('Field to order by: id, status, ref, updated_at, or user_id. Default: id.'),
  ref: z.string().optional().describe('Return pipelines for the specified branch or tag.'),
  scope: z.string().optional().describe('Scope: running, pending, finished, branches, or tags.'),
  sha: z.string().optional().describe('Return pipelines for the specified commit SHA.'),
  sort: z.string().optional().describe('Sort order: asc or desc. Default: desc.'),
  source: z.string().optional().describe('Return pipelines with the specified source.'),
  status: z
    .string()
    .optional()
    .describe(
      'Status: created, waiting_for_resource, preparing, pending, running, success, failed, canceled, skipped, manual, or scheduled.',
    ),
  updated_after: z
    .string()
    .optional()
    .describe('Return pipelines updated after the specified date in ISO 8601 format.'),
  updated_before: z
    .string()
    .optional()
    .describe('Return pipelines updated before the specified date in ISO 8601 format.'),
  created_after: z
    .string()
    .optional()
    .describe('Return pipelines created after the specified date in ISO 8601 format.'),
  created_before: z
    .string()
    .optional()
    .describe('Return pipelines created before the specified date in ISO 8601 format.'),
  username: z.string().optional().describe('Return pipelines triggered by the specified username.'),
  yaml_errors: z.boolean().optional().describe('Return pipelines with invalid configurations.'),
});

const ProviderPipelineSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  status: z.string(),
  source: z.string(),
  ref: z.string(),
  sha: z.string(),
  name: z.string().nullable().optional(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const ProviderResponseSchema = z.array(ProviderPipelineSchema);

const PipelineSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  status: z.string(),
  source: z.string(),
  ref: z.string(),
  sha: z.string(),
  name: z.string().optional(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const listPipelinesOutputSchema = z.object({
  pipelines: z.array(PipelineSchema),
  next_page: z.string().optional(),
});

export function listPipelinesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_pipelines',
    description: 'List pipelines from GitLab.',
    inputSchema: listPipelinesInputSchema,
    outputSchema: listPipelinesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPipelinesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {
        per_page: input.per_page ?? 20,
      };

      if (input.cursor !== undefined && input.cursor.length > 0) {
        params['page'] = input.cursor;
      }
      if (input.name !== undefined) {
        params['name'] = input.name;
      }
      if (input.order_by !== undefined) {
        params['order_by'] = input.order_by;
      }
      if (input.ref !== undefined) {
        params['ref'] = input.ref;
      }
      if (input.scope !== undefined) {
        params['scope'] = input.scope;
      }
      if (input.sha !== undefined) {
        params['sha'] = input.sha;
      }
      if (input.sort !== undefined) {
        params['sort'] = input.sort;
      }
      if (input.source !== undefined) {
        params['source'] = input.source;
      }
      if (input.status !== undefined) {
        params['status'] = input.status;
      }
      if (input.updated_after !== undefined) {
        params['updated_after'] = input.updated_after;
      }
      if (input.updated_before !== undefined) {
        params['updated_before'] = input.updated_before;
      }
      if (input.created_after !== undefined) {
        params['created_after'] = input.created_after;
      }
      if (input.created_before !== undefined) {
        params['created_before'] = input.created_before;
      }
      if (input.username !== undefined) {
        params['username'] = input.username;
      }
      if (input.yaml_errors !== undefined) {
        params['yaml_errors'] = String(input.yaml_errors);
      }

      // https://docs.gitlab.com/api/pipelines/
      const response = await platformProxy.get({
        endpoint: `/api/v4/projects/${encodeURIComponent(String(input.project_id))}/pipelines`,
        params,
        retries: 3,
      });

      const providerPipelines = ProviderResponseSchema.parse(response.data);

      const pipelines = providerPipelines.map(pipeline => ({
        id: pipeline.id,
        iid: pipeline.iid,
        project_id: pipeline.project_id,
        status: pipeline.status,
        source: pipeline.source,
        ref: pipeline.ref,
        sha: pipeline.sha,
        ...(pipeline.name != null && { name: pipeline.name }),
        web_url: pipeline.web_url,
        created_at: pipeline.created_at,
        updated_at: pipeline.updated_at,
      }));

      let next_page: string | undefined;
      if (typeof response.headers === 'object' && response.headers !== null && 'x-next-page' in response.headers) {
        const nextPageValue = response.headers['x-next-page'];
        if (typeof nextPageValue === 'string' && nextPageValue.length > 0) {
          next_page = nextPageValue;
        }
      }

      return {
        pipelines,
        ...(next_page !== undefined && { next_page }),
      };
    },
  });
}
