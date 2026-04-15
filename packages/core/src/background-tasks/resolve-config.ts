import type {
  AgentBackgroundConfig,
  AgentBackgroundToolConfig,
  BackgroundTaskManagerConfig,
  LLMBackgroundOverride,
  ToolBackgroundConfig,
} from './types';

export interface ResolvedBackgroundConfig {
  runInBackground: boolean;
  timeoutMs: number;
  maxRetries: number;
}

/**
 * Resolves whether a tool call should run in the background, and with what config.
 *
 * Resolution order (highest to lowest priority):
 * 1. LLM per-call override (`_background` field in tool args)
 * 2. Agent-level backgroundTasks.tools config
 * 3. Tool-level background config
 * 4. Default: foreground
 *
 * Strips the `_background` field from args (mutates the args object).
 */
export function resolveBackgroundConfig({
  llmBgOverrides,
  toolName,
  toolConfig,
  agentConfig,
  managerConfig,
}: {
  llmBgOverrides: Record<string, unknown>;
  toolName: string;
  toolConfig?: ToolBackgroundConfig;
  agentConfig?: AgentBackgroundConfig;
  managerConfig?: BackgroundTaskManagerConfig;
}): ResolvedBackgroundConfig {
  const llmOverride = llmBgOverrides as LLMBackgroundOverride | undefined;

  // If this agent has background tasks disabled, short-circuit so no tool can
  // dispatch a background task even if its own config or the LLM override
  // would otherwise enable it. Default timeoutMs/maxRetries are still returned
  // so callers can use the shape safely.
  if (agentConfig?.disabled) {
    return {
      runInBackground: false,
      timeoutMs: managerConfig?.defaultTimeoutMs ?? 300_000,
      maxRetries: managerConfig?.defaultRetries?.maxRetries ?? 0,
    };
  }

  // Resolve agent-level config for this specific tool
  const agentToolConfig = resolveAgentToolConfig(toolName, agentConfig);

  // --- enabled ---
  const enabled = llmOverride?.enabled ?? agentToolConfig?.enabled ?? toolConfig?.enabled ?? false;

  // --- timeoutMs ---
  const timeoutMs =
    llmOverride?.timeoutMs ??
    agentToolConfig?.timeoutMs ??
    toolConfig?.timeoutMs ??
    managerConfig?.defaultTimeoutMs ??
    300_000;

  // --- maxRetries ---
  const maxRetries =
    llmOverride?.maxRetries ?? toolConfig?.maxRetries ?? managerConfig?.defaultRetries?.maxRetries ?? 0;

  return { runInBackground: enabled, timeoutMs, maxRetries };
}

function resolveAgentToolConfig(
  toolName: string,
  agentConfig?: AgentBackgroundConfig,
): { enabled: boolean; timeoutMs?: number } | undefined {
  if (!agentConfig?.tools) return undefined;

  if (agentConfig.tools === 'all') {
    return { enabled: true };
  }

  if (toolName.startsWith('agent-')) {
    toolName = toolName.substring('agent-'.length);
  } else if (toolName.startsWith('workflow-')) {
    toolName = toolName.substring('workflow-'.length);
  }

  const entry: AgentBackgroundToolConfig | undefined = agentConfig.tools[toolName];
  if (entry === undefined) return undefined;
  if (typeof entry === 'boolean') return { enabled: entry };
  return entry;
}
