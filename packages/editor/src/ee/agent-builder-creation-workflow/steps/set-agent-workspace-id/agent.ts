import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../../constant';
import type { AgentFactoryArgs } from '../../types';

/**
 * Agent that selects at most one workspace the agent should attach to.
 */
export const createWorkspaceAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-workspace-agent',
    name: 'Agent Builder Workspace Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You select at most one workspace an AI agent should be attached to.',
      'Only choose a workspace from the provided available list, identified by its id.',
      'If none of the available workspaces is appropriate, return an empty value.',
    ].join(' '),
  });
