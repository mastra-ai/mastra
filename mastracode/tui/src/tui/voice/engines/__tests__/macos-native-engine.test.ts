import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveRecognizer: vi.fn(),
  spawn: vi.fn(),
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('../../native/compile.js', () => ({
  resolveRecognizer: mocks.resolveRecognizer,
}));

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('node:fs/promises', () => ({
  mkdtemp: mocks.mkdtemp,
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  rm: mocks.rm,
}));

import { MacosNativeSTTEngine } from '../macos-native-engine.js';

/**
 * Fake `open` child: the engine launches the recognizer via `open` and tails an
 * events file. We model that file in memory; `appendEvent` writes a JSONL line
 * that the next `readFile` poll picks up.
 */
class FakeOpenChild extends EventEmitter {
  stderr = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };
  kill = vi.fn();
  constructor() {
    super();
    this.stderr.setEncoding = vi.fn();
  }
}

const INVOCATION = {
  appPath: '/cache/macos-stt.app',
  binaryPath: '/cache/macos-stt.app/Contents/MacOS/MastraCodeVoice',
};

function callbacks() {
  return { onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn() };
}

const flush = () => new Promise(r => setTimeout(r, 0));
// The engine polls the event file every 80ms; wait a bit longer than that.
const tick = () => new Promise(r => setTimeout(r, 120));

describe('MacosNativeSTTEngine', () => {
  let eventFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    eventFile = '';
    mocks.resolveRecognizer.mockResolvedValue(INVOCATION);
    mocks.mkdtemp.mockResolvedValue('/tmp/mastracode-voice-XXXX');
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);
    // The event file is modeled in memory; reads return the current contents.
    mocks.readFile.mockImplementation((path: string) => {
      if (String(path).endsWith('events.jsonl')) return Promise.resolve(eventFile);
      return Promise.reject(new Error('ENOENT'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function appendEvent(obj: unknown) {
    eventFile += JSON.stringify(obj) + '\n';
  }

  it('checkReady fails off darwin', () => {
    const spy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    expect(new MacosNativeSTTEngine().checkReady()).toMatch(/only available on macOS/);
    spy.mockRestore();
  });

  it('launches the .app via open through LaunchServices with file-IPC args', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);

    new MacosNativeSTTEngine().start(callbacks());
    await flush();

    expect(mocks.spawn).toHaveBeenCalledWith(
      'open',
      expect.arrayContaining(['-n', '-W', INVOCATION.appPath, '--args', '--events', '--stop']),
      expect.anything(),
    );
  });

  it('streams partial results and a final on the final event', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);
    const cb = callbacks();

    const session = new MacosNativeSTTEngine().start(cb);
    await flush();

    appendEvent({ type: 'ready' });
    appendEvent({ type: 'partial', text: 'hello' });
    appendEvent({ type: 'partial', text: 'hello world' });
    await tick();
    expect(cb.onPartial).toHaveBeenLastCalledWith('hello world');

    const stopped = session.stop();
    appendEvent({ type: 'final', text: 'hello world' });
    await tick();
    await stopped;

    expect(cb.onFinal).toHaveBeenCalledWith('hello world');
    // Stopping writes the stop sentinel file.
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringMatching(/stop$/), '', 'utf8');
  });

  it('handles multiple events appended between polls', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);
    const cb = callbacks();

    new MacosNativeSTTEngine().start(cb);
    await flush();

    appendEvent({ type: 'partial', text: 'one' });
    appendEvent({ type: 'partial', text: 'one two' });
    await tick();
    expect(cb.onPartial).toHaveBeenCalledWith('one');
    expect(cb.onPartial).toHaveBeenCalledWith('one two');
  });

  it('reports an error event via onError', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);
    const cb = callbacks();

    new MacosNativeSTTEngine().start(cb);
    await flush();

    appendEvent({ type: 'error', message: 'permission denied' });
    await tick();
    expect(cb.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission denied' }));
  });

  it('errors when no Swift toolchain is available', async () => {
    mocks.resolveRecognizer.mockResolvedValue(null);
    const cb = callbacks();

    new MacosNativeSTTEngine().start(cb);
    await flush();

    expect(cb.onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/Swift/) }));
  });

  it('surfaces a permission/crash error when the app exits before emitting anything', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);
    const cb = callbacks();

    new MacosNativeSTTEngine().start(cb);
    await flush();

    // `open` exits (TCC kill / suppressed prompt) with no JSON ever written.
    child.emit('exit', null, 'SIGABRT', '');
    await tick();

    expect(cb.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/before it could start.*Privacy & Security/s) }),
    );
  });

  it('does not error when the app exits after a final event', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);
    const cb = callbacks();

    const session = new MacosNativeSTTEngine().start(cb);
    await flush();

    appendEvent({ type: 'final', text: 'done' });
    await tick();
    await session.stop();
    child.emit('exit', 0, null, '');
    await tick();

    expect(cb.onError).not.toHaveBeenCalled();
    expect(cb.onFinal).toHaveBeenCalledWith('done');
  });

  it('cancel writes the stop sentinel and does not kill the app immediately', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);
    const cb = callbacks();

    const session = new MacosNativeSTTEngine().start(cb);
    await flush();

    session.cancel();
    await flush();

    // The stop sentinel is written so the detached app can wind down and release
    // the mic; we must not SIGKILL the wrapper before it has seen the sentinel.
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringMatching(/stop$/), '', 'utf8');
    expect(child.kill).not.toHaveBeenCalled();

    // No transcript surfaces from a cancelled session.
    appendEvent({ type: 'final', text: 'ignored' });
    await tick();
    expect(cb.onFinal).not.toHaveBeenCalled();
  });

  it('flushes a final line that lacks a trailing newline when the app exits', async () => {
    const child = new FakeOpenChild();
    mocks.spawn.mockReturnValue(child);
    const cb = callbacks();

    new MacosNativeSTTEngine().start(cb);
    await flush();

    // Recognizer wrote a complete JSON object but exited before the newline.
    eventFile += JSON.stringify({ type: 'final', text: 'no newline' });
    child.emit('exit', 0, null, '');
    await tick();

    expect(cb.onFinal).toHaveBeenCalledWith('no newline');
    expect(cb.onError).not.toHaveBeenCalled();
  });

  describe('verify (permission probe)', () => {
    let platformSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    });
    afterEach(() => platformSpy.mockRestore());

    /**
     * Fake probe child: the engine launches the `.app` via `open` with `--probe`
     * and `--events <file>`, then reads the probe JSON back from that event file.
     * We model that file in memory: the child writes the probe line, then exits.
     */
    function probeChild(probe: unknown) {
      const child = new EventEmitter() as EventEmitter & { kill: () => void };
      child.kill = vi.fn();
      mocks.readFile.mockImplementation((path: string) => {
        if (String(path).endsWith('probe.jsonl')) {
          return Promise.resolve(probe === undefined ? '' : JSON.stringify(probe) + '\n');
        }
        return Promise.reject(new Error('ENOENT'));
      });
      mocks.spawn.mockImplementation(() => {
        queueMicrotask(() => child.emit('exit', 0));
        return child;
      });
      return child;
    }

    it('returns the toolchain error when the recognizer cannot resolve', async () => {
      mocks.resolveRecognizer.mockResolvedValue(null);
      expect(await new MacosNativeSTTEngine().verify()).toMatch(/Swift toolchain/);
    });

    it('runs the probe through the .app via open (shared bundle TCC identity)', async () => {
      probeChild({ type: 'probe', speech: 'authorized', mic: 'authorized', available: true });
      await new MacosNativeSTTEngine().verify();
      expect(mocks.spawn).toHaveBeenCalledWith(
        'open',
        expect.arrayContaining(['-n', '-W', '-g', INVOCATION.appPath, '--args', '--probe', '--events']),
        expect.anything(),
      );
    });

    it('returns null when both permissions are authorized', async () => {
      probeChild({ type: 'probe', speech: 'authorized', mic: 'authorized', available: true });
      expect(await new MacosNativeSTTEngine().verify()).toBeNull();
    });

    it('flags a denied microphone', async () => {
      probeChild({ type: 'probe', speech: 'authorized', mic: 'denied', available: true });
      expect(await new MacosNativeSTTEngine().verify()).toMatch(/Microphone/);
    });

    it('flags denied speech recognition', async () => {
      probeChild({ type: 'probe', speech: 'denied', mic: 'authorized', available: true });
      expect(await new MacosNativeSTTEngine().verify()).toMatch(/Speech Recognition/);
    });

    it('explains the first-run prompt when permission is not determined', async () => {
      probeChild({ type: 'probe', speech: 'notDetermined', mic: 'notDetermined', available: true });
      expect(await new MacosNativeSTTEngine().verify()).toMatch(/prompt/);
    });

    it('passes verification when the probe cannot run', async () => {
      probeChild(undefined);
      expect(await new MacosNativeSTTEngine().verify()).toBeNull();
    });
  });
});
