import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { PermissionError } from '../../errors';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';
import type { WorkspaceToolsConfig } from '../types';

const APPLY_PATCH = WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH;

describe('workspace_apply_patch', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-apply-patch-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  const read = (p: string) => fs.readFile(path.join(tempDir, p), 'utf-8');
  const exists = (p: string) =>
    fs.access(path.join(tempDir, p)).then(
      () => true,
      () => false,
    );

  async function setup(tools?: WorkspaceToolsConfig) {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: tools ?? { [APPLY_PATCH]: { enabled: true } },
    });
    const allTools = await createWorkspaceTools(workspace);
    const apply = (patch: string) => allTools[APPLY_PATCH].execute({ patch }, { workspace });
    return { workspace, tools: allTools, apply };
  }

  describe('opt-in', () => {
    it('is absent by default', async () => {
      const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
      const tools = await createWorkspaceTools(workspace);
      expect(tools[APPLY_PATCH]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]).toBeDefined();
    });

    it('is not enabled by top-level tools.enabled', async () => {
      const { tools } = await setup({ enabled: true });
      expect(tools[APPLY_PATCH]).toBeUndefined();
    });

    it('is registered alongside the other tools when opted in', async () => {
      const { tools } = await setup();
      expect(tools[APPLY_PATCH]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]).toBeDefined();
    });

    it('is registered when the per-tool enabled is a function returning true', async () => {
      const { tools } = await setup({ [APPLY_PATCH]: { enabled: () => true } });
      expect(tools[APPLY_PATCH]).toBeDefined();
    });

    it('is absent on a read-only filesystem even when opted in', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir, readOnly: true }),
        tools: { [APPLY_PATCH]: { enabled: true } },
      });
      const tools = await createWorkspaceTools(workspace);
      expect(tools[APPLY_PATCH]).toBeUndefined();
    });
  });

  describe('operations', () => {
    it('adds a file, creating parent directories', async () => {
      const { apply } = await setup();
      const result = await apply(`*** Begin Patch
*** Add File: src/new.ts
+export const a = 1;
+export const b = 2;
*** End Patch`);

      expect(result).toContain('A src/new.ts');
      expect(await read('src/new.ts')).toBe('export const a = 1;\nexport const b = 2;\n');
    });

    it('updates a file using context lines', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'function f() {\n  return 1;\n}\n');
      const { apply } = await setup();
      const result = await apply(`*** Begin Patch
*** Update File: a.ts
@@ function f() {
-  return 1;
+  return 2;
 }
*** End Patch`);

      expect(result).toContain('M a.ts');
      expect(await read('a.ts')).toBe('function f() {\n  return 2;\n}\n');
    });

    it('moves a file while updating it', async () => {
      await fs.writeFile(path.join(tempDir, 'old.ts'), 'const name = "old";\n');
      const { apply } = await setup();
      const result = await apply(`*** Begin Patch
*** Update File: old.ts
*** Move to: lib/renamed.ts
@@
-const name = "old";
+const name = "new";
*** End Patch`);

      expect(result).toContain('R old.ts -> lib/renamed.ts');
      expect(await exists('old.ts')).toBe(false);
      expect(await read('lib/renamed.ts')).toBe('const name = "new";\n');
    });

    it('moves a file without changing its content', async () => {
      await fs.writeFile(path.join(tempDir, 'old.ts'), 'keep me\n');
      const { apply } = await setup();
      await apply(`*** Begin Patch
*** Update File: old.ts
*** Move to: new.ts
*** End Patch`);

      expect(await exists('old.ts')).toBe(false);
      expect(await read('new.ts')).toBe('keep me\n');
    });

    it('deletes a file', async () => {
      await fs.writeFile(path.join(tempDir, 'gone.ts'), 'bye\n');
      const { apply } = await setup();
      const result = await apply(`*** Begin Patch
*** Delete File: gone.ts
*** End Patch`);

      expect(result).toContain('D gone.ts');
      expect(await exists('gone.ts')).toBe(false);
    });

    it('applies add, update, move and delete together', async () => {
      await fs.writeFile(path.join(tempDir, 'keep.ts'), 'a\nb\nc\n');
      await fs.writeFile(path.join(tempDir, 'move.ts'), 'm\n');
      await fs.writeFile(path.join(tempDir, 'remove.ts'), 'r\n');
      const { apply } = await setup();
      await apply(`*** Begin Patch
*** Add File: added.ts
+new
*** Update File: keep.ts
@@
 a
-b
+B
 c
*** Update File: move.ts
*** Move to: moved.ts
*** Delete File: remove.ts
*** End Patch`);

      expect(await read('added.ts')).toBe('new\n');
      expect(await read('keep.ts')).toBe('a\nB\nc\n');
      expect(await read('moved.ts')).toBe('m\n');
      expect(await exists('move.ts')).toBe(false);
      expect(await exists('remove.ts')).toBe(false);
    });

    it('preserves CRLF line endings and a missing final newline', async () => {
      await fs.writeFile(path.join(tempDir, 'win.txt'), 'one\r\ntwo\r\nthree');
      const { apply } = await setup();
      await apply(`*** Begin Patch
*** Update File: win.txt
@@
 one
-two
+TWO
 three
*** End Patch`);

      expect(await read('win.txt')).toBe('one\r\nTWO\r\nthree');
    });
  });

  describe('all-or-nothing', () => {
    it('applies nothing when one hunk in a multi-file patch does not match', async () => {
      await fs.writeFile(path.join(tempDir, 'good.ts'), 'x = 1\n');
      await fs.writeFile(path.join(tempDir, 'bad.ts'), 'y = 1\n');
      await fs.writeFile(path.join(tempDir, 'doomed.ts'), 'z\n');
      const { apply } = await setup();

      const result = await apply(`*** Begin Patch
*** Add File: created.ts
+hello
*** Update File: good.ts
@@
-x = 1
+x = 2
*** Delete File: doomed.ts
*** Update File: bad.ts
@@
-this line is not in the file
+y = 2
*** End Patch`);

      expect(result).toContain('Patch not applied, no files were changed');
      expect(result).toContain('bad.ts');
      expect(await exists('created.ts')).toBe(false);
      expect(await read('good.ts')).toBe('x = 1\n');
      expect(await read('bad.ts')).toBe('y = 1\n');
      expect(await read('doomed.ts')).toBe('z\n');
    });

    it('applies nothing when an added file already exists', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'a\n');
      await fs.writeFile(path.join(tempDir, 'exists.ts'), 'original\n');
      const { apply } = await setup();

      const result = await apply(`*** Begin Patch
*** Update File: a.ts
@@
-a
+A
*** Add File: exists.ts
+clobbered
*** End Patch`);

      expect(result).toContain('exists.ts already exists');
      expect(await read('a.ts')).toBe('a\n');
      expect(await read('exists.ts')).toBe('original\n');
    });

    it('applies nothing when a deleted file is missing', async () => {
      const { apply } = await setup();
      const result = await apply(`*** Begin Patch
*** Add File: new.ts
+x
*** Delete File: missing.ts
*** End Patch`);

      expect(result).toContain('missing.ts does not exist');
      expect(await exists('new.ts')).toBe(false);
    });

    it('rolls back completed writes when a later write fails', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'a\n');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: { [APPLY_PATCH]: { enabled: true } },
      });
      const tools = await createWorkspaceTools(workspace);
      const filesystem = workspace.filesystem!;
      const realWrite = filesystem.writeFile.bind(filesystem);
      filesystem.writeFile = async (p, content, options) => {
        if (p === 'b.ts') throw new Error('disk full');
        return realWrite(p, content, options);
      };

      await expect(
        tools[APPLY_PATCH].execute(
          {
            patch: `*** Begin Patch
*** Update File: a.ts
@@
-a
+A
*** Add File: b.ts
+b
*** End Patch`,
          },
          { workspace },
        ),
      ).rejects.toThrow('disk full');

      expect(await read('a.ts')).toBe('a\n');
      expect(await exists('b.ts')).toBe(false);
    });

    it('rejects a malformed patch without touching files', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'a\n');
      const { apply } = await setup();
      const result = await apply(`*** Update File: a.ts
-a
+A`);

      expect(result).toContain('Patch not applied');
      expect(await read('a.ts')).toBe('a\n');
    });
  });

  describe('path safety', () => {
    it('rejects an added file outside the workspace and writes nothing', async () => {
      const { apply } = await setup();
      await expect(
        apply(`*** Begin Patch
*** Add File: inside.ts
+ok
*** Add File: ../escape.ts
+pwned
*** End Patch`),
      ).rejects.toThrow(PermissionError);

      expect(await exists('inside.ts')).toBe(false);
      expect(
        await fs.access(path.join(tempDir, '..', 'escape.ts')).then(
          () => true,
          () => false,
        ),
      ).toBe(false);
    });

    it('rejects moving a file outside the workspace', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'a\n');
      const { apply } = await setup();
      await expect(
        apply(`*** Begin Patch
*** Update File: a.ts
*** Move to: ../../escaped.ts
*** End Patch`),
      ).rejects.toThrow(PermissionError);

      expect(await read('a.ts')).toBe('a\n');
    });
  });

  describe('read-before-write', () => {
    it('requires every updated or deleted file to have been read first', async () => {
      await fs.writeFile(path.join(tempDir, 'read.ts'), 'r\n');
      await fs.writeFile(path.join(tempDir, 'unread.ts'), 'u\n');
      const { tools, workspace } = await setup({
        [APPLY_PATCH]: { enabled: true, requireReadBeforeWrite: true },
      });
      await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'read.ts' }, { workspace });

      const patch = `*** Begin Patch
*** Update File: read.ts
@@
-r
+R
*** Delete File: unread.ts
*** Add File: brand-new.ts
+n
*** End Patch`;

      await expect(tools[APPLY_PATCH].execute({ patch }, { workspace })).rejects.toThrow(/unread\.ts/);
      expect(await read('read.ts')).toBe('r\n');
      expect(await exists('unread.ts')).toBe(true);

      await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'unread.ts' }, { workspace });
      const result = await tools[APPLY_PATCH].execute({ patch }, { workspace });
      expect(result).toContain('Applied patch');
      expect(await read('read.ts')).toBe('R\n');
      expect(await exists('unread.ts')).toBe(false);
      expect(await read('brand-new.ts')).toBe('n\n');
    });

    it('applies nothing when a file changed after it was read', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'a\n');
      await fs.writeFile(path.join(tempDir, 'b.ts'), 'b\n');
      const { tools, workspace } = await setup();
      await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'b.ts' }, { workspace });
      await new Promise(r => setTimeout(r, 20));
      await fs.writeFile(path.join(tempDir, 'b.ts'), 'b changed\n');

      await expect(
        tools[APPLY_PATCH].execute(
          {
            patch: `*** Begin Patch
*** Update File: a.ts
@@
-a
+A
*** Update File: b.ts
@@
-b changed
+B
*** End Patch`,
          },
          { workspace },
        ),
      ).rejects.toThrow(/modified externally/);

      expect(await read('a.ts')).toBe('a\n');
      expect(await read('b.ts')).toBe('b changed\n');
    });
  });

  describe('write lock', () => {
    it('serialises overlapping patches without deadlocking', async () => {
      await fs.writeFile(path.join(tempDir, 'x.ts'), '0\n');
      await fs.writeFile(path.join(tempDir, 'y.ts'), '0\n');
      const { apply } = await setup();
      const bump = (first: string, second: string) =>
        apply(`*** Begin Patch
*** Update File: ${first}
@@
-0
+${first}
*** Update File: ${second}
@@
-0
+${first}
*** End Patch`);

      const results = await Promise.all([bump('x.ts', 'y.ts'), bump('y.ts', 'x.ts')]);

      // One wins; the other sees the first one's content and fails to match, applying nothing.
      expect(results.filter(r => r.startsWith('Applied patch'))).toHaveLength(1);
      expect(results.filter(r => r.startsWith('Patch not applied'))).toHaveLength(1);
      expect(await read('x.ts')).toBe(await read('y.ts'));
    });
  });
});
