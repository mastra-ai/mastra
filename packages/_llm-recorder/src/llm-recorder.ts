/* eslint-disable no-console */
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

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { diffJson } from 'diff';
import { http, HttpResponse, bypass } from 'msw';
import type { SetupServerApi } from 'msw/node';
import { setupServer } from 'msw/node';
import stringSimilarity from 'string-similarity';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

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
export interface LLMBinaryArtifact {
  /** Relative path from recordingsDir to the stored artifact */
  path: string;
  /** MIME type of the binary payload */
  contentType: string;
  /** Byte length of the payload */
  size: number;
}

export interface LLMRecording {
  /** Unique hash of the request for matching */
  hash: string;
  /** Original request details */
  request: {
    url: string;
    method: string;
    body: unknown;
    timestamp: number;
    /** Optional binary request payload stored as a sidecar artifact */
    binaryArtifact?: LLMBinaryArtifact;
  };
  /** Response details */
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    /** For non-streaming responses - parsed JSON or text */
    body?: unknown;
    /** Optional binary response payload stored as a sidecar artifact */
    binaryArtifact?: LLMBinaryArtifact;
    /** For streaming responses - individual chunks */
    chunks?: string[];
    /** Timing between chunks in ms */
    chunkTimings?: number[];
    /** Whether this was a streaming response */
    isStreaming: boolean;
  };
}

/**
 * Metadata stored at the top of each recording file.
 * Makes recording files self-describing — you can open a JSON
 * and immediately know what it is, which test generated it, etc.
 */
export interface RecordingMeta {
  /** Recording name (matches the filename without extension) */
  name: string;
  /** Relative path (from cwd) of the test file that created this recording */
  testFile?: string;
  /** Name of the test (best-effort, may not always be available) */
  testName?: string;
  /** Provider ID (e.g. "openai", "anthropic") */
  provider?: string;
  /** Model ID (e.g. "gpt-4o") */
  model?: string;
  /** ISO timestamp when recording was first created */
  createdAt: string;
  /** ISO timestamp when recording was last updated */
  updatedAt?: string;
}

/**
 * New versioned recording file format.
 * Files always have `{ meta, recordings }` at the top level.
 * Legacy files (plain arrays) are auto-migrated on read.
 */
export interface RecordingFile {
  meta: RecordingMeta;
  recordings: LLMRecording[];
}

/**
 * Load a recording file, handling both legacy (plain array) and new ({ meta, recordings }) formats.
 */
function isRecordingFile(raw: unknown): raw is RecordingFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return Array.isArray(obj.recordings);
}

function loadRecordingFile(filePath: string, name: string): RecordingFile {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // New format: { meta, recordings }
  if (isRecordingFile(raw)) {
    return raw;
  }

  // Legacy format: plain array of LLMRecording[]
  if (Array.isArray(raw)) {
    return {
      meta: {
        name,
        createdAt: new Date().toISOString(),
      },
      recordings: raw as LLMRecording[],
    };
  }

  throw new Error(`[llm-recorder] Invalid recording file format: ${filePath}`);
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
  /**
   * Transform the request URL and/or body before hashing for recording lookup.
   *
   * Useful for normalizing dynamic fields (timestamps, UUIDs, session IDs)
   * so recordings match reliably across test runs.
   *
   * Applied both during **recording** (to normalize what gets stored) and
   * during **replay** (to normalize what gets matched).
   *
   * @example
   * ```typescript
   * useLLMRecording('my-tests', {
   *   transformRequest: ({ url, body }) => ({
   *     url,
   *     body: { ...body, timestamp: 'NORMALIZED' },
   *   }),
   * });
   * ```
   */
  transformRequest?: (req: { url: string; body: unknown }) => { url: string; body: unknown };
  /**
   * Restrict interception to specific API hosts.
   * When provided, only requests to these hosts are intercepted; all others pass through.
   * Defaults to all known LLM API hosts.
   *
   * @example
   * ```typescript
   * setupLLMRecording({
   *   name: 'openai-only',
   *   hosts: ['https://api.openai.com'],
   * });
   * ```
   */
  hosts?: string[];
  /**
   * Enable verbose debug logging for request hashes, model info, and match results.
   * Helps diagnose why a replay miss or fuzzy match happens.
   */
  debug?: boolean;
  /**
   * When true, only accept exact hash matches during replay.
   * Disables fuzzy/similarity matching.
   */
  exactMatch?: boolean;
  /**
   * Override the test mode instead of reading from `LLM_TEST_MODE` env var.
   * Useful for tests that must always replay regardless of environment.
   */
  mode?: LLMTestMode;
  /**
   * Additional metadata context to include in the recording file.
   * Automatically populated by `createLLMMock` but can be set manually.
   */
  metaContext?: {
    /** Absolute path of the test file */
    testFile?: string;
    /** Provider ID (e.g. "openai") */
    provider?: string;
    /** Model ID (e.g. "gpt-4o") */
    model?: string;
  };
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
  /** Reset fuzzy match tracking so recordings can be reused across tests */
  resetFuzzyMatches(): void;
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
export const LLM_API_HOSTS = [
  'https://api.openai.com',
  'https://api.anthropic.com',
  'https://generativelanguage.googleapis.com',
  'https://openrouter.ai',
];

/**
 * Headers to skip when storing (sensitive + compression)
 */
const SKIP_HEADERS = ['authorization', 'x-api-key', 'api-key', 'content-encoding', 'transfer-encoding', 'set-cookie'];

/**
 * Module-scoped active recorder instance.
 *
 * Vitest runs each test file in its own worker, so there's no cross-file
 * contamination. This lets `useLiveMode()` discover the active recorder
 * without the user having to pass it explicitly.
 */
let activeRecorder: LLMRecorderInstance | null = null;

/**
 * Get the currently active recorder instance (if any).
 * Primarily for internal use by `useLiveMode()`.
 */
export function getActiveRecorder(): LLMRecorderInstance | null {
  return activeRecorder;
}

/**
 * Convert an absolute test file path to a stable relative path.
 * Falls back to the basename if the path is outside the project (starts with `..`).
 */
function relativizeTestFile(filepath: string): string {
  const rel = path.relative(process.cwd(), filepath);
  return rel.startsWith('..') ? path.basename(filepath) : rel;
}

/**
 * Deep sort object keys for stable serialization
 */
function stableSortKeys(value: unknown): unknown {
  if (typeof value === 'string') return canonicalizeISODateString(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableSortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = stableSortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

function canonicalizeISODateString(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return value;
  return new Date(value).toISOString();
}

interface ParsedRequestBody {
  value: unknown;
  binary?: {
    bytes: Uint8Array;
    contentType: string;
  };
}

/**
 * Parse request payload into a JSON/text value or binary bytes.
 */
async function parseRequestBody(request: Request): Promise<ParsedRequestBody> {
  const contentType = request.headers.get('content-type')?.toLowerCase() || '';
  const cloned = request.clone();

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    const json = await cloned.json().catch(() => ({}));
    return { value: json };
  }

  if (contentType.startsWith('text/')) {
    const text = await cloned.text().catch(() => '');
    return { value: text };
  }

  const buffer = await cloned.arrayBuffer().catch(() => new ArrayBuffer(0));
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) {
    return { value: {} };
  }

  const digest = crypto.createHash('md5').update(bytes).digest('hex').slice(0, 16);

  return {
    value: {
      __binary: true,
      contentType: contentType || 'application/octet-stream',
      size: bytes.length,
      digest,
    },
    binary: {
      bytes,
      contentType: contentType || 'application/octet-stream',
    },
  };
}

/**
 * Serialize request content for hashing and fuzzy matching.
 */
function normalizeRequestBody(body: unknown): unknown {
  if (typeof body === 'string') return canonicalizeISODateString(body);
  if (body !== null && typeof body === 'object') return stableSortKeys(body);
  return body;
}

function serializeRequestContent(url: string, body: unknown): string {
  const normalizedBody = normalizeRequestBody(body);
  return `${url}:${typeof normalizedBody === 'string' ? normalizedBody : JSON.stringify(normalizedBody)}`;
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

function writeBinaryArtifact(params: {
  recordingsDir: string;
  hash: string;
  kind: 'request' | 'response';
  contentType: string;
  bytes: Uint8Array;
}): LLMBinaryArtifact {
  fs.mkdirSync(params.recordingsDir, { recursive: true });

  const ext = params.contentType.includes('mpeg')
    ? 'mp3'
    : params.contentType.includes('wav')
      ? 'wav'
      : params.contentType.includes('ogg')
        ? 'ogg'
        : params.contentType.includes('webm')
          ? 'webm'
          : 'bin';

  const payloadDigest = crypto.createHash('md5').update(params.bytes).digest('hex').slice(0, 12);
  const fileName = `${params.hash}-${params.kind}-${payloadDigest}.${ext}`;
  const absolutePath = path.join(params.recordingsDir, fileName);
  fs.writeFileSync(absolutePath, Buffer.from(params.bytes));
  return {
    path: fileName,
    contentType: params.contentType,
    size: params.bytes.byteLength,
  };
}

function readBinaryArtifact(recordingsDir: string, artifact: LLMBinaryArtifact): Uint8Array {
  const baseDir = path.resolve(recordingsDir);
  const absolutePath = path.resolve(baseDir, artifact.path);
  if (!absolutePath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error(`[llm-recorder] Invalid binary artifact path: ${artifact.path}`);
  }
  return new Uint8Array(fs.readFileSync(absolutePath));
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
 *
 * `usedHashes` tracks recordings already consumed by **binary** fuzzy matches
 * so that multiple similar requests (e.g. audio transcription calls that all
 * serialize to near-identical strings) don't all resolve to the same recording.
 * It is only applied to binary request matching — non-binary recordings are
 * intentionally reusable across tests (e.g. v1/v2 model variants sharing one
 * recording).  Exact hash matches are always exempt.
 */
function findRecording(
  recordings: LLMRecording[],
  hash: string,
  url: string,
  body: unknown,
  usedHashes?: Set<string>,
): LLMRecording | undefined {
  // 1. Exact hash match (fast path)
  const exact = recordings.find(r => r.hash === hash);
  if (exact) {
    return exact;
  }

  if (recordings.length === 0) {
    return undefined;
  }

  // 2. Fuzzy match fallback.
  //    Skip recordings already consumed by a previous fuzzy match.

  // For binary requests, string similarity is unreliable because the serialized
  // form mainly differs in the random multipart boundary and binary digest, making
  // all candidates score nearly identically.  Instead, match by body size proximity
  // (replayed audio is deterministic so sizes should be very close).
  const isBinary = typeof body === 'object' && body !== null && (body as Record<string, unknown>).__binary === true;

  if (isBinary) {
    const incomingSize = (body as Record<string, unknown>).size as number;
    let bestIndex: number | undefined;
    let bestSizeDiff = Infinity;

    for (let i = 0; i < recordings.length; i++) {
      if (usedHashes?.has(recordings[i]!.hash)) continue;
      if (recordings[i]!.request.url !== url) continue;

      const recBody = recordings[i]!.request.body as Record<string, unknown> | undefined;
      if (!recBody?.__binary) continue;

      const recSize = recBody.size as number;
      const diff = Math.abs(incomingSize - recSize);

      // Reject candidates whose size diverges too much — the same TTS output
      // varies by only a few bytes across runs, so a 10% relative tolerance
      // is generous while still preventing clearly-wrong matches.
      const maxSize = Math.max(incomingSize, recSize) || 1;
      if (diff / maxSize > 0.1) continue;

      if (diff < bestSizeDiff) {
        bestSizeDiff = diff;
        bestIndex = i;
      }
    }

    if (bestIndex != null) {
      usedHashes?.add(recordings[bestIndex]!.hash);
      return recordings[bestIndex]!;
    }
    // Fall through to string similarity if no binary match found
  }

  // For non-binary requests, use string similarity on serialized request content.
  // Prefer recordings that match the request URL to avoid cross-API mismatches
  // (e.g. /v1/chat/completions vs /v1/responses).
  //
  // NOTE: usedHashes is NOT applied here.  Non-binary recordings are intentionally
  // reusable across tests — e.g. v1 and v2 model variants share the same recording.
  const incoming = serializeRequestContent(url, body);
  let bestRating = -1;
  let bestIndex = -1;
  let bestUrlMatchRating = -1;
  let bestUrlMatchIndex = -1;

  for (let i = 0; i < recordings.length; i++) {
    const candidate = serializeRequestContent(recordings[i]!.request.url, recordings[i]!.request.body);
    const rating = stringSimilarity.compareTwoStrings(incoming, candidate);
    if (rating > bestRating) {
      bestRating = rating;
      bestIndex = i;
    }
    if (recordings[i]!.request.url === url && rating > bestUrlMatchRating) {
      bestUrlMatchRating = rating;
      bestUrlMatchIndex = i;
    }
  }

  // Prefer URL-matching recording when available and above threshold
  if (bestUrlMatchRating >= SIMILARITY_THRESHOLD && bestUrlMatchIndex >= 0) {
    return recordings[bestUrlMatchIndex]!;
  }

  if (bestRating >= SIMILARITY_THRESHOLD && bestIndex >= 0) {
    return recordings[bestIndex]!;
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
  let mode = options.mode ?? getLLMTestMode();

  // Force record if explicitly requested
  if (options.forceRecord) {
    mode = 'record';
  }

  // Load existing recordings / metadata before any mutations (backward compatible)
  // In record/update modes a corrupted file should not block re-recording.
  let savedRecordings: LLMRecording[] = [];
  let existingMeta: RecordingMeta | undefined;
  if (recordingExists) {
    const willRecord = mode === 'record' || mode === 'update';
    try {
      const file = loadRecordingFile(recordingPath, options.name);
      existingMeta = file.meta;
      savedRecordings = file.recordings;
    } catch (err) {
      if (!willRecord) {
        throw err;
      }
      console.warn(
        `[llm-recorder] Failed to parse existing recording for "${options.name}", starting fresh: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // Resolve mode to an effective action
  if (mode === 'update' || mode === 'record') {
    // Update/record: force record (delete existing recording to re-record)
    if (recordingExists && mode === 'update') {
      fs.unlinkSync(recordingPath);
    }
    mode = 'record';
    // Don't replay existing recordings in record mode
    savedRecordings = [];
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
    const instance: LLMRecorderInstance = {
      server: null,
      mode: 'live',
      isRecording: false,
      isLive: true,
      recordingCount: 0,
      start() {
        console.log(`[llm-recorder] LIVE mode: ${options.name} (real API calls, no recording)`);
        activeRecorder = instance;
      },
      stop() {
        if (activeRecorder === instance) activeRecorder = null;
      },
      async save() {
        // no-op
      },
      resetFuzzyMatches() {
        // no-op in live mode
      },
    };
    return instance;
  }

  const recordings: LLMRecording[] = [];
  const isRecordMode = mode === 'record';
  const fuzzyUsedHashes = new Set<string>();
  let saved = false;

  // Create handlers for each LLM API host (or a filtered subset)
  const interceptHosts = options.hosts ?? LLM_API_HOSTS;
  const debug = options.debug ?? false;
  const handlers = interceptHosts.flatMap(baseUrl => [
    http.post(`${baseUrl}/*`, async ({ request }) => {
      let url = request.url;
      const parsedRequest = await parseRequestBody(request);
      const body = parsedRequest.value;

      // Extract model from request body for debug logging
      const model =
        body && typeof body === 'object' && 'model' in body ? (body as Record<string, unknown>).model : undefined;

      // Apply user-provided transform before hashing
      let hash: string;
      let transformedBody = body;
      if (options.transformRequest) {
        const transformed = options.transformRequest({ url, body });
        transformedBody = transformed.body;
        hash = hashRequest(transformed.url, transformedBody);
      } else {
        hash = hashRequest(url, transformedBody);
      }

      if (isRecordMode) {
        console.log(`[llm-recorder] Recording: ${url}${model ? ` (model: ${model})` : ''} [hash: ${hash}]`);

        const currentDate = Date.now();
        try {
          const realResponse = await fetch(bypass(request));
          const isStreaming = isStreamingResponse(realResponse.headers);

          if (isStreaming) {
            const { chunks, timings, headers } = await captureStreamingResponse(realResponse.clone());
            const requestBinaryArtifact = parsedRequest.binary
              ? writeBinaryArtifact({
                  recordingsDir,
                  hash,
                  kind: 'request',
                  contentType: parsedRequest.binary.contentType,
                  bytes: parsedRequest.binary.bytes,
                })
              : undefined;

            recordings.push({
              hash,
              request: {
                url,
                method: 'POST',
                body,
                timestamp: currentDate,
                ...(requestBinaryArtifact ? { binaryArtifact: requestBinaryArtifact } : {}),
              },
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
            const headers = filterHeaders(realResponse.headers);
            const responseContentType = realResponse.headers.get('content-type')?.toLowerCase() || '';
            const requestBinaryArtifact = parsedRequest.binary
              ? writeBinaryArtifact({
                  recordingsDir,
                  hash,
                  kind: 'request',
                  contentType: parsedRequest.binary.contentType,
                  bytes: parsedRequest.binary.bytes,
                })
              : undefined;

            let responseBody: unknown;
            let responseBinaryArtifact: LLMBinaryArtifact | undefined;

            if (responseContentType.includes('application/json') || responseContentType.includes('+json')) {
              const responseText = await realResponse.text();
              try {
                responseBody = JSON.parse(responseText);
              } catch {
                responseBody = responseText;
              }
            } else if (responseContentType.startsWith('text/')) {
              responseBody = await realResponse.text();
            } else {
              const responseBuffer = await realResponse.arrayBuffer();
              const responseBytes = new Uint8Array(responseBuffer);
              responseBinaryArtifact = writeBinaryArtifact({
                recordingsDir,
                hash,
                kind: 'response',
                contentType: responseContentType || 'application/octet-stream',
                bytes: responseBytes,
              });
              responseBody = {
                __binary: true,
                contentType: responseBinaryArtifact.contentType,
                size: responseBinaryArtifact.size,
              };
            }

            recordings.push({
              hash,
              request: {
                url,
                method: 'POST',
                body,
                timestamp: currentDate,
                ...(requestBinaryArtifact ? { binaryArtifact: requestBinaryArtifact } : {}),
              },
              response: {
                status: realResponse.status,
                statusText: realResponse.statusText,
                headers,
                body: responseBody,
                ...(responseBinaryArtifact ? { binaryArtifact: responseBinaryArtifact } : {}),
                isStreaming: false,
              },
            });

            if (responseBinaryArtifact) {
              return new HttpResponse(readBinaryArtifact(recordingsDir, responseBinaryArtifact), {
                status: realResponse.status,
                statusText: realResponse.statusText,
                headers,
              });
            }

            const responseText = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
            return new HttpResponse(responseText, {
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
        if (debug) {
          console.log(`[llm-recorder] Replay lookup: ${url}${model ? ` (model: ${model})` : ''} [hash: ${hash}]`);
          console.log(`[llm-recorder]   Available hashes: ${savedRecordings.map(r => r.hash).join(', ')}`);
        }

        const recording = findRecording(savedRecordings, hash, url, body, fuzzyUsedHashes);

        if (!recording) {
          console.error(`[llm-recorder] No recording found for: ${url}${model ? ` (model: ${model})` : ''}`);
          console.error(`[llm-recorder]   Request hash: ${hash}`);
          console.error(
            `[llm-recorder]   Available: ${savedRecordings.map(r => `${r.hash} (${r.request.url})`).join(', ')}`,
          );
          throw new Error(
            `No recording found for request: ${url} (hash: ${hash}). Run with UPDATE_RECORDINGS=true to re-record.`,
          );
        }

        if (debug) {
          const matchType = recording.hash === hash ? 'exact' : 'fuzzy';
          console.log(`[llm-recorder]   Matched (${matchType}): ${recording.request.url} [hash: ${recording.hash}]`);
        }

        if (recording.hash !== hash) {
          // findRecording returned a fuzzy match (rating >= SIMILARITY_THRESHOLD).
          // Accept it with a warning rather than failing the test.
          console.warn(
            `[llm-recorder] No exact match for hash ${hash}, using fuzzy match (recorded hash: ${recording.hash}). ` +
              `Consider re-recording with UPDATE_RECORDINGS=true.`,
          );
          const transformedReqBody = options.transformRequest
            ? options.transformRequest({ url, body: recording.request.body }).body
            : recording.request.body;
          const changes = diffJson(
            normalizeRequestBody(transformedReqBody)!,
            normalizeRequestBody(transformedBody) ?? {},
          );
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

          if (options.exactMatch) {
            throw new Error(
              `No exact match for hash ${hash}, using fuzzy match (recorded hash: ${recording.hash}). ` +
                `Consider re-recording with UPDATE_RECORDINGS=true.`,
            );
          }
        }

        if (recording.response.isStreaming) {
          return createStreamingResponse(recording, options);
        } else {
          if (recording.response.binaryArtifact) {
            return new HttpResponse(readBinaryArtifact(recordingsDir, recording.response.binaryArtifact), {
              status: recording.response.status,
              statusText: recording.response.statusText,
              headers: recording.response.headers,
            });
          }

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

  const instance: LLMRecorderInstance = {
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
      activeRecorder = instance;
    },

    stop() {
      server.close();
      if (activeRecorder === instance) activeRecorder = null;
    },

    async save() {
      if (!isRecordMode || recordings.length === 0 || saved) {
        return;
      }

      // Build metadata for the recording file
      const now = new Date().toISOString();
      const vitestWorker = (globalThis as Record<string, unknown>).__vitest_worker__ as
        | { filepath?: string }
        | undefined;

      const vitestState = (globalThis as Record<string, unknown>).__vitest_worker__ as
        | { currentTestName?: string; current?: { fullTestName?: string } }
        | undefined;

      const firstRequestBody = recordings[0]?.request.body as Record<string, unknown> | undefined;
      const inferredModel = typeof firstRequestBody?.model === 'string' ? firstRequestBody.model : undefined;

      const rawTestFile = options.metaContext?.testFile ?? vitestWorker?.filepath;

      const meta: RecordingMeta = {
        name: options.name,
        testFile: rawTestFile ? relativizeTestFile(rawTestFile) : undefined,
        testName: vitestState?.current?.fullTestName ?? vitestState?.currentTestName ?? existingMeta?.testName,
        provider: options.metaContext?.provider ?? existingMeta?.provider,
        model: options.metaContext?.model ?? inferredModel ?? existingMeta?.model,
        createdAt: existingMeta?.createdAt ?? now,
        ...(existingMeta?.createdAt ? { updatedAt: now } : {}),
      };

      // Deduplicate recordings by hash — identical requests across tests share one entry
      const seen = new Set<string>();
      const dedupedRecordings = recordings.filter(r => {
        if (seen.has(r.hash)) return false;
        seen.add(r.hash);
        return true;
      });

      const file: RecordingFile = { meta, recordings: dedupedRecordings };

      fs.mkdirSync(path.dirname(recordingPath), { recursive: true });
      fs.writeFileSync(recordingPath, JSON.stringify(file, null, 2));
      saved = true;

      const deduped = recordings.length - dedupedRecordings.length;
      console.log(
        `[llm-recorder] Saved ${dedupedRecordings.length} recordings to: ${recordingPath}` +
          (deduped > 0 ? ` (${deduped} duplicates removed)` : ''),
      );
    },

    resetFuzzyMatches() {
      fuzzyUsedHashes.clear();
    },
  };

  return instance;
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

  beforeEach(() => {
    recorder.resetFuzzyMatches();
  });

  afterAll(async () => {
    await recorder.save();
    recorder.stop();
  });

  return recorder;
}

/**
 * Opt individual tests out of LLM recording within a suite that has recording enabled.
 *
 * When used inside a `describe` block, stops the active MSW server before
 * each test and restarts it after, letting real HTTP requests go through.
 * This is the per-test counterpart to suite-wide `useLLMRecording()`.
 *
 * No-op if there is no active recorder (e.g. already in global live mode).
 *
 * @example
 * ```typescript
 * describe('My LLM Tests', () => {
 *   useLLMRecording('my-suite');
 *
 *   it('replays from recording', async () => {
 *     // This test uses recorded responses
 *   });
 *
 *   describe('real API calls', () => {
 *     useLiveMode();
 *
 *     it('hits the real API', async () => {
 *       // This test bypasses recording and calls the real API
 *     });
 *   });
 * });
 * ```
 */
export function useLiveMode() {
  let recorder: LLMRecorderInstance | null = null;

  beforeEach(() => {
    recorder = activeRecorder;
    if (recorder?.server) {
      recorder.server.close();
    }
  });

  afterEach(() => {
    if (recorder?.server) {
      recorder.server.listen({ onUnhandledRequest: 'bypass' });
    }
  });
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
  // If another MSW server is already listening (e.g. from a suite-level
  // useLLMRecording or the vitest plugin), pause it so we don't collide.
  const parentRecorder = activeRecorder;
  if (parentRecorder?.server) {
    parentRecorder.server.close();
  }

  let recorder: LLMRecorderInstance | undefined;
  try {
    recorder = setupLLMRecording({ name, ...options });
    recorder.start();
    const result = await fn();
    return result;
  } finally {
    if (recorder) {
      await recorder.save();
      recorder.stop();
    }

    // Restore the parent recorder's server
    if (parentRecorder?.server) {
      parentRecorder.server.listen({ onUnhandledRequest: 'bypass' });
      activeRecorder = parentRecorder;
    }
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
