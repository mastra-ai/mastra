import type { ToolsInput } from '@mastra/core/agent';
import type { AgentControllerConfig } from '@mastra/core/agent-controller';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { Workspace } from '@mastra/core/workspace';
import { createWorkspaceTools } from '@mastra/core/workspace';

import type { MastraCodeState } from '../schema.js';
import { GOAL_JUDGE_READONLY_TOOLS } from './tool-availability.js';

type WorkspaceConfig = AgentControllerConfig<MastraCodeState>['workspace'];

async function resolveWorkspace({
  workspace,
  requestContext,
  mastra,
}: {
  workspace: WorkspaceConfig;
  requestContext: RequestContext;
  mastra?: Mastra;
}): Promise<Workspace | undefined> {
  if (!workspace) return undefined;
  if (typeof workspace === 'function') {
    return workspace({ requestContext, mastra });
  }
  return workspace;
}

/**
 * Build read-only workspace tools for the goal judge using the same effective
 * workspace configured on the AgentController. Surfaces own workspace selection;
 * the SDK only filters the selected workspace down to the verifier-safe tools.
 */
export function createGoalJudgeToolsResolver(workspace: WorkspaceConfig) {
  return async function getGoalJudgeTools({
    requestContext,
    mastra,
  }: {
    requestContext: RequestContext;
    mastra?: Mastra;
  }): Promise<ToolsInput | undefined> {
    let resolvedWorkspace: Workspace | undefined;
    try {
      resolvedWorkspace = await resolveWorkspace({ workspace, requestContext, mastra });
    } catch {
      return undefined;
    }

    if (!resolvedWorkspace) return undefined;

    const allTools = await createWorkspaceTools(resolvedWorkspace, { requestContext, workspace: resolvedWorkspace });
    const readonly: ToolsInput = {};
    for (const name of GOAL_JUDGE_READONLY_TOOLS) {
      if (allTools[name]) readonly[name] = allTools[name];
    }
    return Object.keys(readonly).length > 0 ? readonly : undefined;
  };
}

export { GOAL_JUDGE_READONLY_TOOLS };
