import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { githubFetch, mapPRResponse, fetchAllPRFiles, fetchFileContent } from '../lib/github';
import { prIdentifierSchema, prSchema, fileSchema } from '../lib/schemas';
import { SKIP_PATTERNS } from '../lib/review-config';

export const parseGitHubPRUrl = createTool({
  id: 'parse-github-pr-url',
  description: 'Parse a GitHub Pull Request URL into its owner, repo, and pull number components.',
  inputSchema: z.object({
    url: z.string().describe('A GitHub PR URL, e.g. https://github.com/owner/repo/pull/123'),
  }),
  outputSchema: prIdentifierSchema,
  execute: async inputData => {
    const match = inputData.url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
    if (!match) {
      throw new Error(
        `Invalid GitHub PR URL: "${inputData.url}". Expected format: https://github.com/owner/repo/pull/123`,
      );
    }
    return {
      owner: match[1],
      repo: match[2],
      pullNumber: parseInt(match[3], 10),
    };
  },
});

export const getPullRequest = createTool({
  id: 'get-pull-request',
  description:
    'Fetch metadata for a GitHub Pull Request including title, body, state, author, branches, labels, and diff stats.',
  inputSchema: prIdentifierSchema,
  outputSchema: prSchema,
  execute: async inputData => {
    const { owner, repo, pullNumber } = inputData;
    const response = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    const data = await response.json();
    return mapPRResponse(data);
  },
});

export const getPullRequestDiff = createTool({
  id: 'get-pull-request-diff',
  description:
    'Fetch the raw unified diff for a GitHub Pull Request. For large PRs, prefer using getPullRequestFiles with pagination instead.',
  inputSchema: prIdentifierSchema,
  outputSchema: z.object({
    diff: z.string(),
  }),
  execute: async inputData => {
    const { owner, repo, pullNumber } = inputData;
    const response = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`, 'application/vnd.github.diff');
    return { diff: await response.text() };
  },
});

const FILES_PER_PAGE = 30;

export const getPullRequestFiles = createTool({
  id: 'get-pull-request-files',
  description:
    'List the files changed in a GitHub Pull Request with per-file diff patches. Non-reviewable files (lock files, images, generated code) are filtered out. Use `page` to paginate — each page returns up to 30 reviewable files. Check `hasMore` to know if more pages exist.',
  inputSchema: prIdentifierSchema.extend({
    page: z.number().optional().default(1).describe('Page number (1-based).'),
  }),
  outputSchema: z.object({
    files: z.array(fileSchema),
    totalFiles: z.number(),
    reviewableCount: z.number(),
    hasMore: z.boolean(),
    page: z.number(),
  }),
  execute: async inputData => {
    const { owner, repo, pullNumber, page } = inputData;
    const allFiles = await fetchAllPRFiles(owner, repo, pullNumber);

    const reviewableFiles = allFiles.filter(f => !SKIP_PATTERNS.some(p => p.test(f.filename)));

    const start = (page - 1) * FILES_PER_PAGE;
    const pageFiles = reviewableFiles.slice(start, start + FILES_PER_PAGE);

    return {
      files: pageFiles,
      totalFiles: allFiles.length,
      reviewableCount: reviewableFiles.length,
      hasMore: start + FILES_PER_PAGE < reviewableFiles.length,
      page,
    };
  },
});

export const getFileContent = createTool({
  id: 'get-file-content',
  description:
    'Fetch the content of a single file from a GitHub repository at a specific git ref. Prefer using a commit SHA as the ref — branch names may fail if the branch has been deleted. Returns null content if the file or ref is not found.',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner'),
    repo: z.string().describe('Repository name'),
    path: z.string().describe('File path within the repository'),
    ref: z.string().describe('Git ref (branch, tag, or commit SHA). Prefer commit SHA.'),
  }),
  outputSchema: z.object({
    content: z.string().nullable(),
    encoding: z.string(),
    size: z.number(),
  }),
  execute: async inputData => {
    const result = await fetchFileContent(inputData.owner, inputData.repo, inputData.path, inputData.ref);
    if (!result) return { content: null, encoding: 'utf-8', size: 0 };
    return result;
  },
});
