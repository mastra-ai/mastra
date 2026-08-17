import { randomUUID } from 'node:crypto';
import { appendFile, chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { join } from 'node:path';
import { PerformanceObserver, type PerformanceEntry } from 'node:perf_hooks';
import { arch, platform } from 'node:process';
import { getHeapSpaceStatistics, getHeapStatistics } from 'node:v8';

import { getAppDataDir } from './utils/project.js';

export const PROCESS_MEMORY_DIAGNOSTICS_DEFAULTS = {
  sampleIntervalMs: 10_000,
  captureIntervalMs: 300_000,
  allocationIntervalBytes: 524_288,
} as const;

export const PROCESS_MEMORY_DIAGNOSTICS_MINIMUMS = {
  sampleIntervalMs: 1_000,
  captureIntervalMs: 10_000,
  allocationIntervalBytes: 32_768,
} as const;

export interface ProcessMemoryDiagnosticsConfig {
  parentDirectory: string;
  sampleIntervalMs: number;
  captureIntervalMs: number;
  allocationIntervalBytes: number;
}

export interface ProcessMemoryDiagnosticsEnvironment {
  MASTRACODE_PROFILE?: string;
  MASTRACODE_PROFILE_DIR?: string;
  MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS?: string;
  MASTRACODE_PROFILE_CAPTURE_INTERVAL_MS?: string;
  MASTRACODE_PROFILE_ALLOCATION_INTERVAL_BYTES?: string;
}

export interface ProcessMemoryDiagnosticsMemorySample {
  timestamp: string;
  sequence: number;
  elapsedMs: number;
  memory: ReturnType<typeof process.memoryUsage>;
  resourceUsage: ReturnType<typeof process.resourceUsage>;
  heap: ReturnType<typeof getHeapStatistics>;
  heapSpaces: ReturnType<typeof getHeapSpaceStatistics>;
}

export interface ProcessMemoryDiagnosticsStatus {
  state: 'inactive' | 'starting' | 'active' | 'stopping' | 'error';
  outputDirectory: string | null;
  config: ProcessMemoryDiagnosticsConfig;
  sampleCount: number;
  captureCount: number;
  gcEventCount: number;
  latestSample: ProcessMemoryDiagnosticsMemorySample | null;
  latestCapturePath: string | null;
  error: string | null;
}

export interface ProcessMemoryDiagnosticsCapture {
  path: string;
  sequence: number;
  timestamp: string;
  reason: 'manual' | 'periodic' | 'stop';
}

interface InspectorSessionAdapter {
  connect(): void;
  disconnect(): void;
  post(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

interface PerformanceObserverAdapter {
  observe(options: Parameters<PerformanceObserver['observe']>[0]): void;
  disconnect(): void;
}

interface ProcessMemoryDiagnosticsDependencies {
  createInspectorSession?: () => InspectorSessionAdapter;
  createPerformanceObserver?: (callback: (entries: PerformanceEntry[]) => void) => PerformanceObserverAdapter;
  now?: () => Date;
  randomId?: () => string;
}

export interface ProcessMemoryDiagnosticsSetup {
  diagnostics: ProcessMemoryDiagnostics;
  enabled: boolean;
  error: string | null;
}

export class ProcessMemoryDiagnosticsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessMemoryDiagnosticsConfigError';
  }
}

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

function parseBoundedInteger(
  env: ProcessMemoryDiagnosticsEnvironment,
  name: keyof ProcessMemoryDiagnosticsEnvironment,
  fallback: number,
  minimum: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new ProcessMemoryDiagnosticsConfigError(
      `${name} must be an integer greater than or equal to ${minimum}; received ${JSON.stringify(raw)}.`,
    );
  }
  return value;
}

export function parseProcessMemoryDiagnosticsEnvironment(env: ProcessMemoryDiagnosticsEnvironment = process.env): {
  enabled: boolean;
  config: ProcessMemoryDiagnosticsConfig;
} {
  return {
    enabled: isEnabled(env.MASTRACODE_PROFILE),
    config: {
      parentDirectory: env.MASTRACODE_PROFILE_DIR?.trim() || join(getAppDataDir(), 'profiles'),
      sampleIntervalMs: parseBoundedInteger(
        env,
        'MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS',
        PROCESS_MEMORY_DIAGNOSTICS_DEFAULTS.sampleIntervalMs,
        PROCESS_MEMORY_DIAGNOSTICS_MINIMUMS.sampleIntervalMs,
      ),
      captureIntervalMs: parseBoundedInteger(
        env,
        'MASTRACODE_PROFILE_CAPTURE_INTERVAL_MS',
        PROCESS_MEMORY_DIAGNOSTICS_DEFAULTS.captureIntervalMs,
        PROCESS_MEMORY_DIAGNOSTICS_MINIMUMS.captureIntervalMs,
      ),
      allocationIntervalBytes: parseBoundedInteger(
        env,
        'MASTRACODE_PROFILE_ALLOCATION_INTERVAL_BYTES',
        PROCESS_MEMORY_DIAGNOSTICS_DEFAULTS.allocationIntervalBytes,
        PROCESS_MEMORY_DIAGNOSTICS_MINIMUMS.allocationIntervalBytes,
      ),
    },
  };
}

export function createProcessMemoryDiagnosticsFromEnvironment(
  env: ProcessMemoryDiagnosticsEnvironment = process.env,
  dependencies: ProcessMemoryDiagnosticsDependencies = {},
): ProcessMemoryDiagnosticsSetup {
  try {
    const { enabled, config } = parseProcessMemoryDiagnosticsEnvironment(env);
    return { diagnostics: new ProcessMemoryDiagnostics(config, dependencies), enabled, error: null };
  } catch (error) {
    const config: ProcessMemoryDiagnosticsConfig = {
      parentDirectory: env.MASTRACODE_PROFILE_DIR?.trim() || join(getAppDataDir(), 'profiles'),
      ...PROCESS_MEMORY_DIAGNOSTICS_DEFAULTS,
    };
    const message = error instanceof Error ? error.message : String(error);
    return {
      diagnostics: new ProcessMemoryDiagnostics(config, dependencies, message),
      enabled: isEnabled(env.MASTRACODE_PROFILE),
      error: message,
    };
  }
}

export async function startConfiguredProcessMemoryDiagnostics(
  setup: ProcessMemoryDiagnosticsSetup,
  warn: (message: string) => void,
): Promise<ProcessMemoryDiagnostics> {
  if (!setup.enabled) return setup.diagnostics;
  if (setup.error) {
    warn(`Process memory diagnostics were not started: ${setup.error}`);
    return setup.diagnostics;
  }

  const status = await setup.diagnostics.start();
  if (status.state !== 'active') {
    warn(`Process memory diagnostics were not started: ${status.error ?? 'unknown inspector error'}`);
  }
  return setup.diagnostics;
}

function defaultInspectorSession(): InspectorSessionAdapter {
  const session = new Session();
  return {
    connect: () => session.connect(),
    disconnect: () => session.disconnect(),
    post: async (method, params) =>
      (await session.post(
        method as Parameters<Session['post']>[0],
        params as Parameters<Session['post']>[1],
      )) as unknown as Record<string, unknown>,
  };
}

function defaultPerformanceObserver(callback: (entries: PerformanceEntry[]) => void) {
  const observer = new PerformanceObserver(list => callback(list.getEntries()));
  return observer;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeTimestamp(date: Date): string {
  return date.toISOString().replaceAll(':', '-');
}

function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  timer.unref?.();
}

export class ProcessMemoryDiagnostics {
  readonly config: ProcessMemoryDiagnosticsConfig;

  private state: ProcessMemoryDiagnosticsStatus['state'] = 'inactive';
  private outputDirectory: string | null = null;
  private inspector: InspectorSessionAdapter | null = null;
  private observer: PerformanceObserverAdapter | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private captureTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt: Date | null = null;
  private sampleCount = 0;
  private captureCount = 0;
  private gcEventCount = 0;
  private latestSample: ProcessMemoryDiagnosticsMemorySample | null = null;
  private latestCapturePath: string | null = null;
  private latestError: string | null;
  private samplingActive = false;
  private stopRequested = false;
  private stoppingPromise: Promise<ProcessMemoryDiagnosticsStatus> | null = null;
  private captureQueue: Promise<unknown> = Promise.resolve();
  private writeQueue: Promise<unknown> = Promise.resolve();

  private readonly createInspectorSession: () => InspectorSessionAdapter;
  private readonly createPerformanceObserver: NonNullable<
    ProcessMemoryDiagnosticsDependencies['createPerformanceObserver']
  >;
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(
    config: ProcessMemoryDiagnosticsConfig,
    dependencies: ProcessMemoryDiagnosticsDependencies = {},
    initialError: string | null = null,
  ) {
    this.config = { ...config };
    this.latestError = initialError;
    this.createInspectorSession = dependencies.createInspectorSession ?? defaultInspectorSession;
    this.createPerformanceObserver = dependencies.createPerformanceObserver ?? defaultPerformanceObserver;
    this.now = dependencies.now ?? (() => new Date());
    this.randomId = dependencies.randomId ?? randomUUID;
  }

  getStatus(): ProcessMemoryDiagnosticsStatus {
    return {
      state: this.state,
      outputDirectory: this.outputDirectory,
      config: { ...this.config },
      sampleCount: this.sampleCount,
      captureCount: this.captureCount,
      gcEventCount: this.gcEventCount,
      latestSample: this.latestSample,
      latestCapturePath: this.latestCapturePath,
      error: this.latestError,
    };
  }

  async start(): Promise<ProcessMemoryDiagnosticsStatus> {
    if (this.state === 'active' || this.state === 'starting') return this.getStatus();
    if (this.state === 'stopping' && this.stoppingPromise) return this.stoppingPromise;
    if (this.latestError && this.outputDirectory === null) {
      this.state = 'error';
      return this.getStatus();
    }

    this.state = 'starting';
    this.stoppingPromise = null;
    this.stopRequested = false;
    this.outputDirectory = null;
    this.sampleCount = 0;
    this.captureCount = 0;
    this.gcEventCount = 0;
    this.latestSample = null;
    this.latestCapturePath = null;
    this.latestError = null;
    this.startedAt = this.now();

    try {
      await this.createArtifacts();
      this.observeGc();
      this.inspector = this.createInspectorSession();
      this.inspector.connect();
      await this.startSampling();
      await this.takeSample();

      this.sampleTimer = setInterval(() => {
        void this.takeSample().catch(error => this.recordError('Process sample failed', error));
      }, this.config.sampleIntervalMs);
      unrefTimer(this.sampleTimer);

      this.captureTimer = setInterval(() => {
        void this.capture('periodic').catch(error => this.recordError('Periodic allocation capture failed', error));
      }, this.config.captureIntervalMs);
      unrefTimer(this.captureTimer);

      this.state = 'active';
      return this.getStatus();
    } catch (error) {
      this.latestError = `Unable to start process memory diagnostics: ${errorMessage(error)}`;
      await this.cleanupAfterStartFailure();
      this.state = 'error';
      return this.getStatus();
    }
  }

  capture(reason: 'manual' | 'periodic' = 'manual'): Promise<ProcessMemoryDiagnosticsCapture> {
    if (this.state !== 'active') {
      return Promise.reject(new Error(this.latestError ?? 'Process memory diagnostics are not active.'));
    }
    return this.enqueueCapture(() => this.captureEpoch(reason, false));
  }

  async stop(): Promise<ProcessMemoryDiagnosticsStatus> {
    if (this.stoppingPromise) return this.stoppingPromise;
    if (this.state === 'inactive') return this.getStatus();
    if (this.state === 'error' && !this.inspector && !this.outputDirectory) return this.getStatus();

    this.stopRequested = true;
    this.state = 'stopping';
    this.clearTimersAndObserver();

    this.stoppingPromise = (async () => {
      try {
        if (this.outputDirectory) await this.takeSample();
        await this.enqueueCapture(async () => {
          if (this.inspector && this.samplingActive) await this.captureEpoch('stop', true);
        });
        await this.writeQueue;
      } catch (error) {
        this.latestError = `Unable to stop process memory diagnostics cleanly: ${errorMessage(error)}`;
      } finally {
        this.disconnectInspector();
        this.state = this.latestError ? 'error' : 'inactive';
      }
      return this.getStatus();
    })();

    return this.stoppingPromise;
  }

  private async createArtifacts(): Promise<void> {
    await mkdir(this.config.parentDirectory, { recursive: true });
    const runName = `run-${safeTimestamp(this.startedAt!)}-${process.pid}-${this.randomId()
      .replaceAll(/[^a-zA-Z0-9-]/g, '')
      .slice(0, 12)}`;
    this.outputDirectory = join(this.config.parentDirectory, runName);
    await mkdir(this.outputDirectory, { mode: 0o700 });
    await chmod(this.outputDirectory, 0o700);

    const metadata = {
      schemaVersion: 1,
      runId: runName,
      startedAt: this.startedAt!.toISOString(),
      pid: process.pid,
      nodeVersion: process.version,
      platform,
      arch,
      config: this.config,
    };
    await writeFile(join(this.outputDirectory, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    await writeFile(join(this.outputDirectory, 'process-samples.jsonl'), '', { flag: 'wx', mode: 0o600 });
    await writeFile(join(this.outputDirectory, 'gc-events.jsonl'), '', { flag: 'wx', mode: 0o600 });
  }

  private observeGc(): void {
    const observer = this.createPerformanceObserver(entries => {
      for (const entry of entries) {
        const before = this.latestSample?.memory ?? null;
        const after = process.memoryUsage();
        const gcEntry = entry as PerformanceEntry & {
          kind?: number;
          flags?: number;
          detail?: { kind?: number; flags?: number };
        };
        this.gcEventCount += 1;
        void this.enqueueWrite('gc-events.jsonl', {
          timestamp: this.now().toISOString(),
          sequence: this.gcEventCount,
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
          kind: gcEntry.detail?.kind ?? gcEntry.kind ?? null,
          flags: gcEntry.detail?.flags ?? gcEntry.flags ?? null,
          before,
          after,
          latestSampleSequence: this.latestSample?.sequence ?? null,
        }).catch(error => this.recordError('GC event write failed', error));
      }
    });
    observer.observe({ entryTypes: ['gc'] });
    this.observer = observer;
  }

  private async startSampling(): Promise<void> {
    if (!this.inspector) throw new Error('Inspector session is unavailable.');
    await this.inspector.post('HeapProfiler.startSampling', {
      samplingInterval: this.config.allocationIntervalBytes,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
    this.samplingActive = true;
  }

  private async takeSample(): Promise<ProcessMemoryDiagnosticsMemorySample> {
    if (!this.outputDirectory || !this.startedAt) throw new Error('Diagnostics output directory is unavailable.');
    const sample: ProcessMemoryDiagnosticsMemorySample = {
      timestamp: this.now().toISOString(),
      sequence: this.sampleCount + 1,
      elapsedMs: Math.max(0, this.now().getTime() - this.startedAt.getTime()),
      memory: process.memoryUsage(),
      resourceUsage: process.resourceUsage(),
      heap: getHeapStatistics(),
      heapSpaces: getHeapSpaceStatistics(),
    };
    this.sampleCount = sample.sequence;
    this.latestSample = sample;
    await this.enqueueWrite('process-samples.jsonl', sample);
    return sample;
  }

  private enqueueWrite(fileName: string, value: unknown): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      if (!this.outputDirectory) return;
      await appendFile(join(this.outputDirectory, fileName), `${JSON.stringify(value)}\n`, { mode: 0o600 });
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  private enqueueCapture<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.captureQueue.then(operation);
    this.captureQueue = result.catch(() => undefined);
    return result;
  }

  private async captureEpoch(
    reason: ProcessMemoryDiagnosticsCapture['reason'],
    final: boolean,
  ): Promise<ProcessMemoryDiagnosticsCapture> {
    if (!this.inspector || !this.samplingActive || !this.outputDirectory) {
      throw new Error(this.latestError ?? 'Allocation sampling is not active.');
    }

    let response: Record<string, unknown>;
    try {
      response = await this.inspector.post('HeapProfiler.stopSampling');
      this.samplingActive = false;
    } catch (error) {
      this.latestError = `Allocation capture failed: ${errorMessage(error)}`;
      if (!final && !this.stopRequested) await this.restartSamplingAfterFailure();
      throw new Error(this.latestError, { cause: error });
    }

    const profile = response.profile;
    if (!profile || typeof profile !== 'object') {
      this.latestError = 'Allocation capture failed: inspector returned no profile.';
      if (!final && !this.stopRequested) await this.restartSamplingAfterFailure();
      throw new Error(this.latestError);
    }

    const sequence = this.captureCount + 1;
    const timestamp = this.now().toISOString();
    const filename = `allocation-${String(sequence).padStart(6, '0')}-${safeTimestamp(new Date(timestamp))}.heapprofile`;
    const finalPath = join(this.outputDirectory, filename);
    const temporaryPath = join(this.outputDirectory, `.${filename}.${this.randomId()}.tmp`);

    try {
      await writeFile(temporaryPath, `${JSON.stringify(profile)}\n`, { flag: 'wx', mode: 0o600 });
      await chmod(temporaryPath, 0o600);
      await rename(temporaryPath, finalPath);
      await chmod(finalPath, 0o600);
      this.captureCount = sequence;
      this.latestCapturePath = finalPath;
      this.latestError = null;
    } catch (error) {
      this.latestError = `Unable to persist allocation capture: ${errorMessage(error)}`;
      throw new Error(this.latestError, { cause: error });
    } finally {
      if (!final && !this.stopRequested && this.state === 'active') {
        try {
          await this.startSampling();
        } catch (error) {
          this.latestError = `Unable to restart allocation sampling: ${errorMessage(error)}`;
          this.state = 'error';
        }
      }
    }

    if (!final && !this.stopRequested && !this.samplingActive) {
      throw new Error(this.latestError ?? 'Allocation sampling did not restart.');
    }

    return { path: finalPath, sequence, timestamp, reason };
  }

  private async restartSamplingAfterFailure(): Promise<void> {
    try {
      await this.startSampling();
    } catch (error) {
      this.latestError = `Unable to restart allocation sampling: ${errorMessage(error)}`;
      this.state = 'error';
    }
  }

  private recordError(prefix: string, error: unknown): void {
    this.latestError = `${prefix}: ${errorMessage(error)}`;
  }

  private clearTimersAndObserver(): void {
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    if (this.captureTimer) clearInterval(this.captureTimer);
    this.sampleTimer = null;
    this.captureTimer = null;
    this.observer?.disconnect();
    this.observer = null;
  }

  private disconnectInspector(): void {
    this.samplingActive = false;
    if (!this.inspector) return;
    try {
      this.inspector.disconnect();
    } catch {
      // Best-effort cleanup after an inspector failure.
    }
    this.inspector = null;
  }

  private async cleanupAfterStartFailure(): Promise<void> {
    this.clearTimersAndObserver();
    this.disconnectInspector();
    await this.writeQueue;
  }
}
