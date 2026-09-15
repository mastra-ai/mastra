import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { encode as encodeJpeg } from 'jpeg-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MastraBrowser } from '../../browser.js';
import { __isRecordingActive, __resetRecordingStateForTests, createBrowserRecordingTools } from '../tools.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJpegBase64(width: number, height: number, fill: [number, number, number] = [40, 80, 120]): string {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  const encoded = encodeJpeg({ data, width, height }, 80);
  return Buffer.from(encoded.data).toString('base64');
}

class FakeStream extends EventEmitter {
  stopped = false;
  isActive() {
    return !this.stopped;
  }
  async start() {}
  async stop() {
    this.stopped = true;
    this.emit('stop', 'manual');
  }
  async reconnect() {}
  emitUrl(_url: string) {}
  pushFrame(width = 32, height = 24) {
    this.emit('frame', { data: makeJpegBase64(width, height), viewport: { width, height } });
  }
}

interface FakeBrowserOpts {
  failStart?: string;
  failReconnect?: string;
}

function makeFakeBrowser(opts: FakeBrowserOpts = {}): { browser: MastraBrowser; stream: FakeStream } {
  const stream = new FakeStream();
  if (opts.failReconnect) {
    stream.reconnect = vi.fn(async () => {
      throw new Error(opts.failReconnect);
    });
  }
  const browser = {
    startScreencast: vi.fn(async () => {
      if (opts.failStart) throw new Error(opts.failStart);
      return stream as unknown as ReturnType<MastraBrowser['startScreencast']> extends Promise<infer T> ? T : never;
    }),
    setCurrentThread: vi.fn(),
    ensureReady: vi.fn(async () => {}),
    getTools: () => ({}),
  } as unknown as MastraBrowser;
  return { browser, stream };
}

async function runTool(tool: any, input: any = {}) {
  return tool.execute(input, { requestContext: { get: () => undefined } });
}

let outputDir: string;

function recordingPath(fileName: string): string {
  return join(outputDir, fileName);
}

function makeRecordingTools(browser: MastraBrowser) {
  return createBrowserRecordingTools(browser, { outputDir });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBrowserRecordingTools', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'browser-rec-'));
    outputDir = join(tmpDir, 'recordings');
  });

  afterEach(() => {
    __resetRecordingStateForTests();
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.useRealTimers();
  });

  it('exposes exactly the two expected recording tools', () => {
    const { browser } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    expect(Object.keys(tools).sort()).toEqual(['browser_record', 'browser_record_caption'].sort());
  });

  it('status reports inactive when no recording is running', async () => {
    const { browser } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    const result = await runTool(tools.browser_record, { action: 'status' });
    expect(result.isError).toBe(false);
    expect(result.active).toBe(false);
  });

  it('start succeeds and rejects a second concurrent start', async () => {
    const { browser } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);

    const first = await runTool(tools.browser_record, { action: 'start', outputPath: recordingPath('one.avi') });
    expect(first.isError).toBe(false);
    expect(first.recordingId).toMatch(/^rec_/);
    expect(__isRecordingActive()).toBe(true);

    const second = await runTool(tools.browser_record, { action: 'start', outputPath: recordingPath('two.avi') });
    expect(second.isError).toBe(true);
    expect(second.content).toMatch(/already active/i);
  });

  it('rejects outputPath outside the app-data browser-recordings directory', async () => {
    const { browser } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    const result = await runTool(tools.browser_record, { action: 'start', outputPath: join(tmpDir, 'outside.avi') });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/outputPath must be inside/i);
    expect(__isRecordingActive()).toBe(false);
  });

  it('caption rejects when no recording is active', async () => {
    const { browser } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    const result = await runTool(tools.browser_record_caption, { text: 'too soon' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/No browser recording is active/i);
  });

  it('caption accepts text during an active recording and increments counter', async () => {
    const { browser } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    await runTool(tools.browser_record, { action: 'start', outputPath: recordingPath('c.avi') });

    const a = await runTool(tools.browser_record_caption, { text: 'opened login' });
    expect(a.isError).toBe(false);
    expect(a.captionCount).toBe(1);
  });

  it('stop without any frames returns a clean error', async () => {
    const { browser } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    await runTool(tools.browser_record, { action: 'start', outputPath: recordingPath('no-frames.avi') });

    const result = await runTool(tools.browser_record, { action: 'stop' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/No frames captured/i);
    expect(__isRecordingActive()).toBe(false);
  });

  it('stop writes a non-empty AVI to disk and returns the file path', async () => {
    const { browser, stream } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    const outputPath = recordingPath('movie.avi');

    await runTool(tools.browser_record, { action: 'start', outputPath });
    stream.pushFrame(32, 24);
    stream.pushFrame(32, 24);
    stream.pushFrame(32, 24);

    await runTool(tools.browser_record_caption, { text: 'did a thing' });

    const result = await runTool(tools.browser_record, { action: 'stop' });
    expect(result.isError).toBe(false);
    expect(result.filePath).toBe(outputPath);
    expect(result.frameCount).toBe(3);
    expect(result.captionCount).toBe(1);

    expect(existsSync(outputPath)).toBe(true);
    expect(statSync(outputPath).size).toBeGreaterThan(0);

    // AVI/RIFF magic header: 'RIFF' .... 'AVI '
    const bytes = readFileSync(outputPath);
    expect(bytes.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.slice(8, 12).toString('ascii')).toBe('AVI ');

    expect(__isRecordingActive()).toBe(false);
  });

  it('rejects mixed-dimension frames instead of writing a malformed AVI', async () => {
    const { browser, stream } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    const outputPath = recordingPath('mixed.avi');

    await runTool(tools.browser_record, { action: 'start', outputPath });
    stream.pushFrame(32, 24);
    stream.pushFrame(64, 24);

    const result = await runTool(tools.browser_record, { action: 'stop' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/Frame dimensions changed/i);
    expect(__isRecordingActive()).toBe(false);
  });

  it('surfaces a clean error when startScreencast throws "not supported"', async () => {
    const { browser } = makeFakeBrowser({ failStart: 'Screencast not supported by this provider' });
    const tools = makeRecordingTools(browser);
    const result = await runTool(tools.browser_record, { action: 'start', outputPath: recordingPath('x.avi') });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/not supported/i);
    expect(__isRecordingActive()).toBe(false);
  });

  it('surfaces reconnect failures when stopping', async () => {
    vi.useFakeTimers();
    const { browser, stream } = makeFakeBrowser({ failReconnect: 'reconnect exploded' });
    const tools = makeRecordingTools(browser);
    await runTool(tools.browser_record, { action: 'start', outputPath: recordingPath('reconnect.avi') });
    stream.pushFrame(32, 24);

    await vi.advanceTimersByTimeAsync(5_000);

    const result = await runTool(tools.browser_record, { action: 'stop' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/reconnect exploded/i);
    expect(__isRecordingActive()).toBe(false);
    vi.useRealTimers();
  });

  it('auto-stops at maxDurationMs and cleans up state', async () => {
    vi.useFakeTimers();
    const { browser, stream } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    await runTool(tools.browser_record, {
      action: 'start',
      outputPath: recordingPath('auto.avi'),
      maxDurationMs: 1_000,
    });
    expect(__isRecordingActive()).toBe(true);

    await vi.advanceTimersByTimeAsync(1_500);
    expect(stream.stopped).toBe(true);

    vi.useRealTimers();
  });

  it('status reflects active state during a session', async () => {
    const { browser, stream } = makeFakeBrowser();
    const tools = makeRecordingTools(browser);
    await runTool(tools.browser_record, { action: 'start', outputPath: recordingPath('status.avi') });
    stream.pushFrame(16, 16);
    stream.pushFrame(16, 16);

    const status = await runTool(tools.browser_record, { action: 'status' });
    expect(status.active).toBe(true);
    expect(status.frameCount).toBe(2);
    expect(status.captionCount).toBe(0);
  });
});
