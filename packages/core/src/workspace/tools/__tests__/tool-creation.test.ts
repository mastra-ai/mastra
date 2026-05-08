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

  it('should create filesystem tools when filesystem is available', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
  });

  it('should not create filesystem tools when no filesystem', async () => {
    const workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
  });

  it('should create search tools when BM25 is enabled', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    const tools = await createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
  });

  it('should not create search tools when search not configured', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
  });

  it('should create sandbox tools when sandbox is available', async () => {
    const workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });

  it('should not create sandbox tools when no sandbox', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });

  it('should create all tools when all capabilities available', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      bm25: true,
    });
    const tools = await createWorkspaceTools(workspace);

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

  it('should not inject path context into execute_command tool description', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      sandbox: new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);
    const executeTool = tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND];

    // The tool description should be the base description, not augmented with path context
    expect(executeTool.description).not.toContain('Local filesystem');
    expect(executeTool.description).not.toContain('Local command execution');
  });

  it('should have all expected tool names with proper namespacing', async () => {
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

  describe('tool name remapping', () => {
    it('should use custom name as dictionary key when name is provided', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          mastra_workspace_read_file: { name: 'view' },
          mastra_workspace_grep: { name: 'search_content' },
        },
      });
      const tools = await createWorkspaceTools(workspace);

      expect(tools).toHaveProperty('view');
      expect(tools).toHaveProperty('search_content');
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
    });

    it('should keep default names for non-remapped tools', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          mastra_workspace_read_file: { name: 'view' },
        },
      });
      const tools = await createWorkspaceTools(workspace);

      expect(tools).toHaveProperty('view');
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.GREP);
    });

    it('should preserve config options when name is remapped', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          mastra_workspace_read_file: { name: 'view', requireApproval: true },
        },
      });
      const tools = await createWorkspaceTools(workspace);

      expect(tools).toHaveProperty('view');
      expect(tools['view'].requireApproval).toBe(true);
    });

    it('should update tool id to match remapped name', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          mastra_workspace_read_file: { name: 'view' },
          mastra_workspace_edit_file: { name: 'string_replace_lsp' },
        },
      });
      const tools = await createWorkspaceTools(workspace);

      // The tool id should be updated to match the exposed name so that
      // fallback-by-id resolution doesn't allow calling by the old name
      expect((tools['view'] as any).id).toBe('view');
      expect((tools['string_replace_lsp'] as any).id).toBe('string_replace_lsp');

      // Non-remapped tools should keep their default id
      expect((tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE] as any).id).toBe(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    });

    it('should remap sandbox tools', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        tools: {
          mastra_workspace_execute_command: { name: 'execute_command' },
        },
      });
      const tools = await createWorkspaceTools(workspace);

      expect(tools).toHaveProperty('execute_command');
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
    });

    it('should throw on duplicate custom names', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          mastra_workspace_read_file: { name: 'my_tool' },
          mastra_workspace_grep: { name: 'my_tool' },
        },
      });

      await expect(createWorkspaceTools(workspace)).rejects.toThrow(/Duplicate workspace tool name "my_tool"/);
    });

    it('should throw when custom name conflicts with a default name', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          // Remap read_file to the default name of grep — conflict
          mastra_workspace_read_file: { name: WORKSPACE_TOOLS.FILESYSTEM.GREP },
        },
      });

      await expect(createWorkspaceTools(workspace)).rejects.toThrow(/Duplicate workspace tool name/);
    });
  });

  describe('background process tools', () => {
    it('should register process tools when sandbox has processes (LocalSandbox)', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });
      const tools = await createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS);
    });

    it('should not register process tools when sandbox has no processes', async () => {
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
      const tools = await createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS);
    });

    it('should include background param in execute_command schema when processes available', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });
      const tools = await createWorkspaceTools(workspace);
      const execTool = tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND];

      const shape = execTool.inputSchema.shape;
      expect(shape).toHaveProperty('background');
    });

    it('should not include background param in execute_command schema when no processes', async () => {
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
      const tools = await createWorkspaceTools(workspace);
      const execTool = tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND];

      const shape = execTool.inputSchema.shape;
      expect(shape).not.toHaveProperty('background');
    });
  });

  describe('dynamic tool config functions', () => {
    it('should disable tool when enabled is a function that returns false', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
            enabled: () => false,
          },
        },
      });
      const configContext = { requestContext: {}, workspace };
      const tools = await createWorkspaceTools(workspace, configContext);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    });

    it('should enable tool when enabled is an async function that returns true', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
            enabled: async () => true,
          },
        },
      });
      const configContext = { requestContext: {}, workspace };
      const tools = await createWorkspaceTools(workspace, configContext);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    });

    it('should disable tool when enabled function throws (fail-closed)', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
            enabled: () => {
              throw new Error('config error');
            },
          },
        },
      });
      const configContext = { requestContext: {}, workspace };
      const tools = await createWorkspaceTools(workspace, configContext);

      // Fail-closed: exclude the tool when its enabled function throws
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    });

    it('should set needsApprovalFn when requireApproval is a function', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
            requireApproval: async ({ args }) => {
              return (args.path as string).startsWith('/protected');
            },
          },
        },
      });
      const tools = await createWorkspaceTools(workspace);
      const writeTool = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

      // Static flag is true so the pipeline knows to check the function
      expect(writeTool.requireApproval).toBe(true);
      // The dynamic function is stored for execution-time evaluation
      expect(typeof writeTool.needsApprovalFn).toBe('function');

      // Evaluate with protected path
      expect(await writeTool.needsApprovalFn({ path: '/protected/secret.txt' })).toBe(true);
      // Evaluate with non-protected path
      expect(await writeTool.needsApprovalFn({ path: '/public/readme.txt' })).toBe(false);
    });

    it('should normalize Map-like requestContext to a plain object for dynamic enabled', async () => {
      let receivedContext: Record<string, unknown> | undefined;
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
            enabled: (ctx: { requestContext: Record<string, unknown> }) => {
              receivedContext = ctx.requestContext;
              return ctx.requestContext['role'] === 'admin';
            },
          },
        },
      });

      // Simulate a Map-like RequestContext (has .entries()) to verify
      // that createWorkspaceTools normalizes it to a plain object.
      const mapLike = new Map<string, unknown>([['role', 'admin']]);
      const configContext = {
        requestContext: mapLike as unknown as Record<string, unknown>,
        workspace,
      };
      const tools = await createWorkspaceTools(workspace, configContext);

      // The tool should be enabled because role === 'admin'
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
      // The dynamic function should have received a plain object, not the Map
      expect(receivedContext).toEqual({ role: 'admin' });
      expect(receivedContext instanceof Map).toBe(false);
    });

    it('should keep static boolean requireApproval without needsApprovalFn', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
            requireApproval: true,
          },
        },
      });
      const tools = await createWorkspaceTools(workspace);
      const writeTool = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

      expect(writeTool.requireApproval).toBe(true);
      expect(writeTool.needsApprovalFn).toBeUndefined();
    });
  });
});
