import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

const instructionsSchema = z.object({
  instructions: z.string().min(1).describe('A focused, production-quality system prompt for the agent'),
});

/**
 * Resolve the agent instructions (system prompt). Uses explicit instructions
 * when provided (no LLM call), otherwise asks the injected agent to author a
 * focused system prompt from the name and description.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveInstructions(
  agent: Agent,
  name: string,
  description: string,
  explicitInstructions?: string,
): Promise<string> {
  if (typeof explicitInstructions === 'string') {
    return explicitInstructions;
  }

  const result = await agent.generate(
    `Write the system prompt for an agent.\n\nName: ${name}\nDescription: ${description}`,
    { structuredOutput: { schema: instructionsSchema } },
  );
  return result.object.instructions;
}
