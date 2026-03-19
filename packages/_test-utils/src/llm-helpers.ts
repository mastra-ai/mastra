/**
 * LLM Test Helpers
 *
 * Common utilities for LLM integration tests.
 * These helpers reduce boilerplate across test files.
 */

import fs from 'node:fs';
import path from 'node:path';

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

// Consolidated mapping of providers to their possible environment variable names.
// Some providers (like Google) have multiple possible env var names.
const PROVIDER_ENV_VARS: Record<keyof ProviderApiKeys, readonly string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
};

export function setupDummyApiKeys(
  mode: string,
  providers: (keyof ProviderApiKeys)[] = ['openai', 'anthropic', 'google', 'openrouter'],
): void {
  // Set dummy keys for modes that may replay recordings.
  // - replay: strict replay mode, recordings are required
  // - auto: replay if recording exists, otherwise record/hit API
  // For live, record, and update modes, real keys are always required.
  if (mode === 'live' || mode === 'record' || mode === 'update') return;

  const dummyKeys: ProviderApiKeys = {
    openai: 'sk-dummy-for-replay-mode',
    anthropic: 'sk-ant-dummy-for-replay-mode',
    google: 'dummy-google-key-for-replay-mode',
    openrouter: 'sk-or-dummy-for-replay-mode',
  };

  for (const provider of providers) {
    for (const envVar of PROVIDER_ENV_VARS[provider]) {
      if (!process.env[envVar]) {
        process.env[envVar] = dummyKeys[provider];
      }
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
  return PROVIDER_ENV_VARS[provider].some(name => !!process.env[name]?.trim());
}

/**
 * Check if a real (non-dummy) API key is available for a provider.
 * Returns false if the key is a dummy key set by setupDummyApiKeys.
 */
export function hasRealApiKey(provider: keyof ProviderApiKeys): boolean {
  for (const envVar of PROVIDER_ENV_VARS[provider]) {
    const key = process.env[envVar]?.trim();
    if (key && !key.includes('-dummy-') && !key.includes('dummy-')) {
      return true;
    }
  }
  return false;
}

// Map providers to their API URL domains
const PROVIDER_URL_PATTERNS: Record<keyof ProviderApiKeys, string[]> = {
  openai: ['api.openai.com'],
  anthropic: ['api.anthropic.com'],
  google: ['generativelanguage.googleapis.com'],
  openrouter: ['openrouter.ai'],
};

/**
 * Check if non-empty recordings exist for a test file.
 *
 * Recording files are JSON arrays. An empty recording is `[]` (3 bytes).
 * This function checks if the recording file exists AND has content.
 *
 * @param recordingName - The recording name (typically derived from test file path)
 * @param recordingsDir - Optional recordings directory (defaults to `__recordings__` in cwd)
 * @param provider - Optional provider to check for (if specified, only counts recordings for that provider)
 * @returns true if recordings exist and are non-empty (optionally for the specified provider)
 */
export function hasNonEmptyRecordings(
  recordingName: string,
  recordingsDir?: string,
  provider?: keyof ProviderApiKeys,
): boolean {
  const dir = recordingsDir || path.join(process.cwd(), '__recordings__');
  const recordingPath = path.join(dir, `${recordingName}.json`);

  if (!fs.existsSync(recordingPath)) return false;

  try {
    const content = fs.readFileSync(recordingPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both formats:
    // - Legacy: plain array of recordings
    // - Current: { meta, recordings: [...] }
    const recordings = Array.isArray(parsed) ? parsed : parsed?.recordings;
    if (!Array.isArray(recordings) || recordings.length === 0) return false;

    // If no provider specified, just check if any recordings exist
    if (!provider) return true;

    // Check if any recordings match the provider's URL patterns
    const patterns = PROVIDER_URL_PATTERNS[provider];
    return recordings.some(
      (entry: { request?: { url?: string } }) =>
        entry.request?.url && patterns.some(pattern => entry.request!.url!.includes(pattern)),
    );
  } catch {
    return false;
  }
}

/**
 * Determine if an LLM test should be skipped.
 *
 * Skip logic:
 * - If real API key exists: never skip
 * - In `replay` mode: never skip (recordings are required, let it fail if missing)
 * - In `auto` mode: skip only if no recordings exist (no key + no recordings = can't run)
 * - In `live`/`record`/`update` modes: skip if no real API key
 *
 * @param mode - Current LLM test mode from getLLMTestMode()
 * @param provider - Which provider's API key to check
 * @param recordingName - Optional recording name to check for existing recordings (for auto mode)
 * @returns true if the test should be skipped
 *
 * @example
 * ```typescript
 * import { getLLMTestMode } from '@internal/llm-recorder';
 * import { shouldSkipLLMTest } from '@internal/test-utils';
 *
 * const MODE = getLLMTestMode();
 *
 * // Without recording check (skips in auto mode without real key)
 * const skipLLM = shouldSkipLLMTest(MODE, 'openai');
 *
 * // With recording check (allows auto mode to run if recordings exist)
 * const skipLLM = shouldSkipLLMTest(MODE, 'openai', 'my-test-recording');
 *
 * describe.skipIf(skipLLM)('LLM Tests', () => { ... });
 * ```
 */
export function shouldSkipLLMTest(mode: string, provider: keyof ProviderApiKeys, recordingName?: string): boolean {
  // If we have a real API key, never skip
  if (hasRealApiKey(provider)) return false;

  // In explicit replay mode, don't skip - let it fail if no recording
  if (mode === 'replay') return false;

  // In auto mode, check if recordings exist for this provider
  if (mode === 'auto' && recordingName) {
    // If recordings exist for this provider, don't skip - the recorder will replay them
    if (hasNonEmptyRecordings(recordingName, undefined, provider)) return false;
  }

  // For all other cases (live, record, update, or auto without recordings), skip
  return true;
}
