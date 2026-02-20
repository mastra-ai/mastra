import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { LocalSandbox } from '../../sandbox';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('createWorkspaceTools', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should create filesystem tools when filesystem is available', () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
  });

  it('should not create filesystem tools when no filesystem', () => {
    const workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
  });

  it('should create search tools when BM25 is enabled', () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    const tools = createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
  });

  it('should not create search tools when search not configured', () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
  });

  it('should create sandbox tools when sandbox is available', () => {
    const workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });

  it('should not create sandbox tools when no sandbox', () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });

  it('should create all tools when all capabilities available', () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      bm25: true,
    });
    const tools = createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });

  it('should have all expected tool names with proper namespacing', () => {
    expect(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE).toBe('mastra_workspace_read_file');
    expect(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE).toBe('mastra_workspace_write_file');
    expect(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE).toBe('mastra_workspace_edit_file');
    expect(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES).toBe('mastra_workspace_list_files');
    expect(WORKSPACE_TOOLS.FILESYSTEM.DELETE).toBe('mastra_workspace_delete');
    expect(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT).toBe('mastra_workspace_file_stat');
    expect(WORKSPACE_TOOLS.FILESYSTEM.MKDIR).toBe('mastra_workspace_mkdir');
    expect(WORKSPACE_TOOLS.FILESYSTEM.GREP).toBe('mastra_workspace_grep');
    expect(WORKSPACE_TOOLS.SEARCH.SEARCH).toBe('mastra_workspace_search');
    expect(WORKSPACE_TOOLS.SEARCH.INDEX).toBe('mastra_workspace_index');
    expect(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND).toBe('mastra_workspace_execute_command');
    expect(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT).toBe('mastra_workspace_get_process_output');
    expect(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS).toBe('mastra_workspace_kill_process');
  });

  describe('background process tools', () => {
    it('should register process tools when sandbox has processes (LocalSandbox)', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS);
    });

    it('should not register process tools when sandbox has no processes', () => {
      // Minimal sandbox without processes
      const sandbox = {
        id: 'test',
        name: 'test',
        provider: 'test',
        status: 'running' as const,
        executeCommand: async () => ({
          success: true,
          exitCode: 0,
          stdout: '',
          stderr: '',
          executionTimeMs: 0,
        }),
      };
      const workspace = new Workspace({ sandbox });
      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS);
    });

    it('should include background param in execute_command schema when processes available', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);
      const execTool = tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND];

      const shape = execTool.inputSchema.shape;
      expect(shape).toHaveProperty('background');
    });

    it('should not include background param in execute_command schema when no processes', () => {
      const sandbox = {
        id: 'test',
        name: 'test',
        provider: 'test',
        status: 'running' as const,
        executeCommand: async () => ({
          success: true,
          exitCode: 0,
          stdout: '',
          stderr: '',
          executionTimeMs: 0,
        }),
      };
      const workspace = new Workspace({ sandbox });
      const tools = createWorkspaceTools(workspace);
      const execTool = tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND];

      const shape = execTool.inputSchema.shape;
      expect(shape).not.toHaveProperty('background');
    });
  });
});
