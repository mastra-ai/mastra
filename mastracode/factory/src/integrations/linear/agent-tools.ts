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

function createLinearGetIssueTool(linear: LinearIntegration, orgId: string, workspaceUrlKey: string | null) {
  // The URL pattern lets the agent link a ticket it mentions without fetching it first.
  const linkHint = workspaceUrlKey
    ? ` Issues in this workspace link as https://linear.app/${workspaceUrlKey}/issue/<identifier> (e.g. https://linear.app/${workspaceUrlKey}/issue/ENG-123).`
    : ' To link an issue, use the `url` field of the fetched issue.';
  return createTool({
    id: 'linear_get_issue',
    description: `Fetch a Linear issue's full details — title, description, state, assignee, labels, priority, and discussion comments. Use this whenever you're working on a Linear issue (e.g. ENG-123) to get its complete context.${linkHint}`,
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

function createLinearListProjectsTool(linear: LinearIntegration, orgId: string) {
  return createTool({
    id: 'linear_list_projects',
    description:
      'List the Linear projects and teams in the connected workspace, with the source id linear_list_issues needs. Use this to find a project (e.g. from a linear.app/<workspace>/project/<name-slug>-<id> URL, by matching its name; drop the trailing id from the slug) before listing its issues.',
    inputSchema: z.object({
      query: z.string().optional().describe('Case-insensitive text to match against project and team names.'),
    }),
    execute: async ({ query }: { query?: string }) => {
      const connection = await linear.loadConnection(orgId);
      if (!connection) {
        return { error: 'Linear is not connected for this repository. Connect Linear in Settings to list projects.' };
      }
      try {
        // Linear sources are scoped by org alone; no Linear implementation reads userId.
        const sources = await linear.intake.listSources({ orgId, userId: '' });
        // Fold hyphens into spaces so a URL slug like "agent-browser" matches "Agent Browser".
        const normalize = (text: string) =>
          text
            .toLowerCase()
            .replace(/[\s-]+/g, ' ')
            .trim();
        const needle = normalize(query ?? '');
        const matches = needle ? sources.filter(source => normalize(source.name).includes(needle)) : sources;
        return {
          projects: matches
            .filter(source => source.type === 'project')
            .map(source => ({ sourceId: source.id, name: source.name })),
          teams: matches
            .filter(source => source.type === 'team')
            .map(source => ({ sourceId: source.id, name: source.name, key: source.metadata?.teamKey ?? null })),
        };
      } catch (err) {
        if (err instanceof LinearReauthRequiredError) {
          return { error: err.message };
        }
        return { error: `Failed to list Linear projects: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}

function createLinearListIssuesTool(linear: LinearIntegration, orgId: string) {
  return createTool({
    id: 'linear_list_issues',
    description:
      'List the open issues (triage, backlog, todo and in progress; completed and canceled are left out) in one Linear project or team, most recently updated first. Get the source id from linear_list_projects, and read an issue in full with linear_get_issue. Pass nextCursor back as cursor for the next page.',
    inputSchema: z.object({
      source: z.string().min(1).describe('The project or team source id returned by linear_list_projects.'),
      labels: z.array(z.string().trim().min(1)).optional().describe('Only return issues carrying one of these label names.'),
      cursor: z.string().optional().describe('The nextCursor from a previous call, to fetch the next page.'),
    }),
    execute: async ({ source, labels, cursor }: { source: string; labels?: string[]; cursor?: string }) => {
      const connection = await linear.loadConnection(orgId);
      if (!connection) {
        return { error: 'Linear is not connected for this repository. Connect Linear in Settings to list issues.' };
      }
      try {
        const accessToken = await linear.getFreshAccessToken(connection);
        const page = await linear.intake.listIssues({
          connection: { type: 'oauth', accessToken },
          sourceIds: [source.trim()],
          ...(labels?.length ? { labels } : {}),
          ...(cursor ? { cursor } : {}),
        });
        return {
          issues: page.issues.map(issue => ({
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
            state: issue.state,
            priority: issue.priority,
            assignee: issue.assignee,
            labels: issue.labels,
            updatedAt: issue.updatedAt,
          })),
          nextCursor: page.nextCursor,
        };
      } catch (err) {
        if (err instanceof LinearReauthRequiredError) {
          return { error: err.message };
        }
        return { error: `Failed to list Linear issues: ${err instanceof Error ? err.message : String(err)}` };
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
    | ReturnType<typeof createLinearListProjectsTool>
    | ReturnType<typeof createLinearListIssuesTool>
  >
> {
  if (!linear.authEnabled) return {};

  const ctx = requestContext.get('controller') as
    AgentControllerRequestContext<{ factoryProjectId?: string }> | undefined;
  if (!ctx) return {};

  // Prefer the Factory recorded on the session. Factory sessions run under the
  // Factory as their resource, so the resource is the fallback; a legacy
  // session whose resource is its own id resolves to no project.
  const projectId = ctx.getState().factoryProjectId ?? ctx.resourceId;
  if (!projectId) return {};

  const orgId = await linear.resolveOrgId(projectId);
  if (!orgId) return {};
  const check = await linear.checkConnection(orgId);
  if (!check.connected) return {};

  return {
    linear_get_issue: createLinearGetIssueTool(linear, orgId, check.workspaceUrlKey),
    linear_list_projects: createLinearListProjectsTool(linear, orgId),
    linear_list_issues: createLinearListIssuesTool(linear, orgId),
    // Only offered when the granted OAuth scope allows posting comments —
    // connections made before `comments:create` was requested are read-only
    // until the org reconnects Linear.
    ...(check.canComment ? { linear_create_comment: createLinearCommentTool(linear, orgId) } : {}),
  };
}
