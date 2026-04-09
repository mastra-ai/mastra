import { existsSync, writeFileSync, symlinkSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupProfileLockFiles, killProcessGroup } from './browser';

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
});
