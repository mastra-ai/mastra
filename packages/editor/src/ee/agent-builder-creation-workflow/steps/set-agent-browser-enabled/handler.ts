import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

const browserSchema = z.object({
  browserEnabled: z.boolean().describe('Whether the agent needs browser access to achieve its outcome'),
});

/**
 * Resolve whether browser access is enabled for the agent. Uses the explicit
 * value when provided (no LLM call), otherwise asks the injected agent to decide
 * from the agent's description.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveBrowserEnabled(agent: Agent, description: string, browserEnabled?: boolean) {
  if (typeof browserEnabled === 'boolean') {
    return browserEnabled;
  }

  const result = await agent.generate(
    `Does an agent for the following need browser access?\n\n${description}`,
    { structuredOutput: { schema: browserSchema } },
  );
  return result.object.browserEnabled;
}
