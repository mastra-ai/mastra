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

export const getBranchInputSchema = z.object({
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
  branch: z.string().describe('Branch name. Example: feature/test'),
});

const CommitSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  created_at: z.string(),
  parent_ids: z.array(z.string()),
  title: z.string(),
  message: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  authored_date: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  committed_date: z.string(),
  trailers: z.record(z.string(), z.unknown()),
  extended_trailers: z.record(z.string(), z.unknown()),
  web_url: z.string(),
});

const ProviderBranchSchema = z.object({
  name: z.string(),
  merged: z.boolean(),
  protected: z.boolean(),
  default: z.boolean(),
  developers_can_push: z.boolean(),
  developers_can_merge: z.boolean(),
  can_push: z.boolean(),
  web_url: z.string(),
  commit: CommitSchema,
});

export const getBranchOutputSchema = ProviderBranchSchema;

export function getBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_branch',
    description: 'Retrieve a single branch from GitLab.',
    inputSchema: getBranchInputSchema,
    outputSchema: getBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      try {
        // https://docs.gitlab.com/api/branches/#get-a-single-repository-branch
        const response = await platformProxy.get({
          endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/branches/${encodeURIComponent(String(input.branch))}`,
          retries: 3,
        });

        return ProviderBranchSchema.parse(response.data);
      } catch (error: unknown) {
        if (
          error !== null &&
          typeof error === 'object' &&
          'response' in error &&
          typeof error.response === 'object' &&
          error.response !== null &&
          'status' in error.response &&
          error.response.status === 404 &&
          !('code' in error && error.code === 'connection_not_found')
        ) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'Branch not found',
            project_id: String(input.project_id),
            branch: input.branch,
          });
        }
        throw error;
      }
    },
  });
}
