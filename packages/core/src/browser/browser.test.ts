import {
  existsSync,
  writeFileSync,
  symlinkSync,
  readdirSync,
  mkdtempSync,
  rmSync,
  lstatSync,
  readlinkSync,
} from 'node:fs';
import { createServer } from 'node:net';
import type { Server } from 'node:net';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BrowserProfileInUseError,
  MastraBrowser,
  cleanupProfileLockFiles,
  killProcessGroup,
  resolveLaunchViewport,
  resolveViewportSize,
} from './browser';

describe('cleanupProfileLockFiles', () => {
  let profileDir: string;

  beforeEach(() => {
    profileDir = mkdtempSync(join(tmpdir(), 'browser-test-'));
  });

  afterEach(() => {
    rmSync(profileDir, { recursive: true, force: true });
  });

  it('removes all Chrome lock files', () => {
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'chrome.pid', 'RunningChromeVersion'];
    for (const file of lockFiles) {
      writeFileSync(join(profileDir, file), 'test');
    }

    cleanupProfileLockFiles(profileDir);

    for (const file of lockFiles) {
      expect(existsSync(join(profileDir, file))).toBe(false);
    }
  });

  it('removes symlinks (SingletonLock is often a symlink)', () => {
    // SingletonLock is typically a symlink to a socket
    const target = join(profileDir, 'target');
    writeFileSync(target, '');
    symlinkSync(target, join(profileDir, 'SingletonLock'));

    cleanupProfileLockFiles(profileDir);

    expect(existsSync(join(profileDir, 'SingletonLock'))).toBe(false);
    // Target should still exist — we only remove the lock
    expect(existsSync(target)).toBe(true);
  });

  it('leaves non-lock files untouched', () => {
    writeFileSync(join(profileDir, 'Preferences'), '{}');
    writeFileSync(join(profileDir, 'Cookies'), 'data');
    writeFileSync(join(profileDir, 'SingletonLock'), 'test');

    cleanupProfileLockFiles(profileDir);

    expect(existsSync(join(profileDir, 'Preferences'))).toBe(true);
    expect(existsSync(join(profileDir, 'Cookies'))).toBe(true);
    expect(existsSync(join(profileDir, 'SingletonLock'))).toBe(false);
  });

  it('handles non-existent profile directory', () => {
    expect(() => cleanupProfileLockFiles('/nonexistent/path')).not.toThrow();
  });

  it('handles empty profile directory', () => {
    expect(() => cleanupProfileLockFiles(profileDir)).not.toThrow();
    expect(readdirSync(profileDir)).toHaveLength(0);
  });

  it('handles empty string', () => {
    expect(() => cleanupProfileLockFiles('')).not.toThrow();
  });
});

describe('killProcessGroup', () => {
  it('does nothing for undefined PID', () => {
    expect(() => killProcessGroup(undefined)).not.toThrow();
  });

  it('calls process.kill with negative PID for process group', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    killProcessGroup(12345);
    expect(killSpy).toHaveBeenCalledWith(-12345, 'SIGKILL');
    killSpy.mockRestore();
  });

  it('does not throw when process.kill fails', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });
    expect(() => killProcessGroup(12345)).not.toThrow();
    killSpy.mockRestore();
  });

  // Defense in depth for issue #23588: a remote browser's PID (e.g. a
  // container's Chromium at PID 1) must never reach process.kill, because
  // process.kill(-pid) would signal an unrelated local group — and kill(-1)
  // broadcasts to every process the user owns.
  it.each([
    ['1 (would target init / a container PID 1)', 1],
    ['0 (would target the caller process group)', 0],
    ['-1 (would broadcast to all owned processes)', -1],
    ['a negative PID', -12345],
    ['a non-integer PID', 1234.5],
    ['NaN', Number.NaN],
  ])('refuses to signal for unsafe PID: %s', (_label, pid) => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    killProcessGroup(pid as number);
    expect(killSpy).not.toHaveBeenCalled();
    killSpy.mockRestore();
  });
});

describe('MastraBrowser launch with a locked profile', () => {
  // A minimal provider: doLaunch stands in for Chrome starting on the profile.
  class FakeBrowser extends MastraBrowser {
    readonly id = 'fake';
    readonly name = 'Fake';
    readonly provider = 'fake';
    doLaunch = vi.fn(async () => {});
    protected async doClose() {}
    protected async getActivePage() {
      return null;
    }
    protected getBrowserStateForThread() {
      return null;
    }
    getTools() {
      return {};
    }
  }

  let profileDir: string;
  let socketDir: string;
  let server: Server | undefined;

  beforeEach(() => {
    profileDir = mkdtempSync(join(tmpdir(), 'browser-profile-'));
    // Chrome keeps the real socket in a short temp dir and links to it from the profile.
    socketDir = mkdtempSync(join(tmpdir(), 'sock-'));
  });

  afterEach(async () => {
    if (server?.listening) await new Promise(r => server!.close(r));
    server = undefined;
    rmSync(profileDir, { recursive: true, force: true });
    rmSync(socketDir, { recursive: true, force: true });
  });

  /** Lay out the lock files Chrome leaves in a profile it holds. */
  async function lockProfile(holder: string, { listening }: { listening: boolean }) {
    const socketPath = join(socketDir, 'SingletonSocket');
    server = createServer(socket => socket.destroy());
    await new Promise<void>(r => server!.listen(socketPath, r));
    if (!listening) {
      // The holder died: its socket is no longer accepting connections.
      await new Promise(r => server!.close(r));
    }
    symlinkSync(holder, join(profileDir, 'SingletonLock'));
    symlinkSync(socketPath, join(profileDir, 'SingletonSocket'));
    symlinkSync('12345', join(profileDir, 'SingletonCookie'));
  }

  it.skipIf(process.platform === 'win32')(
    'fails with an error naming the profile and holding PID when a browser holds the profile',
    async () => {
      await lockProfile(`${hostname()}-4242`, { listening: true });
      const browser = new FakeBrowser({ profile: profileDir });

      const error = await browser.launch().catch(e => e);

      expect(error).toBeInstanceOf(BrowserProfileInUseError);
      expect(error.message).toContain(profileDir);
      expect(error.message).toContain('PID 4242');
      expect(browser.doLaunch).not.toHaveBeenCalled();
      // The live holder's lock is left alone.
      expect(readlinkSync(join(profileDir, 'SingletonLock'))).toBe(`${hostname()}-4242`);
    },
  );

  it.skipIf(process.platform === 'win32')('removes a stale lock left by a dead browser and launches', async () => {
    await lockProfile(`${hostname()}-4242`, { listening: false });
    const browser = new FakeBrowser({ profile: profileDir });

    await browser.launch();

    expect(browser.doLaunch).toHaveBeenCalledTimes(1);
    for (const file of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      expect(() => lstatSync(join(profileDir, file))).toThrow();
    }
  });

  // The lock's PID now belongs to an unrelated live process (PID reuse). Chrome
  // treats that as a held profile, but nothing serves the profile.
  it.skipIf(process.platform === 'win32')('removes a stale lock whose PID was reused by another process', async () => {
    await lockProfile(`${hostname()}-${process.pid}`, { listening: false });
    const browser = new FakeBrowser({ profile: profileDir });

    await browser.launch();

    expect(browser.doLaunch).toHaveBeenCalledTimes(1);
    expect(() => lstatSync(join(profileDir, 'SingletonLock'))).toThrow();
  });

  it.skipIf(process.platform === 'win32')('removes a stale lock left under a different hostname', async () => {
    await lockProfile('old-hostname.local-4242', { listening: false });
    const browser = new FakeBrowser({ profile: profileDir });

    await browser.launch();

    expect(browser.doLaunch).toHaveBeenCalledTimes(1);
    expect(() => lstatSync(join(profileDir, 'SingletonLock'))).toThrow();
  });

  it('launches normally when the profile is not locked', async () => {
    writeFileSync(join(profileDir, 'Preferences'), '{}');
    const browser = new FakeBrowser({ profile: profileDir });

    await browser.launch();

    expect(browser.doLaunch).toHaveBeenCalledTimes(1);
    expect(existsSync(join(profileDir, 'Preferences'))).toBe(true);
  });
});

describe('resolveViewportSize', () => {
  it('passes explicit dimensions through', () => {
    expect(resolveViewportSize({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
  });

  // Providers that emulate a fixed size treat an absent viewport as "do not
  // emulate", which is how 'window' is expressed.
  it('drops the viewport for window', () => {
    expect(resolveViewportSize('window')).toBeUndefined();
  });

  it('passes undefined through', () => {
    expect(resolveViewportSize(undefined)).toBeUndefined();
  });
});

describe('resolveLaunchViewport', () => {
  it('passes explicit dimensions through without launch args', () => {
    expect(resolveLaunchViewport({ width: 800, height: 600 })).toEqual({ viewport: { width: 800, height: 600 } });
  });

  // agent-browser disables viewport emulation when it sees a window-sizing arg.
  it('requests a maximized window for window', () => {
    expect(resolveLaunchViewport('window')).toEqual({ args: ['--start-maximized'] });
  });

  it('leaves the viewport unset when unconfigured', () => {
    expect(resolveLaunchViewport(undefined)).toEqual({ viewport: undefined });
  });
});
