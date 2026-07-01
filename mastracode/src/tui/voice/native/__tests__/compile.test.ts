import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('node:fs/promises', () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  mkdir: mocks.mkdir,
  rm: mocks.rm,
  stat: mocks.stat,
}));

import { resolveRecognizer } from '../compile.js';

/** Build a fake child process that exits with the given code. */
function fakeProcess(exitCode: number, error?: Error) {
  const child = new EventEmitter() as EventEmitter & { stdin?: unknown };
  queueMicrotask(() => {
    if (error) child.emit('error', error);
    else child.emit('exit', exitCode);
  });
  return child;
}

describe('resolveRecognizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFile.mockResolvedValue('// swift source');
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reuses a cached bundle without building', async () => {
    mocks.stat.mockResolvedValue({}); // cached binary exists
    const result = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');
    expect(result?.appPath).toMatch(/macos-stt-.*\.app$/);
    expect(result?.binaryPath).toMatch(/\.app\/Contents\/MacOS\//);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('keys the cache on both the source and the plist', async () => {
    mocks.stat.mockResolvedValue({});
    mocks.readFile.mockImplementation((path: string) =>
      Promise.resolve(path.endsWith('.plist') ? '<plist a>' : '// swift source'),
    );
    const first = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');

    mocks.readFile.mockImplementation((path: string) =>
      Promise.resolve(path.endsWith('.plist') ? '<plist b>' : '// swift source'),
    );
    const second = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');

    // Different plist contents must produce a different cached bundle path.
    expect(first?.appPath).not.toBe(second?.appPath);
  });

  it('builds an .app bundle (Info.plist + compiled binary) when no cache exists', async () => {
    mocks.stat.mockRejectedValue(new Error('ENOENT'));
    // swiftc --version (ok), swiftc compile (ok), codesign sign (ok)
    mocks.spawn.mockImplementation(() => fakeProcess(0));

    const result = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');
    expect(result?.appPath).toMatch(/macos-stt-.*\.app$/);
    expect(result?.binaryPath).toMatch(/\.app\/Contents\/MacOS\//);
    expect(mocks.mkdir).toHaveBeenCalled();

    // The Info.plist must be written into the bundle's Contents dir.
    const plistWrite = mocks.writeFile.mock.calls.find((c: unknown[]) => String(c[0]).endsWith('/Contents/Info.plist'));
    expect(plistWrite).toBeDefined();

    // The Swift binary is compiled straight into Contents/MacOS.
    const compileCall = mocks.spawn.mock.calls.find(
      (c: unknown[]) => c[0] === 'swiftc' && Array.isArray(c[1]) && (c[1] as string[]).includes('-o'),
    );
    expect(compileCall).toBeDefined();
    const compileArgs = compileCall![1] as string[];
    const outPath = compileArgs[compileArgs.indexOf('-o') + 1];
    expect(outPath).toMatch(/\.app\/Contents\/MacOS\//);
  });

  it('ad-hoc signs the .app bundle so the Info.plist binds for TCC', async () => {
    mocks.stat.mockRejectedValue(new Error('ENOENT'));
    mocks.spawn.mockImplementation(() => fakeProcess(0));

    const result = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');

    // A `codesign -f -s -` ad-hoc seal of the bundle must run, otherwise macOS
    // never shows the permission prompt and the recognizer is killed by TCC.
    const signCall = mocks.spawn.mock.calls.find((c: unknown[]) => c[0] === 'codesign');
    expect(signCall).toBeDefined();
    const signArgs = signCall![1] as string[];
    expect(signArgs).toEqual(expect.arrayContaining(['-f', '-s', '-']));
    // It signs the .app bundle, not a loose binary.
    expect(signArgs[signArgs.length - 1]).toBe(result?.appPath);
  });

  it('returns null when the ad-hoc sign fails', async () => {
    mocks.stat.mockRejectedValue(new Error('ENOENT'));
    mocks.spawn.mockImplementation((cmd: string) => {
      // swiftc version + compile succeed; codesign fails.
      return fakeProcess(cmd === 'codesign' ? 1 : 0);
    });
    const result = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');
    expect(result).toBeNull();
  });

  it('returns null when swiftc is unavailable (no interpreter fallback)', async () => {
    mocks.stat.mockRejectedValue(new Error('ENOENT'));
    // swiftc --version fails — there is no swift-interpreter fallback because a
    // plist-less process TCC-crashes on first microphone touch.
    mocks.spawn.mockImplementation(() => fakeProcess(127));
    const result = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');
    expect(result).toBeNull();
  });

  it('returns null when the native assets cannot be read', async () => {
    mocks.stat.mockRejectedValue(new Error('ENOENT'));
    // Asset is missing from the published bundle (or unreadable): no throw, just
    // "native unavailable" so the caller can fall back to a cloud engine.
    mocks.readFile.mockRejectedValue(new Error('ENOENT'));
    const result = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');
    expect(result).toBeNull();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('returns null when the swiftc compile fails', async () => {
    mocks.stat.mockRejectedValue(new Error('ENOENT'));
    mocks.spawn.mockImplementation((_cmd: string, args: string[]) => {
      // swiftc --version succeeds; the actual compile fails.
      return fakeProcess(args.includes('--version') ? 0 : 1);
    });
    const result = await resolveRecognizer('/x/macos-stt.swift', '/x/macos-stt.plist');
    expect(result).toBeNull();
  });
});
