import { createTool } from '@mastra/core/tools';
import { LinearClient } from '@linear/sdk';
import { z } from 'zod';

function getLinearClient(): LinearClient {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error('LINEAR_API_KEY is not set.');
  return new LinearClient({ apiKey });
}

export const searchLinearIssues = createTool({
  id: 'search-linear-issues',
  description: 'Search Linear issues by free-text query. Returns up to 20 matching issues with id, title, state, and URL.',
  inputSchema: z.object({
    query: z.string().describe('Free-text query, e.g. "billing bug" or "Q3 roadmap".'),
  }),
  outputSchema: z.object({
    issues: z.array(
      z.object({
        id: z.string(),
        identifier: z.string(),
        title: z.string(),
        state: z.string().optional(),
        url: z.string(),
      }),
    ),
  }),
  execute: async input => {
    const client = getLinearClient();
    const result = await client.issues({
      filter: { title: { containsIgnoreCase: input.query } },
      first: 20,
    });
    const issues = await Promise.all(
      result.nodes.map(async issue => {
        const state = await issue.state;
        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          state: state?.name,
          url: issue.url,
        };
      }),
    );
    return { issues };
  },
});

export const getLinearIssue = createTool({
  id: 'get-linear-issue',
  description: 'Fetch a single Linear issue by identifier (e.g. "ENG-123") including description and comments.',
  inputSchema: z.object({
    identifier: z.string().describe('Linear issue identifier, e.g. ENG-123.'),
  }),
  outputSchema: z.object({
    id: z.string(),
    identifier: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    state: z.string().optional(),
    url: z.string(),
  }),
  execute: async input => {
    const client = getLinearClient();
    const issue = await client.issue(input.identifier);
    const state = await issue.state;
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? null,
      state: state?.name,
      url: issue.url,
    };
  },
});

export const listLinearProjects = createTool({
  id: 'list-linear-projects',
  description: 'List Linear projects (up to 25) with name, status, and URL.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    projects: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        state: z.string().optional(),
        url: z.string(),
      }),
    ),
  }),
  execute: async () => {
    const client = getLinearClient();
    const result = await client.projects({ first: 25 });
    return {
      projects: result.nodes.map(p => ({
        id: p.id,
        name: p.name,
        state: p.state,
        url: p.url,
      })),
    };
  },
});
