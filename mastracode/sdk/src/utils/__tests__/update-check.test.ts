import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock, homedirMock, readFileSyncMock, realpathSyncMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  homedirMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  realpathSyncMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({ execFile: execFileMock }));
vi.mock('node:fs', () => ({ readFileSync: readFileSyncMock, realpathSync: realpathSyncMock }));
vi.mock('node:os', () => ({ homedir: homedirMock }));

import {
  fetchChangelog,
  locateOwnInstall,
  parseChangelog,
  performUpdate,
  resolveUpdateOutcome,
  runUpdate,
} from '../update-check.js';

describe('parseChangelog', () => {
  const SAMPLE_CHANGELOG = [
    '# mastracode',
    '',
    '## 0.16.0',
    '',
    '### Minor Changes',
    '',
    '- Added evals system for MastraCode. ([#15642](https://github.com/mastra-ai/mastra/pull/15642))',
    '',
    '### Patch Changes',
    '',
    '- Fixed task lists leaking across threads. ([#15749](https://github.com/mastra-ai/mastra/pull/15749))',
    '',
    '- Allow typing a custom model string in `/om`. ([#15703](https://github.com/mastra-ai/mastra/pull/15703))',
    '',
    '- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b)]:',
    '  - @mastra/core@1.29.0',
    '  - @mastra/memory@1.17.2',
    '',
    '## 0.15.2',
    '',
    '### Patch Changes',
    '',
    '- Old bugfix from previous release. ([#15500](https://github.com/mastra-ai/mastra/pull/15500))',
  ].join('\n');

  it('produces the expected exact output for the sample changelog', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0');
    expect(result).toBe(
      [
        '  • Added evals system for MastraCode',
        '  • Fixed task lists leaking across threads',
        '  • Allow typing a custom model string in `/om`',
      ].join('\n'),
    );
  });

  it('does not include entries from other versions', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0');
    expect(result).not.toContain('Old bugfix');
  });

  it('filters out dependency update entries and their sub-items', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0');
    expect(result).not.toContain('Updated dependenc');
    expect(result).not.toContain('@mastra/core');
    expect(result).not.toContain('@mastra/memory');
  });

  it('strips markdown link syntax', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0')!;
    expect(result).not.toMatch(/\[.*\]\(.*\)/);
  });

  it('strips PR reference numbers', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0')!;
    expect(result).not.toMatch(/#\d{4,}/);
  });

  it('formats entries as bullet points', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0')!;
    const lines = result.split('\n');
    for (const line of lines) {
      expect(line).toMatch(/^\s+•\s+/);
    }
  });

  it('returns null for a version not in the changelog', () => {
    expect(parseChangelog(SAMPLE_CHANGELOG, '99.0.0')).toBeNull();
  });

  it('returns null when there are no meaningful entries', () => {
    const depOnly = ['## 1.0.0', '', '### Patch Changes', '', '- Updated dependencies:', '  - @mastra/core@2.0.0'].join(
      '\n',
    );
    expect(parseChangelog(depOnly, '1.0.0')).toBeNull();
  });

  it('preserves full entry text without truncation', () => {
    const longEntry = 'A'.repeat(200);
    const md = `## 1.0.0\n\n- ${longEntry}`;
    const result = parseChangelog(md, '1.0.0')!;
    expect(result).toContain('A'.repeat(200));
  });

  it('preserves full multi-sentence entries', () => {
    const md = '## 1.0.0\n\n- First sentence here. Then a longer explanation follows with details.';
    const result = parseChangelog(md, '1.0.0')!;
    expect(result).toContain('First sentence here. Then a longer explanation follows with details');
  });
});

describe('fetchChangelog (integration)', () => {
  it('fetches and parses the real changelog for a known published version', async () => {
    // v0.16.0 is a known published version with real changelog entries
    const result = await fetchChangelog('0.16.0');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');

    const lines = result!.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    // Every line should be a bullet point
    for (const line of lines) {
      expect(line).toMatch(/^\s+•\s+/);
    }
    // Should contain at least one recognizable entry from v0.16.0
    expect(result).toContain('evals');
  }, 10_000);

  it('fetches and preserves full entries for a version with many entries (v0.10.0)', async () => {
    const result = await fetchChangelog('0.10.0');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(9);
    // Entries should not be truncated with "…"
    expect(result).toContain('Custom response');
    expect(result).toContain('/thread command');
    expect(result).toContain('observational memory');
    for (const line of lines) {
      expect(line).toMatch(/^\s+•\s+/);
    }
  }, 10_000);

  it('returns null for a non-existent version', async () => {
    const result = await fetchChangelog('0.0.0-does-not-exist');
    expect(result).toBeNull();
  }, 10_000);
});

describe('runUpdate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves ok and omits stderr when the package manager exits cleanly', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: any) => cb(null, '', ''));
    await expect(runUpdate('npm', '1.2.3')).resolves.toEqual({ ok: true });
  });

  it('captures stderr even on success (e.g. deprecation warnings)', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: any) =>
      cb(null, '', 'npm warn deprecated foo@1.0.0\n'),
    );
    await expect(runUpdate('npm', '1.2.3')).resolves.toEqual({ ok: true, stderr: 'npm warn deprecated foo@1.0.0' });
  });

  it('returns ok:false with the captured stderr on failure', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: any) =>
      cb(new Error('Command failed'), '', 'npm ERR! code EACCES\nnpm ERR! permission denied\n'),
    );
    const result = await runUpdate('npm', '1.2.3');
    expect(result.ok).toBe(false);
    expect(result.stderr).toBe('npm ERR! code EACCES\nnpm ERR! permission denied');
  });

  it('falls back to the error message when the package manager produced no stderr', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: any) =>
      cb(new Error('spawn pnpm ENOENT'), '', ''),
    );
    await expect(runUpdate('pnpm', '1.2.3')).resolves.toEqual({ ok: false, stderr: 'spawn pnpm ENOENT' });
  });

  it('invokes the package manager with the right global install args', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: any) => cb(null, '', ''));
    await runUpdate('pnpm', '1.2.3');
    expect(execFileMock).toHaveBeenLastCalledWith(
      'pnpm',
      ['add', '-g', 'mastracode@1.2.3'],
      expect.any(Object),
      expect.any(Function),
    );
  });
});

describe('locateOwnInstall', () => {
  const originalArgv1 = process.argv[1];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.argv[1] = originalArgv1;
  });

  it('walks up from the running binary to the mastracode manifest and reads the version fresh', () => {
    process.argv[1] = '/opt/tool/mastracode/dist/cli.js';
    realpathSyncMock.mockReturnValue('/opt/tool/mastracode/dist/cli.js');
    readFileSyncMock.mockImplementation((p: string) => {
      if (p === '/opt/tool/mastracode/package.json') return JSON.stringify({ name: 'mastracode', version: '9.9.9' });
      throw new Error('ENOENT');
    });

    expect(locateOwnInstall()).toEqual({ dir: '/opt/tool/mastracode', version: '9.9.9' });
  });

  it('skips unrelated package.json files while walking up', () => {
    process.argv[1] = '/a/b/c/cli.js';
    realpathSyncMock.mockReturnValue('/a/b/c/cli.js');
    readFileSyncMock.mockImplementation((p: string) => {
      if (p === '/a/b/c/package.json') return JSON.stringify({ name: 'some-other-pkg', version: '1.0.0' });
      if (p === '/a/b/package.json') return JSON.stringify({ name: 'mastracode', version: '2.0.0' });
      throw new Error('ENOENT');
    });

    expect(locateOwnInstall()).toEqual({ dir: '/a/b', version: '2.0.0' });
  });

  it('returns null when no mastracode manifest is found (e.g. running from source)', () => {
    process.argv[1] = '/a/b/cli.js';
    realpathSyncMock.mockReturnValue('/a/b/cli.js');
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(locateOwnInstall()).toBeNull();
  });

  it('returns null when the binary path cannot be resolved', () => {
    process.argv[1] = '/broken';
    realpathSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(locateOwnInstall()).toBeNull();
  });

  it('returns a null version when the manifest has no version field', () => {
    process.argv[1] = '/pkg/dist/cli.js';
    realpathSyncMock.mockReturnValue('/pkg/dist/cli.js');
    readFileSyncMock.mockImplementation((p: string) => {
      if (p === '/pkg/package.json') return JSON.stringify({ name: 'mastracode' });
      throw new Error('ENOENT');
    });

    expect(locateOwnInstall()).toEqual({ dir: '/pkg', version: null });
  });
});

describe('resolveUpdateOutcome', () => {
  const base = { pm: 'npm' as const, targetVersion: '2.0.0' };
  const oldInstall = { dir: '/opt/vite-plus/mastracode', version: '1.0.0' };

  it('reports failure with the manual command and formatted stderr', () => {
    const outcome = resolveUpdateOutcome({
      ...base,
      result: { ok: false, stderr: 'npm ERR! code EACCES\nnpm ERR! permission denied' },
      install: oldInstall,
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('npm install -g mastracode@2.0.0');
    expect(outcome.message).toContain('npm ERR! permission denied');
  });

  it('caps surfaced stderr at the last five non-empty lines', () => {
    const stderr = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n\n');
    const outcome = resolveUpdateOutcome({ ...base, result: { ok: false, stderr }, install: oldInstall });
    expect(outcome.message).toContain('line 10');
    expect(outcome.message).toContain('line 6');
    expect(outcome.message).not.toContain('line 5');
  });

  it('reports failure without a details block when there is no stderr', () => {
    const outcome = resolveUpdateOutcome({ ...base, result: { ok: false }, install: oldInstall });
    expect(outcome).toEqual({
      status: 'failed',
      message: 'Auto-update failed. Run `npm install -g mastracode@2.0.0` manually.',
    });
  });

  it('reports success when the installed version matches the target', () => {
    const outcome = resolveUpdateOutcome({
      ...base,
      result: { ok: true },
      install: { dir: '/usr/local/lib/node_modules/mastracode', version: '2.0.0' },
    });
    expect(outcome).toEqual({ status: 'updated', message: 'Updated to v2.0.0. Please restart Mastra Code.' });
  });

  it('reports success when the install is indeterminable', () => {
    expect(resolveUpdateOutcome({ ...base, result: { ok: true }, install: null }).status).toBe('updated');
    expect(
      resolveUpdateOutcome({ ...base, result: { ok: true }, install: { dir: '/pkg', version: null } }).status,
    ).toBe('updated');
  });

  it('reports an honest unchanged message when exit 0 but the binary is still old', () => {
    const outcome = resolveUpdateOutcome({ ...base, result: { ok: true }, install: oldInstall });
    expect(outcome.status).toBe('unchanged');
    expect(outcome.message).toContain('still v1.0.0');
    expect(outcome.message).toContain('/opt/vite-plus/mastracode');
    expect(outcome.message).not.toContain('Updated to v');
    expect(outcome.message).toContain('npm install -g mastracode@2.0.0');
  });
});

describe('performUpdate', () => {
  const originalArgv1 = process.argv[1];

  beforeEach(() => {
    vi.resetAllMocks();
    homedirMock.mockReturnValue('/home/tester');
  });

  afterEach(() => {
    process.argv[1] = originalArgv1;
  });

  /** Mock execFile so `npm root -g` answers with `globalRoot` and installs succeed. */
  function mockPackageManager(globalRoot: string | Error) {
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: any) => {
      if (args[0] === 'root') {
        return globalRoot instanceof Error ? cb(globalRoot, '', '') : cb(null, `${globalRoot}\n`, '');
      }
      cb(null, '', '');
    });
  }

  function mockInstalledAt(pkgDir: string, version: string) {
    process.argv[1] = `${pkgDir}/dist/cli.js`;
    realpathSyncMock.mockImplementation((p: string) => {
      if (p === `${pkgDir}/dist/cli.js` || p === pkgDir) return p;
      throw new Error('ENOENT');
    });
    readFileSyncMock.mockImplementation((p: string) => {
      if (p === `${pkgDir}/package.json`) return JSON.stringify({ name: 'mastracode', version });
      throw new Error('ENOENT');
    });
  }

  it('runs the install and reports updated when the running install is managed by the pm', async () => {
    mockPackageManager('/global/root');
    mockInstalledAt('/global/root/mastracode', '2.0.0');

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('updated');
    expect(execFileMock).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', 'mastracode@2.0.0'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('skips the install and explains when the running install is managed by another tool', async () => {
    mockPackageManager('/global/root');
    mockInstalledAt('/opt/vite-plus/mastracode', '1.0.0');

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('unchanged');
    expect(outcome.message).toContain('/opt/vite-plus/mastracode');
    expect(outcome.message).toContain('not managed by npm');
    expect(outcome.message).toContain('npm install -g mastracode@2.0.0');
    const installCalls = execFileMock.mock.calls.filter(([, args]) => args[0] === 'install');
    expect(installCalls).toHaveLength(0);
  });

  it('proceeds with the install when the global root cannot be determined', async () => {
    mockPackageManager(new Error('spawn failed'));
    mockInstalledAt('/opt/vite-plus/mastracode', '2.0.0');

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('updated');
    expect(execFileMock).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', 'mastracode@2.0.0'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('still reports unchanged when the pre-check passes but the on-disk version did not change', async () => {
    mockPackageManager('/global/root');
    mockInstalledAt('/global/root/mastracode', '1.0.0');

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('unchanged');
    expect(outcome.message).toContain('still v1.0.0');
  });

  const VP_PKG_DIR = '/home/tester/.vite-plus/packages/mastracode/lib/node_modules/mastracode';

  /** Mock an install under ~/.vite-plus whose on-disk version changes when `vp` runs. */
  function mockVitePlusInstall(opts: { vpBumpsTo?: string; vpError?: { error: Error; stderr: string } }) {
    let version = '1.0.0';
    process.argv[1] = `${VP_PKG_DIR}/dist/cli.js`;
    realpathSyncMock.mockImplementation((p: string) => p);
    readFileSyncMock.mockImplementation((p: string) => {
      if (p === `${VP_PKG_DIR}/package.json`) return JSON.stringify({ name: 'mastracode', version });
      throw new Error('ENOENT');
    });
    execFileMock.mockImplementation((cmd: string, _args: string[], _opts: unknown, cb: any) => {
      if (cmd !== 'vp') return cb(new Error(`unexpected command: ${cmd}`), '', '');
      if (opts.vpError) return cb(opts.vpError.error, '', opts.vpError.stderr);
      if (opts.vpBumpsTo) version = opts.vpBumpsTo;
      cb(null, '', '');
    });
  }

  it('delegates to vite-plus for an install under ~/.vite-plus and verifies it on disk', async () => {
    mockVitePlusInstall({ vpBumpsTo: '2.0.0' });

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome).toEqual({ status: 'updated', message: 'Updated to v2.0.0. Please restart Mastra Code.' });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      'vp',
      ['install', '-g', 'mastracode@2.0.0'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('surfaces vite-plus stderr and the vp command when the delegated update fails', async () => {
    mockVitePlusInstall({
      vpError: { error: new Error('Command failed'), stderr: 'vp error: registry unreachable\n' },
    });

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('vp install -g mastracode@2.0.0');
    expect(outcome.message).toContain('vp error: registry unreachable');
  });

  it('reports unchanged with the vp command when vite-plus ran but the version did not change', async () => {
    mockVitePlusInstall({});

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('unchanged');
    expect(outcome.message).toContain('still v1.0.0');
    expect(outcome.message).toContain('vp install -g mastracode@2.0.0');
    expect(outcome.message).not.toContain('another tool');
  });

  it('suggests brew upgrade without running anything for a Homebrew install', async () => {
    mockInstalledAt('/opt/homebrew/Cellar/mastracode/1.0.0/libexec/lib/node_modules/mastracode', '1.0.0');

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('unchanged');
    expect(outcome.message).toContain('managed by Homebrew');
    expect(outcome.message).toContain('brew upgrade mastracode');
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('recognizes Homebrew under a non-default prefix (linuxbrew)', async () => {
    mockInstalledAt('/home/linuxbrew/.linuxbrew/Cellar/mastracode/1.0.0/libexec/lib/node_modules/mastracode', '1.0.0');

    const outcome = await performUpdate('npm', '2.0.0');

    expect(outcome.status).toBe('unchanged');
    expect(outcome.message).toContain('brew upgrade mastracode');
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed target version before running anything', async () => {
    mockInstalledAt('/global/root/mastracode', '1.0.0');

    const outcome = await performUpdate('npm', '2.0.0; rm -rf ~');

    expect(outcome.status).toBe('failed');
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
