import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Minimal Linear issue-creation tool. Uses the Linear GraphQL API directly so
 * we don't pull in @linear/sdk just to fire a single mutation.
 *
 * Gated by LINEAR_API_KEY. If unset, the tool throws on use.
 */
export const createLinearIssue = createTool({
  id: 'createLinearIssue',
  description: 'Create a Linear issue from a meeting action item.',
  inputSchema: z.object({
    teamId: z.string().describe('Linear team id (uuid).'),
    title: z.string(),
    description: z.string().optional(),
    assigneeEmail: z.string().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    identifier: z.string(),
    url: z.string(),
  }),
  execute: async input => {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) throw new Error('LINEAR_API_KEY is not set.');

    const mutation = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }
    `;

    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            teamId: input.teamId,
            title: input.title,
            description: input.description,
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Linear API failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      data?: { issueCreate?: { issue?: { id: string; identifier: string; url: string } } };
      errors?: unknown;
    };
    const issue = data.data?.issueCreate?.issue;
    if (!issue) throw new Error(`Linear API error: ${JSON.stringify(data.errors ?? data)}`);
    return issue;
  },
});
