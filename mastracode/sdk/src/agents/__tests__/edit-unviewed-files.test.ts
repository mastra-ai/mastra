import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFilesystem, LocalSandbox, Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMastraCodeWorkspaceTools } from '../tool-availability';

describe('Mastra Code edit tools after the file was read some other way', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mc-edit-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function setup() {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: dir }),
      sandbox: new LocalSandbox({ workingDirectory: dir }),
      tools: createMastraCodeWorkspaceTools(),
    });
    const tools: Record<string, any> = await createWorkspaceTools(workspace);
    return { workspace, tools };
  }

  it('edits and overwrites a file that was never viewed', async () => {
    await writeFile(join(dir, 'a.txt'), 'hello world\n');
    const { workspace, tools } = await setup();

    await tools['string_replace_lsp'].execute({ path: 'a.txt', old_string: 'hello', new_string: 'bye' }, { workspace });
    expect(await readFile(join(dir, 'a.txt'), 'utf-8')).toBe('bye world\n');

    await tools['write_file'].execute({ path: 'a.txt', content: 'x\n' }, { workspace });
    expect(await readFile(join(dir, 'a.txt'), 'utf-8')).toBe('x\n');
  });

  for (const [name, call, expected] of [
    ['string_replace_lsp', { path: 'a.txt', old_string: 'hello', new_string: 'bye' }, 'bye shell\n'],
    ['write_file', { path: 'a.txt', content: 'x\n' }, 'x\n'],
  ] as const) {
    it(`${name} works on a file that changed outside the tools after it was viewed`, async () => {
      await writeFile(join(dir, 'a.txt'), 'hello world\n');
      const { workspace, tools } = await setup();
      await tools['view'].execute({ path: 'a.txt' }, { workspace });

      // What `sed -i`, git or a formatter does between the view and the edit.
      await writeFile(join(dir, 'a.txt'), 'hello shell\n');
      const later = new Date(Date.now() + 5000);
      await utimes(join(dir, 'a.txt'), later, later);

      await tools[name].execute(call, { workspace });
      expect(await readFile(join(dir, 'a.txt'), 'utf-8')).toBe(expected);
    });
  }
});
