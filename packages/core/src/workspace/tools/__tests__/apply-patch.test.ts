import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { FileReadRequiredError } from '../../errors';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

function patch(body: string): string {
  return `*** Begin Patch\n${body}*** End Patch\n`;
}

describe('workspace_apply_patch', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-apply-patch-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  async function tools(options?: { requireReadBeforeWrite?: boolean; readOnly?: boolean }) {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir, readOnly: options?.readOnly }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]: {
          enabled: true,
          requireReadBeforeWrite: options?.requireReadBeforeWrite,
        },
      },
    });
    return { workspace, tools: await createWorkspaceTools(workspace) };
  }

  it('is absent by default', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const created = await createWorkspaceTools(workspace);
    expect(created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]).toBeUndefined();
  });

  it('is absent when only top-level tools.enabled is true', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { enabled: true },
    });
    const created = await createWorkspaceTools(workspace);
    expect(created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]).toBeUndefined();
  });

  it('is registered when explicitly enabled', async () => {
    const { tools: created } = await tools();
    expect(created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]).toBeDefined();
  });

  it('is omitted on a static read-only filesystem even when enabled', async () => {
    const { tools: created } = await tools({ readOnly: true });
    expect(created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]).toBeUndefined();
  });

  it('creates multiple files in one call', async () => {
    const { workspace, tools: created } = await tools();
    const result = await created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
      {
        patchText: patch(
          ['*** Add File: a.ts', '+export const a = 1', '*** Add File: b.ts', '+export const b = 2', ''].join('\n'),
        ),
      },
      { workspace },
    );

    expect(result).toContain('A a.ts');
    expect(result).toContain('A b.ts');
    expect(await fs.readFile(path.join(tempDir, 'a.ts'), 'utf-8')).toBe('export const a = 1\n');
    expect(await fs.readFile(path.join(tempDir, 'b.ts'), 'utf-8')).toBe('export const b = 2\n');
  });

  it('updates, creates, and deletes in one call', async () => {
    await fs.writeFile(path.join(tempDir, 'existing.ts'), 'const name = "old"\n');
    await fs.writeFile(path.join(tempDir, 'gone.ts'), 'bye\n');
    const { workspace, tools: created } = await tools();

    const result = await created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
      {
        patchText: patch(
          [
            '*** Add File: created.ts',
            '+hello',
            '*** Update File: existing.ts',
            '@@',
            '-const name = "old"',
            '+const name = "new"',
            '*** Delete File: gone.ts',
            '',
          ].join('\n'),
        ),
      },
      { workspace },
    );

    expect(result).toContain('A created.ts');
    expect(result).toContain('M existing.ts');
    expect(result).toContain('D gone.ts');
    expect(await fs.readFile(path.join(tempDir, 'existing.ts'), 'utf-8')).toBe('const name = "new"\n');
    expect(await fs.readFile(path.join(tempDir, 'created.ts'), 'utf-8')).toBe('hello\n');
    await expect(fs.stat(path.join(tempDir, 'gone.ts'))).rejects.toThrow();
  });

  it('applies nothing when a later hunk does not match', async () => {
    await fs.writeFile(path.join(tempDir, 'keep.ts'), 'keep me\n');
    const { workspace, tools: created } = await tools();

    const result = await created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
      {
        patchText: patch(
          [
            '*** Add File: new.ts',
            '+created',
            '*** Update File: keep.ts',
            '@@',
            '-does not exist',
            '+replacement',
            '',
          ].join('\n'),
        ),
      },
      { workspace },
    );

    expect(result).toContain('does not match');
    await expect(fs.stat(path.join(tempDir, 'new.ts'))).rejects.toThrow();
    expect(await fs.readFile(path.join(tempDir, 'keep.ts'), 'utf-8')).toBe('keep me\n');
  });

  it('returns a parse error for malformed patch text', async () => {
    const { workspace, tools: created } = await tools();
    const result = await created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
      { patchText: 'not a patch' },
      { workspace },
    );
    expect(result).toContain('*** Begin Patch');
  });

  it('moves a file while updating its contents', async () => {
    await fs.writeFile(path.join(tempDir, 'old.ts'), 'value = 1\n');
    const { workspace, tools: created } = await tools();

    const result = await created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
      {
        patchText: patch(
          ['*** Update File: old.ts', '*** Move to: new.ts', '@@', '-value = 1', '+value = 2', ''].join('\n'),
        ),
      },
      { workspace },
    );

    expect(result).toContain('M new.ts');
    expect(await fs.readFile(path.join(tempDir, 'new.ts'), 'utf-8')).toBe('value = 2\n');
    await expect(fs.stat(path.join(tempDir, 'old.ts'))).rejects.toThrow();
  });

  it('enforces requireReadBeforeWrite on existing files', async () => {
    await fs.writeFile(path.join(tempDir, 'existing.ts'), 'const name = "old"\n');
    const { workspace, tools: created } = await tools({ requireReadBeforeWrite: true });

    await expect(
      created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
        {
          patchText: patch(
            ['*** Update File: existing.ts', '@@', '-const name = "old"', '+const name = "new"', ''].join('\n'),
          ),
        },
        { workspace },
      ),
    ).rejects.toThrow(FileReadRequiredError);
  });

  it('allows apply_patch after read_file when requireReadBeforeWrite is set', async () => {
    await fs.writeFile(path.join(tempDir, 'existing.ts'), 'const name = "old"\n');
    const { workspace, tools: created } = await tools({ requireReadBeforeWrite: true });

    await created[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'existing.ts' }, { workspace });
    const result = await created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
      {
        patchText: patch(
          ['*** Update File: existing.ts', '@@', '-const name = "old"', '+const name = "new"', ''].join('\n'),
        ),
      },
      { workspace },
    );

    expect(result).toContain('M existing.ts');
    expect(await fs.readFile(path.join(tempDir, 'existing.ts'), 'utf-8')).toBe('const name = "new"\n');
  });

  it('does not require a prior read for Add File', async () => {
    const { workspace, tools: created } = await tools({ requireReadBeforeWrite: true });
    const result = await created[WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH].execute(
      { patchText: patch(['*** Add File: fresh.ts', '+ok', ''].join('\n')) },
      { workspace },
    );
    expect(result).toContain('A fresh.ts');
  });
});
