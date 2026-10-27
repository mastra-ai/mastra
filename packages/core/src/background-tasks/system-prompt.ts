import {
  isModelBackgroundOverrideAllowed,
  isToolBackgroundEligible,
  resolveDefaultDisposition,
} from './resolve-config';
import type { AgentBackgroundConfig, ToolBackgroundConfig } from './types';

/**
 * Tool shape accepted by the prompt generator. Callers may pass raw `Tool`s
 * (config on `background`) or converted `CoreTool`s (config on
 * `backgroundConfig`); both are honored.
 */
export interface BackgroundPromptTool {
  background?: ToolBackgroundConfig;
  backgroundConfig?: ToolBackgroundConfig;
  description?: string;
}

/**
 * Generates the system prompt section that tells the LLM about background task capabilities.
 *
 * Only tools that `resolveBackgroundConfig` could actually dispatch to the
 * background are listed (agent-level opt-in, falling back to tool-level
 * config — see `isToolBackgroundEligible`). Tools with `modelOverrides: false`
 * are listed without `_background` instructions. Returns undefined if no tools
 * are listed (nothing to inject).
 */
export function generateBackgroundTaskSystemPrompt(
  tools: Record<string, BackgroundPromptTool>,
  agentConfig?: AgentBackgroundConfig,
): string | undefined {
  const eligibleTools: {
    toolName: string;
    defaultDisposition: 'foreground' | 'deferred';
    allowsOverride: boolean;
  }[] = [];

  for (const [toolName, tool] of Object.entries(tools)) {
    const toolConfig = tool.backgroundConfig ?? tool.background;
    if (!isToolBackgroundEligible({ toolName, toolConfig, agentConfig })) continue;
    const defaultDisposition = resolveDefaultDisposition({ toolName, toolConfig, agentConfig });
    const allowsOverride = isModelBackgroundOverrideAllowed({ toolName, toolConfig, agentConfig });
    // A foreground-default tool the model can't override never runs in the
    // background, so there is nothing to tell the model about it.
    if (!allowsOverride && defaultDisposition === 'foreground') continue;
    eligibleTools.push({ toolName, defaultDisposition, allowsOverride });
  }

  if (eligibleTools.length === 0) {
    return undefined;
  }

  // Each eligible tool advertises the disposition it resolves to when the
  // call carries no `_background` override: 'deferred' defaults show as
  // "default: background", while 'foreground' defaults require an explicit
  // per-call opt-in. Tools without model overrides always run in the background.
  const toolLines = eligibleTools
    .map(({ toolName, defaultDisposition, allowsOverride }) =>
      !allowsOverride
        ? `- ${toolName} (always runs in the background)`
        : defaultDisposition === 'deferred'
          ? `- ${toolName} (default: background)`
          : `- ${toolName} (default: foreground — opt in with "_background")`,
    )
    .join('\n');

  const intro = `You have the ability to run certain tools in the background while continuing the conversation. The following tools support background execution:
${toolLines}`;

  if (!eligibleTools.some(tool => tool.allowsOverride)) {
    return `${intro}

These tools run in the background: you receive a placeholder result with a task ID and are notified when the task completes. You can reference the task ID in your response to the user.`;
  }

  const fixedNote = eligibleTools.some(tool => !tool.allowsOverride)
    ? `\n\nTools marked "always runs in the background" do not accept "_background".`
    : '';

  return `${intro}

For any of these tools, you can include a "_background" field in the tool arguments to override the default:
  "_background": { "disposition": "foreground" | "deferred" | "awaited", "timeoutMs": number, "maxRetries": number }

All fields in "_background" are optional. Only include what you want to override. Tools listed with "default: background" run in the background unless you set "disposition": "foreground". Tools listed with "default: foreground" run inline unless you explicitly request "deferred" or "awaited" — for those tools, omitting "_background" never starts background work.${fixedNote}

Dispositions:
- "deferred": the tool runs in the background while you continue; you receive a placeholder result with a task ID and are notified when the task completes.
- "awaited": the tool runs as a durable background task but your run waits for its result before continuing.
- "foreground": the tool runs inline and returns its real result immediately.

Guidelines:
- Use background execution when the user doesn't need the result immediately, or when you're launching multiple independent tasks.
- Use foreground execution when the user is directly waiting for the result and the conversation can't continue without it.
- When a tool runs deferred, you'll receive a placeholder result with a task ID. You can reference this in your response to the user.

IMPORTANT: "_background" field is always an object. The fields in the _background field should be inside the _background object, not outside of it.`;
}
