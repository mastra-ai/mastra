import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRunbookRoot } from '../../src/mastra/knowledge/root.js';
import { loadRunbook } from '../../src/mastra/knowledge/loader.js';

const temporary: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporary.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('stable runbook application root', () => {
  it('loads the actual country runbook when Studio reports public as cwd', async () => {
    const expected = resolve('runbooks');
    vi.spyOn(process, 'cwd').mockReturnValue(resolve('src/mastra/public'));
    expect(resolveRunbookRoot()).toBe(expected);
    expect((await loadRunbook(resolveRunbookRoot(), 'disallowed-country-login.md')).metadata.id).toBe(
      'RB-IDENTITY-002',
    );
  });

  it.each(['src/mastra/knowledge/root.ts', 'dist/mastra/knowledge/root.js', '.mastra/output/index.mjs'])(
    'supports %s, without depending on the package name',
    async relative => {
      const root = await mkdtemp(join(tmpdir(), 'soc-root-test-'));
      temporary.push(root);
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'customer-template',
          dependencies: { '@mastra/core': '1.63.0' },
        }),
      );
      await mkdir(join(root, '.mastra/output'), { recursive: true });
      await writeFile(join(root, '.mastra/output/package.json'), JSON.stringify({ name: 'server', dependencies: {} }));
      expect(resolveRunbookRoot(pathToFileURL(join(root, relative)).href)).toBe(join(root, 'runbooks'));
      // A missing application resource must not silently load a cwd copy.
      await expect(
        loadRunbook(resolveRunbookRoot(pathToFileURL(join(root, relative)).href), 'disallowed-country-login.md'),
      ).rejects.toBeDefined();
    },
  );

  it('fails closed if no owning application exists', () => {
    expect(() => resolveRunbookRoot('file:///nonexistent-isolated-module/root.mjs')).toThrow(
      'RUNBOOK_APPLICATION_ROOT_NOT_FOUND',
    );
  });
});
