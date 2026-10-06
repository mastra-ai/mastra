import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  SETUP_FAILED_MARKER_PATH,
  SETUP_MARKER_DIR,
  SETUP_MARKER_PATH,
  WORKSPACE_SETUP_MARKER_PATH,
  guardedSetupCommand,
  normalizeSetupCommands,
  repoSetupMarkerPath,
  setupMarkerCommand,
  setupMarkerContent,
} from './setup-marker';

describe('setup marker', () => {
  it('digests the non-blank commands joined by newlines, in order', () => {
    const expected = `sha256:${createHash('sha256').update('pnpm i\npnpm build').digest('hex')}`;
    expect(setupMarkerContent(['pnpm i', '', '  ', 'pnpm build'])).toBe(expected);
    expect(setupMarkerContent(['pnpm build', 'pnpm i'])).not.toBe(expected);
    // A single string is a one-entry list, so factory's string and a template's array agree.
    expect(setupMarkerContent('pnpm i')).toBe(setupMarkerContent(['pnpm i']));
    expect(setupMarkerContent(undefined)).toBe(setupMarkerContent([]));
  });

  it('normalizes blank entries away without trimming the rest', () => {
    expect(normalizeSetupCommands([' pnpm i ', '', '   '])).toEqual([' pnpm i ']);
    expect(normalizeSetupCommands('pnpm i')).toEqual(['pnpm i']);
    expect(normalizeSetupCommands(undefined)).toEqual([]);
  });

  it('writes the marker beside the cwd with a shell-safe digest', () => {
    const content = setupMarkerContent('pnpm i');
    expect(content).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Pinned literally: Factory compares against this exact file, so the one-argument form must not drift.
    expect(setupMarkerCommand(content)).toBe(
      `mkdir -p "$(dirname ".mastra-sandbox/setup")" && printf '%s' '${content}' > ".mastra-sandbox/setup"`,
    );
    expect(SETUP_MARKER_PATH).toBe('.mastra-sandbox/setup');
  });

  it('derives the other marker paths from the same directory', () => {
    expect(SETUP_MARKER_DIR).toBe('.mastra-sandbox');
    expect(WORKSPACE_SETUP_MARKER_PATH).toBe('.mastra-sandbox/workspace-setup');
    expect(SETUP_FAILED_MARKER_PATH).toBe('.mastra-sandbox/setup-failed');
    expect(repoSetupMarkerPath('mastra')).toBe('.mastra-sandbox/repos/mastra');
  });

  it('writes a marker at a custom path', () => {
    const content = setupMarkerContent(['exit 7']);
    expect(setupMarkerCommand(content, repoSetupMarkerPath('widgets'))).toBe(
      `mkdir -p "$(dirname ".mastra-sandbox/repos/widgets")" && printf '%s' '${content}' > ".mastra-sandbox/repos/widgets"`,
    );
  });
});

describe('guardedSetupCommand', () => {
  it('is the plain cd step when the guard is off', () => {
    expect(guardedSetupCommand({ repoDir: 'x', command: 'pnpm i && pnpm build', continueOnFailure: false })).toBe(
      'cd "x" && pnpm i && pnpm build',
    );
  });

  it('wraps the command and appends the repo dir to the failure list when the guard is on', () => {
    expect(guardedSetupCommand({ repoDir: 'x', command: 'pnpm i && pnpm build', continueOnFailure: true })).toBe(
      `( cd "x" && ( pnpm i && pnpm build\n) ) || { mkdir -p ".mastra-sandbox" && printf '%s\\n' 'x' >> ".mastra-sandbox/setup-failed"; }`,
    );
  });

  describe('executed in a shell', () => {
    let tmp: string;
    const run = (cmd: string) => execFileSync('sh', ['-c', cmd], { cwd: tmp, stdio: 'pipe' });
    const failed = () => join(tmp, SETUP_FAILED_MARKER_PATH);

    afterEach(() => rmSync(tmp, { recursive: true, force: true }));

    function setup(...dirs: string[]) {
      tmp = mkdtempSync(join(tmpdir(), 'guard-'));
      for (const dir of dirs) mkdirSync(join(tmp, dir));
    }

    it('records a failure at the build cwd, not inside the repo, and exits 0', () => {
      setup('x');
      run(guardedSetupCommand({ repoDir: 'x', command: 'exit 7', continueOnFailure: true }));
      expect(readFileSync(failed(), 'utf8')).toBe('x\n');
      expect(existsSync(join(tmp, 'x', SETUP_MARKER_DIR))).toBe(false);
    });

    it('writes nothing when the command succeeds', () => {
      setup('x');
      run(guardedSetupCommand({ repoDir: 'x', command: 'true', continueOnFailure: true }));
      expect(existsSync(failed())).toBe(false);
    });

    it('lists each failing repo on its own line', () => {
      setup('x', 'y');
      run(guardedSetupCommand({ repoDir: 'x', command: 'exit 1', continueOnFailure: true }));
      run(guardedSetupCommand({ repoDir: 'y', command: 'false', continueOnFailure: true }));
      expect(readFileSync(failed(), 'utf8')).toBe('x\ny\n');
    });

    it('survives a command that ends in a shell comment', () => {
      setup('x');
      const out = run(guardedSetupCommand({ repoDir: 'x', command: 'echo hi # note', continueOnFailure: true }));
      expect(out.toString()).toBe('hi\n');
      expect(existsSync(failed())).toBe(false);
    });

    it('runs the command inside the repo dir', () => {
      setup('x');
      const out = run(guardedSetupCommand({ repoDir: 'x', command: 'basename "$PWD"', continueOnFailure: true }));
      expect(out.toString()).toBe('x\n');
    });

    it('fails the step itself when the guard is off', () => {
      setup('x');
      expect(() => run(guardedSetupCommand({ repoDir: 'x', command: 'exit 7', continueOnFailure: false }))).toThrow();
      expect(existsSync(failed())).toBe(false);
    });
  });
});
