import type { AgentBackgroundConfig, ToolBackgroundConfig } from './types';

interface ToolEntry {
  toolName: string;
  toolConfig?: ToolBackgroundConfig;
  /** Whether the tool defaults to background execution */
  defaultBackground: boolean;
}

/**
 * Generates the system prompt section that tells the LLM about background task capabilities.
 *
 * Returns undefined if no tools are background-eligible (nothing to inject).
 */
export function generateBackgroundTaskSystemPrompt(
  tools: Record<string, { background?: ToolBackgroundConfig; description?: string }>,
  agentConfig?: AgentBackgroundConfig,
): string | undefined {
  const eligibleTools: ToolEntry[] = [];

  const enableAll = agentConfig?.tools === 'all';

  for (const [toolName, tool] of Object.entries(tools)) {
    const bgEnabledFromAgentConfig =
      agentConfig?.tools === 'all'
        ? false
        : typeof agentConfig?.tools?.[toolName] === 'boolean'
          ? agentConfig.tools[toolName]
          : (agentConfig?.tools?.[toolName]?.enabled ?? false);
    eligibleTools.push({
      toolName,
      toolConfig: tool.background,
      defaultBackground: enableAll ? true : (bgEnabledFromAgentConfig ?? tool.background?.enabled ?? false),
    });
  }

  if (eligibleTools.length === 0) {
    return undefined;
  }

  const toolLines = eligibleTools
    .map(t => `- ${t.toolName} (default: ${t.defaultBackground ? 'background' : 'foreground'})`)
    .join('\n');

  return `You have the ability to run certain tools in the background while continuing the conversation. The following tools support background execution:
${toolLines}

For any of these tools, you can include a "_background" field in the tool arguments to override the default:
  "_background": { "enabled": true/false, "timeoutMs": number, "maxRetries": number }

All fields in "_background" are optional. Only include what you want to override.

Guidelines:
- Use background execution when the user doesn't need the result immediately, or when you're launching multiple independent tasks.
- Use foreground execution when the user is directly waiting for the result and the conversation can't continue without it.
- If you don't include "_background", the tool's default configuration is used.
- When a tool runs in the background, you'll receive a placeholder result with a task ID. You can reference this in your response to the user.`;
}
