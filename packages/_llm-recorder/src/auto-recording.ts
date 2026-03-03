/**
 * Auto-Recording Module
 *
 * Provides a simple function to enable LLM recording/replay for a test file
 * with automatic name derivation from the test file path.
 *
 * This is a lighter alternative to the Vite plugin — just import and call
 * `enableAutoRecording()` at the top of your test file.
 *
 * @example
 * ```typescript
 * import { enableAutoRecording } from '@internal/llm-recorder';
 *
 * // Auto-derives recording name from file path
 * enableAutoRecording();
 *
 * describe('My Tests', () => {
 *   it('works', async () => {
 *     const result = await agent.generate('Hello');
 *     expect(result.text).toBeDefined();
 *   });
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom name
 * enableAutoRecording({ nameOverride: 'my-custom-name' });
 * ```
 */

import { beforeAll, afterAll } from 'vitest';
import { setupLLMRecording } from './llm-recorder';
import { defaultNameGenerator } from './vite-plugin';

export interface AutoRecordingOptions {
  /** Override the auto-derived recording name */
  nameOverride?: string;
  /** Override the recordings directory */
  recordingsDir?: string;
  /** Force recording mode even if recording exists */
  forceRecord?: boolean;
  /** Simulate original chunk timing during replay (default: false) */
  replayWithTiming?: boolean;
  /** Maximum delay between chunks during replay in ms (default: 10) */
  maxChunkDelay?: number;
  /**
   * Transform the request URL and/or body before hashing for recording lookup.
   *
   * @see LLMRecorderOptions.transformRequest
   */
  transformRequest?: (req: { url: string; body: unknown }) => { url: string; body: unknown };
}

/**
 * Enable LLM recording/replay for the current test file.
 *
 * Must be called at the module level (outside `describe` blocks) or
 * inside a `describe` block. Uses Vitest's `beforeAll`/`afterAll`
 * hooks to manage the recording lifecycle.
 *
 * The recording name is auto-derived from the test file path using
 * Vitest's internal state. If the file path cannot be determined,
 * falls back to 'unknown-test'.
 */
export function enableAutoRecording(options: AutoRecordingOptions = {}) {
  const { nameOverride, recordingsDir, ...recorderOptions } = options;

  // Derive the recording name from the test file path
  let name: string;
  if (nameOverride) {
    name = nameOverride;
  } else {
    // Get the current test file path from the call stack
    const testPath = getCallerFilePath();
    name = testPath ? defaultNameGenerator(testPath) : 'unknown-test';
  }

  const recorder = setupLLMRecording({ name, recordingsDir, ...recorderOptions });

  beforeAll(() => {
    recorder.start();
  });

  afterAll(async () => {
    await recorder.save();
    recorder.stop();
  });

  return recorder;
}

/**
 * Get the file path of the caller by inspecting the call stack.
 * Returns null if the path cannot be determined.
 */
function getCallerFilePath(): string | null {
  const originalPrepare = Error.prepareStackTrace;
  // Use an object to capture the result from the prepareStackTrace callback,
  // since TypeScript can't track closure mutations from callbacks.
  const result: { file: string | null } = { file: null };

  try {
    const err = new Error();

    Error.prepareStackTrace = (_err, stack) => {
      // Walk up the stack to find the first frame outside this module
      for (const frame of stack) {
        const filename = frame.getFileName();
        if (filename && !filename.includes('auto-recording') && !filename.includes('node_modules')) {
          result.file = filename;
          break;
        }
      }
      return stack;
    };

    // Trigger stack trace generation
    err.stack;

    // Handle file:// URLs (common in ESM)
    if (result.file?.startsWith('file://')) {
      result.file = new URL(result.file).pathname;
    }

    return result.file;
  } finally {
    Error.prepareStackTrace = originalPrepare;
  }
}
