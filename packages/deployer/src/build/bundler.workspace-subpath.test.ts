import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDir, remove, writeFile } from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import { resolveWorkspaceSubpathToSource } from './bundler';

describe('resolveWorkspaceSubpathToSource', () => {
  let dir: string;
  let counter = 0;

  beforeEach(async () => {
    dir = join(tmpdir(), `ws-subpath-${Date.now()}-${counter++}`);
    await ensureDir(dir);
  });

  afterEach(async () => {
    await remove(dir);
  });

  async function writePkg(exportsField: Record<string, string>) {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@scope/leaf', version: '1.0.0', exports: exportsField }),
    );
    return new Map<string, WorkspacePackageInfo>([
      ['@scope/leaf', { location: dir, dependencies: {}, version: '1.0.0' }],
    ]);
  }

  it('resolves a transitive subpath to the source file its exports map points at', async () => {
    const workspaceMap = await writePkg({ './feature': './src/feature.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf/feature', workspaceMap)).toBe(join(dir, 'src', 'feature.ts'));
  });

  it('resolves a wildcard subpath entry', async () => {
    const workspaceMap = await writePkg({ './dist/*': './src/*.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf/dist/lexorder', workspaceMap)).toBe(
      join(dir, 'src', 'lexorder.ts'),
    );
  });

  it('returns null for a bare root specifier (roots are handled by the analyze dependency map)', async () => {
    const workspaceMap = await writePkg({ './feature': './src/feature.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf', workspaceMap)).toBeNull();
  });

  it('returns null for a package outside the workspace map', async () => {
    const workspaceMap = await writePkg({ './feature': './src/feature.ts' });
    expect(resolveWorkspaceSubpathToSource('@other/pkg/feature', workspaceMap)).toBeNull();
  });

  it('swallows the resolve.exports throw for a missing entry and returns null', async () => {
    const workspaceMap = await writePkg({ './feature': './src/feature.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf/does-not-exist', workspaceMap)).toBeNull();
  });

  it('returns null when the workspace package has no readable package.json', async () => {
    const dir2 = join(dir, 'ghost');
    await ensureDir(dir2); // package.json intentionally absent
    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      ['@scope/ghost', { location: dir2, dependencies: {}, version: '1.0.0' }],
    ]);
    expect(resolveWorkspaceSubpathToSource('@scope/ghost/feature', workspaceMap)).toBeNull();
  });
});
