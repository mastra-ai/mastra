import type { AgentBackgroundConfig, ToolBackgroundConfig } from './types';

/**
 * Generates the system prompt section that tells the LLM about background task capabilities.
 *
 * Returns undefined if no tools are background-eligible (nothing to inject).
 */
export function generateBackgroundTaskSystemPrompt(
  tools: Record<string, { background?: ToolBackgroundConfig; description?: string }>,
  agentConfig?: AgentBackgroundConfig,
): string | undefined {
  const eligibleToolNames: string[] = [];

  for (const [toolName, tool] of Object.entries(tools)) {
    const agentToolConfig = agentConfig?.tools === 'all' ? true : agentConfig?.tools?.[toolName];
    const eligible =
      typeof agentToolConfig === 'boolean'
        ? agentToolConfig
        : (agentToolConfig?.enabled ?? tool.background?.enabled ?? false);

    if (eligible) {
      eligibleToolNames.push(toolName);
    }
  }

  if (eligibleToolNames.length === 0) {
    return undefined;
  }

  const toolLines = eligibleToolNames.map(toolName => `- ${toolName} (default: foreground)`).join('\n');

  return `You have the ability to run certain tools in the background while continuing the conversation. The following tools support background execution:
${toolLines}

Background execution is always per-call opt-in. To request it, include a "_background" field in the tool arguments:
  "_background": { "disposition": "deferred" | "awaited", "timeoutMs": number, "maxRetries": number }

Use "foreground" or omit "_background" to run the call in the foreground. All fields in "_background" are optional, but omitting the field never starts background work.

Guidelines:
- Use background execution when the user doesn't need the result immediately, or when you're launching multiple independent tasks.
- Use foreground execution when the user is directly waiting for the result and the conversation can't continue without it.
- When a tool runs in the background, you'll receive a placeholder result with a task ID. You can reference this in your response to the user.

IMPORTANT: "_background" is always an object. Its fields must be inside that object, not outside it.`;
}
