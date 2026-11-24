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

const CommitActionSchema = z
  .object({
    action: z.enum(['create', 'delete', 'move', 'update', 'chmod']),
    file_path: z.string(),
    content: z.string().optional(),
    encoding: z.enum(['text', 'base64']).optional(),
    execute_filemode: z.boolean().optional(),
    last_commit_id: z.string().optional(),
    previous_path: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const missing =
      (value.action === 'create' || value.action === 'update') && value.content === undefined
        ? 'content'
        : value.action === 'move' && value.previous_path === undefined
          ? 'previous_path'
          : value.action === 'chmod' && value.execute_filemode === undefined
            ? 'execute_filemode'
            : undefined;
    if (missing)
      ctx.addIssue({ code: 'custom', path: [missing], message: `${missing} is required for a ${value.action} action` });
  });

export const createCommitInputSchema = z
  .object({
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
    branch: z.string().describe('Name of the branch to commit into. Example: "feature/test"'),
    commit_message: z.string().describe('Commit message. Example: "Add new feature"'),
    actions: z.array(CommitActionSchema).optional().describe('Array of file actions to perform in this commit'),
    start_branch: z.string().optional().describe('Name of the branch to use as the parent for the new commit'),
    author_email: z.string().optional().describe("Specify the commit author's email address"),
    author_name: z.string().optional().describe("Specify the commit author's name"),
    allow_empty: z.boolean().optional().describe('When true, creates an empty commit. Default is false'),
    force: z.boolean().optional().describe('If true, overwrites branch with a new commit. Default is false'),
    start_sha: z.string().optional().describe('SHA of the commit to use as the parent for the new commit'),
    start_project: z
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
      .optional()
      .describe('The project ID or URL-encoded path to use as the source'),
    stats: z.boolean().optional().describe('Include commit stats. Default is true'),
  })
  .refine(data => data.allow_empty === true || (Array.isArray(data.actions) && data.actions.length > 0), {
    message: 'actions must contain at least one item unless allow_empty is true',
    path: ['actions'],
  });

const ProviderCommitSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  committer_name: z.string().optional(),
  committer_email: z.string().optional(),
  created_at: z.string(),
  message: z.string(),
  parent_ids: z.array(z.string()).optional(),
  committed_date: z.string().optional(),
  authored_date: z.string().optional(),
  stats: z
    .object({
      additions: z.number().optional(),
      deletions: z.number().optional(),
      total: z.number().optional(),
    })
    .optional(),
  status: z.string().nullable().optional(),
  web_url: z.string().optional(),
});

export const createCommitOutputSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  committer_name: z.string().optional(),
  committer_email: z.string().optional(),
  created_at: z.string(),
  message: z.string(),
  parent_ids: z.array(z.string()).optional(),
  committed_date: z.string().optional(),
  authored_date: z.string().optional(),
  stats: z
    .object({
      additions: z.number().optional(),
      deletions: z.number().optional(),
      total: z.number().optional(),
    })
    .optional(),
  status: z.string().optional(),
  web_url: z.string().optional(),
});

export function createCommitTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_commit',
    description: 'Create a commit in GitLab',
    inputSchema: createCommitInputSchema,
    outputSchema: createCommitOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCommitOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        branch: input.branch,
        commit_message: input.commit_message,
      };

      if (input.actions !== undefined) {
        requestBody['actions'] = input.actions;
      }
      if (input.start_branch !== undefined) {
        requestBody['start_branch'] = input.start_branch;
      }
      if (input.author_email !== undefined) {
        requestBody['author_email'] = input.author_email;
      }
      if (input.author_name !== undefined) {
        requestBody['author_name'] = input.author_name;
      }
      if (input.allow_empty !== undefined) {
        requestBody['allow_empty'] = input.allow_empty;
      }
      if (input.force !== undefined) {
        requestBody['force'] = input.force;
      }
      if (input.start_sha !== undefined) {
        requestBody['start_sha'] = input.start_sha;
      }
      if (input.start_project !== undefined) {
        requestBody['start_project'] = input.start_project;
      }
      if (input.stats !== undefined) {
        requestBody['stats'] = input.stats;
      }

      // https://docs.gitlab.com/api/commits/#create-a-commit
      const response = await platformProxy.post({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/commits`,
        data: requestBody,
        retries: 1,
      });

      const providerCommit = ProviderCommitSchema.parse(response.data);

      return {
        id: providerCommit.id,
        short_id: providerCommit.short_id,
        title: providerCommit.title,
        author_name: providerCommit.author_name,
        author_email: providerCommit.author_email,
        ...(providerCommit.committer_name !== undefined && { committer_name: providerCommit.committer_name }),
        ...(providerCommit.committer_email !== undefined && { committer_email: providerCommit.committer_email }),
        created_at: providerCommit.created_at,
        message: providerCommit.message,
        ...(providerCommit.parent_ids !== undefined && { parent_ids: providerCommit.parent_ids }),
        ...(providerCommit.committed_date !== undefined && { committed_date: providerCommit.committed_date }),
        ...(providerCommit.authored_date !== undefined && { authored_date: providerCommit.authored_date }),
        ...(providerCommit.stats !== undefined && { stats: providerCommit.stats }),
        ...(providerCommit.status != null && { status: providerCommit.status }),
        ...(providerCommit.web_url !== undefined && { web_url: providerCommit.web_url }),
      };
    },
  });
}
