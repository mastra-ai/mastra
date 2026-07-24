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

  it('resolves a subpath via the exports map', async () => {
    const workspaceMap = await writePkg({ './api': './src/api.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf/api', workspaceMap)).toBe(join(dir, 'src', 'api.ts'));
  });

  it('resolves a wildcard subpath', async () => {
    const workspaceMap = await writePkg({ './dist/*': './src/*.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf/dist/lexorder', workspaceMap)).toBe(
      join(dir, 'src', 'lexorder.ts'),
    );
  });

  it('returns null for a bare root specifier (roots are handled elsewhere)', async () => {
    const workspaceMap = await writePkg({ './api': './src/api.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf', workspaceMap)).toBeNull();
  });

  it('returns null for a package that is not in the workspace map', async () => {
    const workspaceMap = await writePkg({ './api': './src/api.ts' });
    expect(resolveWorkspaceSubpathToSource('@other/pkg/api', workspaceMap)).toBeNull();
  });

  it('returns null (guarded) when the exports map has no entry for the subpath', async () => {
    // resolve.exports throws for a missing entry; the resolver must swallow it and return null.
    const workspaceMap = await writePkg({ './api': './src/api.ts' });
    expect(resolveWorkspaceSubpathToSource('@scope/leaf/does-not-exist', workspaceMap)).toBeNull();
  });
});
