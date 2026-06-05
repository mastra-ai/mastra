import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../constant';
import type { AgentFactoryArgs } from './types';

/**
 * Agent that selects the minimum set of available tools/agents/workflows the
 * agent needs to achieve its outcome.
 */
export const createToolsAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-tools-agent',
    name: 'Agent Builder Tools Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You select which of the available tools, agents, and workflows an AI agent should be granted.',
      'Choose the minimum set required to achieve the agent\'s outcome — prefer fewer over more.',
      'Only select entries from the provided available list, identified by their id.',
    ].join(' '),
  });
