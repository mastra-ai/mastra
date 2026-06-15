import { createTool } from '@mastra/core/tools';
import { getToken } from '@vercel/connect';
import { z } from 'zod';

/**
 * Vercel Connect connector name for GitHub.
 * Create this via: `vercel connect create github --name <your-connector-name>`
 * Then set VERCEL_CONNECT_GITHUB_CONNECTOR in your env.
 */
const githubConnector = process.env.VERCEL_CONNECT_GITHUB_CONNECTOR || 'github/my-github';

export const githubCreateIssue = createTool({
  id: 'github-create-issue',
  description: 'Create a GitHub issue using Vercel Connect for authentication',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner'),
    repo: z.string().describe('Repository name'),
    title: z.string().describe('Issue title'),
    body: z.string().optional().describe('Issue body (markdown)'),
    labels: z.array(z.string()).optional().describe('Labels to add'),
  }),
  execute: async ({ owner, repo, title, body, labels }) => {
    const token = await getToken(githubConnector, {
      subject: { type: 'app' },
      scopes: ['repo'],
    });

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body, labels }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }

    const issue = await response.json();
    return { id: issue.id, number: issue.number, url: issue.html_url };
  },
});

export const githubListRepos = createTool({
  id: 'github-list-repos',
  description: 'List repositories accessible via Vercel Connect GitHub connector',
  inputSchema: z.object({
    sort: z.enum(['created', 'updated', 'pushed', 'full_name']).optional().default('updated'),
    per_page: z.number().optional().default(10).describe('Number of repos to return'),
  }),
  execute: async ({ sort, per_page }) => {
    const token = await getToken(githubConnector, {
      subject: { type: 'app' },
    });

    const response = await fetch(
      `https://api.github.com/installation/repositories?sort=${sort}&per_page=${per_page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.repositories.map((r: { full_name: string; description: string; html_url: string }) => ({
      name: r.full_name,
      description: r.description,
      url: r.html_url,
    }));
  },
});
