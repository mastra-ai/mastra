import { Agent } from '@mastra/core/agent';

import { AGENT_GENERATION_MODEL_SETTINGS } from '../../constant';
import type { AgentFactoryArgs } from '../../types';

/**
 * Agent that turns a raw, plain-language user prompt into a structured user
 * outcome. Tightly scoped: it reads what the user wrote and infers the goal,
 * audience, capabilities, tone, and success criteria so later steps can produce
 * something qualitative that matches the user's expectations.
 */
export const createUserOutcomeAgent = ({ model }: AgentFactoryArgs) =>
  new Agent({
    id: 'agent-builder-user-outcome-agent',
    name: 'Agent Builder User Outcome Agent',
    model,
    defaultOptions: { modelSettings: AGENT_GENERATION_MODEL_SETTINGS },
    instructions: [
      'You interpret a plain-language prompt describing an AI agent someone wants to build.',
      'Distill it into a structured user outcome: the single goal, the target audience, the concrete capabilities needed, the tone/persona, and observable success criteria.',
      'Stay faithful to what the user wrote — infer only what is strongly implied, never invent unrelated scope.',
      'Be concrete and outcome-focused so downstream steps can name, describe, and instruct the agent against real expectations.',
    ].join(' '),
  });
