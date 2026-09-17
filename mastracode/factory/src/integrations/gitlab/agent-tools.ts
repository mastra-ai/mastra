import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationConnection } from '../../capabilities/connection.js';
import { GitLabApiError } from './api.js';
import type { GitLabIntegrationBase } from './integration.js';

const TOOL_CONNECTION: IntegrationConnection = { type: 'oauth', accessToken: 'gitlab-tool' };

function createGitLabGetIssueTool(gitlab: GitLabIntegrationBase) {
  return createTool({
    id: 'gitlab_get_issue',
    description:
      "Fetch a GitLab issue's full details, including description, state, assignees, labels, and discussion notes. Pass a project-qualified issue such as group/project#42, a GitLab issue URL, or an encoded issue reference from Factory intake.",
    inputSchema: z.object({
      issue: z
        .string()
        .trim()
        .min(1)
        .describe('A project-qualified GitLab issue (for example, "group/project#42") or GitLab issue URL.'),
    }),
    execute: async ({ issue }: { issue: string }) => {
      try {
        const detail = await gitlab.intake.getIssue({ connection: TOOL_CONNECTION, issueId: issue.trim() });
        if (!detail) return { error: `GitLab issue "${issue}" was not found.` };
        return detail;
      } catch (error) {
        if (error instanceof GitLabApiError && error.code === 'gitlab_auth_failed') {
          return { error: gitlab.authFailureMessage() };
        }
        return { error: `Failed to fetch GitLab issue: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  });
}

export async function buildGitLabAgentTools({
  requestContext,
  gitlab,
}: {
  requestContext: RequestContext;
  gitlab: GitLabIntegrationBase;
}): Promise<Record<string, ReturnType<typeof createGitLabGetIssueTool>>> {
  if (!gitlab.authEnabled) return {};
  const ctx = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!ctx?.resourceId) return {};
  const orgId = await gitlab.resolveOrgId(ctx.resourceId);
  if (!orgId || !(await gitlab.hasActiveConnections())) return {};
  return { gitlab_get_issue: createGitLabGetIssueTool(gitlab) };
}
