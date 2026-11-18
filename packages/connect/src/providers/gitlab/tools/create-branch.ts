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

export const createBranchInputSchema = z.object({
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
  branch: z.string().describe('Name of the new branch. Example: "feature/my-branch"'),
  ref: z.string().describe('Branch name or commit SHA to create the branch from. Example: "main"'),
});

const ProviderCommitSchema = z.object({
  id: z.string(),
  short_id: z.string().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
  authored_date: z.string().optional(),
  committer_name: z.string().optional(),
  committer_email: z.string().optional(),
  committed_date: z.string().optional(),
  created_at: z.string().optional(),
  parent_ids: z.array(z.string()).optional(),
  trailers: z.record(z.string(), z.unknown()).optional(),
  extended_trailers: z.record(z.string(), z.unknown()).optional(),
  web_url: z.string().optional(),
});

const ProviderBranchSchema = z.object({
  name: z.string(),
  merged: z.boolean().optional(),
  protected: z.boolean().optional(),
  default: z.boolean().optional(),
  developers_can_push: z.boolean().optional(),
  developers_can_merge: z.boolean().optional(),
  can_push: z.boolean().optional(),
  web_url: z.string().optional(),
  commit: ProviderCommitSchema.optional(),
});

export const createBranchOutputSchema = z.object({
  name: z.string(),
  merged: z.boolean().optional(),
  protected: z.boolean().optional(),
  default: z.boolean().optional(),
  developers_can_push: z.boolean().optional(),
  developers_can_merge: z.boolean().optional(),
  can_push: z.boolean().optional(),
  web_url: z.string().optional(),
  commit: z
    .object({
      id: z.string(),
      short_id: z.string().optional(),
      title: z.string().optional(),
      message: z.string().optional(),
      author_name: z.string().optional(),
      author_email: z.string().optional(),
      authored_date: z.string().optional(),
      committer_name: z.string().optional(),
      committer_email: z.string().optional(),
      committed_date: z.string().optional(),
      created_at: z.string().optional(),
      parent_ids: z.array(z.string()).optional(),
      web_url: z.string().optional(),
    })
    .optional(),
});

export function createBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_branch',
    description: 'Create a branch in GitLab.',
    inputSchema: createBranchInputSchema,
    outputSchema: createBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.gitlab.com/api/branches/#create-repository-branch
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/branches`,
        data: {
          branch: input.branch,
          ref: input.ref,
        },
        retries: 1,
      });

      const providerBranch = ProviderBranchSchema.parse(response.data);

      return {
        name: providerBranch.name,
        ...(providerBranch.merged !== undefined && { merged: providerBranch.merged }),
        ...(providerBranch.protected !== undefined && { protected: providerBranch.protected }),
        ...(providerBranch.default !== undefined && { default: providerBranch.default }),
        ...(providerBranch.developers_can_push !== undefined && {
          developers_can_push: providerBranch.developers_can_push,
        }),
        ...(providerBranch.developers_can_merge !== undefined && {
          developers_can_merge: providerBranch.developers_can_merge,
        }),
        ...(providerBranch.can_push !== undefined && { can_push: providerBranch.can_push }),
        ...(providerBranch.web_url != null && { web_url: providerBranch.web_url }),
        ...(providerBranch.commit != null && {
          commit: {
            id: providerBranch.commit.id,
            ...(providerBranch.commit.short_id != null && { short_id: providerBranch.commit.short_id }),
            ...(providerBranch.commit.title != null && { title: providerBranch.commit.title }),
            ...(providerBranch.commit.message != null && { message: providerBranch.commit.message }),
            ...(providerBranch.commit.author_name != null && { author_name: providerBranch.commit.author_name }),
            ...(providerBranch.commit.author_email != null && { author_email: providerBranch.commit.author_email }),
            ...(providerBranch.commit.authored_date != null && { authored_date: providerBranch.commit.authored_date }),
            ...(providerBranch.commit.committer_name != null && {
              committer_name: providerBranch.commit.committer_name,
            }),
            ...(providerBranch.commit.committer_email != null && {
              committer_email: providerBranch.commit.committer_email,
            }),
            ...(providerBranch.commit.committed_date != null && {
              committed_date: providerBranch.commit.committed_date,
            }),
            ...(providerBranch.commit.created_at != null && { created_at: providerBranch.commit.created_at }),
            ...(providerBranch.commit.parent_ids != null && { parent_ids: providerBranch.commit.parent_ids }),
            ...(providerBranch.commit.web_url != null && { web_url: providerBranch.commit.web_url }),
          },
        }),
      };
    },
  });
}
