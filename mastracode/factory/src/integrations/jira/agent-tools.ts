/**
 * Jira tools exposed to the coding agent.
 *
 * Wired into the agent through the SDK's async `extraTools` provider: on each
 * tool-set resolution we map the session's resourceId (the factory project
 * id) to its owning org and only expose the Jira tools for real factory
 * projects. Jira credentials are deployment-global, so unlike Linear there is
 * no per-org connection gate — a configured deployment offers the tools to
 * every org's projects.
 *
 * Tenancy mirrors the Jira API routes: nothing is exposed without the host
 * auth seam, and the session must resolve to an org-owned project.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationConnection } from '../../capabilities/connection.js';
import { JiraApiError } from './api.js';
import type { JiraIntegration } from './integration.js';

/**
 * The `Intake` contract requires a connection argument, but Jira credentials
 * live on the integration instance — this placeholder is accepted and
 * ignored (see `JiraIntegration`).
 */
const DEPLOYMENT_CONNECTION: IntegrationConnection = { type: 'oauth', accessToken: 'deployment-global' };

function toolError(action: string, err: unknown): { error: string } {
  if (err instanceof JiraApiError && err.code === 'jira_auth_failed') {
    return { error: 'Jira rejected the configured credentials. Ask the operator to check the Jira API token.' };
  }
  return { error: `${action}: ${err instanceof Error ? err.message : String(err)}` };
}

function createJiraGetIssueTool(jira: JiraIntegration) {
  return createTool({
    id: 'jira_get_issue',
    description:
      "Fetch a Jira issue's full details — summary, description, status, assignee, labels, priority, and discussion comments. Use this whenever you're working on a Jira issue (e.g. ENG-123) to get its complete context.",
    inputSchema: z.object({
      issue: z.string().min(1).describe('The Jira issue key (e.g. "ENG-123") or numeric issue id.'),
    }),
    execute: async ({ issue }: { issue: string }) => {
      try {
        const detail = await jira.intake.getIssue({
          connection: DEPLOYMENT_CONNECTION,
          issueId: issue.trim(),
        });
        if (!detail) {
          return { error: `Jira issue "${issue}" was not found on this site.` };
        }
        return detail;
      } catch (err) {
        return toolError('Failed to fetch Jira issue', err);
      }
    },
  });
}

function createJiraCommentTool(jira: JiraIntegration) {
  return createTool({
    id: 'jira_create_comment',
    description:
      'Post a comment on a Jira issue (e.g. to report investigation findings, link a PR, or ask a clarifying question). The comment is posted by the configured Jira account, so make clear it comes from the agent.',
    inputSchema: z.object({
      issue: z.string().min(1).describe('The Jira issue key (e.g. "ENG-123") or numeric issue id.'),
      body: z.string().min(1).describe('The comment body as plain text (converted to Jira document format).'),
    }),
    execute: async ({ issue, body }: { issue: string; body: string }) => {
      try {
        const comment = await jira.intake.createComment({
          connection: DEPLOYMENT_CONNECTION,
          issueId: issue.trim(),
          body,
        });
        if (!comment) {
          return { error: `Jira issue "${issue}" was not found on this site.` };
        }
        return { posted: true, url: comment.url };
      } catch (err) {
        return toolError('Failed to post Jira comment', err);
      }
    },
  });
}

/**
 * Async `extraTools` provider: expose Jira tools only when the host runs with
 * web auth and the session's resource is an org-owned factory project.
 */
export async function buildJiraAgentTools({
  requestContext,
  jira,
}: {
  requestContext: RequestContext;
  /** The integration instance providing the Jira API client. */
  jira: JiraIntegration;
}): Promise<Record<string, ReturnType<typeof createJiraGetIssueTool> | ReturnType<typeof createJiraCommentTool>>> {
  if (!jira.authEnabled) return {};

  const ctx = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const resourceId = ctx?.resourceId;
  if (!resourceId) return {};

  const orgId = await jira.resolveOrgId(resourceId);
  if (!orgId) return {};

  return {
    jira_get_issue: createJiraGetIssueTool(jira),
    jira_create_comment: createJiraCommentTool(jira),
  };
}
