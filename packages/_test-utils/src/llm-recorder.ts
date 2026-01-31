/**
 * LLM Response Recorder
 *
 * Records and replays HTTP interactions with LLM APIs including SSE streaming.
 * Uses MSW (Mock Service Worker) for reliable interception with human-readable recordings.
 *
 * ## Test Modes
 *
 * Control behavior via `LLM_TEST_MODE` environment variable:
 *
 * ```bash
 * # Live mode (default) - Real API calls, no recording
 * pnpm test
 *
 * # Replay mode - Fast, deterministic, uses recordings (auto in CI)
 * LLM_TEST_MODE=replay pnpm test
 *
 * # Record mode - Makes real API calls, saves new recordings
 * LLM_TEST_MODE=record pnpm test
 * ```
 *
 * ## Mode Selection Priority
 *
 * 1. `LLM_TEST_MODE=replay|record|live` - explicit mode
 * 2. `RECORD_LLM=true` - legacy, same as record
 * 3. `CI=true` - auto-replay in CI environments
 * 4. Default: **live** (real API calls for local development)
 *
 * ## When to Use Each Mode
 *
 * - **live** (default): Local development, debugging, nightly validation
 * - **replay**: CI/PR tests, fast iteration, offline development
 * - **record**: Creating/refreshing fixtures after API changes
 *
 * @example
 * ```typescript
 * import { useLLMRecording } from '@mastra/core/test-utils';
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
import { beforeAll, afterAll } from 'vitest';

// Default recordings directory - can be overridden via options
const DEFAULT_RECORDINGS_DIR = path.join(process.cwd(), '__recordings__');

/**
 * Test modes for LLM recording
 */
export type LLMTestMode = 'replay' | 'record' | 'live';

/**
 * Get the current test mode from environment variables
 *
 * Priority:
 * 1. LLM_TEST_MODE=replay|record|live (explicit)
 * 2. RECORD_LLM=true (legacy, same as record)
 * 3. CI=true (auto-replay in CI environments)
 * 4. Default: live (real API calls for local development)
 */
export function getLLMTestMode(): LLMTestMode {
  const mode = process.env.LLM_TEST_MODE?.toLowerCase();

  // Explicit mode takes priority
  if (mode === 'replay') return 'replay';
  if (mode === 'record') return 'record';
  if (mode === 'live') return 'live';

  // Legacy support
  if (process.env.RECORD_LLM === 'true') return 'record';

  // Auto-replay in CI environments
  if (process.env.CI === 'true') return 'replay';

  // Default: live mode for local development
  return 'live';
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
const SKIP_HEADERS = [
  'authorization',
  'x-api-key',
  'api-key',
  'content-encoding',
  'transfer-encoding',
];

/**
 * Hash a request to create a unique identifier for matching
 */
function hashRequest(url: string, body: unknown): string {
  const normalizedBody = typeof body === 'object' ? JSON.stringify(body, Object.keys(body as object).sort()) : String(body);
  const content = `${url}:${normalizedBody}`;
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 16);
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

/**
 * Set up LLM response recording/replay
 */
export function setupLLMRecording(options: LLMRecorderOptions): LLMRecorderInstance {
  const recordingsDir = options.recordingsDir || DEFAULT_RECORDINGS_DIR;
  const recordingPath = path.join(recordingsDir, `${options.name}.json`);
  const recordingExists = fs.existsSync(recordingPath);

  // Determine mode
  let mode = getLLMTestMode();

  // Force record if explicitly requested or no recording exists (and not live)
  if (options.forceRecord) {
    mode = 'record';
  } else if (mode === 'replay' && !recordingExists) {
    // Auto-switch to record if no recording exists
    console.log(`[llm-recorder] No recording found for "${options.name}", switching to record mode`);
    mode = 'record';
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
      const body = await request.clone().json().catch(() => ({}));
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
        const recording = savedRecordings.find(r => r.hash === hash);

        if (!recording) {
          console.error(`[llm-recorder] No recording found for: ${url}`);
          console.error(`[llm-recorder] Hash: ${hash}`);
          console.error(`[llm-recorder] Available: ${savedRecordings.map(r => r.hash).join(', ')}`);
          throw new Error(`No recording found for request: ${url} (hash: ${hash}). Run with RECORD_LLM=true to record.`);
        }

        if (recording.response.isStreaming) {
          return createStreamingResponse(recording, options);
        } else {
          const body = typeof recording.response.body === 'string'
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
      if (!isRecordMode || recordings.length === 0) {
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
