import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { describe, it, expect } from 'vitest';
import { buildSeatbeltCommand, generateSeatbeltProfile } from './seatbelt';

const isDarwin = os.platform() === 'darwin';

/**
 * Run a shell command under the given profile, returning combined output.
 */
function runSandboxed(profile: string, command: string): { ok: boolean; output: string } {
  const { command: bin, args } = buildSeatbeltCommand(command, profile);
  try {
    return { ok: true, output: execFileSync(bin, args, { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return { ok: false, output: err.stderr ?? err.message ?? '' };
  }
}

describe('generateSeatbeltProfile', () => {
  it('should allow writes to device files, not just ioctl', () => {
    const profile = generateSeatbeltProfile('/workspace', {});

    // Opening a device O_RDWR needs file-write-data; file-ioctl does not cover it.
    for (const device of ['/dev/null', '/dev/zero', '/dev/random', '/dev/urandom', '/dev/tty']) {
      expect(profile).toContain(`(allow file-write-data (literal "${device}"))`);
      expect(profile).toContain(`(allow file-ioctl (literal "${device}"))`);
    }
  });

  it('should not grant unlink or chmod on device files', () => {
    const profile = generateSeatbeltProfile('/workspace', {});

    expect(profile).not.toContain('(allow file-write* (literal "/dev/null"))');
    expect(profile).not.toContain('(allow file-write-unlink');
  });

  it('should still restrict writes to the workspace', () => {
    const profile = generateSeatbeltProfile('/workspace', {});

    expect(profile).toContain('(deny default (with message "mastra-sandbox"))');
    expect(profile).toContain('(allow file-write* (subpath "/workspace"))');
  });

  it('should throw when allowSystemBinaries is disabled', () => {
    expect(() => generateSeatbeltProfile('/workspace', { allowSystemBinaries: false })).toThrow(
      /not supported by seatbelt/,
    );
  });
});

describe.skipIf(!isDarwin)('seatbelt profile under sandbox-exec (macOS)', () => {
  const workspace = os.tmpdir();

  it('should permit opening /dev/null for reading and writing', () => {
    const profile = generateSeatbeltProfile(workspace, { readWritePaths: [workspace] });

    const result = runSandboxed(profile, 'echo written > /dev/null && echo ok');

    expect(result.output).not.toMatch(/not permitted|Permission denied/);
    expect(result.ok).toBe(true);
  });

  it('should permit git, which opens /dev/null O_RDWR', () => {
    const profile = generateSeatbeltProfile(workspace, { readWritePaths: [workspace] });

    const result = runSandboxed(profile, 'git --version');

    expect(result.output).not.toMatch(/could not open '\/dev\/null'/);
    expect(result.ok).toBe(true);
  });
});
