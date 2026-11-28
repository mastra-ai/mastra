import type {
  AgentBackgroundConfig,
  AgentBackgroundToolConfig,
  BackgroundExecutionDisposition,
  BackgroundTaskManagerConfig,
  LLMBackgroundOverride,
  ToolBackgroundConfig,
} from './types';

export interface ResolvedBackgroundConfig {
  runInBackground: boolean;
  disposition: BackgroundExecutionDisposition;
  timeoutMs: number;
  maxRetries: number;
}

/**
 * Resolves whether a tool call should run in the background, and with what config.
 *
 * Resolution order (highest to lowest priority):
 * 1. LLM per-call override (`_background` field in tool args), unless the
 *    tool or agent sets `modelOverrides: false`
 * 2. Agent-level backgroundTasks.tools config
 * 3. Tool-level background config
 * 4. Default for eligible tools: the configured `defaultDisposition`
 *    (deferred when unset); non-eligible tools always run foreground
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
  // If this agent has background tasks disabled, short-circuit so no tool can
  // dispatch a background task even if its own config or the LLM override
  // would otherwise enable it. Default timeoutMs/maxRetries are still returned
  // so callers can use the shape safely.
  if (agentConfig?.disabled) {
    return {
      runInBackground: false,
      disposition: 'foreground',
      timeoutMs: managerConfig?.defaultTimeoutMs ?? 300_000,
      maxRetries: managerConfig?.defaultRetries?.maxRetries ?? 0,
    };
  }

  // Resolve agent-level config for this specific tool
  const agentToolConfig = resolveAgentToolConfig(toolName, agentConfig);

  // Tools that disallow model overrides never advertise `_background`, so
  // ignore one if the model sends it anyway. See issue #28638.
  const llmOverride = isModelBackgroundOverrideAllowed({ toolName, toolConfig, agentConfig })
    ? (llmBgOverrides as LLMBackgroundOverride | undefined)
    : undefined;

  // --- disposition ---
  // Tool and agent config gate eligibility. A non-eligible tool always runs
  // foreground regardless of what the model emits, so `agent.generate()` /
  // `agent.stream()` keep returning real tool results for deterministic
  // tools. See issue #16783.
  //
  // For eligible tools, the `_background` override wins; when omitted, the
  // configured `defaultDisposition` applies. It defaults to 'deferred' so an
  // eligible tool without further config runs in the background. Set
  // `defaultDisposition: 'foreground'` to make eligibility grant only the
  // per-call option.
  const baseEnabled = agentToolConfig?.enabled ?? toolConfig?.enabled ?? false;
  const defaultDisposition = resolveDefaultDisposition({ toolName, toolConfig, agentConfig });
  const requestedDisposition =
    llmOverride?.disposition ??
    (llmOverride?.enabled === false ? 'foreground' : llmOverride?.enabled === true ? 'deferred' : defaultDisposition);
  const disposition: BackgroundExecutionDisposition = baseEnabled ? requestedDisposition : 'foreground';

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

  return { runInBackground: disposition !== 'foreground', disposition, timeoutMs, maxRetries };
}

/**
 * Whether a tool is background-eligible: i.e. whether `resolveBackgroundConfig`
 * could ever dispatch it to the background. This is the same base-enabled
 * expression the runtime resolver uses (the LLM `_background` override is a
 * modifier only, never a standalone opt-in — see issue #16783), so advertising
 * paths (schema injection, system prompt) and dispatch cannot disagree.
 */
export function isToolBackgroundEligible({
  toolName,
  toolConfig,
  agentConfig,
}: {
  toolName: string;
  toolConfig?: ToolBackgroundConfig;
  agentConfig?: AgentBackgroundConfig;
}): boolean {
  if (agentConfig?.disabled) return false;
  const agentToolConfig = resolveAgentToolConfig(toolName, agentConfig);
  return agentToolConfig?.enabled ?? toolConfig?.enabled ?? false;
}

/**
 * The disposition an eligible tool resolves to when a call carries no
 * `_background` override. Mirrors the fallback chain in
 * `resolveBackgroundConfig` so advertising paths (system prompt) and dispatch
 * cannot disagree.
 */
export function resolveDefaultDisposition({
  toolName,
  toolConfig,
  agentConfig,
}: {
  toolName: string;
  toolConfig?: ToolBackgroundConfig;
  agentConfig?: AgentBackgroundConfig;
}): 'foreground' | 'deferred' {
  const agentToolConfig = resolveAgentToolConfig(toolName, agentConfig);
  return agentToolConfig?.defaultDisposition ?? toolConfig?.defaultDisposition ?? 'deferred';
}

/**
 * Whether the model may override background execution per call via
 * `_background`. Schema injection, the system prompt, and dispatch all use
 * this so they cannot disagree. Agent per-tool config wins over tool config;
 * defaults to true. See issue #28638.
 */
export function isModelBackgroundOverrideAllowed({
  toolName,
  toolConfig,
  agentConfig,
}: {
  toolName: string;
  toolConfig?: ToolBackgroundConfig;
  agentConfig?: AgentBackgroundConfig;
}): boolean {
  const agentToolConfig = resolveAgentToolConfig(toolName, agentConfig);
  return agentToolConfig?.modelOverrides ?? toolConfig?.modelOverrides ?? true;
}

/**
 * Drops a model-supplied `_background` override from tool arguments when the
 * tool's resolved policy disallows model overrides (#31614, #31612).
 *
 * Returns the arguments unchanged unless all three hold: the tool is
 * background-eligible, its resolved `modelOverrides` policy is `false`, and the
 * arguments carry their own `_background` key. In that case it returns a
 * shallow copy without `_background`, so model input is never mutated and the
 * later extraction for allowed calls is unaffected. A domain argument named
 * `_background` on an ineligible or ordinary tool is left intact.
 */
export function sanitizeToolArguments({
  args,
  toolName,
  toolConfig,
  agentConfig,
}: {
  args: Record<string, unknown>;
  toolName: string;
  toolConfig?: ToolBackgroundConfig;
  agentConfig?: AgentBackgroundConfig;
}): Record<string, unknown> {
  if (!Object.hasOwn(args, '_background')) return args;
  if (!isToolBackgroundEligible({ toolName, toolConfig, agentConfig })) return args;
  if (isModelBackgroundOverrideAllowed({ toolName, toolConfig, agentConfig })) return args;

  const sanitized = { ...args };
  delete sanitized._background;
  return sanitized;
}

function resolveAgentToolConfig(
  toolName: string,
  agentConfig?: AgentBackgroundConfig,
): Exclude<AgentBackgroundToolConfig, boolean> | undefined {
  if (!agentConfig?.tools) return undefined;

  if (agentConfig.tools === 'all') {
    return {
      enabled: true,
      defaultDisposition: agentConfig.defaultDisposition,
      modelOverrides: agentConfig.modelOverrides,
    };
  }

  if (toolName.startsWith('agent-')) {
    toolName = toolName.substring('agent-'.length);
  } else if (toolName.startsWith('workflow-')) {
    toolName = toolName.substring('workflow-'.length);
  }

  const entry: AgentBackgroundToolConfig | undefined = agentConfig.tools[toolName];
  if (entry === undefined) return undefined;

  // Agent-wide `defaultDisposition`/`modelOverrides` act as defaults for this
  // entry; a value the entry sets itself wins. `enabled` is never inherited, so
  // an agent-wide field can't make an unlisted or false tool eligible.
  const resolved: Exclude<AgentBackgroundToolConfig, boolean> = typeof entry === 'boolean' ? { enabled: entry } : entry;
  return {
    ...resolved,
    defaultDisposition: resolved.defaultDisposition ?? agentConfig.defaultDisposition,
    modelOverrides: resolved.modelOverrides ?? agentConfig.modelOverrides,
  };
}
