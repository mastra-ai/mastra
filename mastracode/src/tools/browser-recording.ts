/**
 * Mastra Code-only browser recording tools.
 *
 * Wraps the existing CDP screencast infrastructure in `@mastra/core/browser` to
 * capture frames, lets the agent drop short captions at specific moments, and
 * encodes the result as a Motion-JPEG AVI video written to disk. The AVI
 * format is used because it can be muxed in pure JavaScript (no ffmpeg) and
 * plays natively in QuickTime / Preview / VLC / browsers.
 *
 * These tools are intentionally NOT exposed from `@mastra/stagehand` or
 * `@mastra/agent-browser`. They are only attached to browsers that Mastra Code
 * itself constructs (see `createBrowserFromSettings`).
 */

import { relative, resolve, sep, join } from 'node:path';
import type { MastraBrowser, ScreencastStream } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getAppDataDir } from '../utils/project.js';
import { decodeJpeg, drawCaptionOnFrame, encodeJpeg, selectCaptionAt } from './browser-recording-overlay.js';
import type { RecordingCaption } from './browser-recording-overlay.js';
import { writeMjpegAviFile } from './mjpeg-avi.js';
import type { MjpegFrame } from './mjpeg-avi.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_DURATION_MS = 30_000;
const HARD_CAP_MAX_DURATION_MS = 120_000;
const DEFAULT_EVERY_NTH_FRAME = 2;
const DEFAULT_MAX_WIDTH = 1024;
const DEFAULT_MAX_HEIGHT = 720;

const MAX_CAPTION_LENGTH = 80;
const DEFAULT_CAPTION_DURATION_MS = 2_500;
const MIN_CAPTION_SPACING_MS = 500;

// Cap the number of buffered frames so a runaway recording can't OOM the host.
const MAX_BUFFERED_FRAMES = 2_000;

// How long a frame stall must persist before the watchdog reissues the
// screencast. CDP frames at quality 80 / everyNthFrame 2 normally arrive at
// ≥2/s on an active page; idle pages can go 1-2s between frames so we leave
// generous headroom.
const FRAME_STALL_MS = 4_000;

// How often the watchdog polls. Cheap (one Date.now compare) so 1s is fine.
const WATCHDOG_INTERVAL_MS = 1_000;

// ---------------------------------------------------------------------------
// Recording state
// ---------------------------------------------------------------------------

interface BufferedFrame {
  /** Milliseconds since recording start. */
  timestampMs: number;
  /** Raw JPEG bytes returned by CDP. */
  bytes: Uint8Array;
}

interface RecordingState {
  id: string;
  stream: ScreencastStream;
  startedAt: number;
  maxDurationMs: number;
  outputPath?: string;
  frames: BufferedFrame[];
  captions: RecordingCaption[];
  autoStopTimer: NodeJS.Timeout | null;
  /** Set when the screencast fails so the next tool call surfaces it. */
  pendingError: Error | null;
  /** Set after stop() begins so we don't double-stop. */
  stopping: boolean;
  /** Last caption timestamp (for rate-limiting). */
  lastCaptionAt: number;
  /** Wall-clock ms (Date.now) of last frame seen, for watchdog. */
  lastFrameAt: number;
  /** Watchdog that reconnects the screencast if frames stall. */
  watchdogTimer: NodeJS.Timeout | null;
  /** True while a reconnect is in flight; suppresses parallel attempts. */
  reconnecting: boolean;
}

/**
 * Module-local state. Only one recording at a time per Mastra Code process —
 * this is intentional and is enforced by the browser_record tool.
 */
let active: RecordingState | null = null;

function generateRecordingId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function recordingsDir(): string {
  return resolve(getAppDataDir(), 'browser-recordings');
}

function defaultOutputPath(id: string): string {
  return join(recordingsDir(), `${id}.avi`);
}

function resolveOutputPath(id: string, requestedPath?: string): string {
  const baseDir = recordingsDir();
  const outputPath = requestedPath ? resolve(requestedPath) : defaultOutputPath(id);
  const rel = relative(baseDir, outputPath);
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`) || resolve(outputPath) === baseDir) {
    throw new Error(`Recording outputPath must be inside ${baseDir}`);
  }
  return outputPath;
}

function clearState(): void {
  if (active?.autoStopTimer) {
    clearTimeout(active.autoStopTimer);
  }
  if (active?.watchdogTimer) {
    clearInterval(active.watchdogTimer);
  }
  active = null;
}

/** Internal: stop the screencast, ignoring errors. */
async function safeStop(stream: ScreencastStream): Promise<void> {
  try {
    await stream.stop();
  } catch {
    // Browser may already be gone — that's fine.
  }
}

// ---------------------------------------------------------------------------
// MJPEG AVI encoding
// ---------------------------------------------------------------------------

/**
 * Produce one captioned JPEG frame ready to be muxed into the AVI container.
 *
 * If there's no active caption at this frame's timestamp the original JPEG
 * bytes are returned as-is — re-encoding is only needed when a caption needs
 * to be burned onto the frame.
 */
function buildCaptionedFrame(state: RecordingState, frame: BufferedFrame): MjpegFrame {
  const caption = selectCaptionAt(state.captions, frame.timestampMs);
  if (!caption) {
    return { bytes: frame.bytes, timestampMs: frame.timestampMs };
  }
  const rgba = decodeJpeg(frame.bytes);
  drawCaptionOnFrame(rgba, caption.text);
  return { bytes: encodeJpeg(rgba, 80), timestampMs: frame.timestampMs };
}

/**
 * Encode all buffered frames as an MJPEG AVI file written directly to disk.
 *
 * Returns the dimensions of the first frame (used to populate the AVI header).
 * The AVI stream has one fixed frame size, so fail fast if the browser changes
 * screencast dimensions mid-recording.
 */
function encodeFramesAsAvi(state: RecordingState, outputPath: string): { width: number; height: number; written: number } {
  if (state.frames.length === 0) {
    throw new Error('No frames captured during recording');
  }

  // Inspect the first frame to learn the dimensions for the AVI header.
  const firstRgba = decodeJpeg(state.frames[0]!.bytes);
  const width = firstRgba.width;
  const height = firstRgba.height;

  const muxFrames: MjpegFrame[] = [];
  for (const frame of state.frames) {
    const rgba = decodeJpeg(frame.bytes);
    if (rgba.width !== width || rgba.height !== height) {
      throw new Error(`Frame dimensions changed during recording: expected ${width}x${height}, got ${rgba.width}x${rgba.height}`);
    }
    const out = buildCaptionedFrame(state, frame);
    muxFrames.push(out);
  }

  writeMjpegAviFile(outputPath, muxFrames, { width, height });
  return { width, height, written: muxFrames.length };
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

async function startRecording(
  browser: MastraBrowser,
  opts: {
    maxDurationMs?: number;
    everyNthFrame?: number;
    maxWidth?: number;
    maxHeight?: number;
    outputPath?: string;
    threadId?: string;
  },
): Promise<{ id: string; outputPath: string; maxDurationMs: number }> {
  if (active) {
    throw new Error(
      'A browser recording is already active. Call browser_record with action="stop" before starting a new recording.',
    );
  }

  const maxDurationMs = Math.min(
    HARD_CAP_MAX_DURATION_MS,
    Math.max(1_000, opts.maxDurationMs ?? DEFAULT_MAX_DURATION_MS),
  );
  const everyNthFrame = Math.max(1, Math.floor(opts.everyNthFrame ?? DEFAULT_EVERY_NTH_FRAME));
  const maxWidth = Math.max(160, Math.floor(opts.maxWidth ?? DEFAULT_MAX_WIDTH));
  const maxHeight = Math.max(120, Math.floor(opts.maxHeight ?? DEFAULT_MAX_HEIGHT));

  const id = generateRecordingId();
  const outputPath = resolveOutputPath(id, opts.outputPath);

  let stream: ScreencastStream;
  try {
    // Bind screencast to the same thread/page the agent is interacting with.
    // Without this, getPageForThread() can pick a different page than the one
    // being navigated, so Page.screencastFrame never fires.
    browser.setCurrentThread(opts.threadId);
    await browser.ensureReady();
    stream = await browser.startScreencast({
      // JPEG is the well-tested format for CDP screencast (matches Studio
      // live viewer); PNG mode is unreliable across Chromium builds.
      format: 'jpeg',
      quality: 80,
      maxWidth,
      maxHeight,
      everyNthFrame,
      threadId: opts.threadId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to start browser recording: ${msg}`);
  }

  const startedAt = Date.now();
  const state: RecordingState = {
    id,
    stream,
    startedAt,
    maxDurationMs,
    outputPath,
    frames: [],
    captions: [],
    autoStopTimer: null,
    pendingError: null,
    stopping: false,
    lastCaptionAt: -Infinity,
    lastFrameAt: startedAt,
    watchdogTimer: null,
    reconnecting: false,
  };

  // Set active state *before* attaching listeners so frames arriving on the
  // very next tick aren't dropped by the `!active` guard.
  active = state;

  stream.on('frame', (frame: { data: string }) => {
    if (!active || active.id !== id || active.stopping) return;
    active.lastFrameAt = Date.now();
    if (active.frames.length >= MAX_BUFFERED_FRAMES) return;
    try {
      const buf = Buffer.from(frame.data, 'base64');
      active.frames.push({
        timestampMs: Date.now() - active.startedAt,
        bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      });
    } catch (err) {
      active.pendingError = err instanceof Error ? err : new Error(String(err));
    }
  });

  stream.on('error', (err: Error) => {
    if (active && active.id === id) {
      active.pendingError = err;
    }
  });

  stream.on('stop', (reason: string) => {
    if (active && active.id === id && reason !== 'manual' && !active.stopping) {
      active.pendingError = new Error(`Browser screencast stopped unexpectedly (reason: ${reason})`);
    }
  });

  state.autoStopTimer = setTimeout(() => {
    // Fire-and-forget; tool calls will pick up the result on the next stop call.
    if (active && active.id === id && !active.stopping) {
      active.stopping = true;
      safeStop(stream).catch(() => {});
    }
  }, maxDurationMs);

  // Watchdog: CDP screencasts can silently stop delivering frames after some
  // cross-origin navigations and tab swaps. If no frame has arrived in
  // FRAME_STALL_MS we re-issue the screencast against the currently active
  // page via stream.reconnect(). This is self-healing for any cause of
  // frame stoppage (target detach, navigation race, etc.).
  const watchdog = () => {
    if (!active || active.id !== id || active.stopping) return;
    const elapsedSinceFrame = Date.now() - active.lastFrameAt;
    if (elapsedSinceFrame >= FRAME_STALL_MS && !active.reconnecting) {
      active.reconnecting = true;
      void (async () => {
        try {
          browser.setCurrentThread(opts.threadId);
          await stream.reconnect();
          // Pretend a frame just arrived so we don't immediately retry.
          if (active && active.id === id) {
            active.lastFrameAt = Date.now();
          }
        } catch (err) {
          if (active && active.id === id) {
            active.pendingError = err instanceof Error ? err : new Error(String(err));
          }
        } finally {
          if (active && active.id === id) {
            active.reconnecting = false;
          }
        }
      })();
    }
  };
  state.watchdogTimer = setInterval(watchdog, WATCHDOG_INTERVAL_MS);

  return { id, outputPath, maxDurationMs };
}

async function stopRecording(): Promise<{
  filePath: string;
  frameCount: number;
  captionCount: number;
  durationMs: number;
}> {
  if (!active) {
    throw new Error('No browser recording is active. Call browser_record with action="start" first.');
  }
  const state = active;
  state.stopping = true;
  if (state.autoStopTimer) {
    clearTimeout(state.autoStopTimer);
    state.autoStopTimer = null;
  }
  if (state.watchdogTimer) {
    clearInterval(state.watchdogTimer);
    state.watchdogTimer = null;
  }

  await safeStop(state.stream);

  if (state.pendingError) {
    const err = state.pendingError;
    clearState();
    throw new Error(`Browser recording failed: ${err.message}`);
  }

  const outputPath = state.outputPath ?? defaultOutputPath(state.id);
  try {
    encodeFramesAsAvi(state, outputPath);
  } catch (err) {
    clearState();
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write recording to ${outputPath}: ${msg}`);
  }

  const result = {
    filePath: outputPath,
    frameCount: state.frames.length,
    captionCount: state.captions.length,
    durationMs:
      state.frames.length > 0 ? state.frames[state.frames.length - 1]!.timestampMs : Date.now() - state.startedAt,
  };
  clearState();
  return result;
}

function addCaption(text: string, durationMs: number | undefined): { captionCount: number; timestampMs: number } {
  if (!active) {
    throw new Error('No browser recording is active. Call browser_record with action="start" before adding a caption.');
  }
  if (active.stopping) {
    throw new Error('Recording is already stopping; cannot add more captions.');
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Caption text must be a non-empty string.');
  }
  const capped = trimmed.length > MAX_CAPTION_LENGTH ? trimmed.slice(0, MAX_CAPTION_LENGTH - 1) + '…' : trimmed;

  const now = Date.now();
  const timestampMs = now - active.startedAt;

  // Rate-limit captions to prevent overlay flicker — drop captions arriving
  // too quickly after the previous one.
  if (now - active.lastCaptionAt < MIN_CAPTION_SPACING_MS) {
    // Replace the last caption's text instead of stacking another entry.
    const last = active.captions[active.captions.length - 1];
    if (last) {
      last.text = capped;
      last.durationMs = Math.max(
        last.durationMs,
        Math.min(HARD_CAP_MAX_DURATION_MS, durationMs ?? DEFAULT_CAPTION_DURATION_MS),
      );
      active.lastCaptionAt = now;
      return { captionCount: active.captions.length, timestampMs: last.timestampMs };
    }
  }

  active.captions.push({
    timestampMs,
    text: capped,
    durationMs: Math.max(500, Math.min(HARD_CAP_MAX_DURATION_MS, durationMs ?? DEFAULT_CAPTION_DURATION_MS)),
  });
  active.lastCaptionAt = now;
  return { captionCount: active.captions.length, timestampMs };
}

function getStatus(): {
  active: boolean;
  frameCount?: number;
  captionCount?: number;
  elapsedMs?: number;
  maxDurationMs?: number;
} {
  if (!active) {
    return { active: false };
  }
  return {
    active: true,
    frameCount: active.frames.length,
    captionCount: active.captions.length,
    elapsedMs: Date.now() - active.startedAt,
    maxDurationMs: active.maxDurationMs,
  };
}

// ---------------------------------------------------------------------------
// Test-only helpers
// ---------------------------------------------------------------------------

/** @internal Exposed for tests so they can reset state between cases. */
export function __resetRecordingStateForTests(): void {
  if (active?.autoStopTimer) {
    clearTimeout(active.autoStopTimer);
  }
  if (active?.watchdogTimer) {
    clearInterval(active.watchdogTimer);
  }
  if (active?.stream) {
    // Best-effort cleanup so a leaked stream doesn't break subsequent tests.
    void safeStop(active.stream);
  }
  active = null;
}

/** @internal Exposed for tests. */
export function __isRecordingActive(): boolean {
  return active !== null;
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

const recordSchema = z.object({
  action: z
    .enum(['start', 'stop', 'status'])
    .describe(
      'Lifecycle action: "start" begins a new recording, "stop" finalizes it and writes the MJPEG .avi video to disk, "status" reports whether one is active.',
    ),
  maxDurationMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only used with action="start". Maximum recording duration in ms (default 30000, hard cap 120000).'),
  everyNthFrame: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only used with action="start". Capture every Nth screencast frame (default 2). Higher = smaller file.'),
  maxWidth: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only used with action="start". Max frame width in pixels (default 1024).'),
  maxHeight: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only used with action="start". Max frame height in pixels (default 720).'),
  outputPath: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Only used with action="start". Absolute path inside the Mastra Code browser-recordings app-data directory. Defaults to a generated file there.',
    ),
});

const recordCaptionSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(MAX_CAPTION_LENGTH)
    .describe('Very short caption (max ~6 words) describing what you just did in the browser.'),
  durationMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('How long the caption should remain visible in the video (ms). Default 2500ms.'),
});

/**
 * Create the Mastra Code-only browser recording tools bound to a browser.
 *
 * Intended to be merged into the underlying browser's `getTools()` by the
 * Mastra Code-side wrapper in `createBrowserFromSettings`. Do NOT export
 * this from `@mastra/stagehand` or `@mastra/agent-browser`.
 */
export function createBrowserRecordingTools(browser: MastraBrowser) {
  return {
    browser_record: createTool({
      id: 'browser_record',
      description:
        'Control browser video recording. Use action="start" to begin recording the current browser session, then add labels via browser_record_caption as you work, then call this tool again with action="stop" to encode and save an MJPEG .avi video (plays in Preview/QuickTime/VLC/browsers). Use action="status" to check whether a recording is currently active. Recording auto-stops at the duration cap.',
      inputSchema: recordSchema,
      execute: async (input, { agent }) => {
        try {
          if (input.action === 'start') {
            const { id, outputPath, maxDurationMs } = await startRecording(browser, {
              ...input,
              threadId: agent?.threadId,
            });
            return {
              content: `Recording started (id: ${id}). Will auto-stop after ${maxDurationMs}ms or when you call this tool with action="stop". Output: ${outputPath}`,
              action: 'start' as const,
              recordingId: id,
              outputPath,
              maxDurationMs,
              isError: false,
            };
          }
          if (input.action === 'stop') {
            const result = await stopRecording();
            return {
              content: `Recording saved to ${result.filePath} (${result.frameCount} frames, ${result.captionCount} captions, ${result.durationMs}ms).`,
              action: 'stop' as const,
              ...result,
              isError: false,
            };
          }
          const status = getStatus();
          return {
            content: status.active
              ? `Recording active: ${status.frameCount} frames, ${status.captionCount} captions, ${status.elapsedMs}ms elapsed (cap ${status.maxDurationMs}ms).`
              : 'No browser recording is active.',
            action: 'status' as const,
            ...status,
            isError: false,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: msg, isError: true };
        }
      },
    }),

    browser_record_caption: createTool({
      id: 'browser_record_caption',
      description:
        'Add a very short, plain-language caption (max ~6 words) describing what you just did in the browser. The caption is burned onto the recorded video at the current moment. Only call this while a recording is active (see browser_record action="start").',
      inputSchema: recordCaptionSchema,
      execute: async ({ text, durationMs }) => {
        try {
          const { captionCount, timestampMs } = addCaption(text, durationMs);
          return {
            content: `Caption added at ${timestampMs}ms (total: ${captionCount}).`,
            captionCount,
            timestampMs,
            isError: false,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: msg, isError: true };
        }
      },
    }),
  };
}
