import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../../constant';
import type { AgentFactoryArgs } from '../../types';

/**
 * Agent that selects the minimum set of relevant stored skills for the agent.
 */
export const createSkillsAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-skills-agent',
    name: 'Agent Builder Skills Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You select which of the available stored skills an AI agent should be attached to.',
      'Choose only skills relevant to the agent\'s outcome — prefer the minimum set.',
      'Only select skills from the provided available list, identified by their id.',
    ].join(' '),
  });
