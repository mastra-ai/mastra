/**
 * LLM Test Helpers
 *
 * Common utilities for LLM integration tests.
 * These helpers reduce boilerplate across test files.
 */

/**
 * Model configuration type from @mastra/core/llm
 * Re-declared here to avoid circular dependencies
 */
export type MastraModelConfig = string | { modelId?: string; specificationVersion?: string; [key: string]: unknown };

/**
 * Minimal interface for Agent-like objects.
 * Uses structural typing to avoid private field compatibility issues
 * that occur when importing the actual Agent class across package boundaries.
 */
export interface AgentLike {
  generate(message: unknown, options?: unknown): Promise<unknown>;
  generateLegacy?(message: unknown, options?: unknown): Promise<unknown>;
  stream(message: unknown, options?: unknown): Promise<unknown>;
  streamLegacy?(message: unknown, options?: unknown): Promise<unknown>;
}

/**
 * Convert a model configuration to a recording-safe filename.
 *
 * Handles:
 * - String models like "openai/gpt-4o" -> "openai-gpt-4o"
 * - SDK models with modelId -> "gpt-4o"
 * - SDK models with specificationVersion -> "sdk-v2"
 *
 * @example
 * ```typescript
 * const name = getModelRecordingName('openai/gpt-4o-mini');
 * // Returns: "openai-gpt-4o-mini"
 *
 * const name = getModelRecordingName(openai('gpt-4o'));
 * // Returns: "gpt-4o"
 * ```
 */
export function getModelRecordingName(model: MastraModelConfig): string {
  if (typeof model === 'string') {
    return model.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  }
  if ('modelId' in model && model.modelId) {
    return String(model.modelId).replace(/[^a-zA-Z0-9-]/g, '');
  }
  if ('specificationVersion' in model && model.specificationVersion) {
    return `sdk-${model.specificationVersion}`;
  }
  return 'unknown-model';
}

/**
 * Check if a model configuration uses the v5+ API (AI SDK v5).
 *
 * v5+ models support:
 * - `agent.generate()` with `memory: { thread, resource }` options
 * - `agent.stream()` with the new streaming API
 *
 * v4 models require:
 * - `agent.generateLegacy()` with `threadId/resourceId` options
 * - `agent.streamLegacy()` for streaming
 *
 * @example
 * ```typescript
 * if (isV5PlusModel(model)) {
 *   await agent.generate('Hello', { memory: { thread: threadId } });
 * } else {
 *   await agent.generateLegacy('Hello', { threadId });
 * }
 * ```
 */
export function isV5PlusModel(model: MastraModelConfig): boolean {
  if (typeof model === 'string') return true;
  if (
    typeof model === 'object' &&
    'specificationVersion' in model &&
    (model.specificationVersion === 'v2' || model.specificationVersion === 'v3')
  ) {
    return true;
  }
  return false;
}

/**
 * Options for agentGenerate helper
 */
export interface AgentGenerateOptions {
  threadId?: string;
  resourceId?: string;
  memory?: { thread: string; resource?: string };
  /** v4 structured output schema — auto-transformed to `structuredOutput: { schema }` for v5+ */
  output?: unknown;
  [key: string]: unknown;
}

/**
 * Version-agnostic agent.generate() wrapper.
 *
 * Automatically calls the correct method based on model version:
 * - v5+ models: `agent.generate()` with `memory: { thread, resource }`
 * - v4 models: `agent.generateLegacy()` with `threadId/resourceId`
 *
 * @example
 * ```typescript
 * // Works with any model version
 * const result = await agentGenerate(
 *   agent,
 *   'Hello',
 *   { threadId: '123', resourceId: 'user' },
 *   model
 * );
 * ```
 */
export async function agentGenerate(
  agent: AgentLike,
  message: string | unknown[],
  options: AgentGenerateOptions,
  model: MastraModelConfig,
): Promise<unknown> {
  if (isV5PlusModel(model)) {
    // Transform deprecated threadId/resourceId to memory format for v5+
    const { threadId, resourceId, output, ...rest } = options;
    const transformedOptions: Record<string, unknown> = { ...rest };

    if (threadId) {
      transformedOptions.memory = { thread: threadId, resource: resourceId };
    }

    // Transform v4 `output` to v5+ `structuredOutput: { schema }`
    if (output && !transformedOptions.structuredOutput) {
      transformedOptions.structuredOutput = { schema: output };
    }

    return agent.generate(message, transformedOptions as any);
  } else {
    return (agent as any).generateLegacy(message, options);
  }
}

/**
 * Version-agnostic agent.stream() wrapper.
 *
 * Automatically calls the correct method based on model version:
 * - v5+ models: `agent.stream()` with `memory: { thread, resource }`
 * - v4 models: `agent.streamLegacy()` with `threadId/resourceId`
 *
 * @example
 * ```typescript
 * const stream = await agentStream(
 *   agent,
 *   'Count to 5',
 *   { threadId: '123', resourceId: 'user' },
 *   model
 * );
 * ```
 */
export async function agentStream(
  agent: AgentLike,
  message: string,
  options: AgentGenerateOptions,
  model: MastraModelConfig,
): Promise<unknown> {
  if (isV5PlusModel(model)) {
    const { threadId, resourceId, output, ...rest } = options;
    const transformedOptions: Record<string, unknown> = { ...rest };

    if (threadId) {
      transformedOptions.memory = { thread: threadId, resource: resourceId };
    }

    // Transform v4 `output` to v5+ `structuredOutput: { schema }`
    if (output && !transformedOptions.structuredOutput) {
      transformedOptions.structuredOutput = { schema: output };
    }

    return agent.stream(message, transformedOptions as any);
  } else {
    return (agent as any).streamLegacy(message, options);
  }
}

/**
 * Provider API key configuration
 */
export interface ProviderApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  openrouter?: string;
}

/**
 * Setup dummy API keys for replay mode.
 *
 * In replay mode, HTTP calls are mocked so we don't need real API keys.
 * However, the Agent class validates that keys exist before making requests.
 * This function sets dummy keys to satisfy that validation.
 *
 * Call this at the top of your test file after checking the mode:
 *
 * @example
 * ```typescript
 * import { getLLMTestMode, setupDummyApiKeys } from '@internal/test-utils';
 *
 * const MODE = getLLMTestMode();
 *
 * // Set dummy keys if in replay mode and real keys aren't available
 * setupDummyApiKeys(MODE);
 * ```
 *
 * @param mode - Current LLM test mode
 * @param providers - Which provider keys to set (default: all)
 */
export function setupDummyApiKeys(
  mode: string,
  providers: (keyof ProviderApiKeys)[] = ['openai', 'anthropic', 'google', 'openrouter'],
): void {
  // Set dummy keys for modes that may replay recordings.
  // In auto mode, we may replay so dummy keys are needed as fallback.
  // Only skip for live, record, and update modes which always need real keys.
  if (mode === 'live' || mode === 'record' || mode === 'update') return;

  const dummyKeys: ProviderApiKeys = {
    openai: 'sk-dummy-for-replay-mode',
    anthropic: 'sk-ant-dummy-for-replay-mode',
    google: 'dummy-google-key-for-replay-mode',
    openrouter: 'sk-or-dummy-for-replay-mode',
  };

  const envVars: Record<keyof ProviderApiKeys, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };

  for (const provider of providers) {
    const envVar = envVars[provider];
    if (!process.env[envVar]) {
      process.env[envVar] = dummyKeys[provider];
    }
  }
}

/**
 * Check if API key is available for a provider.
 *
 * @example
 * ```typescript
 * const hasKey = hasApiKey('openai');
 * if (!hasKey && MODE !== 'replay') {
 *   console.log('Skipping test - no API key');
 *   return;
 * }
 * ```
 */
export function hasApiKey(provider: keyof ProviderApiKeys): boolean {
  const envVars: Record<keyof ProviderApiKeys, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };
  return !!process.env[envVars[provider]];
}
