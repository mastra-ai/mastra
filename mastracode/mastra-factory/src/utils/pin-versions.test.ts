import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pinMastraDependencies } from './pin-versions.js';

let projectDir: string;

function writeManifest(manifest: Record<string, unknown>) {
  fs.writeFileSync(path.join(projectDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
}

type PackumentFixture = {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, { dependencies?: Record<string, string> }>;
};

function mockRegistry(packuments: Record<string, PackumentFixture>) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const name = decodeURIComponent(new URL(String(url)).pathname.replace(/^\//, ''));
    const packument = packuments[name];
    if (!packument) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => packument };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-pin-test-'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('pinMastraDependencies', () => {
  it('pins dist-tag deps to exact versions and applies anchor pins for consistency', async () => {
    writeManifest({
      name: 'my-factory',
      dependencies: {
        '@mastra/factory': 'latest',
        '@mastra/code-sdk': 'latest',
        '@mastra/libsql': 'latest',
        '@mastra/core': 'latest',
        react: '^19.0.0',
      },
      devDependencies: {
        mastra: 'latest',
        typescript: '^5.9.2',
      },
    });

    // Simulate a mid-release skew: factory's `latest` already points at the
    // new release (which exact-pins code-sdk 1.0.0), while code-sdk's and
    // libsql's dist-tags still point at the previous release.
    mockRegistry({
      '@mastra/factory': {
        'dist-tags': { latest: '0.1.0' },
        versions: {
          '0.1.0': { dependencies: { '@mastra/code-sdk': '1.0.0', '@mastra/core': '1.52.0', hono: '^4.12.8' } },
        },
      },
      '@mastra/code-sdk': {
        'dist-tags': { latest: '0.1.0' },
        versions: {
          '0.1.0': { dependencies: { '@mastra/libsql': '1.16.0', '@mastra/core': '1.51.0' } },
          '1.0.0': { dependencies: { '@mastra/libsql': '1.17.0', '@mastra/core': '1.52.0' } },
        },
      },
      '@mastra/libsql': { 'dist-tags': { latest: '1.16.0' } },
      '@mastra/core': { 'dist-tags': { latest: '1.51.0' } },
      mastra: { 'dist-tags': { latest: '1.20.0' } },
    });

    const { pins } = await pinMastraDependencies(projectDir);

    expect(pins).toEqual({
      '@mastra/factory': '0.1.0',
      // Anchor consistency: factory's exact pin wins over the stale dist-tag,
      // and the *pinned* code-sdk version's exact pins win for libsql/core.
      '@mastra/code-sdk': '1.0.0',
      '@mastra/libsql': '1.17.0',
      '@mastra/core': '1.52.0',
      mastra: '1.20.0',
    });

    const manifest = readManifest();
    expect(manifest.dependencies).toEqual({
      '@mastra/factory': '0.1.0',
      '@mastra/code-sdk': '1.0.0',
      '@mastra/libsql': '1.17.0',
      '@mastra/core': '1.52.0',
      react: '^19.0.0',
    });
    expect(manifest.devDependencies).toEqual({
      mastra: '1.20.0',
      typescript: '^5.9.2',
    });
  });

  it('is a no-op without Mastra dist-tag deps and never hits the registry', async () => {
    writeManifest({
      name: 'my-factory',
      dependencies: { react: '^19.0.0', '@mastra/core': '1.52.0' },
    });
    const fetchMock = mockRegistry({});

    const { pins } = await pinMastraDependencies(projectDir);

    expect(pins).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readManifest().dependencies).toEqual({ react: '^19.0.0', '@mastra/core': '1.52.0' });
  });

  it('throws when the registry has no matching dist-tag', async () => {
    writeManifest({
      name: 'my-factory',
      dependencies: { '@mastra/factory': 'latest' },
    });
    mockRegistry({ '@mastra/factory': { 'dist-tags': { alpha: '0.1.0-alpha.9' } } });

    await expect(pinMastraDependencies(projectDir)).rejects.toThrow(/no "latest" dist-tag for @mastra\/factory/);
  });

  it('throws when the registry request fails', async () => {
    writeManifest({
      name: 'my-factory',
      dependencies: { '@mastra/factory': 'latest' },
    });
    mockRegistry({});

    await expect(pinMastraDependencies(projectDir)).rejects.toThrow(/HTTP 404/);
  });
});
