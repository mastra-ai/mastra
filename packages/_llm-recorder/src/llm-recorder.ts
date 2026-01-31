/**
 * LLM Response Recorder
 *
 * Records and replays HTTP interactions with LLM APIs including SSE streaming.
 * Uses MSW (Mock Service Worker) for reliable interception with human-readable recordings.
 * Works like Vitest snapshots — auto-records on first run, replays thereafter.
 *
 * ## Test Modes
 *
 * ```bash
 * # Auto mode (default) - replay if recording exists, record if not
 * pnpm test
 *
 * # Force re-record all recordings (like vitest -u for snapshots)
 * pnpm test -- --update-recordings
 * # or
 * UPDATE_RECORDINGS=true pnpm test
 *
 * # Skip recording entirely (for debugging with real API)
 * LLM_TEST_MODE=live pnpm test
 *
 * # Strict replay — fail if no recording exists
 * LLM_TEST_MODE=replay pnpm test
 * ```
 *
 * ## Mode Selection Priority
 *
 * 1. `--update-recordings` flag or `UPDATE_RECORDINGS=true` → update (force re-record)
 * 2. `LLM_TEST_MODE=live` → live (no recording)
 * 3. `LLM_TEST_MODE=record` → record (legacy, same as update)
 * 4. `LLM_TEST_MODE=replay` → replay (strict, fail if no recording)
 * 5. Default → **auto** (replay if exists, record if not)
 *
 * @example
 * ```typescript
 * import { useLLMRecording } from '@internal/llm-recorder';
 *
 * describe('My LLM Tests', () => {
 *   const recording = useLLMRecording('my-test-suite');
 *
 *   it('generates text', async () => {
 *     const response = await agent.generate('Hello');
 *     expect(response.text).toBeDefined();
 *   });
 *
 *   it('streams text', async () => {
 *     const { textStream } = await agent.stream('Count to 3');
 *     const chunks = [];
 *     for await (const chunk of textStream) {
 *       chunks.push(chunk);
 *     }
 *     expect(chunks.length).toBeGreaterThan(0);
 *   });
 * });
 * ```
 */

import { setupServer, SetupServerApi } from 'msw/node';
import { http, HttpResponse, bypass } from 'msw';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import stringSimilarity from 'string-similarity';
import { beforeAll, afterAll } from 'vitest';
import { diffJson } from 'diff';

// Default recordings directory - can be overridden via options
const DEFAULT_RECORDINGS_DIR = path.join(process.cwd(), '__recordings__');

/**
 * Test modes for LLM recording
 *
 * - **auto** (default): Replay if recording exists, record if not (like test snapshots)
 * - **update**: Force re-record all recordings (like `vitest -u` for snapshots)
 * - **replay**: Strict replay-only, fail if no recording exists
 * - **live**: Real API calls, no recording at all (for debugging/validation)
 * - **record**: Legacy alias for update mode
 */
export type LLMTestMode = 'auto' | 'update' | 'replay' | 'live' | 'record';

/**
 * Check if update mode is requested via CLI flag or env var.
 *
 * Detected from:
 * - `--update-recordings` or `-U` CLI flag
 * - `UPDATE_RECORDINGS=true` environment variable
 */
function isUpdateMode(): boolean {
  if (process.env.UPDATE_RECORDINGS === 'true') return true;
  return process.argv.includes('--update-recordings') || process.argv.includes('-U');
}

/**
 * Get the current test mode from environment variables
 *
 * Priority:
 * 1. `--update-recordings` flag or `UPDATE_RECORDINGS=true` → 'update' (force re-record)
 * 2. `LLM_TEST_MODE=live` → 'live' (no recording)
 * 3. `LLM_TEST_MODE=record` → 'record' (legacy, same as update)
 * 4. `LLM_TEST_MODE=replay` → 'replay' (strict replay-only, fail if no recording)
 * 5. `RECORD_LLM=true` → 'record' (legacy)
 * 6. Default → 'auto' (replay if exists, record if not)
 */
export function getLLMTestMode(): LLMTestMode {
  // CLI flag / env var for update mode takes highest priority
  if (isUpdateMode()) return 'update';

  const mode = process.env.LLM_TEST_MODE?.toLowerCase();

  // Explicit mode
  if (mode === 'live') return 'live';
  if (mode === 'record') return 'record';
  if (mode === 'replay') return 'replay';
  if (mode === 'auto') return 'auto';
  if (mode === 'update') return 'update';

  // Legacy support
  if (process.env.RECORD_LLM === 'true') return 'record';

  // Default: auto mode (snapshot-like behavior)
  return 'auto';
}

/**
 * Recorded request/response pair
 */
export interface LLMRecording {
  /** Unique hash of the request for matching */
  hash: string;
  /** Original request details */
  request: {
    url: string;
    method: string;
    body: unknown;
    timestamp: number;
  };
  /** Response details */
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    /** For non-streaming responses - parsed JSON or text */
    body?: unknown;
    /** For streaming responses - individual chunks */
    chunks?: string[];
    /** Timing between chunks in ms */
    chunkTimings?: number[];
    /** Whether this was a streaming response */
    isStreaming: boolean;
  };
}

export interface LLMRecorderOptions {
  /** Unique name for this recording set (used as filename) */
  name: string;
  /** Directory to store recordings (default: process.cwd()/__recordings__/) */
  recordingsDir?: string;
  /** Force recording mode even if recording exists */
  forceRecord?: boolean;
  /** Simulate original chunk timing during replay (default: false for fast tests) */
  replayWithTiming?: boolean;
  /** Maximum delay between chunks during replay in ms (default: 10) */
  maxChunkDelay?: number;
}

export interface LLMRecorderInstance {
  /** The MSW server instance (null in live mode) */
  server: SetupServerApi | null;
  /** Start intercepting requests (no-op in live mode) */
  start(): void;
  /** Stop intercepting requests (no-op in live mode) */
  stop(): void;
  /** Save recordings to disk (only in record mode) */
  save(): Promise<void>;
  /** Current test mode */
  mode: LLMTestMode;
  /** Whether we're in record mode (legacy, use .mode instead) */
  isRecording: boolean;
  /** Whether we're in live mode (real API, no recording) */
  isLive: boolean;
  /** Number of recordings captured (in record mode) */
  recordingCount: number;
}

/**
 * LLM API hosts to intercept
 */
const LLM_API_HOSTS = [
  'https://api.openai.com',
  'https://api.anthropic.com',
  'https://generativelanguage.googleapis.com',
  'https://openrouter.ai',
];

/**
 * Headers to skip when storing (sensitive + compression)
 */
const SKIP_HEADERS = ['authorization', 'x-api-key', 'api-key', 'content-encoding', 'transfer-encoding'];

/**
 * Deep sort object keys for stable serialization
 */
function stableSortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableSortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = stableSortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Serialize request content for hashing and fuzzy matching.
 */
function serializeRequestContent(url: string, body: unknown): string {
  const normalizedBody = typeof body === 'object' ? JSON.stringify(stableSortKeys(body)) : String(body);
  return `${url}:${normalizedBody}`;
}

/**
 * Hash a request to create a unique identifier for matching
 */
function hashRequest(url: string, body: unknown): string {
  return crypto.createHash('md5').update(serializeRequestContent(url, body)).digest('hex').slice(0, 16);
}

/**
 * Check if a response is a streaming SSE response
 */
function isStreamingResponse(headers: Headers): boolean {
  const contentType = headers.get('content-type') || '';
  return contentType.includes('text/event-stream') || contentType.includes('text/plain');
}

/**
 * Filter headers, removing sensitive and compression headers
 */
function filterHeaders(headers: Headers): Record<string, string> {
  const filtered: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!SKIP_HEADERS.includes(key.toLowerCase())) {
      filtered[key] = value;
    }
  });
  return filtered;
}

/**
 * Read a streaming response and capture all chunks with timing
 */
async function captureStreamingResponse(
  response: Response,
): Promise<{ chunks: string[]; timings: number[]; headers: Record<string, string> }> {
  const chunks: string[] = [];
  const timings: number[] = [];
  let lastTime = Date.now();

  const reader = response.body?.getReader();
  if (!reader) {
    return { chunks: [], timings: [], headers: filterHeaders(response.headers) };
  }

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);

      const now = Date.now();
      timings.push(now - lastTime);
      lastTime = now;
    }
  } finally {
    reader.releaseLock();
  }

  return { chunks, timings, headers: filterHeaders(response.headers) };
}

/**
 * Create a streaming response from recorded chunks
 */
function createStreamingResponse(
  recording: LLMRecording,
  options: { replayWithTiming?: boolean; maxChunkDelay?: number },
): Response {
  const chunks = recording.response.chunks || [];
  const timings = recording.response.chunkTimings || [];
  const maxDelay = options.maxChunkDelay ?? 10;

  let chunkIndex = 0;

  const stream = new ReadableStream({
    async pull(controller) {
      if (chunkIndex >= chunks.length) {
        controller.close();
        return;
      }

      if (options.replayWithTiming && timings[chunkIndex]) {
        const delay = Math.min(timings[chunkIndex]!, maxDelay);
        if (delay > 0) {
          await new Promise(r => setTimeout(r, delay));
        }
      }

      controller.enqueue(new TextEncoder().encode(chunks[chunkIndex]));
      chunkIndex++;
    },
  });

  return new Response(stream, {
    status: recording.response.status,
    statusText: recording.response.statusText,
    headers: recording.response.headers,
  });
}

/** Minimum similarity score to accept a fuzzy match */
const SIMILARITY_THRESHOLD = 0.6;

/**
 * Find a matching recording — first by exact hash, then by string similarity.
 *
 * The fuzzy fallback handles cases where the request body changed slightly
 * between test runs (e.g. different prompt wording, extra metadata fields)
 * but the intent is clearly the same recording.
 */
function findRecording(recordings: LLMRecording[], hash: string, url: string, body: unknown): LLMRecording | undefined {
  // 1. Exact hash match (fast path)
  const exact = recordings.find(r => r.hash === hash);
  if (exact) {
    return exact;
  }

  if (recordings.length === 0) {
    return undefined;
  }

  // 2. Fuzzy match via string similarity on serialized request content
  const incoming = serializeRequestContent(url, body);
  const candidates = recordings.map(r => serializeRequestContent(r.request.url, r.request.body));

  const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(incoming, candidates);

  if (bestMatch.rating >= SIMILARITY_THRESHOLD) {
    return recordings[bestMatchIndex]!;
  }

  return undefined;
}

/**
 * Set up LLM response recording/replay
 */
export function setupLLMRecording(options: LLMRecorderOptions): LLMRecorderInstance {
  const recordingsDir = options.recordingsDir || DEFAULT_RECORDINGS_DIR;
  const recordingPath = path.join(recordingsDir, `${options.name}.json`);
  const recordingExists = fs.existsSync(recordingPath);

  // Determine mode
  let mode = getLLMTestMode();

  // Force record if explicitly requested
  if (options.forceRecord) {
    mode = 'record';
  }

  // Resolve mode to an effective action
  if (mode === 'update' || mode === 'record') {
    // Update/record: force record (delete existing recording to re-record)
    if (recordingExists && mode === 'update') {
      fs.unlinkSync(recordingPath);
    }
    mode = 'record';
  } else if (mode === 'auto') {
    // Auto: replay if recording exists, record if not
    if (recordingExists) {
      mode = 'replay';
    } else {
      console.log(`[llm-recorder] No recording found for "${options.name}", auto-recording`);
      mode = 'record';
    }
  } else if (mode === 'replay' && !recordingExists) {
    // Strict replay: fail if no recording
    throw new Error(
      `[llm-recorder] No recording found for "${options.name}". ` +
        `Run with UPDATE_RECORDINGS=true or --update-recordings to create recordings.`,
    );
  }

  // Live mode: no interception, just pass through
  if (mode === 'live') {
    return {
      server: null,
      mode: 'live',
      isRecording: false,
      isLive: true,
      recordingCount: 0,
      start() {
        console.log(`[llm-recorder] LIVE mode: ${options.name} (real API calls, no recording)`);
      },
      stop() {
        // no-op
      },
      async save() {
        // no-op
      },
    };
  }

  const recordings: LLMRecording[] = [];
  const isRecordMode = mode === 'record';

  // Load existing recordings for replay mode
  let savedRecordings: LLMRecording[] = [];
  if (!isRecordMode && recordingExists) {
    savedRecordings = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
  }

  // Create handlers for each LLM API host
  const handlers = LLM_API_HOSTS.flatMap(baseUrl => [
    http.post(`${baseUrl}/*`, async ({ request }) => {
      const url = request.url;
      const body = await request
        .clone()
        .json()
        .catch(() => ({}));
      const hash = hashRequest(url, body);

      if (isRecordMode) {
        console.log(`[llm-recorder] Recording: ${url}`);

        try {
          const realResponse = await fetch(bypass(request));
          const isStreaming = isStreamingResponse(realResponse.headers);

          if (isStreaming) {
            const { chunks, timings, headers } = await captureStreamingResponse(realResponse.clone());

            recordings.push({
              hash,
              request: { url, method: 'POST', body, timestamp: Date.now() },
              response: {
                status: realResponse.status,
                statusText: realResponse.statusText,
                headers,
                chunks,
                chunkTimings: timings,
                isStreaming: true,
              },
            });

            return createStreamingResponse(recordings[recordings.length - 1]!, options);
          } else {
            const responseText = await realResponse.text();
            let responseBody: unknown;
            try {
              responseBody = JSON.parse(responseText);
            } catch {
              responseBody = responseText;
            }

            const headers = filterHeaders(realResponse.headers);

            recordings.push({
              hash,
              request: { url, method: 'POST', body, timestamp: Date.now() },
              response: {
                status: realResponse.status,
                statusText: realResponse.statusText,
                headers,
                body: responseBody,
                isStreaming: false,
              },
            });

            return new HttpResponse(JSON.stringify(responseBody), {
              status: realResponse.status,
              statusText: realResponse.statusText,
              headers,
            });
          }
        } catch (error) {
          console.error(`[llm-recorder] Error recording:`, error);
          throw error;
        }
      } else {
        // Replay mode
        const recording = findRecording(savedRecordings, hash, url, body);

        if (!recording) {
          console.error(`[llm-recorder] No recording found for: ${url}`);
          console.error(`[llm-recorder] Hash: ${hash}`);
          console.error(`[llm-recorder] Available: ${savedRecordings.map(r => r.hash).join(', ')}`);
          throw new Error(
            `No recording found for request: ${url} (hash: ${hash}). Run with UPDATE_RECORDINGS=true to re-record.`,
          );
        }

        if (recording.hash !== hash) {
          console.warn(
            `[llm-recorder] No exact match for hash ${hash}, using fuzzy match (recorded hash: ${recording.hash}). ` +
              `Consider re-recording with UPDATE_RECORDINGS=true.`,
          );
          const changes = diffJson(recording.request.body!, body ?? {});
          const formatted = changes
            .map(part => {
              const prefix = part.added ? '+' : part.removed ? '-' : ' ';
              return part.value
                .split('\n')
                .filter(line => line !== '')
                .map(line => `${prefix} ${line}`)
                .join('\n');
            })
            .join('\n');
          console.warn(`[llm-recorder] Diff (recorded vs actual):\n${formatted}`);
        }

        if (recording.response.isStreaming) {
          return createStreamingResponse(recording, options);
        } else {
          const body =
            typeof recording.response.body === 'string'
              ? recording.response.body
              : JSON.stringify(recording.response.body);

          return new HttpResponse(body, {
            status: recording.response.status,
            statusText: recording.response.statusText,
            headers: recording.response.headers,
          });
        }
      }
    }),
  ]);

  const server = setupServer(...handlers);

  return {
    server,
    mode,
    isRecording: isRecordMode,
    isLive: false,

    get recordingCount() {
      return recordings.length;
    },

    start() {
      console.log(`[llm-recorder] ${mode.toUpperCase()} mode: ${options.name}`);
      server.listen({ onUnhandledRequest: 'bypass' });
    },

    stop() {
      server.close();
    },

    async save() {
      if (!isRecordMode) {
        return;
      }

      fs.mkdirSync(path.dirname(recordingPath), { recursive: true });
      fs.writeFileSync(recordingPath, JSON.stringify(recordings, null, 2));
      console.log(`[llm-recorder] Saved ${recordings.length} recordings to: ${recordingPath}`);
    },
  };
}

/**
 * Vitest helper that automatically handles setup/teardown
 *
 * @example
 * ```typescript
 * describe('My Tests', () => {
 *   const recording = useLLMRecording('my-tests');
 *
 *   it('works', async () => {
 *     const result = await agent.generate('Hello');
 *     expect(result.text).toBeDefined();
 *   });
 * });
 * ```
 */
export function useLLMRecording(name: string, options: Omit<LLMRecorderOptions, 'name'> = {}) {
  const recorder = setupLLMRecording({ name, ...options });

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
 * Callback wrapper for recording LLM interactions in a single test.
 * Starts recording before the callback, saves and stops after.
 *
 * @example
 * ```typescript
 * it('generates a response', () => withLLMRecording('my-test', async () => {
 *   const result = await agent.generate('Hello');
 *   expect(result.text).toBeDefined();
 * }));
 * ```
 */
export async function withLLMRecording<T>(
  name: string,
  fn: () => T | Promise<T>,
  options: Omit<LLMRecorderOptions, 'name'> = {},
): Promise<T> {
  const recorder = setupLLMRecording({ name, ...options });
  recorder.start();
  try {
    const result = await fn();
    return result;
  } finally {
    await recorder.save();
    recorder.stop();
  }
}

/**
 * Check if a recording exists
 */
export function hasLLMRecording(name: string, recordingsDir?: string): boolean {
  const dir = recordingsDir || DEFAULT_RECORDINGS_DIR;
  return fs.existsSync(path.join(dir, `${name}.json`));
}

/**
 * Delete a recording
 */
export function deleteLLMRecording(name: string, recordingsDir?: string): void {
  const dir = recordingsDir || DEFAULT_RECORDINGS_DIR;
  const recordingPath = path.join(dir, `${name}.json`);
  if (fs.existsSync(recordingPath)) {
    fs.unlinkSync(recordingPath);
  }
}

/**
 * List all recordings
 */
export function listLLMRecordings(recordingsDir?: string): string[] {
  const dir = recordingsDir || DEFAULT_RECORDINGS_DIR;
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/**
 * Get recordings directory path
 */
export function getLLMRecordingsDir(): string {
  return DEFAULT_RECORDINGS_DIR;
}
