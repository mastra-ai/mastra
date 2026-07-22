import * as fsPromises from 'node:fs/promises';
import { x } from 'tinyexec';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCreateVersionTag, getPackageVersion } from './utils.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('tinyexec', () => ({
  x: vi.fn(),
}));

const mockDistTags = (stdout: string) => {
  vi.mocked(x).mockResolvedValue({ stdout } as Awaited<ReturnType<typeof x>>);
};

describe('getPackageVersion', () => {
  it('reads the package version from the package manifest', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify({ version: '1.2.3' }));

    await expect(getPackageVersion()).resolves.toBe('1.2.3');
    expect(fsPromises.readFile).toHaveBeenCalledWith(expect.stringMatching(/create-mastra[/\\]package\.json$/), 'utf8');
  });
});

describe('getCreateVersionTag', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: 'matching prerelease channel',
      version: '1.2.3-beta.4',
      output: 'latest: 1.2.3-beta.4\nbeta: 1.2.3-beta.4',
      expected: 'beta',
    },
    {
      name: 'first nonnumeric prerelease identifier',
      version: '1.2.3-20260716.snapshot.1',
      output: 'latest: 1.2.3-20260716.snapshot.1\nsnapshot: 1.2.3-20260716.snapshot.1',
      expected: 'snapshot',
    },
    {
      name: 'changesets snapshot channel',
      version: '0.0.0-create-mastra-e2e-test-20260715172042',
      output:
        'latest: 0.0.0-create-mastra-e2e-test-20260715172042\ncreate-mastra-e2e-test: 0.0.0-create-mastra-e2e-test-20260715172042',
      expected: 'create-mastra-e2e-test',
    },
    {
      name: 'latest stable tag',
      version: '1.2.3',
      output: 'beta: 1.2.3\nlatest: 1.2.3',
      expected: 'latest',
    },
    {
      name: 'beta fallback',
      version: '1.2.3',
      output: 'zeta: 1.2.3\nbeta: 1.2.3',
      expected: 'beta',
    },
    {
      name: 'deterministic lexical fallback',
      version: '1.2.3',
      output: 'next: 1.2.3\nalpha: 1.2.3',
      expected: 'alpha',
    },
    {
      name: 'exact wrapper version while ignoring other versions',
      version: '1.2.3-snapshot.1',
      output: 'snapshot: 9.9.9-snapshot.1\nlatest: 1.2.3\nsnapshot: 1.2.3-snapshot.1',
      expected: 'snapshot',
    },
  ])('selects the $name', async ({ version, output, expected }) => {
    mockDistTags(output);

    await expect(getCreateVersionTag(version)).resolves.toBe(expected);
    expect(x).toHaveBeenCalledWith('npm', ['dist-tag', 'ls', 'create-mastra'], { throwOnError: true });
  });

  it.each([
    ['no tag has the exact version', () => mockDistTags('latest: 1.2.4\nbeta: 1.2.3-beta.1')],
    ['the registry command fails', () => vi.mocked(x).mockRejectedValue(new Error('registry unavailable'))],
  ])('warns and falls back to latest when %s', async (_name, arrange) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    arrange();

    await expect(getCreateVersionTag('1.2.3')).resolves.toBe('latest');
    expect(consoleError).toHaveBeenCalledWith(
      'We could not resolve the create-mastra version tag, falling back to "latest"',
    );
  });
});
