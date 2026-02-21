import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('write-lock integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-lock-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should serialize concurrent edit_file calls on the same file', async () => {
    // Seed file with three unique markers
    const initial = 'AAA_MARKER\nBBB_MARKER\nCCC_MARKER\n';
    await fs.writeFile(path.join(tempDir, 'test.txt'), initial);

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);
    const editFile = tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE];

    // Fire three concurrent edits — each targets a different unique string
    const [r1, r2, r3] = await Promise.all([
      editFile.execute({ path: '/test.txt', old_string: 'AAA_MARKER', new_string: 'AAA_REPLACED' }),
      editFile.execute({ path: '/test.txt', old_string: 'BBB_MARKER', new_string: 'BBB_REPLACED' }),
      editFile.execute({ path: '/test.txt', old_string: 'CCC_MARKER', new_string: 'CCC_REPLACED' }),
    ]);

    // All three should report success
    expect(r1).toContain('Replaced 1 occurrence');
    expect(r2).toContain('Replaced 1 occurrence');
    expect(r3).toContain('Replaced 1 occurrence');

    // The final file should contain ALL three replacements
    const final = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
    expect(final).toContain('AAA_REPLACED');
    expect(final).toContain('BBB_REPLACED');
    expect(final).toContain('CCC_REPLACED');
    expect(final).not.toContain('AAA_MARKER');
    expect(final).not.toContain('BBB_MARKER');
    expect(final).not.toContain('CCC_MARKER');
  });

  it('should allow concurrent edits to different files in parallel', async () => {
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'hello_a');
    await fs.writeFile(path.join(tempDir, 'b.txt'), 'hello_b');

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);
    const editFile = tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE];

    const [r1, r2] = await Promise.all([
      editFile.execute({ path: '/a.txt', old_string: 'hello_a', new_string: 'goodbye_a' }),
      editFile.execute({ path: '/b.txt', old_string: 'hello_b', new_string: 'goodbye_b' }),
    ]);

    expect(r1).toContain('Replaced 1 occurrence');
    expect(r2).toContain('Replaced 1 occurrence');

    const contentA = await fs.readFile(path.join(tempDir, 'a.txt'), 'utf-8');
    const contentB = await fs.readFile(path.join(tempDir, 'b.txt'), 'utf-8');
    expect(contentA).toBe('goodbye_a');
    expect(contentB).toBe('goodbye_b');
  });

  it('should serialize concurrent write_file calls on the same file', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);
    const writeFile = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

    // Fire three concurrent writes — last one in the queue should win
    await Promise.all([
      writeFile.execute({ path: '/test.txt', content: 'write-1' }),
      writeFile.execute({ path: '/test.txt', content: 'write-2' }),
      writeFile.execute({ path: '/test.txt', content: 'write-3' }),
    ]);

    const final = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
    // Since writes are serialized FIFO, the last write wins
    expect(final).toBe('write-3');
  });
});
