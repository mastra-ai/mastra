import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getWorkspaceInformation } from './workspaceDependencies';

let root: string;

async function writePackage(dir: string, pkg: Record<string, unknown>) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
}

function toPosix(path: string) {
  return path.split('\\').join('/');
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mastra-root-package-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('getWorkspaceInformation when the app is the workspace root package', () => {
  it('treats a root app declared as a workspace member as a workspace package', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "."\n  - "packages/*"\n');
    await writePackage(root, {
      name: 'app',
      version: '0.1.0',
      dependencies: { '@scope/shared': 'workspace:*' },
    });
    await writePackage(join(root, 'packages', 'shared'), { name: '@scope/shared', version: '0.1.0' });

    const info = await getWorkspaceInformation({
      dir: root,
      mastraEntryFile: join(root, 'src', 'mastra', 'index.ts'),
    });

    expect(info.isWorkspacePackage).toBe(true);
    expect(info.workspaceRoot).toBe(toPosix(root));
    expect(info.workspaceMap.get('@scope/shared')).toEqual({
      location: toPosix(join(root, 'packages', 'shared')),
      dependencies: undefined,
      version: '0.1.0',
      exports: undefined,
    });
  });

  it('does not treat a root app as a workspace package when no glob includes it', async () => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    await writePackage(root, { name: 'app', version: '0.1.0' });
    await writePackage(join(root, 'packages', 'shared'), { name: '@scope/shared', version: '0.1.0' });

    const info = await getWorkspaceInformation({
      dir: root,
      mastraEntryFile: join(root, 'src', 'mastra', 'index.ts'),
    });

    expect(info.isWorkspacePackage).toBe(false);
    expect(info.workspaceRoot).toBeUndefined();
    expect(info.workspaceMap.size).toBe(0);
  });
});
