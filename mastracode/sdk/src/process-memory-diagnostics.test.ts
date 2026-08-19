import { chmod, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PerformanceEntry } from 'node:perf_hooks';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createProcessMemoryDiagnosticsFromEnvironment,
  parseProcessMemoryDiagnosticsEnvironment,
  ProcessMemoryDiagnostics,
  PROCESS_MEMORY_DIAGNOSTICS_DEFAULTS,
  stopProcessMemoryDiagnosticsWithTimeout,
} from './process-memory-diagnostics.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function allocationProfile() {
  return {
    head: {
      callFrame: { functionName: '(root)', scriptId: '0', url: '', lineNumber: 0, columnNumber: 0 },
      selfSize: 0,
      id: 1,
      children: [],
    },
    samples: [],
  };
}

function createInspector(
  options: { stopResponses?: Array<Promise<Record<string, unknown>>>; startError?: Error } = {},
) {
  const posts: Array<{ method: string; params?: Record<string, unknown> }> = [];
  const disconnect = vi.fn();
  const connect = vi.fn();
  let stopIndex = 0;
  return {
    posts,
    connect,
    disconnect,
    adapter: {
      connect,
      disconnect,
      async post(method: string, params?: Record<string, unknown>) {
        posts.push({ method, params });
        if (method === 'HeapProfiler.startSampling') {
          if (options.startError) throw options.startError;
          return {};
        }
        const response = options.stopResponses?.[stopIndex++];
        return response ? response : { profile: allocationProfile() };
      },
    },
  };
}

async function createHarness(options: Parameters<typeof createInspector>[0] = {}) {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'mastracode-profile-test-'));
  const inspector = createInspector(options);
  let observerCallback: ((entries: PerformanceEntry[]) => void) | null = null;
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  const diagnostics = new ProcessMemoryDiagnostics(
    {
      parentDirectory,
      sampleIntervalMs: 60_000,
      captureIntervalMs: 60_000,
      allocationIntervalBytes: 524_288,
    },
    {
      createInspectorSession: () => inspector.adapter,
      createPerformanceObserver: callback => {
        observerCallback = callback;
        return observer;
      },
      randomId: () => 'test-id',
    },
  );
  return {
    parentDirectory,
    diagnostics,
    inspector,
    observer,
    emitGc: (entries: PerformanceEntry[]) => observerCallback?.(entries),
  };
}

const roots: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('parseProcessMemoryDiagnosticsEnvironment', () => {
  it('uses safe defaults and parses truthy enable values', () => {
    const result = parseProcessMemoryDiagnosticsEnvironment({
      MASTRACODE_PROFILE: ' YeS ',
      MASTRACODE_PROFILE_DIR: '/tmp/mastracode-profiles',
    });

    expect(result).toEqual({
      enabled: true,
      config: {
        parentDirectory: '/tmp/mastracode-profiles',
        ...PROCESS_MEMORY_DIAGNOSTICS_DEFAULTS,
      },
    });
  });

  it.each(['0', 'false', 'off', '', 'anything'])('treats %j as disabled', value => {
    expect(
      parseProcessMemoryDiagnosticsEnvironment({
        MASTRACODE_PROFILE: value,
        MASTRACODE_PROFILE_DIR: '/tmp/mastracode-profiles',
      }).enabled,
    ).toBe(false);
  });

  it('accepts bounded numeric overrides', () => {
    const result = parseProcessMemoryDiagnosticsEnvironment({
      MASTRACODE_PROFILE_DIR: '/tmp/mastracode-profiles',
      MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS: '1000',
      MASTRACODE_PROFILE_CAPTURE_INTERVAL_MS: '10000',
      MASTRACODE_PROFILE_ALLOCATION_INTERVAL_BYTES: '32768',
    });

    expect(result.config).toMatchObject({
      sampleIntervalMs: 1_000,
      captureIntervalMs: 10_000,
      allocationIntervalBytes: 32_768,
    });
  });

  it.each([
    ['MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS', '999', '1000'],
    ['MASTRACODE_PROFILE_CAPTURE_INTERVAL_MS', '1.5', '10000'],
    ['MASTRACODE_PROFILE_ALLOCATION_INTERVAL_BYTES', 'nope', '32768'],
  ] as const)('rejects invalid %s values', (name, value, _minimum) => {
    expect(() =>
      parseProcessMemoryDiagnosticsEnvironment({
        MASTRACODE_PROFILE_DIR: '/tmp/mastracode-profiles',
        [name]: value,
      }),
    ).toThrow(`${name} must be an integer`);
  });

  it.each(['MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS', 'MASTRACODE_PROFILE_CAPTURE_INTERVAL_MS'] as const)(
    'rejects %s values above the Node timer limit',
    name => {
      expect(() =>
        parseProcessMemoryDiagnosticsEnvironment({
          MASTRACODE_PROFILE_DIR: '/tmp/mastracode-profiles',
          [name]: '2147483648',
        }),
      ).toThrow(`${name} must be an integer between`);
    },
  );

  it('does not create the default profile directory when diagnostics are disabled', async () => {
    const appDataDirectory = await mkdtemp(join(tmpdir(), 'mastracode-disabled-profile-test-'));
    roots.push(appDataDirectory);
    const profileParent = join(appDataDirectory, 'profiles');
    const previous = process.env.MASTRA_APP_DATA_DIR;
    process.env.MASTRA_APP_DATA_DIR = appDataDirectory;
    try {
      const setup = createProcessMemoryDiagnosticsFromEnvironment({ MASTRACODE_PROFILE: '0' });
      expect(setup.enabled).toBe(false);
      await expect(stat(profileParent)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      if (previous === undefined) delete process.env.MASTRA_APP_DATA_DIR;
      else process.env.MASTRA_APP_DATA_DIR = previous;
    }
  });

  it('returns an inactive diagnostics handle with an actionable configuration error', async () => {
    const setup = createProcessMemoryDiagnosticsFromEnvironment({
      MASTRACODE_PROFILE: '1',
      MASTRACODE_PROFILE_DIR: '/tmp/mastracode-profiles',
      MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS: '10',
    });

    expect(setup.enabled).toBe(true);
    expect(setup.error).toContain('MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS');
    expect(await setup.diagnostics.start()).toMatchObject({ state: 'error', outputDirectory: null });
  });
});

describe('stopProcessMemoryDiagnosticsWithTimeout', () => {
  it('returns after the timeout and warns when diagnostics stop hangs', async () => {
    vi.useFakeTimers();
    const warn = vi.fn();
    const diagnostics = { stop: vi.fn(() => new Promise(() => {})) } as unknown as ProcessMemoryDiagnostics;

    const stopping = stopProcessMemoryDiagnosticsWithTimeout(diagnostics, warn, 100);
    await vi.advanceTimersByTimeAsync(100);
    await stopping;

    expect(warn).toHaveBeenCalledWith(
      'Process memory diagnostics did not stop within 100ms; final artifacts may be incomplete.',
    );
    vi.useRealTimers();
  });

  it('warns and resolves when diagnostics stop rejects', async () => {
    const warn = vi.fn();
    const diagnostics = {
      stop: vi.fn().mockRejectedValue(new Error('inspector shutdown failed')),
    } as unknown as ProcessMemoryDiagnostics;

    await expect(stopProcessMemoryDiagnosticsWithTimeout(diagnostics, warn)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Process memory diagnostics did not stop cleanly: inspector shutdown failed');
  });
});

describe('ProcessMemoryDiagnostics', () => {
  it('creates private artifacts, samples V8 state, observes GC, and captures atomically', async () => {
    const harness = await createHarness();
    roots.push(harness.parentDirectory);

    const started = await harness.diagnostics.start();
    expect(started.state).toBe('active');
    expect(started.sampleCount).toBe(1);
    expect(harness.inspector.posts[0]).toEqual({
      method: 'HeapProfiler.startSampling',
      params: {
        samplingInterval: 524_288,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      },
    });
    expect(harness.observer.observe).toHaveBeenCalledWith({ entryTypes: ['gc'] });

    harness.emitGc([
      {
        name: 'gc',
        entryType: 'gc',
        startTime: 12,
        duration: 3,
        detail: { kind: 1, flags: 0 },
        toJSON: () => ({}),
      } as unknown as PerformanceEntry,
    ]);
    const capture = await harness.diagnostics.capture();
    const stopped = await harness.diagnostics.stop();

    expect(capture.path).toMatch(/allocation-000001-.*\.heapprofile$/);
    expect(stopped.state).toBe('inactive');
    expect(stopped.captureCount).toBe(2);
    expect(stopped.gcEventCount).toBe(1);
    expect(harness.observer.disconnect).toHaveBeenCalledOnce();
    expect(harness.inspector.disconnect).toHaveBeenCalledOnce();

    const outputDirectory = started.outputDirectory!;
    const files = await readdir(outputDirectory);
    expect(files).toEqual(
      expect.arrayContaining([
        'metadata.json',
        'process-samples.jsonl',
        'gc-events.jsonl',
        expect.stringMatching(/^allocation-000001-/),
        expect.stringMatching(/^allocation-000002-/),
      ]),
    );
    expect(files.every(file => !file.endsWith('.tmp'))).toBe(true);
    expect((await stat(harness.parentDirectory)).mode & 0o777).toBe(0o700);
    expect((await stat(outputDirectory)).mode & 0o777).toBe(0o700);
    for (const file of files) expect((await stat(join(outputDirectory, file))).mode & 0o777).toBe(0o600);

    const samples = (await readFile(join(outputDirectory, 'process-samples.jsonl'), 'utf8')).trim().split('\n');
    const firstSample = JSON.parse(samples[0]!);
    expect(firstSample).toMatchObject({ sequence: 1 });
    expect(firstSample.heapSpaces.length).toBeGreaterThan(0);
    expect(samples.length).toBeGreaterThanOrEqual(2);

    const gcEvents = (await readFile(join(outputDirectory, 'gc-events.jsonl'), 'utf8')).trim().split('\n');
    expect(JSON.parse(gcEvents[0]!)).toMatchObject({ sequence: 1, kind: 1, flags: 0 });
    expect(JSON.parse(await readFile(capture.path, 'utf8'))).toEqual(allocationProfile());
  });

  it('bounds queued GC events and reports data loss when the buffer overflows', async () => {
    const harness = await createHarness();
    roots.push(harness.parentDirectory);
    const started = await harness.diagnostics.start();
    const entries = Array.from(
      { length: 1_001 },
      (_, index) =>
        ({
          name: 'gc',
          entryType: 'gc',
          startTime: index,
          duration: 1,
          detail: { kind: 1, flags: 0 },
          toJSON: () => ({}),
        }) as unknown as PerformanceEntry,
    );

    harness.emitGc(entries);
    expect(harness.diagnostics.getStatus().error).toContain('GC event buffer exceeded 1000 records');
    await expect(harness.diagnostics.stop()).resolves.toMatchObject({
      state: 'error',
      error: expect.stringContaining('GC event buffer exceeded 1000 records'),
    });

    const lines = (await readFile(join(started.outputDirectory!, 'gc-events.jsonl'), 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(1_000);
  });

  it.each([
    ['JSONL sample', async (outputDirectory: string) => chmod(join(outputDirectory, 'process-samples.jsonl'), 0o400)],
    ['allocation capture', async (outputDirectory: string) => chmod(outputDirectory, 0o500)],
  ])('does not clear a prior %s write failure after a successful final write', async (_kind, makeReadOnly) => {
    vi.useFakeTimers();
    const harness = await createHarness();
    roots.push(harness.parentDirectory);
    const started = await harness.diagnostics.start();
    await makeReadOnly(started.outputDirectory!);

    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.resolve();
    await chmod(join(started.outputDirectory!, 'process-samples.jsonl'), 0o600);
    await chmod(started.outputDirectory!, 0o700);

    await expect(harness.diagnostics.stop()).resolves.toMatchObject({
      state: 'error',
      error: expect.stringContaining('artifact writes failed'),
    });
  });

  it('is idempotent while active and preserves the original run configuration', async () => {
    const harness = await createHarness();
    roots.push(harness.parentDirectory);

    const first = await harness.diagnostics.start();
    const second = await harness.diagnostics.start();

    expect(second.outputDirectory).toBe(first.outputDirectory);
    expect(harness.inspector.connect).toHaveBeenCalledOnce();
    await harness.diagnostics.stop();
    const duplicateStop = await harness.diagnostics.stop();
    expect(duplicateStop.outputDirectory).toBe(first.outputDirectory);
    expect(harness.inspector.disconnect).toHaveBeenCalledOnce();
  });

  it('cleans up the observer and inspector when sampling startup fails', async () => {
    const harness = await createHarness({ startError: new Error('inspector unavailable') });
    roots.push(harness.parentDirectory);

    const status = await harness.diagnostics.start();

    expect(status.state).toBe('error');
    expect(status.error).toContain('inspector unavailable');
    expect(status.outputDirectory).toBeNull();
    expect(await readdir(harness.parentDirectory)).toEqual([]);
    expect(harness.observer.disconnect).toHaveBeenCalledOnce();
    expect(harness.inspector.disconnect).toHaveBeenCalledOnce();
  });

  it('serializes overlapping captures and writes one profile per sampling epoch', async () => {
    const firstStop = deferred<Record<string, unknown>>();
    const secondStop = deferred<Record<string, unknown>>();
    const harness = await createHarness({ stopResponses: [firstStop.promise, secondStop.promise] });
    roots.push(harness.parentDirectory);
    await harness.diagnostics.start();

    const firstCapture = harness.diagnostics.capture();
    const secondCapture = harness.diagnostics.capture();
    await vi.waitFor(() =>
      expect(harness.inspector.posts.filter(post => post.method === 'HeapProfiler.stopSampling')).toHaveLength(1),
    );

    firstStop.resolve({ profile: allocationProfile() });
    await vi.waitFor(() =>
      expect(harness.inspector.posts.filter(post => post.method === 'HeapProfiler.stopSampling')).toHaveLength(2),
    );
    secondStop.resolve({ profile: allocationProfile() });

    await expect(firstCapture).resolves.toMatchObject({ sequence: 1 });
    await expect(secondCapture).resolves.toMatchObject({ sequence: 2 });
    await harness.diagnostics.stop();
  });

  it('waits for an in-flight capture during stop without creating a duplicate final capture', async () => {
    const inFlight = deferred<Record<string, unknown>>();
    const harness = await createHarness({ stopResponses: [inFlight.promise] });
    roots.push(harness.parentDirectory);
    await harness.diagnostics.start();

    const capture = harness.diagnostics.capture();
    const stop = harness.diagnostics.stop();
    let stopSettled = false;
    void stop.then(() => {
      stopSettled = true;
    });
    await Promise.resolve();
    expect(stopSettled).toBe(false);

    inFlight.resolve({ profile: allocationProfile() });
    await expect(capture).resolves.toMatchObject({ sequence: 1 });
    await expect(stop).resolves.toMatchObject({ state: 'inactive', captureCount: 1 });
    expect(harness.inspector.posts.filter(post => post.method === 'HeapProfiler.stopSampling')).toHaveLength(1);
  });

  it('waits for an in-progress stop before starting a new diagnostics run', async () => {
    const finalCapture = deferred<Record<string, unknown>>();
    const harness = await createHarness({ stopResponses: [finalCapture.promise] });
    roots.push(harness.parentDirectory);
    const firstRun = await harness.diagnostics.start();

    const stopping = harness.diagnostics.stop();
    const restarting = harness.diagnostics.start();
    let restartSettled = false;
    void restarting.then(() => {
      restartSettled = true;
    });
    await Promise.resolve();
    expect(restartSettled).toBe(false);

    finalCapture.resolve({ profile: allocationProfile() });
    await expect(stopping).resolves.toMatchObject({ state: 'inactive' });
    await expect(restarting).resolves.toMatchObject({ state: 'active' });
    expect(harness.diagnostics.getStatus().outputDirectory).not.toBe(firstRun.outputDirectory);
    await harness.diagnostics.stop();
  });

  it('reports a missing inspector profile and clears that background error after a clean stop', async () => {
    const harness = await createHarness({ stopResponses: [Promise.resolve({})] });
    roots.push(harness.parentDirectory);
    await harness.diagnostics.start();

    await expect(harness.diagnostics.capture()).rejects.toThrow('inspector returned no profile');
    expect(harness.inspector.posts.filter(post => post.method === 'HeapProfiler.startSampling')).toHaveLength(2);
    expect(harness.diagnostics.getStatus()).toMatchObject({ state: 'active', captureCount: 0 });
    await expect(harness.diagnostics.stop()).resolves.toMatchObject({ state: 'inactive', error: null });
  });
});
