import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveMastraPackageVersions } from './version-resolver';

vi.mock('execa');

const mockedExeca = vi.mocked(execa);

beforeEach(() => {
  mockedExeca.mockReset();
});

describe('resolveMastraPackageVersions', () => {
  it('resolves independent exact versions for packages with different numbering', async () => {
    mockedExeca.mockImplementation(((_cmd: string, args: string[]) => {
      const pkg = args?.[1];
      if (pkg === '@mastra/core') return Promise.resolve({ stdout: '1.55.0-alpha.0\n' }) as never;
      if (pkg === 'mastra') return Promise.resolve({ stdout: '1.21.0-alpha.0\n' }) as never;
      if (pkg === '@mastra/libsql') return Promise.resolve({ stdout: '1.18.0-alpha.1\n' }) as never;
      return Promise.reject(new Error('unexpected')) as never;
    }) as never);

    const result = await resolveMastraPackageVersions(['mastra', '@mastra/core', '@mastra/libsql'], 'alpha');

    expect(result).toEqual({
      '@mastra/core': '1.55.0-alpha.0',
      '@mastra/libsql': '1.18.0-alpha.1',
      mastra: '1.21.0-alpha.0',
    });
  });

  it('dedupes and sorts package requests deterministically', async () => {
    const calls: string[] = [];
    mockedExeca.mockImplementation(((_cmd: string, args: string[]) => {
      const pkg = args?.[1];
      calls.push(pkg);
      return Promise.resolve({ stdout: '1.0.0\n' }) as never;
    }) as never);

    await resolveMastraPackageVersions(['mastra', '@mastra/core', 'mastra', '@mastra/core'], 'latest');

    expect(calls).toEqual(['@mastra/core', 'mastra']);
  });

  it('returns an empty map without invoking npm for an empty package set', async () => {
    const result = await resolveMastraPackageVersions([], 'latest');

    expect(result).toEqual({});
    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it('returns undefined when a dist-tag lookup command rejects', async () => {
    mockedExeca.mockRejectedValue(new Error('npm error') as never);

    const result = await resolveMastraPackageVersions(['mastra'], 'alpha');

    expect(result).toBeUndefined();
  });

  it('returns undefined when the dist-tag output is empty', async () => {
    mockedExeca.mockResolvedValue({ stdout: '\n' } as never);

    const result = await resolveMastraPackageVersions(['mastra'], 'alpha');

    expect(result).toBeUndefined();
  });

  it('fails the complete operation when only a subset resolves', async () => {
    let callCount = 0;
    mockedExeca.mockImplementation((() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ stdout: '1.0.0\n' }) as never;
      return Promise.reject(new Error('npm error')) as never;
    }) as never);

    const result = await resolveMastraPackageVersions(['@mastra/core', 'mastra'], 'alpha');

    expect(result).toBeUndefined();
  });

  it('accepts a valid exact stable version', async () => {
    mockedExeca.mockResolvedValue({ stdout: '1.50.2\n' } as never);

    const result = await resolveMastraPackageVersions(['@mastra/core'], 'latest');

    expect(result).toEqual({ '@mastra/core': '1.50.2' });
  });

  it('accepts a valid exact prerelease version', async () => {
    mockedExeca.mockResolvedValue({ stdout: '1.55.0-alpha.0\n' } as never);

    const result = await resolveMastraPackageVersions(['@mastra/core'], 'alpha');

    expect(result).toEqual({ '@mastra/core': '1.55.0-alpha.0' });
  });

  const invalidValues: Array<[string, string]> = [
    ['a dist-tag name', 'latest'],
    ['a caret range', '^1.2.3'],
    ['a tilde range', '~1.2.3'],
    ['a noncanonical version', 'v1.2.3'],
    ['invalid semver', 'not-a-version'],
    ['an x-range', '1.x'],
    ['empty string', ''],
    ['npm diagnostic text', 'npm ERR! code E404\nnpm ERR! 404 Not Found'],
    ['multiline output', '1.2.3\n1.2.4'],
    ['whitespace-only', '   '],
  ];

  for (const [description, value] of invalidValues) {
    it(`rejects ${description}`, async () => {
      mockedExeca.mockResolvedValue({ stdout: `${value}\n` } as never);

      const result = await resolveMastraPackageVersions(['mastra'], 'alpha');

      expect(result).toBeUndefined();
    });
  }
});
