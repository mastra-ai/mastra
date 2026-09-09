/**
 * GitLab tools exposed to the coding agent.
 *
 * These exist because the rule family invokes `factory-triage` on a GitLab
 * card. `gh` cannot read a GitLab issue, so without these tools the triage
 * agent would be asked to investigate an issue it has no way to fetch and
 * post a handoff it has no way to publish.
 *
 * Wired in the same way as Linear's (`../linear/agent-tools.ts`): an async
 * `extraTools` provider maps the session's project to its owning org and
 * offers the tools only when that org has a GitLab connection, so a model in
 * a GitHub-only project is never shown tools it can't use.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { GitLabIntegration } from './integration.js';

/** Both tools take the same reference, and both accept what the card carries. */
const ISSUE_ARG = z
  .string()
  .min(1)
  .describe(
    'The GitLab issue reference: "<projectId>!<iid>" as stored on the work item, "<group>/<project>#<iid>", or the issue URL.',
  );

function createGitlabGetIssueTool(gitlab: GitLabIntegration, orgId: string) {
  return createTool({
    id: 'gitlab_get_issue',
    description:
      "Fetch a GitLab issue's full details — title, description, state, author, assignees, labels, and discussion notes. Use this whenever you're working on a GitLab issue to get its complete context.",
    inputSchema: z.object({ issue: ISSUE_ARG }),
    execute: async ({ issue }: { issue: string }) => {
      const detail = await gitlab.agentGetIssue(orgId, issue.trim());
      if (detail === 'disconnected') {
        return { error: 'GitLab is not connected for this organization. Connect GitLab in Settings to fetch issues.' };
      }
      if (!detail) {
        return { error: `GitLab issue "${issue}" was not found, or its project is not connected.` };
      }
      return detail;
    },
  });
}

function createGitlabCommentTool(gitlab: GitLabIntegration, orgId: string) {
  return createTool({
    id: 'gitlab_create_comment',
    description:
      'Post a note on a GitLab issue (e.g. to publish investigation findings, link a merge request, or ask a clarifying question). The note is posted as the connected GitLab account, so make clear it comes from the agent.',
    inputSchema: z.object({
      issue: ISSUE_ARG,
      body: z.string().min(1).describe('The note body, as GitLab-flavored markdown.'),
    }),
    execute: async ({ issue, body }: { issue: string; body: string }) => {
      const posted = await gitlab.agentCreateComment(orgId, issue.trim(), body);
      if (posted === 'disconnected') {
        return { error: 'GitLab is not connected for this organization. Connect GitLab in Settings to post notes.' };
      }
      if (!posted) {
        return { error: `GitLab issue "${issue}" was not found, or its project is not connected.` };
      }
      return { posted: true, url: posted.url };
    },
  });
}

export async function buildGitlabAgentTools({
  requestContext,
  gitlab,
}: {
  requestContext: RequestContext;
  gitlab: GitLabIntegration;
}): Promise<Record<string, ReturnType<typeof createGitlabGetIssueTool> | ReturnType<typeof createGitlabCommentTool>>> {
  const ctx = requestContext.get('controller') as
    AgentControllerRequestContext<{ factoryProjectId?: string }> | undefined;
  if (!ctx) return {};

  // Board-run resourceId is the work-item session id, not the project id in
  // factory_projects; project-scoped sessions may not carry factoryProjectId.
  const projectId = ctx.getState().factoryProjectId ?? ctx.resourceId;
  if (!projectId) return {};

  const orgId = await gitlab.resolveOrgId(projectId);
  if (!orgId) return {};
  if (!(await gitlab.hasConnection(orgId))) return {};

  return {
    gitlab_get_issue: createGitlabGetIssueTool(gitlab, orgId),
    gitlab_create_comment: createGitlabCommentTool(gitlab, orgId),
  };
}
