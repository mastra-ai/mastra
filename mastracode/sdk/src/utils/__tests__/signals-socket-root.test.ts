import { chmodSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveSignalsSocketRoot } from '../signals-socket-root.js';

// Only read by the POSIX-only suites below; Windows has no getuid.
const uid = process.getuid?.() ?? 0;

describe.skipIf(process.platform === 'win32')('resolveSignalsSocketRoot', () => {
  let scratch: string;
  // Directories that stand in for $TMPDIR, $XDG_RUNTIME_DIR and /tmp.
  let perUser: string;
  let fallbackParent: string;
  const missing = () => join(scratch, 'missing');

  beforeEach(() => {
    scratch = mkdtempSync('/tmp/mcr-');
    perUser = join(scratch, 'user');
    mkdirSync(perUser, { mode: 0o700 });
    fallbackParent = join(scratch, 'tmp');
    mkdirSync(fallbackParent);
    chmodSync(fallbackParent, 0o1777);
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  const resolve = (overrides: Parameters<typeof resolveSignalsSocketRoot>[0] = {}) =>
    resolveSignalsSocketRoot({
      env: {},
      platform: 'linux',
      uid,
      runtimeDir: missing(),
      darwinUserTempDir: () => undefined,
      fallbackParent,
      ...overrides,
    });

  const modeOf = (path: string) => lstatSync(path).mode & 0o777;

  describe('MASTRACODE_SIGNALS_SOCKET_ROOT', () => {
    it('overrides the default with an absolute path, as is', () => {
      const root = join(scratch, 'custom');
      expect(resolve({ env: { MASTRACODE_SIGNALS_SOCKET_ROOT: root, XDG_RUNTIME_DIR: perUser } })).toBe(root);
    });

    it('ignores a relative path', () => {
      expect(resolve({ env: { MASTRACODE_SIGNALS_SOCKET_ROOT: 'relative/root', XDG_RUNTIME_DIR: perUser } })).toBe(
        join(perUser, 'mc'),
      );
    });
  });

  describe('path selection', () => {
    it('never uses the shared /tmp/mc', () => {
      expect(resolve()).not.toBe('/tmp/mc');
    });

    it('uses $XDG_RUNTIME_DIR/mc on Linux, created with mode 0700', () => {
      const root = resolve({ env: { XDG_RUNTIME_DIR: perUser, TMPDIR: fallbackParent } });
      expect(root).toBe(join(perUser, 'mc'));
      expect(modeOf(root)).toBe(0o700);
    });

    it('uses the runtime directory on Linux when $XDG_RUNTIME_DIR is unset', () => {
      expect(resolve({ runtimeDir: perUser })).toBe(join(perUser, 'mc'));
    });

    it('uses $TMPDIR/mc on macOS and ignores $XDG_RUNTIME_DIR', () => {
      const xdg = join(scratch, 'xdg');
      mkdirSync(xdg, { mode: 0o700 });
      const root = resolve({ platform: 'darwin', env: { TMPDIR: perUser, XDG_RUNTIME_DIR: xdg } });
      expect(root).toBe(join(perUser, 'mc'));
      expect(modeOf(root)).toBe(0o700);
    });

    it("uses the user's temporary directory on macOS when $TMPDIR is unset", () => {
      expect(resolve({ platform: 'darwin', darwinUserTempDir: () => perUser })).toBe(join(perUser, 'mc'));
    });

    it('falls back to a 0700 mc-<uid> directory when there is no per-user directory', () => {
      const root = resolve();
      expect(root).toBe(join(fallbackParent, `mc-${uid}`));
      expect(lstatSync(root).uid).toBe(uid);
      expect(modeOf(root)).toBe(0o700);
    });

    it('skips a per-user directory that other users can write to, such as TMPDIR=/tmp', () => {
      expect(resolve({ platform: 'darwin', env: { TMPDIR: fallbackParent } })).toBe(join(fallbackParent, `mc-${uid}`));
      expect(resolve({ env: { XDG_RUNTIME_DIR: fallbackParent } })).toBe(join(fallbackParent, `mc-${uid}`));
    });

    it('resolves the same root on every call', () => {
      const env = { XDG_RUNTIME_DIR: perUser };
      expect(resolve({ env })).toBe(resolve({ env }));
    });
  });

  describe('ownership and permission checks', () => {
    const fallbackRoot = () => join(fallbackParent, `mc-${uid}`);

    it('reuses an existing private directory', () => {
      mkdirSync(fallbackRoot(), { mode: 0o700 });
      expect(resolve()).toBe(fallbackRoot());
    });

    it('refuses a symlink, even to a private directory of this user', () => {
      symlinkSync(perUser, fallbackRoot());
      expect(() => resolve()).toThrow(/is a symbolic link/);
    });

    it('refuses a file', () => {
      writeFileSync(fallbackRoot(), '', { mode: 0o600 });
      expect(() => resolve()).toThrow(/is not a directory/);
    });

    it('refuses a directory another user owns', () => {
      // Created by this test's user, so it belongs to someone other than `uid + 1`.
      const otherUid = uid + 1;
      mkdirSync(join(fallbackParent, `mc-${otherUid}`), { mode: 0o700 });
      expect(() => resolve({ uid: otherUid })).toThrow(new RegExp(`is owned by uid ${uid}, not ${otherUid}`));
    });

    it.each([0o777, 0o770, 0o707, 0o755])('refuses a directory with mode %o', mode => {
      mkdirSync(fallbackRoot());
      chmodSync(fallbackRoot(), mode);
      expect(() => resolve()).toThrow(/which other users can access/);
    });

    it('names the override in the error', () => {
      mkdirSync(fallbackRoot());
      chmodSync(fallbackRoot(), 0o777);
      expect(() => resolve()).toThrow(/MASTRACODE_SIGNALS_SOCKET_ROOT/);
    });

    it('checks the mc directory inside a per-user directory too', () => {
      symlinkSync(fallbackParent, join(perUser, 'mc'));
      expect(() => resolve({ env: { XDG_RUNTIME_DIR: perUser } })).toThrow(/is a symbolic link/);
    });
  });
});
