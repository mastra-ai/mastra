import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

import type { UserOutcome } from '../../types';
import { formatUserOutcome } from '../../user-outcome';

const descriptionSchema = z.object({
  description: z.string().min(1).describe('A one-sentence, plain-language description of what the agent helps with'),
});

/**
 * Resolve the agent description: a short, one-line summary of what the agent
 * helps with, produced by the injected agent from the raw prompt and the
 * structured user outcome.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveDescription(
  agent: Agent,
  description: string,
  userOutcome?: UserOutcome,
): Promise<string> {
  const result = await agent.generate(
    `Describe, in one plain sentence, an agent for:\n\n${description}${formatUserOutcome(userOutcome)}`,
    { structuredOutput: { schema: descriptionSchema } },
  );
  return result.object.description.trim();
}
