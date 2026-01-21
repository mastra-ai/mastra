import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileReadRequiredError } from './filesystem';
import { LocalFilesystem } from './local-filesystem';
import { LocalSandbox } from './local-sandbox';
import { createWorkspaceTools } from './tools';
import { Workspace, WorkspaceReadOnlyError } from './workspace';

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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
      });
      await workspace.init();

      // Create file first
      await workspace.writeFile('/existing.txt', 'original');

      // Create new workspace instance (simulates fresh session)
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
      });
      await workspace.init();

      // Create file
      await workspace.writeFile('/test.txt', 'original');

      // Create new workspace to simulate fresh session
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
      });
      await workspace.init();

      // Create and read file
      await workspace.writeFile('/test.txt', 'original');

      // Create new workspace
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
      });
      await workspace.init();

      // Create file
      await workspace.writeFile('/test.txt', 'v1');

      // Create new workspace
      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
        },
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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: false,
        },
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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          readOnly: true,
        },
      });
      await workspace.init();

      await expect(workspace.writeFile('/test.txt', 'content')).rejects.toThrow(WorkspaceReadOnlyError);
      await expect(workspace.writeFile('/test.txt', 'content')).rejects.toThrow('read-only mode');

      await workspace.destroy();
    });

    it('should allow reading in readonly mode', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          readOnly: true,
        },
      });
      await workspace.init();

      const content = await workspace.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('content');

      await workspace.destroy();
    });

    it('should allow exists() in readonly mode', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          readOnly: true,
        },
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
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          readOnly: true,
        },
      });
      await workspace.init();

      const entries = await workspace.readdir('/');
      expect(entries.length).toBe(2);

      await workspace.destroy();
    });

    it('should expose readOnly property', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          readOnly: true,
        },
      });

      expect(workspace.readOnly).toBe(true);

      const workspace2 = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      expect(workspace2.readOnly).toBe(false);
    });
  });

  describe('getSafetyConfig', () => {
    it('should return safety config', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        safety: {
          requireReadBeforeWrite: true,
          requireSandboxApproval: 'commands',
          readOnly: false,
        },
      });

      const config = workspace.getSafetyConfig();
      expect(config?.requireReadBeforeWrite).toBe(true);
      expect(config?.requireSandboxApproval).toBe('commands');
      expect(config?.readOnly).toBe(false);
    });

    it('should return undefined when no safety config', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      expect(workspace.getSafetyConfig()).toBeUndefined();
    });
  });

  describe('createWorkspaceTools with safety config', () => {
    it('should exclude write tools in readonly mode', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        bm25: true,
        safety: {
          readOnly: true,
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // Read tools should be present
      expect(tools.workspace_read_file).toBeDefined();
      expect(tools.workspace_list_files).toBeDefined();
      expect(tools.workspace_file_exists).toBeDefined();
      expect(tools.workspace_search).toBeDefined();

      // Write tools should be absent (including index which writes to search index)
      expect(tools.workspace_write_file).toBeUndefined();
      expect(tools.workspace_delete_file).toBeUndefined();
      expect(tools.workspace_mkdir).toBeUndefined();
      expect(tools.workspace_index).toBeUndefined();

      await workspace.destroy();
    });

    it('should include write tools when not readonly', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        bm25: true,
        safety: {
          readOnly: false,
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      expect(tools.workspace_write_file).toBeDefined();
      expect(tools.workspace_delete_file).toBeDefined();
      expect(tools.workspace_mkdir).toBeDefined();
      expect(tools.workspace_index).toBeDefined();

      await workspace.destroy();
    });

    it('should set requireApproval on sandbox tools when sandboxApproval is "all"', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        safety: {
          requireSandboxApproval: 'all',
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      expect(tools.workspace_execute_code.requireApproval).toBe(true);
      expect(tools.workspace_execute_command.requireApproval).toBe(true);
      expect(tools.workspace_install_package.requireApproval).toBe(true);

      await workspace.destroy();
    });

    it('should set requireApproval on command tools when sandboxApproval is "commands"', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        safety: {
          requireSandboxApproval: 'commands',
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // execute_code should NOT require approval
      expect(tools.workspace_execute_code.requireApproval).toBe(false);

      // execute_command and install_package should require approval
      expect(tools.workspace_execute_command.requireApproval).toBe(true);
      expect(tools.workspace_install_package.requireApproval).toBe(true);

      await workspace.destroy();
    });

    it('should not set requireApproval when sandboxApproval is "none"', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        safety: {
          requireSandboxApproval: 'none',
        },
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      expect(tools.workspace_execute_code.requireApproval).toBe(false);
      expect(tools.workspace_execute_command.requireApproval).toBe(false);
      expect(tools.workspace_install_package.requireApproval).toBe(false);

      await workspace.destroy();
    });

    it('should default to requiring approval when no safety config', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });
      await workspace.init();

      const tools = createWorkspaceTools(workspace);

      // Default is now 'all' - all sandbox tools require approval
      expect(tools.workspace_execute_code.requireApproval).toBe(true);
      expect(tools.workspace_execute_command.requireApproval).toBe(true);
      expect(tools.workspace_install_package.requireApproval).toBe(true);

      await workspace.destroy();
    });
  });
});
