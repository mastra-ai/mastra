import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../constant';
import type { AgentFactoryArgs } from './types';

/**
 * Agent that chooses an appropriate `{ provider, name }` model for the agent
 * from the available candidates.
 */
export const createModelAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-model-agent',
    name: 'Agent Builder Model Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You choose an appropriate model for an AI agent as a { provider, name } pair.',
      'Pick from the provided available models when a candidate list is given.',
      'Favor a capable general-purpose model unless the agent\'s outcome calls for something specialized.',
    ].join(' '),
  });
