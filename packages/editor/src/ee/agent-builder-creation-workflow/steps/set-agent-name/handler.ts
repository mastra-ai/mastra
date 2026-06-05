import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

import type { UserOutcome } from '../../types';
import { formatUserOutcome } from '../../user-outcome';

const nameSchema = z.object({
  name: z.string().min(1).describe('A short, memorable, Title Case agent name (2-4 words)'),
});

/**
 * Resolve the agent name. Uses an explicit name when provided (no LLM call),
 * otherwise asks the injected agent to name the agent from the description.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveName(
  agent: Agent,
  description: string,
  explicitName?: string,
  userOutcome?: UserOutcome,
): Promise<string> {
  const trimmed = explicitName?.trim();
  if (trimmed) {
    return trimmed;
  }

  const result = await agent.generate(`Name an agent described as:\n\n${description}${formatUserOutcome(userOutcome)}`, {
    structuredOutput: { schema: nameSchema },
  });
  return result.object.name.trim();
}
