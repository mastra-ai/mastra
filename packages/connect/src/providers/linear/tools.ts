// AUTO-GENERATED from NangoHQ/integration-templates @ <SHA> — do not edit by hand.
import type { z } from 'zod';

import { defineActionTool, type ActionToolContext } from '../../runtime/action-tool.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { createIssueInput, createIssueOutput, createIssueProviderResponse } from './schemas.js';

const ENV_VAR = 'MASTRA_LINEAR_CONNECTION_ID';

function makeCreateIssue(ctx: ActionToolContext) {
  return defineActionTool<z.infer<typeof createIssueInput>, z.infer<typeof createIssueOutput>>(ctx, {
    id: 'linear_create_issue',
    description: 'Create a new Linear issue.',
    inputSchema: createIssueInput,
    outputSchema: createIssueOutput,
    // exec body vendored verbatim (with `nango.ActionError` retyped against the shim).
    exec: async (nango, input) => {
      const variables: Record<string, unknown> = {
        teamId: input.teamId,
        title: input.title,
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.stateId !== undefined && { stateId: input.stateId }),
        ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
        ...(input.cycleId !== undefined && { cycleId: input.cycleId }),
        ...(input.labelIds !== undefined && { labelIds: input.labelIds }),
        ...(input.projectId !== undefined && { projectId: input.projectId }),
      };

      const query = `
        mutation IssueCreate(
          $teamId: String!, $title: String!, $description: String, $priority: Int,
          $stateId: String, $assigneeId: String, $cycleId: String,
          $labelIds: [String!], $projectId: String
        ) {
          issueCreate(input: {
            teamId: $teamId, title: $title, description: $description, priority: $priority,
            stateId: $stateId, assigneeId: $assigneeId, cycleId: $cycleId,
            labelIds: $labelIds, projectId: $projectId
          }) {
            success
            issue {
              id identifier title url description priority
              state { id } assignee { id } team { id } cycle { id } project { id }
            }
          }
        }
      `;

      const response = await nango.post({
        endpoint: '/graphql',
        data: { query, variables },
        retries: 3,
      });

      const parsed = createIssueProviderResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new nango.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Linear API',
          details: parsed.error.issues,
        });
      }

      if (parsed.data.errors && parsed.data.errors.length > 0) {
        throw new nango.ActionError({
          type: 'graphql_error',
          message: parsed.data.errors.map(e => e.message).join('; '),
        });
      }

      const issue = parsed.data.data.issueCreate.issue;
      if (!parsed.data.data.issueCreate.success || !issue) {
        throw new nango.ActionError({ type: 'creation_failed', message: 'Linear reported issue creation failed.' });
      }

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
        description: issue.description ?? undefined,
        priority: issue.priority ?? undefined,
        stateId: issue.state?.id,
        assigneeId: issue.assignee?.id,
        teamId: issue.team?.id,
        cycleId: issue.cycle?.id,
        projectId: issue.project?.id,
      };
    },
  });
}

export function createLinearTools(options?: ProviderToolsOptions) {
  const ctx: ActionToolContext = { envVar: ENV_VAR, options };
  const tools = {
    linear_create_issue: makeCreateIssue(ctx),
  };
  return applyAllowTools(tools, options?.allowTools);
}
