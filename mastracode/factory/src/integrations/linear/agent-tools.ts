/**
 * Linear tools exposed to the coding agent.
 *
 * Wired into the agent through the SDK's async `extraTools` provider: on each
 * tool-set resolution we map the session's factory project to its owning org
 * and only expose the Linear tools when that org has a Linear connection.
 * Projects whose org never connected Linear (or when the
 * feature is disabled) see no Linear tools at all — the model is never shown
 * tools it can't use.
 *
 * Tenancy mirrors the Linear API routes: everything is scoped by the org that
 * owns the project, and tokens are refreshed through the integration's shared
 * connection lifecycle.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { LinearIntegration } from './integration.js';
import { LinearReauthRequiredError } from './integration.js';

function createLinearGetIssueTool(linear: LinearIntegration, orgId: string) {
  return createTool({
    id: 'linear_get_issue',
    description:
      "Fetch a Linear issue's full details — title, description, state, assignee, labels, priority, and discussion comments. Use this whenever you're working on a Linear issue (e.g. ENG-123) to get its complete context.",
    inputSchema: z.object({
      issue: z.string().min(1).describe('The Linear issue identifier (e.g. "ENG-123") or issue UUID.'),
    }),
    execute: async ({ issue }: { issue: string }) => {
      const connection = await linear.loadConnection(orgId);
      if (!connection) {
        return { error: 'Linear is not connected for this repository. Connect Linear in Settings to fetch issues.' };
      }
      try {
        const accessToken = await linear.getFreshAccessToken(connection);
        const detail = await linear.intake.getIssue({
          connection: { type: 'oauth', accessToken },
          issueId: issue.trim(),
        });
        if (!detail) {
          return { error: `Linear issue "${issue}" was not found in this workspace.` };
        }
        return detail;
      } catch (err) {
        if (err instanceof LinearReauthRequiredError) {
          return { error: err.message };
        }
        return { error: `Failed to fetch Linear issue: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}

function createLinearCommentTool(linear: LinearIntegration, orgId: string) {
  return createTool({
    id: 'linear_create_comment',
    description:
      'Post a comment on a Linear issue (e.g. to report investigation findings, link a PR, or ask a clarifying question). The comment is posted as the connected Linear integration, so make clear it comes from the agent.',
    inputSchema: z.object({
      issue: z.string().min(1).describe('The Linear issue identifier (e.g. "ENG-123") or issue UUID.'),
      body: z.string().min(1).describe('The comment body, as Linear-flavored markdown.'),
    }),
    execute: async ({ issue, body }: { issue: string; body: string }) => {
      const connection = await linear.loadConnection(orgId);
      if (!connection) {
        return { error: 'Linear is not connected for this repository. Connect Linear in Settings to post comments.' };
      }
      if (!linear.canPostComments(connection)) {
        return {
          error: 'The Linear connection does not have comment permissions. Reconnect Linear in Settings to grant them.',
        };
      }
      try {
        const accessToken = await linear.getFreshAccessToken(connection);
        const comment = await linear.intake.createComment({
          connection: { type: 'oauth', accessToken },
          issueId: issue.trim(),
          body,
        });
        if (!comment) {
          return { error: `Linear issue "${issue}" was not found in this workspace.` };
        }
        return { posted: true, url: comment.url };
      } catch (err) {
        if (err instanceof LinearReauthRequiredError) {
          return { error: err.message };
        }
        return { error: `Failed to post Linear comment: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}

function createLinearCreateIssueTool(linear: LinearIntegration, orgId: string) {
  return createTool({
    id: 'linear_create_issue',
    description:
      'Create a new Linear issue (e.g. to file a bug or follow-up found while working). The issue is created as the connected Linear integration. If the workspace has more than one team, pass `team`; an error lists the available team keys.',
    inputSchema: z.object({
      title: z.string().trim().min(1).describe('The issue title.'),
      description: z.string().optional().describe('The issue description, as Linear-flavored markdown.'),
      team: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Team key (e.g. "ENG"), name, or UUID. Optional when the workspace has a single team.'),
      priority: z
        .number()
        .int()
        .min(0)
        .max(4)
        .optional()
        .describe('0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low.'),
    }),
    execute: async ({
      title,
      description,
      team,
      priority,
    }: {
      title: string;
      description?: string;
      team?: string;
      priority?: number;
    }) => {
      const connection = await linear.loadConnection(orgId);
      if (!connection) {
        return { error: 'Linear is not connected for this repository. Connect Linear in Settings to create issues.' };
      }
      if (!linear.canCreateIssues(connection)) {
        return {
          error: 'The Linear connection does not have issue permissions. Reconnect Linear in Settings to grant them.',
        };
      }
      try {
        const accessToken = await linear.getFreshAccessToken(connection);
        const teams = await linear.listTeams(accessToken);
        const wanted = team?.toLowerCase();
        const selected = wanted
          ? teams.find(t => t.id === team || t.key.toLowerCase() === wanted || t.name.toLowerCase() === wanted)
          : teams.length === 1
            ? teams[0]
            : undefined;
        if (!selected) {
          const available = teams.map(t => `${t.key} (${t.name})`).join(', ') || 'none';
          return {
            error: team
              ? `Linear team "${team}" was not found. Available teams: ${available}.`
              : `Specify a Linear team. Available teams: ${available}.`,
          };
        }
        const issue = await linear.createIssue(accessToken, {
          teamId: selected.id,
          title,
          ...(description ? { description } : {}),
          ...(priority !== undefined ? { priority } : {}),
        });
        return { created: true, identifier: issue.identifier, url: issue.url };
      } catch (err) {
        if (err instanceof LinearReauthRequiredError) {
          return { error: err.message };
        }
        return { error: `Failed to create Linear issue: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}

/**
 * Async `extraTools` provider: expose Linear tools only when the session's
 * project belongs to an org with an active Linear connection.
 */
export async function buildLinearAgentTools({
  requestContext,
  linear,
}: {
  requestContext: RequestContext;
  /** The integration instance providing the Linear API client. */
  linear: LinearIntegration;
}): Promise<
  Record<
    string,
    | ReturnType<typeof createLinearGetIssueTool>
    | ReturnType<typeof createLinearCommentTool>
    | ReturnType<typeof createLinearCreateIssueTool>
  >
> {
  if (!linear.authEnabled) return {};

  const ctx = requestContext.get('controller') as
    AgentControllerRequestContext<{ factoryProjectId?: string }> | undefined;
  if (!ctx) return {};

  // Board-run resourceId is the work-item session id, not the project id stored
  // in factory_projects. Project-scoped sessions may not carry factoryProjectId.
  const projectId = ctx.getState().factoryProjectId ?? ctx.resourceId;
  if (!projectId) return {};

  const orgId = await linear.resolveOrgId(projectId);
  if (!orgId) return {};
  const check = await linear.checkConnection(orgId);
  if (!check.connected) return {};

  return {
    linear_get_issue: createLinearGetIssueTool(linear, orgId),
    // Only offered when the granted OAuth scope allows posting comments —
    // connections made before `comments:create` was requested are read-only
    // until the org reconnects Linear.
    ...(check.canComment ? { linear_create_comment: createLinearCommentTool(linear, orgId) } : {}),
    // Likewise gated on `issues:create`, which older connections lack.
    ...(check.canCreateIssues ? { linear_create_issue: createLinearCreateIssueTool(linear, orgId) } : {}),
  };
}
