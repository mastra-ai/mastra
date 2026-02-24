import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WORKSPACE_TOOLS } from './constants';
import { FileReadRequiredError, WorkspaceReadOnlyError } from './errors';
import { LocalFilesystem } from './filesystem';
import { LocalSandbox } from './sandbox';
import { createWorkspaceTools } from './tools';
import { Workspace } from './workspace';

describe('Workspace Safety Features', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-safety-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('requireReadBeforeWrite (via tools)', () => {
    // Note: requireReadBeforeWrite is now enforced at the tool level, not workspace level.
    // This allows direct workspace.filesystem.writeFile() calls (from users/server) to work without restriction,
    // while agent tool calls still enforce the read-before-write requirement.

    it('should allow direct filesystem.writeFile() without reading first', async () => {
      // Direct filesystem calls are not restricted by requireReadBeforeWrite
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      await workspace.init();

      await workspace.filesystem!.writeFile('/test.txt', 'original');
      await workspace.filesystem!.writeFile('/test.txt', 'modified'); // Should succeed without reading

      const content = await workspace.filesystem!.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('modified');

      await workspace.destroy();
    });

    it('should throw error when write_file tool is used without reading first', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
            requireReadBeforeWrite: true,
          },
        },
      });
      await workspace.init();

      // Create file first (direct call - no restriction)
      await workspace.filesystem!.writeFile('/existing.txt', 'original');

      // Create tools
      const tools = createWorkspaceTools(workspace);
      const writeTool = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

      // Should fail - file exists but wasn't read via read_file tool
      await expect(writeTool.execute({ path: '/existing.txt', content: 'modified' })).rejects.toThrow(
        FileReadRequiredError,
      );
      await expect(writeTool.execute({ path: '/existing.txt', content: 'modified' })).rejects.toThrow(
        'has not been read',
      );

      await workspace.destroy();
    });

    it('should allow write_file after read_file tool is used', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
            requireReadBeforeWrite: true,
          },
        },
      });
      await workspace.init();

      // Create file first
      await workspace.filesystem!.writeFile('/test.txt', 'original');

      // Create tools
      const tools = createWorkspaceTools(workspace);
      const readTool = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
      const writeTool = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

      // Read first via tool
      await readTool.execute({ path: '/test.txt' });

      // Now write should succeed
      await writeTool.execute({ path: '/test.txt', content: 'modified' });

      const content = await workspace.filesystem!.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('modified');

      await workspace.destroy();
    });

    it('should allow writing new files without reading first', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
            requireReadBeforeWrite: true,
          },
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);
      const writeTool = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

      // Should succeed - new file doesn't require reading
      await writeTool.execute({ path: '/new-file.txt', content: 'content' });

      const content = await workspace.filesystem!.readFile('/new-file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');

      await workspace.destroy();
    });

    it('should require re-reading after successful write', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
            requireReadBeforeWrite: true,
          },
        },
      });
      await workspace.init();

      // Create file first
      await workspace.filesystem!.writeFile('/test.txt', 'v1');

      const tools = createWorkspaceTools(workspace);
      const readTool = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
      const writeTool = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

      // Read and write
      await readTool.execute({ path: '/test.txt' });
      await writeTool.execute({ path: '/test.txt', content: 'v2' });

      // Second write without re-reading should fail
      await expect(writeTool.execute({ path: '/test.txt', content: 'v3' })).rejects.toThrow(FileReadRequiredError);

      // Read again and write should succeed
      await readTool.execute({ path: '/test.txt' });
      await writeTool.execute({ path: '/test.txt', content: 'v3' });

      const content = await workspace.filesystem!.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('v3');

      await workspace.destroy();
    });

    it('should not require read-before-write when not configured', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        // No requireReadBeforeWrite in tools config
      });
      await workspace.init();

      // Create file first
      await workspace.filesystem!.writeFile('/test.txt', 'original');

      const tools = createWorkspaceTools(workspace);
      const writeTool = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE];

      // Should succeed without reading first
      await writeTool.execute({ path: '/test.txt', content: 'modified' });

      const content = await workspace.filesystem!.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('modified');

      await workspace.destroy();
    });

    it('should enforce requireReadBeforeWrite on edit_file tool', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
            requireReadBeforeWrite: true,
          },
        },
      });
      await workspace.init();

      // Create file first
      await workspace.filesystem!.writeFile('/test.txt', 'hello world');

      const tools = createWorkspaceTools(workspace);
      const readTool = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
      const editTool = tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE];

      // Should fail - file wasn't read via read_file tool
      await expect(editTool.execute({ path: '/test.txt', old_string: 'hello', new_string: 'goodbye' })).rejects.toThrow(
        FileReadRequiredError,
      );

      // Read first, then edit should succeed
      await readTool.execute({ path: '/test.txt' });
      const result = await editTool.execute({ path: '/test.txt', old_string: 'hello', new_string: 'goodbye' });
      expect(typeof result).toBe('string');
      expect(result).toContain('Replaced 1 occurrence');

      const content = await workspace.filesystem!.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('goodbye world');

      await workspace.destroy();
    });
  });

  describe('readOnly mode', () => {
    it('should throw error when writing in readonly mode', async () => {
      // Create file first
      await fs.writeFile(path.join(tempDir, 'existing.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          readOnly: true,
        }),
      });
      await workspace.init();

      await expect(workspace.filesystem!.writeFile('/test.txt', 'content')).rejects.toThrow(WorkspaceReadOnlyError);
      await expect(workspace.filesystem!.writeFile('/test.txt', 'content')).rejects.toThrow('read-only mode');

      await workspace.destroy();
    });

    it('should allow reading in readonly mode', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          readOnly: true,
        }),
      });
      await workspace.init();

      const content = await workspace.filesystem!.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');

      await workspace.destroy();
    });

    it('should allow exists() in readonly mode', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          readOnly: true,
        }),
      });
      await workspace.init();

      expect(await workspace.filesystem!.exists('/test.txt')).toBe(true);
      expect(await workspace.filesystem!.exists('/nonexistent.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should allow readdir() in readonly mode', async () => {
      await fs.mkdir(path.join(tempDir, 'subdir'));
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          readOnly: true,
        }),
      });
      await workspace.init();

      const entries = await workspace.filesystem!.readdir('/');
      expect(entries.length).toBe(2);

      await workspace.destroy();
    });

    it('should expose readOnly property', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          readOnly: true,
        }),
      });

      expect(workspace.filesystem?.readOnly).toBe(true);

      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      expect(workspace2.filesystem?.readOnly).toBe(undefined);
    });
  });

  describe('createWorkspaceTools with safety config', () => {
    it('should exclude write tools in readonly mode', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          readOnly: true,
        }),
        bm25: true,
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // Read tools should be present
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.SEARCH.SEARCH]).toBeDefined();

      // Write tools should be absent (including index which writes to search index)
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.SEARCH.INDEX]).toBeUndefined();

      await workspace.destroy();
    });

    it('should include write tools when not readonly', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          readOnly: false,
        }),
        bm25: true,
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.SEARCH.INDEX]).toBeDefined();

      await workspace.destroy();
    });

    it('should default to all tools enabled and no approval required', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        bm25: true,
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // All tools should be enabled by default
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.SEARCH.SEARCH]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.SEARCH.INDEX]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]).toBeDefined();

      // No approval required by default
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].requireApproval).toBe(false);
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].requireApproval).toBe(false);
      expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].requireApproval).toBe(false);

      await workspace.destroy();
    });

    it('should apply top-level requireApproval to all tools', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        tools: {
          requireApproval: true,
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // All tools should require approval
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].requireApproval).toBe(true);
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].requireApproval).toBe(true);
      expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].requireApproval).toBe(true);

      await workspace.destroy();
    });

    it('should apply top-level enabled to all tools', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        tools: {
          enabled: false,
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // No tools should be present when all disabled
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]).toBeUndefined();

      await workspace.destroy();
    });

    it('should allow per-tool overrides of top-level defaults', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        tools: {
          // Top-level: all tools require approval
          requireApproval: true,
          // Override: read_file doesn't require approval
          [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
            requireApproval: false,
          },
          // Override: delete is disabled
          [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
            enabled: false,
          },
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // read_file should NOT require approval (per-tool override)
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].requireApproval).toBe(false);

      // write_file should require approval (top-level default)
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].requireApproval).toBe(true);

      // delete should be disabled
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE]).toBeUndefined();

      // sandbox tool should require approval (top-level default)
      expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].requireApproval).toBe(true);

      await workspace.destroy();
    });

    it('should allow enabling specific tools when top-level is disabled', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        tools: {
          // Top-level: all tools disabled
          enabled: false,
          // Override: only read_file and list_files are enabled
          [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
            enabled: true,
          },
          [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: {
            enabled: true,
          },
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // Only read_file and list_files should be present
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]).toBeDefined();

      // All other tools should be disabled
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]).toBeUndefined();

      await workspace.destroy();
    });

    it('should set requireApproval on sandbox tools via tools config', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
            requireApproval: true,
          },
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].requireApproval).toBe(true);

      await workspace.destroy();
    });
  });
});
