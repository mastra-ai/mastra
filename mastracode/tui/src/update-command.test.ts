import { Writable } from 'node:stream';
import { detectPackageManager, fetchLatestVersion, performUpdate } from '@mastra/code-sdk/utils/update-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getUpdateCommandArgs, runUpdateCommand } from './update-command.js';

vi.mock('@mastra/code-sdk/utils/update-check', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/code-sdk/utils/update-check')>()),
  detectPackageManager: vi.fn(async () => 'pnpm'),
  describeUpdate: vi.fn((pm: string, version: string) => ({ via: pm, command: `${pm} add -g mastracode@${version}` })),
  fetchLatestVersion: vi.fn(),
  performUpdate: vi.fn(),
}));

function capture() {
  const stream = { text: '' };
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      stream.text += chunk.toString();
      callback();
    },
  });
  return { stream, writable };
}

async function run(args: string[] = [], currentVersion = '1.0.0') {
  const out = capture();
  const err = capture();
  const code = await runUpdateCommand({ args, output: out.writable, errorOutput: err.writable, currentVersion });
  return { code, text: out.stream.text, errorText: err.stream.text };
}

describe('getUpdateCommandArgs', () => {
  it.each(['update', 'upgrade'])('treats `mastracode %s` as the update subcommand', word => {
    expect(getUpdateCommandArgs(['node', 'mastracode', word])).toEqual([]);
    expect(getUpdateCommandArgs(['node', 'mastracode', word, '--help'])).toEqual(['--help']);
  });

  it('leaves other invocations alone', () => {
    expect(getUpdateCommandArgs(['node', 'mastracode'])).toBeUndefined();
    expect(getUpdateCommandArgs(['node', 'mastracode', 'update the readme'])).toBeUndefined();
    expect(getUpdateCommandArgs(['node', 'mastracode', '--prompt', 'update'])).toBeUndefined();
  });
});

describe('runUpdateCommand', () => {
  beforeEach(() => {
    vi.mocked(fetchLatestVersion).mockReset();
    vi.mocked(performUpdate).mockReset();
  });

  it('installs a newer version and exits 0', async () => {
    vi.mocked(fetchLatestVersion).mockResolvedValue('1.2.0');
    vi.mocked(performUpdate).mockResolvedValue({ status: 'updated', message: 'Updated to v1.2.0.', via: 'pnpm' });

    const { code, text, errorText } = await run();

    expect(performUpdate).toHaveBeenCalledWith('pnpm', '1.2.0');
    expect(text).toBe(
      [
        'Mastra Code  v1.0.0 → v1.2.0',
        'Installing with pnpm  pnpm add -g mastracode@1.2.0',
        '✓ Updated with pnpm',
        '',
      ].join('\n'),
    );
    expect(errorText).toBe('');
    expect(code).toBe(0);
  });

  it('does nothing when already on the latest version', async () => {
    vi.mocked(fetchLatestVersion).mockResolvedValue('1.0.0');

    const { code, text } = await run();

    expect(performUpdate).not.toHaveBeenCalled();
    expect(text).toBe('Mastra Code  v1.0.0\n✓ Up to date\n');
    expect(code).toBe(0);
  });

  it('exits 1 when the registry is unreachable', async () => {
    vi.mocked(fetchLatestVersion).mockResolvedValue(null);

    const { code, text, errorText } = await run();

    expect(text).toBe('Mastra Code  v1.0.0\n');
    expect(errorText).toBe("✗ Couldn't reach the npm registry. Check your connection and try again.\n");
    expect(code).toBe(1);
  });

  it('exits 1 and sends the failure and manual command to stderr', async () => {
    vi.mocked(fetchLatestVersion).mockResolvedValue('1.2.0');
    vi.mocked(performUpdate).mockResolvedValue({
      status: 'failed',
      message: '',
      command: 'pnpm add -g mastracode@1.2.0',
      details: 'ERR_PNPM_EACCES  permission denied',
    });

    const { code, text, errorText } = await run();

    expect(errorText).toBe(
      [
        '✗ Update failed',
        '  ERR_PNPM_EACCES  permission denied',
        '',
        'Run it yourself:  pnpm add -g mastracode@1.2.0',
        '',
      ].join('\n'),
    );
    expect(text).not.toContain('Update failed');
    expect(code).toBe(1);
  });

  it('exits 1 when another tool manages the install', async () => {
    vi.mocked(fetchLatestVersion).mockResolvedValue('1.2.0');
    vi.mocked(performUpdate).mockResolvedValue({
      status: 'unchanged',
      message: '',
      command: 'brew upgrade mastracode',
      managedBy: 'Homebrew',
    });

    const { code, errorText } = await run();

    expect(errorText).toContain('! Installed with Homebrew, so update it there:');
    expect(errorText).toContain('  brew upgrade mastracode');
    expect(code).toBe(1);
  });

  it('prints usage for --help without checking for updates', async () => {
    const { code, text, errorText } = await run(['--help']);

    expect(fetchLatestVersion).not.toHaveBeenCalled();
    expect(text).toContain('Usage: mastracode update');
    expect(errorText).toBe('');
    expect(code).toBe(0);
  });

  it('rejects unexpected arguments', async () => {
    const { code, text, errorText } = await run(['now']);

    expect(fetchLatestVersion).not.toHaveBeenCalled();
    expect(errorText).toContain('✗ Unexpected argument: now');
    expect(errorText).toContain('Usage: mastracode update');
    expect(text).toBe('');
    expect(code).toBe(1);
  });

  it('uses the detected package manager', async () => {
    vi.mocked(detectPackageManager).mockResolvedValueOnce('bun');
    vi.mocked(fetchLatestVersion).mockResolvedValue('2.0.0');
    vi.mocked(performUpdate).mockResolvedValue({ status: 'updated', message: '', via: 'bun' });

    await run();

    expect(performUpdate).toHaveBeenCalledWith('bun', '2.0.0');
  });
});
