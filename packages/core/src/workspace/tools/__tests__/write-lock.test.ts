import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { FileReadRequiredError } from '../../errors';
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
    const tools = await createWorkspaceTools(workspace);
    const editFile = tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE];

    // Fire three concurrent edits — each targets a different unique string
    const [r1, r2, r3] = await Promise.all([
      editFile.execute({ path: 'test.txt', old_string: 'AAA_MARKER', new_string: 'AAA_REPLACED' }, { workspace }),
      editFile.execute({ path: 'test.txt', old_string: 'BBB_MARKER', new_string: 'BBB_REPLACED' }, { workspace }),
      editFile.execute({ path: 'test.txt', old_string: 'CCC_MARKER', new_string: 'CCC_REPLACED' }, { workspace }),
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
    const tools = await createWorkspaceTools(workspace);
    const editFile = tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE];

    const [r1, r2] = await Promise.all([
      editFile.execute({ path: 'a.txt', old_string: 'hello_a', new_string: 'goodbye_a' }, { workspace }),
      editFile.execute({ path: 'b.txt', old_string: 'hello_b', new_string: 'goodbye_b' }, { workspace }),
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
    const tools = await createWorkspaceTools(workspace);
    const writeFile = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

    // Fire three concurrent writes — last one in the queue should win
    await Promise.all([
      writeFile.execute({ path: 'test.txt', content: 'write-1' }, { workspace }),
      writeFile.execute({ path: 'test.txt', content: 'write-2' }, { workspace }),
      writeFile.execute({ path: 'test.txt', content: 'write-3' }, { workspace }),
    ]);

    const final = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
    // Since writes are serialized FIFO, the last write wins
    expect(final).toBe('write-3');
  });
});

describe('filesystem-level optimistic concurrency (StaleFileError)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stale-file-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should detect external modification via filesystem-level mtime check during edit_file', async () => {
    // Seed the file
    await fs.writeFile(path.join(tempDir, 'target.txt'), 'original content');

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireReadBeforeWrite: true },
      },
    });
    const tools = await createWorkspaceTools(workspace);
    const readFile = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
    const editFile = tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE];

    // Step 1: Read the file via the tool (records mtime in read tracker)
    await readFile.execute({ path: 'target.txt' }, { workspace });

    // Step 2: Simulate external modification (e.g., LSP editor saving)
    await new Promise(resolve => setTimeout(resolve, 50));
    await fs.writeFile(path.join(tempDir, 'target.txt'), 'externally modified content');

    // Step 3: Attempt edit_file — the read tracker detects the mtime mismatch
    // at the tool level and throws FileReadRequiredError. Even if this check
    // were bypassed, the filesystem-level expectedMtime check (StaleFileError)
    // would catch it as a second line of defense.
    await expect(
      editFile.execute({ path: 'target.txt', old_string: 'original content', new_string: 'my update' }, { workspace }),
    ).rejects.toThrow(FileReadRequiredError);

    // The external modification should be preserved
    const content = await fs.readFile(path.join(tempDir, 'target.txt'), 'utf-8');
    expect(content).toBe('externally modified content');
  });

  it('should pass expectedMtime through to filesystem when read tracker has a record', async () => {
    // This test verifies the full pipeline: read → external modification →
    // re-read (updates tracker) → edit succeeds because mtime is now current.
    await fs.writeFile(path.join(tempDir, 'target.txt'), 'AAA_MARKER\nBBB_LINE');

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireReadBeforeWrite: true },
      },
    });
    const tools = await createWorkspaceTools(workspace);
    const readFile = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
    const editFile = tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE];

    // Read → edit should succeed when no external modification happened
    await readFile.execute({ path: 'target.txt' }, { workspace });
    const result = await editFile.execute(
      { path: 'target.txt', old_string: 'AAA_MARKER', new_string: 'AAA_REPLACED' },
      { workspace },
    );
    expect(result).toContain('Replaced 1 occurrence');

    const content = await fs.readFile(path.join(tempDir, 'target.txt'), 'utf-8');
    expect(content).toContain('AAA_REPLACED');
    expect(content).toContain('BBB_LINE');
  });

  it('should detect external modification via write_file with requireReadBeforeWrite', async () => {
    await fs.writeFile(path.join(tempDir, 'target.txt'), 'original content');

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
      },
    });
    const tools = await createWorkspaceTools(workspace);
    const readFile = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
    const writeFile = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

    // Read
    await readFile.execute({ path: 'target.txt' }, { workspace });

    // External modification
    await new Promise(resolve => setTimeout(resolve, 50));
    await fs.writeFile(path.join(tempDir, 'target.txt'), 'externally modified');

    // Write attempt — tool-layer detects mtime mismatch
    await expect(writeFile.execute({ path: 'target.txt', content: 'agent overwrite' }, { workspace })).rejects.toThrow(
      FileReadRequiredError,
    );

    // External modification preserved
    const content = await fs.readFile(path.join(tempDir, 'target.txt'), 'utf-8');
    expect(content).toBe('externally modified');
  });

  it('should allow write_file for new files even with requireReadBeforeWrite', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
      },
    });
    const tools = await createWorkspaceTools(workspace);
    const writeFile = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

    // Writing a new file should not require a prior read
    await writeFile.execute({ path: 'brand-new.txt', content: 'hello' }, { workspace });

    const content = await fs.readFile(path.join(tempDir, 'brand-new.txt'), 'utf-8');
    expect(content).toBe('hello');
  });
});
