import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { CompositeFilesystem, LocalFilesystem } from '../../filesystem';
import { loadGitignore } from '../../gitignore';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace tools on CompositeFilesystem without a root mount', () => {
  let base: string;
  let filesystem: CompositeFilesystem<any>;
  let workspace: Workspace;

  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), 'composite-no-root-'));
    await fs.mkdir(path.join(base, 'incoming'));
    await fs.mkdir(path.join(base, 'working'));
    await fs.writeFile(path.join(base, 'incoming', 'report.txt'), 'line1\nNEEDLE here\n');
    filesystem = new CompositeFilesystem({
      mounts: {
        '/incoming': new LocalFilesystem({ basePath: path.join(base, 'incoming'), readOnly: true }),
        '/working': new LocalFilesystem({ basePath: path.join(base, 'working') }),
      },
    });
    workspace = new Workspace({ filesystem });
  });

  afterEach(async () => {
    await fs.rm(base, { recursive: true, force: true });
  });

  it('loadGitignore treats the unmounted root .gitignore as absent', async () => {
    await expect(loadGitignore(filesystem)).resolves.toBeUndefined();
  });

  it.each([{ pattern: 'NEEDLE' }, { pattern: 'NEEDLE', path: '/incoming' }])('grep %j succeeds', async input => {
    const tools = await createWorkspaceTools(workspace);
    const out = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(input, { workspace });
    expect(String(out)).toContain('NEEDLE');
  });

  it.each([{}, { path: '/incoming' }])('list_files %j succeeds', async input => {
    const tools = await createWorkspaceTools(workspace);
    const out = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute(input, { workspace });
    expect(String(out)).toContain(Object.keys(input).length ? 'report.txt' : 'incoming');
  });
});
