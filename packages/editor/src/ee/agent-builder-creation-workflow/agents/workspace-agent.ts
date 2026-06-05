import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../constant';
import type { AgentFactoryArgs } from './types';

/**
 * Agent that confirms / normalizes the workspace id the agent should attach to.
 */
export const createWorkspaceAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-workspace-agent',
    name: 'Agent Builder Workspace Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You confirm and normalize the workspace id an AI agent should be attached to.',
      'Return the provided workspace id trimmed of surrounding whitespace.',
      'If no usable workspace id is given, return an empty value.',
    ].join(' '),
  });
