import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WORKSPACE_TOOLS } from './constants';
import { WorkspaceReadOnlyError } from './errors';
import { FileReadRequiredError } from './filesystem';
import { LocalFilesystem } from './local-filesystem';
import { LocalSandbox } from './local-sandbox';
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

  describe('requireReadBeforeWrite', () => {
    it('should allow writing new files without reading first', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace.init();

      // Should succeed - new file doesn't require reading
      await workspace.writeFile('/new-file.txt', 'content');
      const content = await workspace.readFile('/new-file.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');

      await workspace.destroy();
    });

    it('should throw error when writing existing file without reading first', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace.init();

      // Create file first
      await workspace.writeFile('/existing.txt', 'original');

      // Create new workspace instance (simulates fresh session)
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace2.init();

      // Should fail - file exists but wasn't read in this session
      await expect(workspace2.writeFile('/existing.txt', 'modified')).rejects.toThrow(FileReadRequiredError);
      await expect(workspace2.writeFile('/existing.txt', 'modified')).rejects.toThrow('has not been read');

      await workspace.destroy();
      await workspace2.destroy();
    });

    it('should allow writing after reading', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace.init();

      // Create file
      await workspace.writeFile('/test.txt', 'original');

      // Create new workspace to simulate fresh session
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace2.init();

      // Read first
      await workspace2.readFile('/test.txt');

      // Now write should succeed
      await workspace2.writeFile('/test.txt', 'modified');
      const content = await workspace2.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('modified');

      await workspace.destroy();
      await workspace2.destroy();
    });

    it('should throw error when file was modified externally after reading', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace.init();

      // Create and read file
      await workspace.writeFile('/test.txt', 'original');

      // Create new workspace
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace2.init();

      // Read file
      await workspace2.readFile('/test.txt');

      // Wait a bit and modify file externally
      await new Promise(resolve => setTimeout(resolve, 50));
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'externally modified');

      // Should fail - file was modified since last read
      await expect(workspace2.writeFile('/test.txt', 'new content')).rejects.toThrow(FileReadRequiredError);
      await expect(workspace2.writeFile('/test.txt', 'new content')).rejects.toThrow('was modified since last read');

      await workspace.destroy();
      await workspace2.destroy();
    });

    it('should require re-reading after successful write', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace.init();

      // Create file
      await workspace.writeFile('/test.txt', 'v1');

      // Create new workspace
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: true },
        }),
      });
      await workspace2.init();

      // Read and write
      await workspace2.readFile('/test.txt');
      await workspace2.writeFile('/test.txt', 'v2');

      // Second write without re-reading should fail
      await expect(workspace2.writeFile('/test.txt', 'v3')).rejects.toThrow(FileReadRequiredError);

      // Read again and write should succeed
      await workspace2.readFile('/test.txt');
      await workspace2.writeFile('/test.txt', 'v3');

      const content = await workspace2.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('v3');

      await workspace.destroy();
      await workspace2.destroy();
    });

    it('should not require read-before-write when disabled', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { requireReadBeforeWrite: false },
        }),
      });
      await workspace.init();

      await workspace.writeFile('/test.txt', 'original');

      // Should succeed without reading first
      await workspace.writeFile('/test.txt', 'modified');
      const content = await workspace.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('modified');

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
          safety: { readOnly: true },
        }),
      });
      await workspace.init();

      await expect(workspace.writeFile('/test.txt', 'content')).rejects.toThrow(WorkspaceReadOnlyError);
      await expect(workspace.writeFile('/test.txt', 'content')).rejects.toThrow('read-only mode');

      await workspace.destroy();
    });

    it('should allow reading in readonly mode', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { readOnly: true },
        }),
      });
      await workspace.init();

      const content = await workspace.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');

      await workspace.destroy();
    });

    it('should allow exists() in readonly mode', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { readOnly: true },
        }),
      });
      await workspace.init();

      expect(await workspace.exists('/test.txt')).toBe(true);
      expect(await workspace.exists('/nonexistent.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should allow readdir() in readonly mode', async () => {
      await fs.mkdir(path.join(tempDir, 'subdir'));
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { readOnly: true },
        }),
      });
      await workspace.init();

      const entries = await workspace.readdir('/');
      expect(entries.length).toBe(2);

      await workspace.destroy();
    });

    it('should expose readOnly property', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { readOnly: true },
        }),
      });

      expect(workspace.readOnly).toBe(true);

      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      expect(workspace2.readOnly).toBe(false);
    });
  });

  describe('getSafetyConfig', () => {
    it('should return safety config from filesystem provider', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: {
            requireReadBeforeWrite: false,
            readOnly: true,
            requireApproval: 'write',
          },
        }),
      });

      const config = workspace.getSafetyConfig();
      expect(config.requireReadBeforeWrite).toBe(false);
      expect(config.readOnly).toBe(true);
      expect(config.requireFilesystemApproval).toBe('write');
    });

    it('should return safety config from sandbox provider', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({
          workingDirectory: tempDir,
          safety: { requireApproval: 'commands' },
        }),
      });

      const config = workspace.getSafetyConfig();
      expect(config.requireSandboxApproval).toBe('commands');
    });

    it('should return default values when no safety config provided', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const config = workspace.getSafetyConfig();
      expect(config.readOnly).toBe(false);
      expect(config.requireReadBeforeWrite).toBe(true);
      expect(config.requireFilesystemApproval).toBe('none');
      expect(config.requireSandboxApproval).toBe('all');
    });
  });

  describe('createWorkspaceTools with safety config', () => {
    it('should exclude write tools in readonly mode', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { readOnly: true },
        }),
        bm25: true,
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // Read tools should be present
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_EXISTS]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.SEARCH.SEARCH]).toBeDefined();

      // Write tools should be absent (including index which writes to search index)
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE_FILE]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR]).toBeUndefined();
      expect(tools[WORKSPACE_TOOLS.SEARCH.INDEX]).toBeUndefined();

      await workspace.destroy();
    });

    it('should include write tools when not readonly', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({
          basePath: tempDir,
          safety: { readOnly: false },
        }),
        bm25: true,
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE_FILE]).toBeDefined();
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
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE_FILE]).toBeDefined();
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_EXISTS]).toBeDefined();
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
          // Override: delete_file is disabled
          [WORKSPACE_TOOLS.FILESYSTEM.DELETE_FILE]: {
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

      // delete_file should be disabled
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE_FILE]).toBeUndefined();

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
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE_FILE]).toBeUndefined();
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
