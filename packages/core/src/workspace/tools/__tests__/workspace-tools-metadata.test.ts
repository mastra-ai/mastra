import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { ToolExecutionContext } from '../../../tools/types';
import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { LocalSandbox } from '../../sandbox';
import { Workspace } from '../../workspace';
import { deleteFileTool } from '../delete-file';
import { editFileTool } from '../edit-file';
import { executeCommandTool } from '../execute-command';
import { fileStatTool } from '../file-stat';
import { indexContentTool } from '../index-content';
import { listFilesTool } from '../list-files';
import { mkdirTool } from '../mkdir';
import { readFileTool } from '../read-file';
import { searchTool } from '../search';
import { writeFileTool } from '../write-file';

describe('all workspace tools emit data-workspace-metadata', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-metadata-test-'));
    // Seed a test file for tools that need an existing file
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello world');
    await fs.mkdir(path.join(tempDir, 'subdir'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function createContext(workspace: Workspace) {
    const writerCustom = vi.fn();
    const context: ToolExecutionContext = {
      workspace,
      writer: { custom: writerCustom } as any,
    };
    return { context, writerCustom };
  }

  function expectMetadataEmitted(writerCustom: ReturnType<typeof vi.fn>, expectedToolName: string) {
    const metadataCall = writerCustom.mock.calls.find(call => call[0]?.type === 'data-workspace-metadata');
    expect(metadataCall).toBeDefined();
    expect(metadataCall![0].data.toolName).toBe(expectedToolName);
  }

  // -- Filesystem tools --

  it('read_file emits metadata', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const { context, writerCustom } = createContext(workspace);

    await readFileTool.execute!({ path: '/test.txt' }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
  });

  it('write_file emits metadata', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const { context, writerCustom } = createContext(workspace);

    await writeFileTool.execute!({ path: '/new.txt', content: 'data', overwrite: true }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
  });

  it('edit_file emits metadata', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const { context, writerCustom } = createContext(workspace);

    await editFileTool.execute!(
      { path: '/test.txt', old_string: 'hello', new_string: 'hi', replace_all: false },
      context,
    );

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
  });

  it('list_files emits metadata', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const { context, writerCustom } = createContext(workspace);

    await listFilesTool.execute!({ path: '/', maxDepth: 1, showHidden: false, dirsOnly: false }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
  });

  it('delete emits metadata', async () => {
    // Create a throwaway file to delete
    await fs.writeFile(path.join(tempDir, 'deleteme.txt'), 'bye');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const { context, writerCustom } = createContext(workspace);

    await deleteFileTool.execute!({ path: '/deleteme.txt', recursive: false }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.FILESYSTEM.DELETE);
  });

  it('file_stat emits metadata', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const { context, writerCustom } = createContext(workspace);

    await fileStatTool.execute!({ path: '/test.txt' }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
  });

  it('mkdir emits metadata', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const { context, writerCustom } = createContext(workspace);

    await mkdirTool.execute!({ path: '/newdir', recursive: true }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
  });

  // -- Search tools --

  it('search emits metadata', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    await workspace.index('/test.txt', 'hello world');
    const { context, writerCustom } = createContext(workspace);

    await searchTool.execute!({ query: 'hello', topK: 5 }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.SEARCH.SEARCH);
  });

  it('index emits metadata', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    const { context, writerCustom } = createContext(workspace);

    await indexContentTool.execute!({ path: '/doc.txt', content: 'some content' }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.SEARCH.INDEX);
  });

  // -- Sandbox tools --

  it('execute_command emits metadata', async () => {
    const workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: tempDir, env: process.env }),
    });
    await workspace.init();
    const { context, writerCustom } = createContext(workspace);

    await executeCommandTool.execute!({ command: 'echo', args: ['hi'], timeout: null, cwd: null }, context);

    expectMetadataEmitted(writerCustom, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
    await workspace.destroy();
  });
});
