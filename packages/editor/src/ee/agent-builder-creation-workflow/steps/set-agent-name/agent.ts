import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../../constant';
import type { AgentFactoryArgs } from '../../types';

/**
 * Agent that names an agent from a plain-language description. Tightly scoped:
 * it does one thing — produce a short, memorable, outcome-anchored name.
 */
export const createNameAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-name-agent',
    name: 'Agent Builder Name Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You name AI agents from a plain-language description of what the agent does.',
      'Produce one short, memorable, Title Case name (2-4 words).',
      'Anchor the name on the outcome the agent delivers, not on jargon.',
      'Do not add quotes, punctuation, or trailing words like "Agent" or "Bot" unless it reads naturally.',
    ].join(' '),
  });
