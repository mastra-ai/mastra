/**
 * Linear tools exposed to the coding agent.
 *
 * Wired into the agent through the SDK's async `extraTools` provider: on each
 * tool-set resolution we map the session's resourceId (the factory project id)
 * to its owning org and only expose the Linear tools when that org has a
 * Linear connection. Projects whose org never connected Linear (or when the
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

import type { LinearIntegration } from './integration';
import { LinearReauthRequiredError } from './integration';

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
}): Promise<Record<string, ReturnType<typeof createLinearGetIssueTool> | ReturnType<typeof createLinearCommentTool>>> {
  if (!linear.authEnabled) return {};

  const ctx = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const resourceId = ctx?.resourceId;
  if (!resourceId) return {};

  const orgId = await linear.resolveOrgId(resourceId);
  if (!orgId) return {};
  const check = await linear.checkConnection(orgId);
  if (!check.connected) return {};

  return {
    linear_get_issue: createLinearGetIssueTool(linear, orgId),
    // Only offered when the granted OAuth scope allows posting comments —
    // connections made before `comments:create` was requested are read-only
    // until the org reconnects Linear.
    ...(check.canComment ? { linear_create_comment: createLinearCommentTool(linear, orgId) } : {}),
  };
}
