import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import * as filesystemModule from '../../filesystem';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import * as astEdit from '../ast-edit';
import * as grep from '../grep';
import * as search from '../search';
import { createWorkspaceTools } from '../tools';

describe('createWorkspaceTools lazy construction', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-lazy-tools-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('does not construct anything when all tools are disabled', async () => {
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const astAvailable = vi.spyOn(astEdit, 'isAstGrepAvailable');
    const extend = vi.spyOn(search.searchInputSchema, 'extend');
    const writeLock = vi.spyOn(filesystemModule, 'InMemoryFileWriteLock');
    const readTracker = vi.spyOn(filesystemModule, 'InMemoryFileReadTracker');

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
      tools: { enabled: false },
    });

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(createGrep).not.toHaveBeenCalled();
    expect(astAvailable).not.toHaveBeenCalled();
    expect(extend).not.toHaveBeenCalled();
    expect(writeLock).not.toHaveBeenCalled();
    expect(readTracker).not.toHaveBeenCalled();
  });

  it('still calls a dynamic top-level enabled function', async () => {
    const enabled = vi.fn(() => false);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { enabled },
    });

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(enabled).toHaveBeenCalled();
  });

  it('does not construct grep when only grep is disabled', async () => {
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: false } },
    });

    const tools = await createWorkspaceTools(workspace);
    expect(createGrep).not.toHaveBeenCalled();
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
  });

  it('constructs only a tool re-enabled by a per-tool override, forwarding grep options', async () => {
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { enabled: false, [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: true } },
    });

    const tools = await createWorkspaceTools(workspace, undefined, { grep: { strict: true } });
    expect(Object.keys(tools)).toEqual([WORKSPACE_TOOLS.FILESYSTEM.GREP]);
    expect(createGrep).toHaveBeenCalledTimes(1);
    expect(createGrep).toHaveBeenCalledWith({ strict: true });
  });

  it('honors a dynamic per-tool enabled function when the top level is disabled', async () => {
    const enabled = vi.fn(({ requestContext }: { requestContext: Record<string, unknown> }) => !!requestContext.allow);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { enabled: false, [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { enabled } },
    });

    const allowed = await createWorkspaceTools(workspace, { workspace, requestContext: { allow: true } });
    expect(Object.keys(allowed)).toEqual([WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]);

    const denied = await createWorkspaceTools(workspace, { workspace, requestContext: {} });
    expect(denied).toEqual({});
    expect(enabled).toHaveBeenCalledTimes(2);
  });

  it('does not probe ast-grep when the filesystem is read-only', async () => {
    const astAvailable = vi.spyOn(astEdit, 'isAstGrepAvailable');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir, readOnly: true }),
    });

    const tools = await createWorkspaceTools(workspace);
    expect(astAvailable).not.toHaveBeenCalled();
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
  });

  it('only registers ast_edit when ast-grep is available', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });

    vi.spyOn(astEdit, 'isAstGrepAvailable').mockReturnValue(false);
    expect(await createWorkspaceTools(workspace)).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);

    vi.spyOn(astEdit, 'isAstGrepAvailable').mockReturnValue(true);
    expect(await createWorkspaceTools(workspace)).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
  });

  it('does not build the search schema when search is disabled', async () => {
    const extend = vi.spyOn(search.searchInputSchema, 'extend');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
      tools: { [WORKSPACE_TOOLS.SEARCH.SEARCH]: { enabled: false } },
    });

    const tools = await createWorkspaceTools(workspace);
    expect(extend).not.toHaveBeenCalled();
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
  });

  it('builds the search schema with only supported modes when enabled', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });

    const tools = await createWorkspaceTools(workspace);
    const schema = tools[WORKSPACE_TOOLS.SEARCH.SEARCH].inputSchema;
    expect(schema.safeParse({ query: 'q', mode: 'bm25' }).success).toBe(true);
    expect(schema.safeParse({ query: 'q', mode: 'hybrid' }).success).toBe(false);
  });

  it('creates one shared write lock and read tracker per call, only when needed', async () => {
    const writeLock = vi.spyOn(filesystemModule, 'InMemoryFileWriteLock');
    const readTracker = vi.spyOn(filesystemModule, 'InMemoryFileReadTracker');

    const readOnly = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { enabled: false },
        [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { enabled: false },
        [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { enabled: false },
        [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled: false },
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { enabled: false },
      },
    });
    await createWorkspaceTools(readOnly);
    expect(writeLock).not.toHaveBeenCalled();
    expect(readTracker).not.toHaveBeenCalled();

    const full = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    await createWorkspaceTools(full);
    expect(writeLock).toHaveBeenCalledTimes(1);
    expect(readTracker).toHaveBeenCalledTimes(1);
  });
});
