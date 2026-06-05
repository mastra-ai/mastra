import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../../constant';
import type { AgentFactoryArgs } from '../../types';

/**
 * Agent that writes a single plain-language sentence describing what the agent
 * helps the user accomplish.
 */
export const createDescriptionAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-description-agent',
    name: 'Agent Builder Description Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You write a one-sentence, plain-language description of what an AI agent helps a user accomplish.',
      'Keep it concise, outcome-focused, and free of jargon or marketing language.',
      'Return a single sentence with no leading label, bullet, or quotes.',
    ].join(' '),
  });
