import { Writable } from 'node:stream';
import { detectPackageManager, fetchLatestVersion, performUpdate } from '@mastra/code-sdk/utils/update-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getUpdateCommandArgs, runUpdateCommand } from './update-command.js';

vi.mock('@mastra/code-sdk/utils/update-check', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/code-sdk/utils/update-check')>()),
  detectPackageManager: vi.fn(async () => 'pnpm'),
  fetchLatestVersion: vi.fn(),
  performUpdate: vi.fn(),
}));

async function run(args: string[] = [], currentVersion = '1.0.0') {
  let text = '';
  const output = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    },
  });
  const code = await runUpdateCommand({ args, output, currentVersion });
  return { code, text };
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
    vi.mocked(performUpdate).mockResolvedValue({ status: 'updated', message: 'Updated to v1.2.0.' });

    const { code, text } = await run();

    expect(performUpdate).toHaveBeenCalledWith('pnpm', '1.2.0');
    expect(text).toContain('Updating Mastra Code from v1.0.0 to v1.2.0');
    expect(text).toContain('Updated Mastra Code to v1.2.0.');
    expect(code).toBe(0);
  });

  it('does nothing when already on the latest version', async () => {
    vi.mocked(fetchLatestVersion).mockResolvedValue('1.0.0');

    const { code, text } = await run();

    expect(performUpdate).not.toHaveBeenCalled();
    expect(text).toContain('already on the latest version (v1.0.0)');
    expect(code).toBe(0);
  });

  it('exits 1 when the registry is unreachable', async () => {
    vi.mocked(fetchLatestVersion).mockResolvedValue(null);

    const { code, text } = await run();

    expect(text).toContain('Could not reach the npm registry');
    expect(code).toBe(1);
  });

  it.each(['failed', 'unchanged'] as const)('exits 1 and explains when the update is %s', async status => {
    vi.mocked(fetchLatestVersion).mockResolvedValue('1.2.0');
    vi.mocked(performUpdate).mockResolvedValue({ status, message: 'Run `pnpm add -g mastracode@1.2.0` manually.' });

    const { code, text } = await run();

    expect(text).toContain('Run `pnpm add -g mastracode@1.2.0` manually.');
    expect(code).toBe(1);
  });

  it('prints usage for --help without checking for updates', async () => {
    const { code, text } = await run(['--help']);

    expect(fetchLatestVersion).not.toHaveBeenCalled();
    expect(text).toContain('Usage: mastracode update');
    expect(code).toBe(0);
  });

  it('rejects unexpected arguments', async () => {
    const { code, text } = await run(['now']);

    expect(fetchLatestVersion).not.toHaveBeenCalled();
    expect(text).toContain('Usage: mastracode update');
    expect(code).toBe(1);
  });

  it('uses the detected package manager', async () => {
    vi.mocked(detectPackageManager).mockResolvedValueOnce('bun');
    vi.mocked(fetchLatestVersion).mockResolvedValue('2.0.0');
    vi.mocked(performUpdate).mockResolvedValue({ status: 'updated', message: '' });

    await run();

    expect(performUpdate).toHaveBeenCalledWith('bun', '2.0.0');
  });
});
