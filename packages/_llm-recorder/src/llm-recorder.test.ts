/**
 * LLM Recorder Tests
 *
 * Demonstrates the unified LLM recording/replay API with mode switching.
 *
 * ## Test Modes
 *
 * ```bash
 * # Auto mode (default) - replay if recording exists, record if not
 * pnpm vitest run src/llm-recorder.test.ts
 *
 * # Force re-record all recordings
 * UPDATE_RECORDINGS=true pnpm vitest run src/llm-recorder.test.ts
 *
 * # Skip recording entirely (real API calls)
 * LLM_TEST_MODE=live pnpm vitest run src/llm-recorder.test.ts
 * ```
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, afterAll, afterEach } from 'vitest';
import {
  useLLMRecording,
  useLiveMode,
  withLLMRecording,
  getLLMTestMode,
  setupLLMRecording,
  getActiveRecorder,
} from './llm-recorder';
import type { LLMRecording } from './llm-recorder';

/**
 * Mode detection tests
 */
describe('LLM Test Mode Detection', () => {
  it('reports current mode', () => {
    const mode = getLLMTestMode();
    console.log(`[test] Current LLM_TEST_MODE: ${mode}`);
    expect(['auto', 'update', 'replay', 'live', 'record']).toContain(mode);
  });

  it('setupLLMRecording reflects correct mode', () => {
    const recording = setupLLMRecording({ name: 'mode-test' });
    console.log(`[test] Recording mode: ${recording.mode}`);
    console.log(`[test] isLive: ${recording.isLive}`);
    console.log(`[test] isRecording: ${recording.isRecording}`);

    // Verify consistency
    if (recording.mode === 'live') {
      expect(recording.isLive).toBe(true);
      expect(recording.isRecording).toBe(false);
    } else if (recording.mode === 'record') {
      expect(recording.isLive).toBe(false);
      expect(recording.isRecording).toBe(true);
    } else {
      expect(recording.isLive).toBe(false);
      expect(recording.isRecording).toBe(false);
    }

    // Clean up — stop the server if one was created
    if (recording.server) {
      recording.start();
      recording.stop();
    }
  });
});

/**
 * withLLMRecording tests - callback wrapper
 */
describe('withLLMRecording', () => {
  it('cleans up even if callback throws', async () => {
    const error = new Error('test error');
    await expect(
      withLLMRecording('with-recording-error-test', async () => {
        throw error;
      }),
    ).rejects.toThrow('test error');
  });
});

/**
 * transformRequest tests
 */
describe('transformRequest', () => {
  it('accepts transformRequest option and creates a recorder', () => {
    const transformFn = vi.fn(({ url, body }: { url: string; body: unknown }) => ({
      url: url.replace(/v[0-9]+/, 'v1'),
      body: { ...(body as Record<string, unknown>), timestamp: 'NORMALIZED' },
    }));

    // Verify the option is accepted and the recorder is created successfully
    const recorder = setupLLMRecording({
      name: 'transform-test',
      transformRequest: transformFn,
    });

    expect(recorder).toBeDefined();
    expect(recorder.mode).toBeDefined();

    // Clean up — start then immediately stop to avoid dangling server
    if (recorder.server) {
      recorder.start();
      recorder.stop();
    }
  });

  it('accepts transformRequest in setupLLMRecording options', () => {
    const recorder = setupLLMRecording({
      name: 'transform-use-test',
      transformRequest: ({ url, body }) => ({ url, body }),
    });

    expect(recorder).toBeDefined();

    // Clean up — start then immediately stop to avoid dangling server
    if (recorder.server) {
      recorder.start();
      recorder.stop();
    }
  });
});

/**
 * Active recorder tracking and useLiveMode tests
 */
describe('getActiveRecorder', () => {
  it('is callable and returns null or an active recorder', () => {
    // At this point in the test run, there may or may not be an active recorder
    // from the enclosing suite. Verify the function is callable and returns a
    // valid type (null or an object with expected shape).
    expect(() => getActiveRecorder()).not.toThrow();
    const recorder = getActiveRecorder();
    if (recorder !== null) {
      expect(recorder).toHaveProperty('mode');
      expect(recorder).toHaveProperty('server');
    }
  });

  it('tracks the active recorder after start/stop', () => {
    const recorder = setupLLMRecording({ name: 'active-tracker-test' });

    recorder.start();
    expect(getActiveRecorder()).toBe(recorder);

    recorder.stop();
    // After stop, activeRecorder should be cleared (unless another recorder took over)
    expect(getActiveRecorder()).not.toBe(recorder);
  });
});

describe('useLiveMode', () => {
  // Set up a recording for the suite
  const recording = useLLMRecording('live-mode-test');

  it('recording is active in normal tests', () => {
    // The suite-level recorder should be active
    expect(getActiveRecorder()).toBe(recording);
    if (recording.mode === 'live') {
      expect(recording.server).toBeNull();
    } else {
      expect(recording.server).not.toBeNull();
    }
  });

  describe('live mode block', () => {
    useLiveMode();

    it('MSW server is stopped during live mode tests', () => {
      // After useLiveMode's beforeEach, the server should be closed.
      // In live mode, server is null and useLiveMode is effectively a no-op.
      if (recording.mode === 'live') {
        expect(recording.server).toBeNull();
      } else {
        // The server object still exists on the recorder, but it's been closed.
        expect(recording.server).not.toBeNull();
      }
    });
  });

  it('recording is still active after live mode block ends', () => {
    // After the live mode describe block's afterEach, the server should be restarted
    expect(getActiveRecorder()).toBe(recording);
  });
});

describe('recording file format', () => {
  const originalMode = process.env.LLM_TEST_MODE;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-recorder-format-'));

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.LLM_TEST_MODE;
    } else {
      process.env.LLM_TEST_MODE = originalMode;
    }
    vi.restoreAllMocks();
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads legacy array recording format in replay mode', () => {
    const legacyName = 'legacy-array-format';
    const filePath = path.join(tempDir, `${legacyName}.json`);
    const legacyRecordings: LLMRecording[] = [
      {
        hash: 'legacy-hash',
        request: {
          url: 'https://api.openai.com/v1/responses',
          method: 'POST',
          body: { model: 'gpt-4o' },
          timestamp: 1,
        },
        response: { status: 200, statusText: 'OK', headers: {}, body: { id: 'legacy' }, isStreaming: false },
      },
    ];
    fs.writeFileSync(filePath, JSON.stringify(legacyRecordings, null, 2), 'utf-8');

    process.env.LLM_TEST_MODE = 'replay';
    const recorder = setupLLMRecording({ name: legacyName, recordingsDir: tempDir });

    expect(recorder.mode).toBe('replay');
    // recordingCount tracks newly captured recordings (record mode), not loaded ones
    expect(recorder.recordingCount).toBe(0);
    recorder.stop();
  });

  it('loads new meta + recordings format in replay mode', () => {
    const name = 'new-format';
    const filePath = path.join(tempDir, `${name}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          meta: {
            name,
            testFile: '/tmp/new-format.test.ts',
            testName: 'loads new format',
            provider: 'openai',
            model: 'gpt-4o',
            createdAt: new Date('2026-03-06T00:00:00.000Z').toISOString(),
          },
          recordings: [],
        },
        null,
        2,
      ),
      'utf-8',
    );

    process.env.LLM_TEST_MODE = 'replay';
    const recorder = setupLLMRecording({ name, recordingsDir: tempDir });

    expect(recorder.mode).toBe('replay');
    expect(recorder.recordingCount).toBe(0);
    recorder.stop();
  });

  it('update mode re-records but preserves createdAt', async () => {
    const name = 'update-mode-test';
    const filePath = path.join(tempDir, `${name}.json`);
    const originalCreatedAt = '2025-01-01T00:00:00.000Z';

    // Write an initial recording file with a known createdAt
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          meta: {
            name,
            testFile: '/tmp/update-mode.test.ts',
            provider: 'openai',
            model: 'gpt-4o',
            createdAt: originalCreatedAt,
          },
          recordings: [
            {
              hash: 'old-hash',
              request: {
                url: 'https://api.openai.com/v1/responses',
                method: 'POST',
                body: { model: 'gpt-4o', input: 'old' },
                timestamp: 1,
              },
              response: {
                status: 200,
                statusText: 'OK',
                headers: {},
                body: { id: 'old-response' },
                isStreaming: false,
              },
            },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    );

    process.env.LLM_TEST_MODE = 'update';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'updated-response', output: [] }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      }),
    );

    const recorder = setupLLMRecording({
      name,
      recordingsDir: tempDir,
      metaContext: { testFile: '/tmp/update-mode.test.ts', provider: 'openai', model: 'gpt-4o' },
    });

    expect(recorder.mode).toBe('record');

    recorder.start();
    await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', input: 'new prompt' }),
    });
    await recorder.save();
    recorder.stop();

    expect(fetchSpy).toHaveBeenCalled();

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(parsed.meta.name).toBe(name);
    expect(parsed.meta.provider).toBe('openai');
    expect(parsed.meta.model).toBe('gpt-4o');
    expect(parsed.meta.createdAt).toBe(originalCreatedAt);
    expect(parsed.meta.updatedAt).toBeDefined();
    expect(parsed.recordings.length).toBe(1);
    expect(parsed.recordings[0].hash).not.toBe('old-hash');
  });

  it('writes the new meta + recordings format in record mode', async () => {
    const name = 'writes-meta-format';
    const filePath = path.join(tempDir, `${name}.json`);

    process.env.LLM_TEST_MODE = 'record';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'mocked-response', output: [] }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      }),
    );

    const recorder = setupLLMRecording({
      name,
      recordingsDir: tempDir,
      metaContext: {
        testFile: '/tmp/writes-meta-format.test.ts',
        provider: 'openai',
        model: 'gpt-4o',
      },
    });

    recorder.start();
    await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', input: 'hello' }),
    });
    await recorder.save();
    recorder.stop();

    expect(fetchSpy).toHaveBeenCalled();

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(parsed.meta.name).toBe(name);
    expect(parsed.meta.testFile).toBe('/tmp/writes-meta-format.test.ts');
    expect(parsed.meta.provider).toBe('openai');
    expect(parsed.meta.model).toBe('gpt-4o');
    expect(parsed.meta.createdAt).toBeDefined();
    expect(Array.isArray(parsed.recordings)).toBe(true);
    expect(parsed.recordings.length).toBe(1);
  });
});
