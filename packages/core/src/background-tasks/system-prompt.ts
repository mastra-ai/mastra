import { resolveBackgroundConfig } from './resolve-config';
import type { AgentBackgroundConfig, ToolBackgroundConfig } from './types';

interface ToolEntry {
  toolName: string;
  toolConfig?: ToolBackgroundConfig;
}

/**
 * Generates the system prompt section that tells the LLM about background task capabilities.
 *
 * Only tools that can actually reach the background are listed. `_background` is
 * a modifier on a prior tool- or agent-level opt-in, not a standalone opt-in
 * (#16792), so for any other tool every field of `_background` is a no-op and
 * listing it advertises a capability the resolver refuses to honor.
 *
 * Returns undefined if no tools are background-eligible (nothing to inject).
 */
export function generateBackgroundTaskSystemPrompt(
  tools: Record<string, { backgroundConfig?: ToolBackgroundConfig; description?: string }>,
  agentBackgroundConfig?: AgentBackgroundConfig,
): string | undefined {
  const eligibleTools: ToolEntry[] = [];

  for (const [toolName, tool] of Object.entries(tools)) {
    // `resolveBackgroundConfig` owns the whole decision — the `agent-` /
    // `workflow-` prefix normalization, the three-state agent-level lookup
    // (unset vs. explicitly off vs. on), the tool-level fallback, `'all'`, and
    // the per-agent `disabled` short-circuit. Re-deriving any of it here is
    // what made this prompt report the inverse of the configuration for
    // sub-agent and workflow tools.
    const { runInBackground } = resolveBackgroundConfig({
      llmBgOverrides: {},
      toolName,
      toolConfig: tool.backgroundConfig,
      agentConfig: agentBackgroundConfig,
    });

    if (!runInBackground) continue;

    eligibleTools.push({ toolName, toolConfig: tool.backgroundConfig });
  }

  if (eligibleTools.length === 0) {
    return undefined;
  }

  // Every listed tool is opted in, and an opted-in tool defaults to background
  // (the LLM override can only pull it back to the foreground), so the default
  // is the same for all of them.
  const toolLines = eligibleTools.map(t => `- ${t.toolName} (default: background)`).join('\n');

  return `You have the ability to run certain tools in the background while continuing the conversation. The following tools support background execution:
${toolLines}

For any of these tools, you can include a "_background" field in the tool arguments to override the default:
  "_background": { "enabled": true/false, "timeoutMs": number, "maxRetries": number }

All fields in "_background" are optional. Only include what you want to override.

Guidelines:
- Use background execution when the user doesn't need the result immediately, or when you're launching multiple independent tasks.
- Use foreground execution when the user is directly waiting for the result and the conversation can't continue without it.
- If you don't include "_background", the tool's default configuration is used.
- When a tool runs in the background, you'll receive a placeholder result with a task ID. You can reference this in your response to the user.

IMPORTANT: "_background" field is always an object. The fields in the _background field should be inside the _background object, not outside of it.`;
}
