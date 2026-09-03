import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getPackageInfo } from 'local-pkg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSourceMapTool } from '../embedded-docs';

vi.mock('local-pkg', () => ({ getPackageInfo: vi.fn() }));

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.mocked(getPackageInfo).mockReset();
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('embedded package docs', () => {
  it('reads generated source maps from the assets directory', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-embedded-docs-project-'));
    const packageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-embedded-docs-package-'));
    temporaryDirectories.push(projectPath, packageRoot);
    const sourceMapDirectory = path.join(packageRoot, 'dist', 'docs', 'assets');
    await fs.mkdir(sourceMapDirectory, { recursive: true });
    await fs.writeFile(
      path.join(sourceMapDirectory, 'SOURCE_MAP.json'),
      JSON.stringify({
        version: '1.0.0',
        package: '@mastra/core',
        exports: {
          Knowledge: {
            types: 'dist/knowledge/index.d.ts',
            implementation: 'dist/knowledge.js',
            line: 42,
          },
        },
      }),
    );
    vi.mocked(getPackageInfo).mockResolvedValue({ rootPath: packageRoot, version: '1.0.0' });

    const result = await readSourceMapTool.execute({ package: '@mastra/core', projectPath, filter: 'Knowledge' });

    expect(result).toContain('Found 1 export(s) matching "Knowledge"');
    expect(result).toContain('**Knowledge**: `dist/knowledge.js:42`');
  });
});
