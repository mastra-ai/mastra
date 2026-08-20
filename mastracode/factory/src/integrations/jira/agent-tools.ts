/**
 * Jira tools exposed to the coding agent — v1 is read-only (`jira_get_issue`).
 *
 * Wired into the agent through the SDK's async `extraTools` provider: on each
 * tool-set resolution we map the session's resourceId (the factory project
 * id) to its owning org and only expose the Jira tool for real factory
 * projects. Jira credentials are deployment-global, so unlike Linear there is
 * no per-org connection gate — a configured deployment offers the tool to
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

/**
 * Async `extraTools` provider: expose the read-only Jira tool only when the
 * host runs with web auth and the session's resource is an org-owned factory
 * project.
 *
 * v1 is intake-only, so no mutating Jira tool (comment/transition) is exposed
 * even though the adapter implements the full `Intake` contract internally.
 * Note the trust boundary: intake source bindings scope the board feed, not
 * this tool — within the intended single-tenant deployment, `jira_get_issue`
 * can read any issue visible to the deployment-global Jira account.
 */
export async function buildJiraAgentTools({
  requestContext,
  jira,
}: {
  requestContext: RequestContext;
  /** The integration instance providing the Jira API client. */
  jira: JiraIntegration;
}): Promise<Record<string, ReturnType<typeof createJiraGetIssueTool>>> {
  if (!jira.authEnabled) return {};

  const ctx = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const resourceId = ctx?.resourceId;
  if (!resourceId) return {};

  const orgId = await jira.resolveOrgId(resourceId);
  if (!orgId) return {};

  return {
    jira_get_issue: createJiraGetIssueTool(jira),
  };
}
