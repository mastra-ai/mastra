// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCommitsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  sha: z.string().optional().describe('SHA or branch to start listing commits from. Example: "main"'),
  path: z
    .string()
    .optional()
    .describe('Only commits containing this file path will be returned. Example: "docs/README.md"'),
  author: z
    .string()
    .optional()
    .describe('GitHub login or email address by which to filter by commit author. Example: "octocat@example.com"'),
  since: z
    .string()
    .optional()
    .describe(
      'Only commits after this date will be returned. ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ. Example: "2024-01-01T00:00:00Z"',
    ),
  until: z
    .string()
    .optional()
    .describe(
      'Only commits before this date will be returned. ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ. Example: "2024-12-31T23:59:59Z"',
    ),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('The number of results per page (max 100). Default: 30'),
  page: z.number().int().min(1).optional().describe('Page number of the results to fetch. Default: 1'),
});

const GitHubAuthorSchema = z.object({
  login: z.string().optional(),
  id: z.number().optional(),
  avatar_url: z.string().optional(),
  url: z.string().optional(),
});

const GitHubCommitAuthorSchema = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string(),
});

const GitHubCommitSchema = z.object({
  url: z.string(),
  author: GitHubCommitAuthorSchema.nullable().optional(),
  committer: GitHubCommitAuthorSchema.nullable().optional(),
  message: z.string(),
  tree: z.object({
    sha: z.string(),
    url: z.string(),
  }),
});

const GitHubCommitItemSchema = z.object({
  sha: z.string(),
  node_id: z.string().optional(),
  commit: GitHubCommitSchema,
  author: GitHubAuthorSchema.nullable().optional(),
  committer: GitHubAuthorSchema.nullable().optional(),
  parents: z
    .array(
      z.object({
        sha: z.string(),
        url: z.string().optional(),
      }),
    )
    .optional(),
  html_url: z.string().optional(),
});

export const listCommitsOutputSchema = z.object({
  commits: z.array(
    z.object({
      sha: z.string().describe('The SHA of the commit'),
      message: z.string().describe('The commit message'),
      author_name: z.string().optional().describe('Name of the author'),
      author_email: z.string().optional().describe('Email of the author'),
      author_date: z.string().optional().describe('Date of the commit'),
      committer_name: z.string().optional().describe('Name of the committer'),
      committer_email: z.string().optional().describe('Email of the committer'),
      committer_date: z.string().optional().describe('Date the commit was committed'),
      html_url: z.string().optional().describe('URL to the commit on GitHub'),
      parent_shas: z.array(z.string()).optional().describe('SHAs of parent commits'),
    }),
  ),
  total_count: z.number().optional().describe('Total number of commits (if available)'),
});

export function listCommitsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_commits',
    description: 'List commits for a repository or branch with common filters',
    inputSchema: listCommitsInputSchema,
    outputSchema: listCommitsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCommitsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/commits/commits#list-commits
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/commits`,
        params: {
          ...(input.sha && { sha: input.sha }),
          ...(input.path && { path: input.path }),
          ...(input.author && { author: input.author }),
          ...(input.since && { since: input.since }),
          ...(input.until && { until: input.until }),
          ...(input.per_page && { per_page: String(input.per_page) }),
          ...(input.page && { page: String(input.page) }),
        },
        retries: 3,
      });

      const commits = z.array(GitHubCommitItemSchema).parse(response.data);

      return {
        commits: commits.map(commit => ({
          sha: commit.sha,
          message: commit.commit.message,
          ...(commit.commit.author?.name && { author_name: commit.commit.author.name }),
          ...(commit.commit.author?.email && { author_email: commit.commit.author.email }),
          ...(commit.commit.author?.date && { author_date: commit.commit.author.date }),
          ...(commit.commit.committer?.name && { committer_name: commit.commit.committer.name }),
          ...(commit.commit.committer?.email && { committer_email: commit.commit.committer.email }),
          ...(commit.commit.committer?.date && { committer_date: commit.commit.committer.date }),
          ...(commit.html_url && { html_url: commit.html_url }),
          ...(commit.parents && { parent_shas: commit.parents.map(p => p.sha) }),
        })),
      };
    },
  });
}
