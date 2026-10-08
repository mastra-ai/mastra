import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import * as astEdit from '../ast-edit';
import * as grep from '../grep';
import { searchInputSchema } from '../search';
import { createWorkspaceTools } from '../tools';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lazy-workspace-tools-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

describe('lazy workspace tool construction', () => {
  it('skips the entire preparation path when every tool is statically disabled', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      tools: {
        enabled: false,
        [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: false },
      },
    });
    const filesystem = vi.spyOn(workspace, 'filesystem', 'get');

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(filesystem).not.toHaveBeenCalled();
  });

  it('evaluates a disabled per-tool callback even when the global default is disabled', async () => {
    const enabled = vi.fn(() => false);
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      tools: { enabled: false, [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled } },
    });

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(enabled).toHaveBeenCalledTimes(1);
    expect(createGrep).not.toHaveBeenCalled();
  });

  it('preserves a statically enabled tool with a disabled global default', async () => {
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      tools: { enabled: false, [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: true } },
    });

    expect(await createWorkspaceTools(workspace)).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
    expect(createGrep).toHaveBeenCalledTimes(1);
  });

  it('does not construct grep or search or probe AST support when all tools are disabled', async () => {
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const extendSearch = vi.spyOn(searchInputSchema, 'extend');
    const probeAst = vi.spyOn(astEdit, 'isAstGrepAvailable');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      bm25: true,
      tools: { enabled: false },
    });

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(createGrep).not.toHaveBeenCalled();
    expect(extendSearch).not.toHaveBeenCalled();
    expect(probeAst).not.toHaveBeenCalled();
  });

  it.each([false, () => false])('skips individually disabled tools while retaining other tools', async enabled => {
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const extendSearch = vi.spyOn(searchInputSchema, 'extend');
    const probeAst = vi.spyOn(astEdit, 'isAstGrepAvailable');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      bm25: true,
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled },
        [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled },
        [WORKSPACE_TOOLS.SEARCH.SEARCH]: { enabled },
      },
    });

    const tools = await createWorkspaceTools(workspace);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(createGrep).not.toHaveBeenCalled();
    expect(extendSearch).not.toHaveBeenCalled();
    expect(probeAst).not.toHaveBeenCalled();
  });

  it('preserves enabled overrides, resolves callbacks once, and forwards construction options', async () => {
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const extendSearch = vi.spyOn(searchInputSchema, 'extend');
    const probeAst = vi.spyOn(astEdit, 'isAstGrepAvailable').mockReturnValue(true);
    const enableGrep = vi.fn(() => true);
    const enableAst = vi.fn(() => true);
    const enableSearch = vi.fn(() => true);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      bm25: true,
      tools: {
        enabled: false,
        [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: enableGrep },
        [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled: enableAst },
        [WORKSPACE_TOOLS.SEARCH.SEARCH]: { enabled: enableSearch },
      },
    });

    const tools = await createWorkspaceTools(workspace, undefined, { grep: { strict: true } });
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(createGrep).toHaveBeenCalledExactlyOnceWith({ strict: true });
    expect(extendSearch).toHaveBeenCalledTimes(1);
    expect(probeAst).toHaveBeenCalledTimes(1);
    expect(enableGrep).toHaveBeenCalledTimes(1);
    expect(enableAst).toHaveBeenCalledTimes(1);
    expect(enableSearch).toHaveBeenCalledTimes(1);
  });

  it('evaluates dynamic disabled defaults without constructing tools', async () => {
    const enabled = vi.fn(() => false);
    const createGrep = vi.spyOn(grep, 'createGrepTool');
    const probeAst = vi.spyOn(astEdit, 'isAstGrepAvailable');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      tools: { enabled },
    });

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(enabled).toHaveBeenCalled();
    expect(createGrep).not.toHaveBeenCalled();
    expect(probeAst).not.toHaveBeenCalled();
  });

  it('omits enabled AST editing when the optional dependency is unavailable', async () => {
    const probeAst = vi.spyOn(astEdit, 'isAstGrepAvailable').mockReturnValue(false);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      tools: { enabled: false, [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled: true } },
    });

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(probeAst).toHaveBeenCalledTimes(1);
  });

  it('does not probe AST support when the filesystem is read-only', async () => {
    const probeAst = vi.spyOn(astEdit, 'isAstGrepAvailable').mockReturnValue(true);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory, readOnly: true }),
      tools: { enabled: false, [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled: true } },
    });

    expect(await createWorkspaceTools(workspace)).toEqual({});
    expect(probeAst).not.toHaveBeenCalled();
  });
});
