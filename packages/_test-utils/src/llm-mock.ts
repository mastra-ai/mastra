/**
 * LLM Mocking
 *
 * Record/replay LLM API calls in tests. Two factories:
 *
 * - `createLLMMock(model)` — wrap a real AI SDK model instance
 * - `createGatewayMock()` — mock all LLM traffic (for gateway/string models)
 *
 * Both return self-contained instances with no global state.
 *
 * @example
 * ```typescript
 * // With a real model instance
 * import { createLLMMock } from '@internal/test-utils';
 * import { openai } from '@ai-sdk/openai';
 *
 * const mock = createLLMMock(openai('gpt-4o'));
 * beforeAll(() => mock.start());
 * afterAll(() => mock.saveAndStop());
 * ```
 *
 * @example
 * ```typescript
 * // With gateway string models like 'openai/gpt-4o'
 * import { createGatewayMock } from '@internal/test-utils';
 *
 * const mock = createGatewayMock();
 * beforeAll(() => mock.start());
 * afterAll(() => mock.saveAndStop());
 * ```
 */

import path from 'node:path';

import type { LLMRecorderOptions, LLMRecorderInstance } from '@internal/llm-recorder';
import { setupLLMRecording, defaultNameGenerator } from '@internal/llm-recorder';

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

export interface MockOptions {
  /** Explicit recording name. Auto-derived from test file if omitted. */
  name?: string;
  /** Directory for recording files (default: `__recordings__` in cwd) */
  recordingsDir?: string;
  /** Override the test mode instead of reading from `LLM_TEST_MODE` env var. */
  mode?: LLMRecorderOptions['mode'];
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
  /** When true, only accept exact hash matches during replay. Disables fuzzy/similarity matching. */
  exactMatch?: boolean;
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

/** Vitest's internal worker state, available at module scope. */
interface VitestWorkerState {
  filepath?: string;
}

/**
 * Get the current test file path from Vitest's worker state.
 * Note: `expect.getState().testPath` only works inside `it()` blocks,
 * but our mocks are created at `describe` scope, so we use the worker state.
 */
function getVitestFilePath(): string | null {
  const worker = (globalThis as Record<string, unknown>).__vitest_worker__ as VitestWorkerState | undefined;
  return worker?.filepath ?? null;
}

/**
 * Get the base name from the test file path.
 */
function getTestBaseName(): string {
  const testPath = getVitestFilePath();
  return testPath ? defaultNameGenerator(testPath) : 'unknown-test';
}

/** Monorepo directory patterns that contain packages. */
const PACKAGE_DIR_PATTERN =
  /^(.*\/(?:packages|stores|deployers|voice|server-adapters|client-sdks|auth|observability|communications|pubsub|workflows|e2e-tests)\/[^/]+)\//;

/**
 * Derive the package root from a test file path.
 * e.g. `/repo/packages/core/src/agent/agent.e2e.test.ts` → `/repo/packages/core`
 */
function getPackageRoot(): string | null {
  const testPath = getVitestFilePath();
  if (!testPath) return null;
  const normalized = testPath.replace(/\\/g, '/');
  const match = normalized.match(PACKAGE_DIR_PATTERN);
  return match?.[1] ?? null;
}

/**
 * Get the recordings directory, preferring the package root over cwd.
 */
function getRecordingsDir(): string | undefined {
  const pkgRoot = getPackageRoot();
  return pkgRoot ? path.join(pkgRoot, '__recordings__') : undefined;
}

/**
 * Derive a recording name from the test file path and model identity.
 *
 * `createLLMMock(openai('gpt-4o'))` in `packages/core/src/agent/my-test.e2e.test.ts`
 * → `core-src-agent-my-test.e2e--openai-chat--gpt-4o`
 */
function deriveModelRecordingName(provider: string, modelId: string): string {
  const baseName = getTestBaseName();
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
export function createLLMMock(model: ModelLike, options: MockOptions = {}): LLMMock {
  const { name, recordingsDir = getRecordingsDir(), debug, ...recorderOptions } = options;

  const { provider, modelId } = model;
  const recordingName = name ?? deriveModelRecordingName(provider, modelId);

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
      try {
        await recorder.save();
      } finally {
        recorder.stop();
      }
    },
    recorder,
  };
}

/**
 * Self-contained gateway mock. Just start/stop — no model info needed.
 */
export interface GatewayMock {
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
 * Create a gateway mock that records/replays all LLM API traffic.
 *
 * Use this when your agent uses gateway string models like `'openai/gpt-4o'`
 * and you don't have a model instance to pass in.
 *
 * @param options - Recording options
 *
 * @example
 * ```typescript
 * import { createGatewayMock } from '@internal/test-utils';
 *
 * describe('my agent', () => {
 *   const mock = createGatewayMock();
 *   beforeAll(() => mock.start());
 *   afterAll(() => mock.saveAndStop());
 *
 *   it('works', async () => {
 *     const agent = new Agent({ model: 'openai/gpt-4o', ... });
 *     const result = await agent.generate('Hello');
 *     expect(result.text).toBeDefined();
 *   });
 * });
 * ```
 */
export function createGatewayMock(options: MockOptions = {}): GatewayMock {
  const { name, recordingsDir = getRecordingsDir(), debug, ...recorderOptions } = options;

  const recordingName = name ?? getTestBaseName();

  const recorder = setupLLMRecording({
    name: recordingName,
    recordingsDir,
    debug,
    metaContext: {
      testFile: getVitestFilePath() ?? undefined,
    },
    ...recorderOptions,
  });

  return {
    recordingName,
    get mode() {
      return recorder.mode;
    },
    start() {
      recorder.start();
    },
    async saveAndStop() {
      try {
        await recorder.save();
      } finally {
        recorder.stop();
      }
    },
    recorder,
  };
}
