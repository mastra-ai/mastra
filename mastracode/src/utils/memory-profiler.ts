/**
 * Lightweight memory profiler for Mastra Code.
 *
 * Samples process.memoryUsage() on an interval and writes a JSONL timeline
 * to disk.  Optionally triggers V8 heap snapshots when memory crosses
 * configurable thresholds.  Designed for minimal runtime overhead — no
 * heavy allocations or blocking operations during normal sampling.
 *
 * Env configuration:
 *   MASTRACODE_PROFILE=1           enable auto-start from main/headless
 *   MASTRACODE_PROFILE_DIR=<path>  override output directory
 *   MASTRACODE_PROFILE_INTERVAL_MS=<ms>  sampling interval (default 10_000)
 *   MASTRACODE_PROFILE_HEAP_MB=<mb>     trigger snapshot when heapUsed exceeds this
 *   MASTRACODE_PROFILE_RSS_MB=<mb>      trigger snapshot when rss exceeds this
 *   MASTRACODE_PROFILE_MAX_SNAPSHOTS=<n>  max automatic snapshots (default 3)
 */
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import { getAppDataDir } from './project.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileSample {
  /** ISO timestamp of the sample */
  t: string;
  /** Process resident set size in bytes */
  rss: number;
  /** V8 heap total in bytes */
  heapTotal: number;
  /** V8 heap used in bytes */
  heapUsed: number;
  /** C++/native memory usage in bytes (bound to the V8 isolate) */
  external: number;
  /** ArrayBuffer memory in bytes */
  arrayBuffers: number;
  /** CPU time used by this process (user+system) in micro-seconds, or 0 */
  cpuUser: number;
  cpuSystem: number;
  /** Process PID */
  pid: number;
  /** Current working directory */
  cwd: string;
  /** Current agent mode, if available ("build"|"plan"|"fast") */
  mode?: string;
  /** Current thread ID, if available */
  threadId?: string;
  /** Current resource ID, if available */
  resourceId?: string;
  /** Current model ID, if available */
  modelId?: string;
}

export interface MemoryProfilerOptions {
  /** Sampling interval in ms (default 10_000) */
  intervalMs?: number;
  /** Trigger heap snapshot when heapUsed exceeds this (bytes) */
  heapThresholdBytes?: number;
  /** Trigger heap snapshot when RSS exceeds this (bytes) */
  rssThresholdBytes?: number;
  /** Max automatic heap snapshots (default 3) */
  maxSnapshots?: number;
  /** Output directory (default: appDataDir/profiles/<session>-<pid>) */
  outDir?: string;
  /** Optional getter for current mode */
  getMode?: () => string | undefined;
  /** Optional getter for current thread ID */
  getThreadId?: () => string | undefined;
  /** Optional getter for current resource ID */
  getResourceId?: () => string | undefined;
  /** Optional getter for current model ID */
  getModelId?: () => string | undefined;
}

export interface MemoryProfilerStatus {
  enabled: boolean;
  running: boolean;
  outDir: string;
  sampleCount: number;
  snapshotCount: number;
  latestSample: ProfileSample | null;
  heapThresholdBytes: number | undefined;
  rssThresholdBytes: number | undefined;
  maxSnapshots: number;
  intervalMs: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_MAX_SNAPSHOTS = 3;

// ---------------------------------------------------------------------------
// MemoryProfiler
// ---------------------------------------------------------------------------

export class MemoryProfiler {
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _outDir: string;
  private _sampleStream: fs.WriteStream | null = null;
  private _sampleCount = 0;
  private _snapshotCount = 0;
  private _latestSample: ProfileSample | null = null;

  readonly intervalMs: number;
  readonly heapThresholdBytes: number | undefined;
  readonly rssThresholdBytes: number | undefined;
  readonly maxSnapshots: number;
  readonly getMode?: () => string | undefined;
  readonly getThreadId?: () => string | undefined;
  readonly getResourceId?: () => string | undefined;
  readonly getModelId?: () => string | undefined;

  constructor(opts: MemoryProfilerOptions = {}) {
    // Resolve output directory
    const sessionTag = `${Date.now()}-${process.pid}`;
    this._outDir =
      opts.outDir ?? path.join(getAppDataDir(), 'profiles', sessionTag);

    this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.maxSnapshots = opts.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;

    // Thresholds — accept bytes directly from options, but env vars in MB
    this.heapThresholdBytes = opts.heapThresholdBytes ?? this._envHeapMb();
    this.rssThresholdBytes = opts.rssThresholdBytes ?? this._envRssMb();

    this.getMode = opts.getMode;
    this.getThreadId = opts.getThreadId;
    this.getResourceId = opts.getResourceId;
    this.getModelId = opts.getModelId;

    // Parse env overrides
    const envInterval = process.env.MASTRACODE_PROFILE_INTERVAL_MS;
    if (envInterval) {
      const parsed = parseInt(envInterval, 10);
      if (!isNaN(parsed) && parsed > 0) {
        this.intervalMs = parsed;
      }
    }

    const envMax = process.env.MASTRACODE_PROFILE_MAX_SNAPSHOTS;
    if (envMax) {
      const parsed = parseInt(envMax, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        (this as any).maxSnapshots = parsed;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Start periodic sampling.  Safe to call multiple times (no-op if running). */
  start(): void {
    if (this._intervalId) return;

    // Ensure output directory exists
    fs.mkdirSync(this._outDir, { recursive: true });

    const samplesPath = path.join(this._outDir, 'samples.jsonl');
    this._sampleStream = fs.createWriteStream(samplesPath, { flags: 'a' });

    // Take an immediate baseline sample
    this._takeSample();

    this._intervalId = setInterval(() => {
      this._takeSample();
    }, this.intervalMs);

    // Unref so the timer doesn't keep the process alive
    this._intervalId.unref();
  }

  /** Stop periodic sampling.  Safe to call multiple times (no-op if stopped). */
  stop(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    // Take one final sample
    this._takeSample();
    this._closeStream();
  }

  /**
   * Manually trigger a V8 heap snapshot.  The snapshot is written to the
   * profile output directory with a descriptive filename.
   *
   * Returns the path to the snapshot file, or `null` if it failed.
   */
  snapshot(reason: string): string | null {
    const sanitized = reason.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const filename = `heap-${sanitized}-${Date.now()}.heapsnapshot`;
    const filepath = path.join(this._outDir, filename);

    try {
      v8.writeHeapSnapshot(filepath);
      this._snapshotCount++;
      return filepath;
    } catch (err) {
      // If memory is critically low, snapshot writing may fail
      process.stderr.write(
        `[memory-profiler] Failed to write heap snapshot: ${(err as Error).message}\n`,
      );
      return null;
    }
  }

  /** Return current profiler status. */
  status(): MemoryProfilerStatus {
    return {
      enabled: true,
      running: this._intervalId !== null,
      outDir: this._outDir,
      sampleCount: this._sampleCount,
      snapshotCount: this._snapshotCount,
      latestSample: this._latestSample,
      heapThresholdBytes: this.heapThresholdBytes,
      rssThresholdBytes: this.rssThresholdBytes,
      maxSnapshots: this.maxSnapshots,
      intervalMs: this.intervalMs,
    };
  }

  /** The active output directory path. */
  get outDir(): string {
    return this._outDir;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private _takeSample(): void {
    const mem = process.memoryUsage();
    const resourceUsage = process.resourceUsage();

    const sample: ProfileSample = {
      t: new Date().toISOString(),
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers ?? 0,
      cpuUser: resourceUsage.userCPUTime,
      cpuSystem: resourceUsage.systemCPUTime,
      pid: process.pid,
      cwd: process.cwd(),
      mode: this.getMode?.(),
      threadId: this.getThreadId?.(),
      resourceId: this.getResourceId?.(),
      modelId: this.getModelId?.(),
    };

    this._latestSample = sample;
    this._sampleCount++;

    // Write to JSONL
    if (this._sampleStream) {
      this._sampleStream.write(JSON.stringify(sample) + '\n');
    }

    // Check thresholds
    this._checkThresholds(sample);
  }

  private _checkThresholds(sample: ProfileSample): void {
    const maxReached =
      typeof this.maxSnapshots === 'number' && this._snapshotCount >= this.maxSnapshots;
    if (maxReached) return;

    // heapUsed threshold (most common trigger)
    if (this.heapThresholdBytes && sample.heapUsed >= this.heapThresholdBytes) {
      const mb = (sample.heapUsed / 1024 / 1024).toFixed(1);
      this.snapshot(`auto-heap-${mb}mb`);
      return;
    }

    // RSS threshold
    if (this.rssThresholdBytes && sample.rss >= this.rssThresholdBytes) {
      const mb = (sample.rss / 1024 / 1024).toFixed(1);
      this.snapshot(`auto-rss-${mb}mb`);
    }
  }

  private _closeStream(): void {
    if (this._sampleStream) {
      try {
        this._sampleStream.end();
      } catch {
        // Best effort
      }
      this._sampleStream = null;
    }
  }

  /** Parse MASTRACODE_PROFILE_HEAP_MB env var into bytes. */
  private _envHeapMb(): number | undefined {
    const val = process.env.MASTRACODE_PROFILE_HEAP_MB;
    if (!val) return undefined;
    const mb = parseFloat(val);
    return isNaN(mb) || mb <= 0 ? undefined : mb * 1024 * 1024;
  }

  /** Parse MASTRACODE_PROFILE_RSS_MB env var into bytes. */
  private _envRssMb(): number | undefined {
    const val = process.env.MASTRACODE_PROFILE_RSS_MB;
    if (!val) return undefined;
    const mb = parseFloat(val);
    return isNaN(mb) || mb <= 0 ? undefined : mb * 1024 * 1024;
  }
}

// ---------------------------------------------------------------------------
// Helper: parse env & construct profiler
// ---------------------------------------------------------------------------

/** Parse MASTRACODE_PROFILE_DIR or default. */
export function resolveProfileDir(overrideDir?: string): string {
  return (
    overrideDir ??
    process.env.MASTRACODE_PROFILE_DIR ??
    path.join(getAppDataDir(), 'profiles', `${Date.now()}-${process.pid}`)
  );
}

/** Returns true when the MASTRACODE_PROFILE env var requests auto-start. */
export function isProfileEnabled(): boolean {
  return process.env.MASTRACODE_PROFILE === '1';
}
