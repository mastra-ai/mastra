import { spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readFileSync,
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

describe('MastraBrowser retire', () => {
  class ClosableBrowser extends MastraBrowser {
    readonly id = 'closable';
    readonly name = 'Closable';
    readonly provider = 'closable';
    doLaunch = vi.fn(async () => {});
    finishClose: () => void = () => {};
    protected doClose() {
      return new Promise<void>(resolve => {
        this.finishClose = resolve;
      });
    }
    protected async getActivePage() {
      return null;
    }
    protected getBrowserStateForThread() {
      return null;
    }
    getTools() {
      return {};
    }
    adoptPid(pid: number) {
      this.sharedBrowserPid = pid;
    }
  }

  it('does not relaunch for a caller that reaches ensureReady while the browser is being retired', async () => {
    const browser = new ClosableBrowser({ headless: true });
    await browser.ensureReady();
    expect(browser.doLaunch).toHaveBeenCalledOnce();

    // A tool that captured the browser before it was replaced calls in mid-close.
    const retiring = browser.retire();
    await vi.waitFor(() => expect(browser.status).toBe('closing'));
    const lateToolCall = browser.ensureReady();
    browser.finishClose();
    await retiring;

    await expect(lateToolCall).rejects.toThrow('was retired');
    await expect(browser.ensureReady()).rejects.toThrow('was retired');
    expect(browser.doLaunch).toHaveBeenCalledOnce();
    expect(browser.status).toBe('closed');
  });

  it('still relaunches after a plain close', async () => {
    const browser = new ClosableBrowser({ headless: true });
    await browser.ensureReady();
    const closing = browser.close();
    await vi.waitFor(() => expect(browser.status).toBe('closing'));
    const nextCall = browser.ensureReady();
    browser.finishClose();
    await closing;
    await nextCall;
    expect(browser.doLaunch).toHaveBeenCalledTimes(2);
    expect(browser.status).toBe('ready');
  });

  it.skipIf(process.platform === 'win32')(
    'killProcesses ends the browser process group without waiting for close',
    async () => {
      const browser = new ClosableBrowser({ headless: true });
      // Detached like chrome-launcher's Chrome, so it leads its own process group.
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        detached: true,
        stdio: 'ignore',
      });
      const exited = new Promise<NodeJS.Signals | null>(resolve =>
        child.once('exit', (_code, signal) => resolve(signal)),
      );
      browser.adoptPid(child.pid!);

      browser.killProcesses();

      expect(await exited).toBe('SIGKILL');
    },
  );
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

  it.skipIf(process.platform === 'win32')(
    'treats a live local holder that starts listening shortly after locking as holding the profile',
    async () => {
      // Chrome creates SingletonLock before it listens on SingletonSocket.
      await lockProfile(`${hostname()}-${process.pid}`, { listening: false });
      const socketPath = join(socketDir, 'SingletonSocket');
      const startListening = setTimeout(() => {
        server = createServer(socket => socket.destroy());
        server.listen(socketPath);
      }, 300);
      const browser = new FakeBrowser({ profile: profileDir });

      const error = await browser.launch().catch(e => e);
      clearTimeout(startListening);

      expect(error).toBeInstanceOf(BrowserProfileInUseError);
      expect(browser.doLaunch).not.toHaveBeenCalled();
      expect(readlinkSync(join(profileDir, 'SingletonLock'))).toBe(`${hostname()}-${process.pid}`);
    },
  );

  it.skipIf(process.platform === 'win32')('removes a stale lock left under a different hostname', async () => {
    await lockProfile('old-hostname.local-4242', { listening: false });
    const browser = new FakeBrowser({ profile: profileDir });

    await browser.launch();

    expect(browser.doLaunch).toHaveBeenCalledTimes(1);
    expect(() => lstatSync(join(profileDir, 'SingletonLock'))).toThrow();
  });

  it.skipIf(process.platform === 'win32')(
    'removes a stale lock whose holder was SIGKILLed and left its socket file behind',
    async () => {
      // Like a crashed Chrome: the socket file stays on disk, connecting to it gets ECONNREFUSED.
      const socketPath = join(socketDir, 'SingletonSocket');
      const child = spawn(process.execPath, [
        '-e',
        `require('net').createServer().listen(${JSON.stringify(socketPath)}, () => console.log('ready'))`,
      ]);
      await new Promise<void>(r => child.stdout.once('data', () => r()));
      child.kill('SIGKILL');
      await new Promise(r => child.once('exit', r));
      expect(existsSync(socketPath)).toBe(true);
      symlinkSync(`${hostname()}-${child.pid}`, join(profileDir, 'SingletonLock'));
      symlinkSync(socketPath, join(profileDir, 'SingletonSocket'));
      const browser = new FakeBrowser({ profile: profileDir });

      await browser.launch();

      expect(browser.doLaunch).toHaveBeenCalledTimes(1);
      expect(() => lstatSync(join(profileDir, 'SingletonLock'))).toThrow();
    },
  );

  it.skipIf(process.platform === 'win32')(
    'keeps the lock of a browser that took the profile while an older browser was still closing',
    async () => {
      let finishClose = () => {};
      class SlowCloseBrowser extends FakeBrowser {
        protected doClose() {
          return new Promise<void>(resolve => {
            finishClose = resolve;
          });
        }
      }
      const old = new SlowCloseBrowser({ profile: profileDir });
      await old.launch();
      const closing = old.close();
      await vi.waitFor(() => expect(old.status).toBe('closing'));

      // The replacement now holds the profile; the old close finishes late.
      await lockProfile(`${hostname()}-4242`, { listening: true });
      finishClose();
      await closing;

      expect(readlinkSync(join(profileDir, 'SingletonLock'))).toBe(`${hostname()}-4242`);
      expect(lstatSync(join(profileDir, 'SingletonSocket')).isSymbolicLink()).toBe(true);
    },
  );

  it.skipIf(process.platform === 'win32')('removes its own lock files after closing', async () => {
    const browser = new FakeBrowser({ profile: profileDir });
    await browser.launch();
    // Chrome died without unlinking its socket; nothing listens anymore.
    await lockProfile(`${hostname()}-4242`, { listening: false });

    await browser.close();

    expect(() => lstatSync(join(profileDir, 'SingletonLock'))).toThrow();
  });

  it('launches normally when the profile is not locked', async () => {
    writeFileSync(join(profileDir, 'Preferences'), '{}');
    const browser = new FakeBrowser({ profile: profileDir });

    await browser.launch();

    expect(browser.doLaunch).toHaveBeenCalledTimes(1);
    expect(existsSync(join(profileDir, 'Preferences'))).toBe(true);
  });

  // Issue #28664: chrome-launcher appends Chrome's stderr to <profile>/chrome-err.log
  // and takes the DevTools port from the first match in the whole file. On a reused
  // profile that is the first launch's port, which is dead, so the launch fails with
  // ECONNREFUSED on the old port even though no lock files are left behind.
  describe('relaunching on a reused profile', () => {
    const DEVTOOLS_PORT = /DevTools listening on ws:\/\/.*?:(\d+)\//;

    /** Behaves like chrome-launcher: append Chrome's stderr, then discover the port from the file. */
    class LauncherLikeBrowser extends FakeBrowser {
      discoveredPort?: number;
      constructor(
        profile: string,
        private readonly chromePort: number,
      ) {
        super({ profile });
      }
      doLaunch = vi.fn(async () => {
        const errLog = join(profileDir, 'chrome-err.log');
        appendFileSync(errLog, `\nDevTools listening on ws://127.0.0.1:${this.chromePort}/devtools/browser/abc\n`);
        appendFileSync(join(profileDir, 'chrome-out.log'), 'out\n');
        this.discoveredPort = Number(readFileSync(errLog, 'utf-8').match(DEVTOOLS_PORT)![1]);
      });
    }

    it('reads the new DevTools port when launching again after a clean close', async () => {
      const first = new LauncherLikeBrowser(profileDir, 50047);
      await first.launch();
      expect(first.discoveredPort).toBe(50047);
      await first.close();

      const second = new LauncherLikeBrowser(profileDir, 61234);
      await second.launch();

      expect(second.discoveredPort).toBe(61234);
    });

    it('clears launcher logs left by an earlier launch before launching', async () => {
      writeFileSync(
        join(profileDir, 'chrome-err.log'),
        'DevTools listening on ws://127.0.0.1:50047/devtools/browser/old\n',
      );
      writeFileSync(join(profileDir, 'chrome-out.log'), 'old\n');
      writeFileSync(join(profileDir, 'Preferences'), '{}');
      const browser = new FakeBrowser({ profile: profileDir });
      browser.doLaunch.mockImplementation(async () => {
        expect(existsSync(join(profileDir, 'chrome-err.log'))).toBe(false);
        expect(existsSync(join(profileDir, 'chrome-out.log'))).toBe(false);
      });

      await browser.launch();

      expect(browser.doLaunch).toHaveBeenCalledTimes(1);
      expect(existsSync(join(profileDir, 'Preferences'))).toBe(true);
    });

    it.skipIf(process.platform === 'win32')(
      'leaves launcher logs alone when a live browser holds the profile',
      async () => {
        writeFileSync(join(profileDir, 'chrome-err.log'), 'live\n');
        await lockProfile(`${hostname()}-4242`, { listening: true });
        const browser = new FakeBrowser({ profile: profileDir });

        await expect(browser.launch()).rejects.toBeInstanceOf(BrowserProfileInUseError);

        expect(readFileSync(join(profileDir, 'chrome-err.log'), 'utf-8')).toBe('live\n');
      },
    );
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

describe('MastraBrowser.setCookies', () => {
  class NoCookieBrowser extends MastraBrowser {
    readonly id = 'no-cookies';
    readonly name = 'NoCookieBrowser';
    readonly provider = 'no-cookies';
    protected async doLaunch() {}
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

  class QueueingBrowser extends NoCookieBrowser {
    open = false;
    added: string[] = [];
    values: Record<string, string> = {};
    protected override async addCookiesToOpenBrowser(cookies: { name: string; value: string }[]) {
      // Like a real browser, answering takes a moment.
      await new Promise(resolve => setTimeout(resolve, 1));
      if (!this.open) return false;
      const rejected = cookies.find(cookie => cookie.value === 'rejected');
      if (rejected) throw new Error(`browser rejected ${rejected.name}`);
      for (const cookie of cookies) {
        this.added.push(cookie.name);
        this.values[cookie.name] = cookie.value;
      }
      return true;
    }
    async openThread(threadId: string) {
      this.open = true;
      await this.addPendingCookies(threadId);
    }
  }

  it('forgets a cookie the browser rejected, so later cookies still get added', async () => {
    const browser = new QueueingBrowser({ headless: true, scope: 'thread' });
    await browser.setCookies([{ name: 'bad', value: 'rejected', url: 'https://example.com' }], 'thread-1');

    await expect(browser.openThread('thread-1')).rejects.toThrow('browser rejected bad');
    await browser.setCookies([{ name: 'good', value: 'v', url: 'https://example.com' }], 'thread-1');

    expect(browser.added).toEqual(['good']);
  });

  it("doesn't keep a record for every thread that closes", async () => {
    const browser = new QueueingBrowser({ headless: true, scope: 'thread' });
    for (const id of ['a', 'b', 'c']) {
      await browser.setCookies([{ name: 'n', value: 'v', url: 'https://example.com' }], id);
      await browser.closeThreadSession(id);
    }

    expect(browser['cookieQueueGenerations'].size).toBe(0);
    expect(browser['pendingCookies'].size).toBe(0);
  });

  it('keeps the newest value when a cookie set before the browser opens is set again after', async () => {
    const browser = new QueueingBrowser({ headless: true, scope: 'shared' });
    await browser.setCookies([{ name: 'session', value: 'old', url: 'https://example.com' }]);
    browser.open = true;

    await browser.setCookies([{ name: 'session', value: 'new', url: 'https://example.com' }]);
    await browser.openThread('thread-1');

    expect(browser.values.session).toBe('new');
  });

  it('keeps every cookie from calls that overlap before the browser opens', async () => {
    const browser = new QueueingBrowser({ headless: true, scope: 'thread' });

    await Promise.all([
      browser.setCookies([{ name: 'a', value: 'v', url: 'https://example.com' }], 'thread-1'),
      browser.setCookies([{ name: 'b', value: 'v', url: 'https://example.com' }], 'thread-1'),
    ]);
    await browser.openThread('thread-1');

    expect(browser.added.sort()).toEqual(['a', 'b']);
  });

  it('rejects a cookie with neither a url nor a domain and path', async () => {
    const browser = new QueueingBrowser({ headless: true });

    await expect(browser.setCookies([{ name: 'bad', value: 'v', domain: 'example.com' }])).rejects.toThrow(
      'Cookie "bad" needs a url, or a domain and a path',
    );
    browser.open = true;
    await browser.openThread('thread-1');
    expect(browser.added).toEqual([]);
  });

  it.each(['closeThreadSession', 'close'] as const)(
    "doesn't bring back cookies from a setCookies call still running when %s is called",
    async method => {
      const browser = new QueueingBrowser({ headless: true, scope: 'thread' });

      const pending = browser.setCookies([{ name: 'secret', value: 'v', url: 'https://example.com' }], 'thread-1');
      await (method === 'close' ? browser.close() : browser.closeThreadSession('thread-1'));
      await pending;
      await browser.openThread('thread-1');

      expect(browser.added).toEqual([]);
    },
  );

  it('drops cookies queued for a thread that closes before its browser opens', async () => {
    const browser = new QueueingBrowser({ headless: true, scope: 'thread' });
    await browser.setCookies([{ name: 'kept', value: 'v', url: 'https://example.com' }], 'thread-1');
    await browser.setCookies([{ name: 'dropped', value: 'v', url: 'https://example.com' }], 'thread-2');

    await browser.closeThreadSession('thread-2');
    await browser.openThread('thread-1');
    await browser.openThread('thread-2');

    expect(browser.added).toEqual(['kept']);
  });

  it('shares one queue across threads with a shared browser', async () => {
    const browser = new QueueingBrowser({ headless: true, scope: 'shared' });
    await browser.setCookies([{ name: 'shared', value: 'v', url: 'https://example.com' }], 'thread-1');

    await browser.closeThreadSession('thread-1');
    await browser.openThread('thread-2');

    expect(browser.added).toEqual(['shared']);
  });

  it('drops every queued cookie when the browser closes', async () => {
    const browser = new QueueingBrowser({ headless: true });
    await browser.setCookies([{ name: 'dropped', value: 'v', url: 'https://example.com' }], 'thread-1');

    await browser.close();
    await browser.openThread('thread-1');

    expect(browser.added).toEqual([]);
  });

  it('fails for a provider that cannot set cookies', async () => {
    const browser = new NoCookieBrowser({ headless: true });

    await expect(browser.setCookies([{ name: 'a', value: 'b', url: 'https://example.com' }])).rejects.toThrow(
      'no-cookies does not support setting cookies',
    );
  });
});
