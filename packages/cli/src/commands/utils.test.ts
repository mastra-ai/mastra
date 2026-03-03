import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi, beforeEach } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('node:fs/promises', async importOriginal => {
  const original = await importOriginal();
  return {
    ...original,
    readFile: vi.fn(),
  };
});

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/mock/path/to/package.json'),
}));

describe('getVersionTag', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('returns "beta" when CLI version matches beta dist-tag', async () => {
    const { execa } = await import('execa');

    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0-beta.5' }) as any);
    vi.mocked(execa).mockResolvedValue({
      stdout: 'beta: 1.0.0-beta.5\nlatest: 0.18.6',
      stderr: '',
      command: '',
      escapedCommand: '',
      exitCode: 0,
      failed: false,
      timedOut: false,
      killed: false,
    } as any);

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBe('beta');
  });

  test('returns "latest" when CLI version matches latest dist-tag', async () => {
    const { execa } = await import('execa');

    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '0.18.6' }) as any);
    vi.mocked(execa).mockResolvedValue({
      stdout: 'beta: 1.0.0-beta.5\nlatest: 0.18.6',
      stderr: '',
      command: '',
      escapedCommand: '',
      exitCode: 0,
      failed: false,
      timedOut: false,
      killed: false,
    } as any);

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBe('latest');
  });

  test('returns undefined when version does not match any dist-tag', async () => {
    const { execa } = await import('execa');

    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '0.0.0-local' }) as any);
    vi.mocked(execa).mockResolvedValue({
      stdout: 'beta: 1.0.0-beta.5\nlatest: 0.18.6',
      stderr: '',
      command: '',
      escapedCommand: '',
      exitCode: 0,
      failed: false,
      timedOut: false,
      killed: false,
    } as any);

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBeUndefined();
  });

  test('returns undefined when npm command fails', async () => {
    const { execa } = await import('execa');

    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0-beta.5' }) as any);
    vi.mocked(execa).mockRejectedValue(new Error('npm command failed'));

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBeUndefined();
  });

  test('returns undefined when package.json cannot be read', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBeUndefined();
  });
});
