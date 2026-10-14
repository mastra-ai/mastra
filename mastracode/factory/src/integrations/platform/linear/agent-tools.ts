/**
 * Linear tools exposed to the coding agent for Platform Connect connections —
 * `linear_get_issue`, `linear_create_comment` and `linear_create_issue`.
 *
 * Mirrors the Platform Jira tools: nothing is exposed without the host auth
 * seam, the session must resolve to an org-owned factory project, and the org
 * needs at least one active Platform Linear connection.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { PlatformApiError } from '../api-client.js';
import type { PlatformLinearIntegration } from './integration.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toolError(action: string, err: unknown): { error: string } {
  if (err instanceof PlatformApiError && err.status === 401) {
    return { error: 'Linear rejected the connected account. Reconnect Linear in Settings.' };
  }
  return { error: `${action}: ${err instanceof Error ? err.message : String(err)}` };
}

function createLinearGetIssueTool(linear: PlatformLinearIntegration) {
  return createTool({
    id: 'linear_get_issue',
    description:
      "Fetch a Linear issue's full details — title, description, state, assignee, labels, priority, and discussion comments. Use this whenever you're working on a Linear issue (e.g. ENG-123).",
    inputSchema: z.object({
      issue: z.string().trim().min(1).describe('The Linear issue identifier (e.g. "ENG-123") or UUID.'),
    }),
    execute: async ({ issue }: { issue: string }) => {
      try {
        const detail = await linear.getIssueDetail(issue);
        if (!detail) return { error: `Linear issue "${issue}" was not found.` };
        return detail;
      } catch (err) {
        return toolError('Failed to fetch Linear issue', err);
      }
    },
  });
}

function createLinearCommentTool(linear: PlatformLinearIntegration) {
  return createTool({
    id: 'linear_create_comment',
    description:
      'Post a comment on a Linear issue (e.g. to report findings, link a PR, or ask a clarifying question). The comment is posted as the connected Linear account, so make clear it comes from the agent.',
    inputSchema: z.object({
      issue: z.string().trim().min(1).describe('The Linear issue identifier (e.g. "ENG-123") or UUID.'),
      body: z.string().min(1).describe('The comment body, in Markdown.'),
    }),
    execute: async ({ issue, body }: { issue: string; body: string }) => {
      try {
        const comment = await linear.commentOnIssue(issue, body);
        if (!comment) return { error: `Linear issue "${issue}" was not found.` };
        return { posted: true, url: comment.url };
      } catch (err) {
        return toolError('Failed to post Linear comment', err);
      }
    },
  });
}

function createLinearCreateIssueTool(linear: PlatformLinearIntegration) {
  return createTool({
    id: 'linear_create_issue',
    description:
      'Create a new Linear issue. Pass `team` as a team key (e.g. "ENG"), name, or UUID; it can be omitted when only one team is connected.',
    inputSchema: z.object({
      title: z.string().trim().min(1).describe('The issue title.'),
      description: z.string().optional().describe('The issue description, in Markdown.'),
      team: z.string().trim().min(1).optional().describe('Team key (e.g. "ENG"), team name, or team UUID.'),
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
      try {
        const teams = await linear.listAllTeams();
        const listKeys = () => teams.map(t => t.key).join(', ');
        let target: (typeof teams)[number] | undefined;
        if (team) {
          const needle = team.toLowerCase();
          target =
            (UUID_PATTERN.test(team) ? teams.find(t => t.id === team) : undefined) ??
            teams.find(t => t.key.toLowerCase() === needle) ??
            teams.find(t => t.name.toLowerCase() === needle);
          if (!target) return { error: `Linear team "${team}" was not found. Available teams: ${listKeys()}.` };
        } else if (teams.length === 1) {
          target = teams[0];
        } else if (teams.length === 0) {
          return { error: 'No Linear teams are available on the connected workspaces.' };
        } else {
          return { error: `Specify a team. Available teams: ${listKeys()}.` };
        }
        const created = await linear.createIssue(target!.workspaceId, {
          teamId: target!.id,
          title,
          ...(description !== undefined ? { description } : {}),
          ...(priority !== undefined ? { priority } : {}),
        });
        return { created: true, identifier: created.identifier, url: created.url };
      } catch (err) {
        return toolError('Failed to create Linear issue', err);
      }
    },
  });
}

type PlatformLinearTool =
  | ReturnType<typeof createLinearGetIssueTool>
  | ReturnType<typeof createLinearCommentTool>
  | ReturnType<typeof createLinearCreateIssueTool>;

export async function buildPlatformLinearAgentTools({
  requestContext,
  linear,
}: {
  requestContext: RequestContext;
  linear: PlatformLinearIntegration;
}): Promise<Record<string, PlatformLinearTool>> {
  if (!linear.authEnabled) return {};

  const ctx = requestContext.get('controller') as
    AgentControllerRequestContext<{ factoryProjectId?: string }> | undefined;
  if (!ctx) return {};

  const projectId = ctx.getState().factoryProjectId ?? ctx.resourceId;
  if (!projectId) return {};

  const orgId = await linear.resolveOrgId(projectId);
  if (!orgId || !(await linear.hasActiveConnections())) return {};

  return {
    linear_get_issue: createLinearGetIssueTool(linear),
    linear_create_comment: createLinearCommentTool(linear),
    linear_create_issue: createLinearCreateIssueTool(linear),
  };
}
