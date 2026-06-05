import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../../constant';
import type { AgentFactoryArgs } from '../../types';

/**
 * Agent that authors a focused, production-quality system prompt for the agent
 * being built, from its name and description.
 */
export const createInstructionsAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-instructions-agent',
    name: 'Agent Builder Instructions Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You author the system prompt (instructions) for an AI agent given its name and description.',
      'Write a focused, production-quality prompt: state the role, the outcome to deliver, how to behave, and what to avoid.',
      'Prefer clear, direct guidance. Make reasonable assumptions and avoid asking unnecessary follow-up questions.',
      'Return only the prompt text, with no surrounding commentary or code fences.',
    ].join(' '),
  });
