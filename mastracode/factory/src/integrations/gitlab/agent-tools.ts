import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { GitLabApiError } from './api.js';
import type { GitLabIntegrationBase } from './integration.js';

function createGitLabGetIssueTool(gitlab: GitLabIntegrationBase, scope: { orgId: string; factoryProjectId: string }) {
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
        const detail = await gitlab.getIssueForFactoryProject({
          orgId: scope.orgId,
          factoryProjectId: scope.factoryProjectId,
          issueId: issue,
        });
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
  const ctx = requestContext.get('controller') as
    AgentControllerRequestContext<{ factoryProjectId?: string }> | undefined;
  if (!ctx) return {};
  const projectId = ctx.getState().factoryProjectId ?? ctx.resourceId;
  if (!projectId) return {};
  const orgId = await gitlab.resolveOrgId(projectId);
  if (!orgId || !(await gitlab.hasActiveConnections())) return {};
  return { gitlab_get_issue: createGitLabGetIssueTool(gitlab, { orgId, factoryProjectId: projectId }) };
}
