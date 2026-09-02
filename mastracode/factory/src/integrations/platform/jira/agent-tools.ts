/**
 * Jira tools exposed to the coding agent — v1 is read-only (`jira_get_issue`).
 *
 * Wired into the agent through the SDK's async `extraTools` provider: on each
 * tool-set resolution we map the session's resourceId (the factory project
 * id) to its owning org and only expose the Jira tool for real factory
 * projects with an active Platform-managed Jira connection.
 *
 * Tenancy mirrors the Jira API routes: nothing is exposed without the host
 * auth seam, and the session must resolve to an org-owned project.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationConnection } from '../../../capabilities/connection.js';
import { PlatformJiraApiError } from './api.js';
import type { PlatformJiraIntegration } from './integration.js';

/** The `Intake` contract requires a connection argument; the Platform adapter resolves the real connection. */
const PLATFORM_CONNECTION: IntegrationConnection = { type: 'oauth', accessToken: 'platform-managed' };

function toolError(action: string, err: unknown): { error: string } {
  if (err instanceof PlatformJiraApiError && err.code === 'jira_auth_failed') {
    return { error: 'Jira rejected the connected account. Reconnect it in Mastra Platform.' };
  }
  return { error: `${action}: ${err instanceof Error ? err.message : String(err)}` };
}

function createJiraGetIssueTool(jira: PlatformJiraIntegration) {
  return createTool({
    id: 'jira_get_issue',
    description:
      "Fetch a Jira issue's full details — summary, description, status, assignee, labels, priority, and discussion comments. Use this whenever you're working on a Jira issue (e.g. ENG-123) to get its complete context.",
    inputSchema: z.object({
      issue: z.string().trim().min(1).describe('The Jira issue key (e.g. "ENG-123") or numeric issue id.'),
    }),
    execute: async ({ issue }: { issue: string }) => {
      try {
        const detail = await jira.intake.getIssue({
          connection: PLATFORM_CONNECTION,
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

/**
 * Async `extraTools` provider: expose the read-only Jira tool only when the
 * host runs with web auth and the session's resource is an org-owned factory
 * project.
 *
 * v1 is intake-only, so no mutating Jira tool (comment/transition) is exposed
 * even though the adapter implements the full `Intake` contract internally.
 * Intake source bindings scope the board feed; `jira_get_issue` resolves the
 * issue through one of the organization's active Platform Jira connections.
 */
export async function buildPlatformJiraAgentTools({
  requestContext,
  jira,
}: {
  requestContext: RequestContext;
  /** The integration instance providing the Jira API client. */
  jira: PlatformJiraIntegration;
}): Promise<Record<string, ReturnType<typeof createJiraGetIssueTool>>> {
  if (!jira.authEnabled) return {};

  const ctx = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const resourceId = ctx?.resourceId;
  if (!resourceId) return {};

  const orgId = await jira.resolveOrgId(resourceId);
  if (!orgId || !(await jira.hasActiveConnections())) return {};

  return {
    jira_get_issue: createJiraGetIssueTool(jira),
  };
}
