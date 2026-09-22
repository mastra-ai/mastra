// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCommitInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "viictoo"'),
  repo: z.string().describe('The name of the repository. Example: "api-playground2"'),
  ref: z
    .string()
    .describe(
      'The commit reference. Can be a commit SHA, branch name (heads/BRANCH_NAME), or tag name (tags/TAG_NAME). Example: "main"',
    ),
});

const GitUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string(),
});

const SimpleUserSchema = z
  .object({
    login: z.string(),
    id: z.number(),
    avatar_url: z.string(),
    html_url: z.string(),
  })
  .passthrough();

const VerificationSchema = z.object({
  verified: z.boolean(),
  reason: z.string(),
  payload: z.string().nullable(),
  signature: z.string().nullable(),
  verified_at: z.string().nullable().optional(),
});

const CommitInfoSchema = z.object({
  url: z.string(),
  author: GitUserSchema.nullable(),
  committer: GitUserSchema.nullable(),
  message: z.string(),
  comment_count: z.number(),
  tree: z.object({
    sha: z.string(),
    url: z.string(),
  }),
  verification: VerificationSchema.optional(),
});

const ParentSchema = z.object({
  sha: z.string(),
  url: z.string(),
  html_url: z.string().optional(),
});

const StatsSchema = z.object({
  additions: z.number(),
  deletions: z.number(),
  total: z.number(),
});

const FileSchema = z.object({
  sha: z.string().nullable(),
  filename: z.string(),
  status: z.enum(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']).or(z.string()),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  blob_url: z.string(),
  raw_url: z.string(),
  contents_url: z.string(),
  patch: z.string().optional(),
  previous_filename: z.string().optional(),
});

const ProviderCommitSchema = z.object({
  sha: z.string(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  comments_url: z.string(),
  commit: CommitInfoSchema,
  author: z.union([SimpleUserSchema, z.object({})]).nullable(),
  committer: z.union([SimpleUserSchema, z.object({})]).nullable(),
  parents: z.array(ParentSchema),
  stats: StatsSchema.optional(),
  files: z.array(FileSchema).optional(),
});

export const getCommitOutputSchema = z.object({
  sha: z.string(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  comments_url: z.string(),
  commit: z.object({
    message: z.string(),
    author: z
      .object({
        name: z.string(),
        email: z.string(),
        date: z.string(),
      })
      .optional(),
    committer: z
      .object({
        name: z.string(),
        email: z.string(),
        date: z.string(),
      })
      .optional(),
    comment_count: z.number(),
    tree: z.object({
      sha: z.string(),
      url: z.string(),
    }),
    verification: z
      .object({
        verified: z.boolean(),
        reason: z.string(),
        payload: z.string().optional(),
        signature: z.string().optional(),
        verified_at: z.string().optional(),
      })
      .optional(),
  }),
  author: z
    .object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string(),
      html_url: z.string(),
    })
    .optional(),
  committer: z
    .object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string(),
      html_url: z.string(),
    })
    .optional(),
  parents: z.array(
    z.object({
      sha: z.string(),
      url: z.string(),
      html_url: z.string().optional(),
    }),
  ),
  stats: z
    .object({
      additions: z.number(),
      deletions: z.number(),
      total: z.number(),
    })
    .optional(),
  files: z
    .array(
      z.object({
        sha: z.string().optional(),
        filename: z.string(),
        status: z.enum(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']).or(z.string()),
        additions: z.number(),
        deletions: z.number(),
        changes: z.number(),
        blob_url: z.string(),
        raw_url: z.string(),
        contents_url: z.string(),
        patch: z.string().optional(),
        previous_filename: z.string().optional(),
      }),
    )
    .optional(),
});

export function getCommitTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_commit',
    description: 'Retrieve a commit with changed files and stats',
    inputSchema: getCommitInputSchema,
    outputSchema: getCommitOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCommitOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/commits/commits#get-a-commit
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/commits/${encodeURIComponent(input.ref)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Commit not found',
          owner: input.owner,
          repo: input.repo,
          ref: input.ref,
        });
      }

      const providerCommit = ProviderCommitSchema.parse(response.data);

      // Normalize author and committer
      const author =
        providerCommit.author && 'login' in providerCommit.author
          ? {
              login: providerCommit.author.login,
              id: providerCommit.author.id,
              avatar_url: providerCommit.author.avatar_url,
              html_url: providerCommit.author.html_url,
            }
          : undefined;

      const committer =
        providerCommit.committer && 'login' in providerCommit.committer
          ? {
              login: providerCommit.committer.login,
              id: providerCommit.committer.id,
              avatar_url: providerCommit.committer.avatar_url,
              html_url: providerCommit.committer.html_url,
            }
          : undefined;

      // Normalize verification
      const verification = providerCommit.commit.verification
        ? {
            verified: providerCommit.commit.verification.verified,
            reason: providerCommit.commit.verification.reason,
            ...(providerCommit.commit.verification.payload != null && {
              payload: providerCommit.commit.verification.payload,
            }),
            ...(providerCommit.commit.verification.signature != null && {
              signature: providerCommit.commit.verification.signature,
            }),
            ...(providerCommit.commit.verification.verified_at != null && {
              verified_at: providerCommit.commit.verification.verified_at,
            }),
          }
        : undefined;

      // Normalize commit author and committer
      const commitAuthor = providerCommit.commit.author
        ? {
            name: providerCommit.commit.author.name,
            email: providerCommit.commit.author.email,
            date: providerCommit.commit.author.date,
          }
        : undefined;

      const commitCommitter = providerCommit.commit.committer
        ? {
            name: providerCommit.commit.committer.name,
            email: providerCommit.commit.committer.email,
            date: providerCommit.commit.committer.date,
          }
        : undefined;

      return {
        sha: providerCommit.sha,
        node_id: providerCommit.node_id,
        url: providerCommit.url,
        html_url: providerCommit.html_url,
        comments_url: providerCommit.comments_url,
        commit: {
          message: providerCommit.commit.message,
          comment_count: providerCommit.commit.comment_count,
          tree: providerCommit.commit.tree,
          ...(commitAuthor && { author: commitAuthor }),
          ...(commitCommitter && { committer: commitCommitter }),
          ...(verification && { verification }),
        },
        ...(author && { author }),
        ...(committer && { committer }),
        parents: providerCommit.parents,
        stats: providerCommit.stats,
        files: providerCommit.files?.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          blob_url: file.blob_url,
          raw_url: file.raw_url,
          contents_url: file.contents_url,
          ...(file.sha != null && { sha: file.sha }),
          ...(file.patch && { patch: file.patch }),
          ...(file.previous_filename && { previous_filename: file.previous_filename }),
        })),
      };
    },
  });
}
