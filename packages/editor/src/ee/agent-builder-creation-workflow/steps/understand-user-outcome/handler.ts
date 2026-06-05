import type { Agent } from '@mastra/core/agent';

import { userOutcomeSchema, type UserOutcome } from '../../types';

/**
 * Resolve the structured user outcome from the raw user prompt. Asks the
 * injected agent to interpret the prompt and produce an LLM-understandable
 * outcome (goal, audience, capabilities, tone, success criteria) that downstream
 * steps consume to produce qualitative results.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and the raw prompt, never a workflow `ctx`.
 */
export async function resolveUserOutcome(agent: Agent, prompt: string): Promise<UserOutcome> {
  const result = await agent.generate(
    `Interpret this request for an AI agent and produce the structured user outcome:\n\n${prompt}`,
    { structuredOutput: { schema: userOutcomeSchema } },
  );
  return result.object;
}
