/**
 * LLM Mocking
 *
 * Wrap a real model instance to record/replay its API calls.
 * No global state — returns a self-contained mock you control.
 *
 * @example
 * ```typescript
 * import { createLLMMock } from '@internal/test-utils';
 * import { openai } from '@ai-sdk/openai';
 *
 * describe('My Agent Tests', () => {
 *   const mock = createLLMMock(openai('gpt-4o'));
 *
 *   beforeAll(() => mock.start());
 *   afterAll(() => mock.saveAndStop());
 *
 *   it('generates a response', async () => {
 *     const result = await agent.generate('Hello');
 *     expect(result.text).toBeDefined();
 *   });
 * });
 * ```
 */

import {
  setupLLMRecording,
  type LLMRecorderOptions,
  type LLMRecorderInstance,
} from '@internal/llm-recorder';
import { defaultNameGenerator } from '@internal/llm-recorder';

/**
 * Minimal model shape we need — just `provider` and `modelId`.
 * Works with any AI SDK model instance (v1, v2, v3).
 */
export interface ModelLike {
  /** Provider identifier (e.g. "openai.chat", "anthropic.messages") */
  readonly provider: string;
  /** Model identifier (e.g. "gpt-4o", "claude-3-haiku") */
  readonly modelId: string;
}

export interface LLMMockOptions {
  /** Explicit recording name. Auto-derived from test file + model if omitted. */
  name?: string;
  /** Directory for recording files (default: `__recordings__` in cwd) */
  recordingsDir?: string;
  /** Force re-record even if recording exists */
  forceRecord?: boolean;
  /** Replay with original chunk timing (default: false) */
  replayWithTiming?: boolean;
  /** Max delay between chunks in replay, ms (default: 10) */
  maxChunkDelay?: number;
  /** Transform requests before hashing */
  transformRequest?: LLMRecorderOptions['transformRequest'];
  /** Enable verbose debug logging */
  debug?: boolean;
}

/**
 * Self-contained LLM mock instance. No global state — you own the lifecycle.
 */
export interface LLMMock {
  /** The provider from the model (e.g. "openai.chat") */
  readonly provider: string;
  /** The model ID (e.g. "gpt-4o") */
  readonly modelId: string;
  /** The recording name used for this mock */
  readonly recordingName: string;
  /** Current test mode (record, replay, auto, live) */
  readonly mode: LLMRecorderInstance['mode'];
  /** Start intercepting requests */
  start(): void;
  /** Save recordings (if in record mode) and stop intercepting */
  saveAndStop(): Promise<void>;
  /** The underlying recorder instance for advanced use */
  readonly recorder: LLMRecorderInstance;
}

/**
 * Get the current test file path from Vitest's worker state.
 */
function getVitestFilePath(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__vitest_worker__?.filepath ?? null;
}

/**
 * Derive a recording name from the test file path and model identity.
 *
 * `createLLMMock(openai('gpt-4o'))` in `packages/core/src/agent/my-test.e2e.test.ts`
 * → `core-src-agent-my-test.e2e--openai.chat--gpt-4o`
 */
function deriveRecordingName(provider: string, modelId: string): string {
  const testPath = getVitestFilePath();
  const baseName = testPath ? defaultNameGenerator(testPath) : 'unknown-test';
  // Normalize dots and slashes to dashes for safe filenames
  const providerSlug = provider.replace(/[./]/g, '-');
  const modelSlug = modelId.replace(/[./]/g, '-');
  return `${baseName}--${providerSlug}--${modelSlug}`;
}

/**
 * Create an LLM mock that records/replays API calls for a model.
 *
 * Pass a real model instance — the mock reads its `provider` and `modelId`
 * for naming the recording file. MSW intercepts all LLM API traffic.
 *
 * @param model - Any AI SDK model instance (e.g. `openai('gpt-4o')`)
 * @param options - Recording options
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 *
 * describe('OpenAI agent', () => {
 *   const mock = createLLMMock(openai('gpt-4o'));
 *   beforeAll(() => mock.start());
 *   afterAll(() => mock.saveAndStop());
 *
 *   it('works', async () => {
 *     const result = await agent.generate('Hello');
 *     expect(result.text).toBeDefined();
 *   });
 * });
 * ```
 */
export function createLLMMock(model: ModelLike, options: LLMMockOptions = {}): LLMMock {
  const { name, recordingsDir, debug, ...recorderOptions } = options;

  const { provider, modelId } = model;
  const recordingName = name ?? deriveRecordingName(provider, modelId);

  const recorder = setupLLMRecording({
    name: recordingName,
    recordingsDir,
    debug,
    metaContext: {
      testFile: getVitestFilePath() ?? undefined,
      provider,
      model: modelId,
    },
    ...recorderOptions,
  });

  return {
    provider,
    modelId,
    recordingName,
    get mode() {
      return recorder.mode;
    },
    start() {
      recorder.start();
    },
    async saveAndStop() {
      await recorder.save();
      recorder.stop();
    },
    recorder,
  };
}
