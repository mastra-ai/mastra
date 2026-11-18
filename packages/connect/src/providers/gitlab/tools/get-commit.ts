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

export const getCommitInputSchema = z.object({
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
  sha: z.string().describe('The commit hash or name of a repository branch or tag. Example: abc123def456'),
});

const LastPipelineSchema = z
  .object({
    id: z.number(),
    ref: z.string(),
    sha: z.string(),
    status: z.string(),
  })
  .optional();

const StatsSchema = z
  .object({
    additions: z.number(),
    deletions: z.number(),
    total: z.number(),
  })
  .optional();

const ProviderCommitSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  created_at: z.string(),
  message: z.string(),
  committed_date: z.string(),
  authored_date: z.string(),
  parent_ids: z.array(z.string()),
  last_pipeline: LastPipelineSchema.nullable(),
  stats: StatsSchema,
  status: z.string().nullish(),
  web_url: z.string(),
});

export const getCommitOutputSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  created_at: z.string(),
  message: z.string(),
  committed_date: z.string(),
  authored_date: z.string(),
  parent_ids: z.array(z.string()),
  last_pipeline: LastPipelineSchema.nullable(),
  stats: StatsSchema,
  status: z.string().nullish(),
  web_url: z.string(),
});

export function getCommitTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_commit',
    description: 'Retrieve a single commit from GitLab.',
    inputSchema: getCommitInputSchema,
    outputSchema: getCommitOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCommitOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = typeof input.project_id === 'number' ? String(input.project_id) : input.project_id;

      // https://docs.gitlab.com/api/commits/#get-a-single-commit
      const response = await platformProxy.get({
        endpoint: `/api/v4/projects/${gitlabPathSegment(projectId)}/repository/commits/${encodeURIComponent(String(input.sha))}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Commit not found',
          project_id: String(input.project_id),
          sha: input.sha,
        });
      }

      const providerCommit = ProviderCommitSchema.parse(response.data);

      return {
        id: providerCommit.id,
        short_id: providerCommit.short_id,
        title: providerCommit.title,
        author_name: providerCommit.author_name,
        author_email: providerCommit.author_email,
        committer_name: providerCommit.committer_name,
        committer_email: providerCommit.committer_email,
        created_at: providerCommit.created_at,
        message: providerCommit.message,
        committed_date: providerCommit.committed_date,
        authored_date: providerCommit.authored_date,
        parent_ids: providerCommit.parent_ids,
        ...(providerCommit.last_pipeline !== undefined && { last_pipeline: providerCommit.last_pipeline }),
        ...(providerCommit.stats !== undefined && { stats: providerCommit.stats }),
        ...(providerCommit.status !== undefined && { status: providerCommit.status }),
        web_url: providerCommit.web_url,
      };
    },
  });
}
