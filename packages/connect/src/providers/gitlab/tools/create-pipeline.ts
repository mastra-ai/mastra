// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

const PipelineVariableSchema = z.object({
  key: z.string(),
  variable_type: z.string().optional(),
  value: z.string(),
});

export const createPipelineInputSchema = z.object({
  project_id: z
    .union([
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      z
        .string()
        .min(1)
        .refine(value => {
          try {
            encodeURIComponent(value);
            return true;
          } catch {
            return false;
          }
        }, 'must not contain unpaired surrogate characters'),
    ])
    .describe(
      'Numeric project ID, or the project path raw or URL-encoded. Example: 82599306, "team/app", or "team%2Fapp"',
    ),
  ref: z.string().describe('The branch or tag to run the pipeline on. Example: "main"'),
  variables: z.array(PipelineVariableSchema).optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
});

const ProviderUserSchema = z.object({
  name: z.string(),
  username: z.string(),
  id: z.number(),
  state: z.string(),
  avatar_url: z.string().optional(),
  web_url: z.string().optional(),
});

const ProviderPipelineSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  sha: z.string(),
  ref: z.string(),
  status: z.string(),
  before_sha: z.string().optional(),
  tag: z.boolean(),
  yaml_errors: z.string().nullable().optional(),
  user: ProviderUserSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  committed_at: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  queued_duration: z.number().nullable().optional(),
  coverage: z.string().nullable().optional(),
  web_url: z.string().optional(),
  archived: z.boolean().optional(),
});

export const createPipelineOutputSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  sha: z.string(),
  ref: z.string(),
  status: z.string(),
  before_sha: z.string().optional(),
  tag: z.boolean(),
  yaml_errors: z.string().optional(),
  user: z
    .object({
      name: z.string(),
      username: z.string(),
      id: z.number(),
      state: z.string(),
      avatar_url: z.string().optional(),
      web_url: z.string().optional(),
    })
    .optional(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  committed_at: z.string().optional(),
  duration: z.number().optional(),
  queued_duration: z.number().optional(),
  coverage: z.number().optional(),
  web_url: z.string().optional(),
  archived: z.boolean().optional(),
});

export function createPipelineTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_pipeline',
    description: 'Create a pipeline in GitLab.',
    inputSchema: createPipelineInputSchema,
    outputSchema: createPipelineOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPipelineOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = String(input.project_id);
      const requestData: Record<string, unknown> = {};

      if (input.variables !== undefined) {
        requestData['variables'] = input.variables;
      }

      if (input.inputs !== undefined) {
        requestData['inputs'] = input.inputs;
      }

      const response = await platformProxy.post({
        // https://docs.gitlab.com/api/pipelines/#create-a-new-pipeline
        endpoint: `/api/v4/projects/${gitlabPathSegment(projectId)}/pipeline`,
        params: {
          ref: input.ref,
        },
        data: requestData,
        retries: 1,
      });

      const providerPipeline = ProviderPipelineSchema.parse(response.data);

      return {
        id: providerPipeline.id,
        iid: providerPipeline.iid,
        project_id: providerPipeline.project_id,
        sha: providerPipeline.sha,
        ref: providerPipeline.ref,
        status: providerPipeline.status,
        ...(providerPipeline.before_sha !== undefined && { before_sha: providerPipeline.before_sha }),
        tag: providerPipeline.tag,
        ...(providerPipeline.yaml_errors !== null &&
          providerPipeline.yaml_errors !== undefined && { yaml_errors: providerPipeline.yaml_errors }),
        ...(providerPipeline.user !== undefined && {
          user: {
            name: providerPipeline.user.name,
            username: providerPipeline.user.username,
            id: providerPipeline.user.id,
            state: providerPipeline.user.state,
            ...(providerPipeline.user.avatar_url !== undefined && { avatar_url: providerPipeline.user.avatar_url }),
            ...(providerPipeline.user.web_url !== undefined && { web_url: providerPipeline.user.web_url }),
          },
        }),
        created_at: providerPipeline.created_at,
        updated_at: providerPipeline.updated_at,
        ...(providerPipeline.started_at !== null &&
          providerPipeline.started_at !== undefined && { started_at: providerPipeline.started_at }),
        ...(providerPipeline.finished_at !== null &&
          providerPipeline.finished_at !== undefined && { finished_at: providerPipeline.finished_at }),
        ...(providerPipeline.committed_at !== null &&
          providerPipeline.committed_at !== undefined && { committed_at: providerPipeline.committed_at }),
        ...(providerPipeline.duration !== null &&
          providerPipeline.duration !== undefined && { duration: providerPipeline.duration }),
        ...(providerPipeline.queued_duration !== null &&
          providerPipeline.queued_duration !== undefined && { queued_duration: providerPipeline.queued_duration }),
        ...(providerPipeline.coverage !== null &&
          providerPipeline.coverage !== undefined && { coverage: parseFloat(providerPipeline.coverage) }),
        ...(providerPipeline.web_url !== undefined && { web_url: providerPipeline.web_url }),
        ...(providerPipeline.archived !== undefined && { archived: providerPipeline.archived }),
      };
    },
  });
}
