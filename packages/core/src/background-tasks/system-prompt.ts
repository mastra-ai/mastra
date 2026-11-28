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
 * Effective prompt policy for a single tool:
 *
 * - `background`: supports background execution and runs deferred by default,
 *   so the model can pull a call back to the foreground with `_background`.
 * - `foreground`: supports background execution but runs inline by default, so
 *   the model must opt in per call with `_background`.
 * - `fixed`: supports background execution but never accepts `_background`, so
 *   there is nothing for the model to configure.
 */
type ToolPromptPolicy = 'background' | 'foreground' | 'fixed';

const POLICY_LINE: Record<ToolPromptPolicy, (toolName: string) => string> = {
  background: toolName => `- ${toolName} (default: background)`,
  foreground: toolName => `- ${toolName} (default: foreground — opt in with "_background")`,
  fixed: toolName => `- ${toolName} (always runs in the background)`,
};

const LIST_ORDER: ToolPromptPolicy[] = ['background', 'foreground', 'fixed'];

const OVERRIDE_SHAPE =
  '"_background": { "disposition": "foreground" | "deferred" | "awaited", "timeoutMs": number, "maxRetries": number }';

const DISPOSITIONS = `Dispositions:
- "deferred": the tool runs in the background while you continue; you receive a placeholder result with a task ID and are notified when the task completes.
- "awaited": the tool runs as a durable background task but your run waits for its result before continuing.
- "foreground": the tool runs inline and returns its real result immediately.`;

const GUIDELINES = `Guidelines:
- Use background execution when the user doesn't need the result immediately, or when you're launching multiple independent tasks.
- Use foreground execution when the user is directly waiting for the result and the conversation can't continue without it.
- When a tool runs deferred, you'll receive a placeholder result with a task ID. You can reference this in your response to the user.`;

const EMPTY_FIELD_NOTE =
  'IMPORTANT: "_background" field is always an object. The fields in the _background field should be inside the _background object, not outside of it.';

const PLACEHOLDER_NOTE =
  'you receive a placeholder result with a task ID and are notified when the task completes. You can reference the task ID in your response to the user.';

/** Where the model is told it may pass `_background`, phrased for the tools that accept it. */
function describeAcceptingTools(policies: Set<ToolPromptPolicy>, uniform: boolean): string {
  if (uniform) return 'For any tool,';
  const listed = LIST_ORDER.filter(policy => policy !== 'fixed' && policies.has(policy)).map(
    policy => `"default: ${policy}"`,
  );
  const joined = listed.length > 1 ? `${listed.slice(0, -1).join(', ')} or ${listed[listed.length - 1]}` : listed[0];
  return `For the tools listed with ${joined},`;
}

/**
 * Explains what omitting `_background` means for each accepting policy, so the
 * model never reads a blanket "you can override anything" instruction.
 */
function describeDefaults(policies: Set<ToolPromptPolicy>, uniform: boolean): string {
  const sentences: string[] = [];
  if (policies.has('background')) {
    sentences.push(
      uniform
        ? 'Tools run in the background unless you set "disposition": "foreground".'
        : 'Tools listed with "default: background" run in the background unless you set "disposition": "foreground".',
    );
  }
  if (policies.has('foreground')) {
    sentences.push(
      uniform
        ? 'Tools run inline unless you explicitly request "deferred" or "awaited" — omitting "_background" never starts background work.'
        : 'Tools listed with "default: foreground" run inline unless you explicitly request "deferred" or "awaited" — omitting "_background" never starts background work.',
    );
  }
  return sentences.length > 0 ? ` ${sentences.join(' ')}` : '';
}

/**
 * Generates the system prompt section that tells the LLM about background task capabilities.
 *
 * Only tools that `resolveBackgroundConfig` could actually dispatch to the
 * background are listed (agent-level opt-in, falling back to tool-level
 * config — see `isToolBackgroundEligible`). Tools with `modelOverrides: false`
 * never accept `_background`, so they are described without override
 * instructions. Returns undefined if no tools are listed (nothing to inject).
 *
 * When `tools: 'all'` opts every tool in and they all resolve to one policy,
 * the guidance names no tools at all. That keeps the text identical however
 * many tools the agent has, so a large uniform tool set neither grows the
 * prompt one line per tool nor churns the prompt cache (issue #31614).
 */
export function generateBackgroundTaskSystemPrompt(
  tools: Record<string, BackgroundPromptTool>,
  agentConfig?: AgentBackgroundConfig,
): string | undefined {
  const policies = new Map<string, ToolPromptPolicy>();

  for (const [toolName, tool] of Object.entries(tools)) {
    const toolConfig = tool.backgroundConfig ?? tool.background;
    if (!isToolBackgroundEligible({ toolName, toolConfig, agentConfig })) continue;
    const defaultDisposition = resolveDefaultDisposition({ toolName, toolConfig, agentConfig });
    const allowsOverride = isModelBackgroundOverrideAllowed({ toolName, toolConfig, agentConfig });
    // A foreground-default tool the model can't override never runs in the
    // background, so there is nothing to tell the model about it.
    if (!allowsOverride && defaultDisposition === 'foreground') continue;
    policies.set(toolName, !allowsOverride ? 'fixed' : defaultDisposition === 'deferred' ? 'background' : 'foreground');
  }

  if (policies.size === 0) {
    return undefined;
  }

  const uniformPolicies = new Set(policies.values());
  const uniform =
    agentConfig?.tools === 'all' && policies.size === Object.keys(tools).length && uniformPolicies.size === 1;

  const acceptedPolicies = new Set([...uniformPolicies].filter(policy => policy !== 'fixed'));
  const acceptsOverride = acceptedPolicies.size > 0;
  const hasFixed = uniformPolicies.has('fixed');

  const listing = uniform
    ? ''
    : `The following tools support background execution:\n${LIST_ORDER.flatMap(policy =>
        [...policies.entries()]
          .filter(([, toolPolicy]) => toolPolicy === policy)
          .map(([toolName]) => POLICY_LINE[policy](toolName)),
      ).join('\n')}`;

  const intro = uniform
    ? `You have the ability to run tools in the background while continuing the conversation. Every tool supports background execution.`
    : `You have the ability to run certain tools in the background while continuing the conversation. ${listing}`;

  if (!acceptsOverride) {
    const subject = uniform ? 'Every tool runs' : 'These tools run';
    return `${intro}

${subject} in the background: ${PLACEHOLDER_NOTE}`;
  }

  const overrideSection = `${describeAcceptingTools(acceptedPolicies, uniform)} you can include a "_background" field in the tool arguments to override the default:
  ${OVERRIDE_SHAPE}

All fields in "_background" are optional. Only include what you want to override.${describeDefaults(
    acceptedPolicies,
    uniform,
  )}${hasFixed ? `\n\nTools marked "always runs in the background" do not accept "_background".` : ''}`;

  return `${intro}

${overrideSection}

${DISPOSITIONS}

${GUIDELINES}

${EMPTY_FIELD_NOTE}`;
}
