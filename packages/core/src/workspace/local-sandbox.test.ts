import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LocalSandbox } from './local-sandbox';
import { SandboxNotReadyError } from './sandbox';

describe('LocalSandbox', () => {
  let tempDir: string;
  let sandbox: LocalSandbox;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-sandbox-test-'));
    // Use inheritEnv: true for tests so PATH and other essential vars are available
    sandbox = new LocalSandbox({ workingDirectory: tempDir, inheritEnv: true });
  });

  afterEach(async () => {
    // Clean up
    try {
      await sandbox.destroy();
    } catch {
      // Ignore
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================
  describe('constructor', () => {
    it('should create sandbox with default values', () => {
      const defaultSandbox = new LocalSandbox();

      expect(defaultSandbox.provider).toBe('local');
      expect(defaultSandbox.name).toBe('LocalSandbox');
      expect(defaultSandbox.id).toBeDefined();
      expect(defaultSandbox.status).toBe('stopped');
    });

    it('should accept custom id', () => {
      const customSandbox = new LocalSandbox({ id: 'custom-sandbox-id' });
      expect(customSandbox.id).toBe('custom-sandbox-id');
    });

    it('should accept custom working directory', () => {
      const customSandbox = new LocalSandbox({ workingDirectory: '/tmp/custom' });
      // We can't directly check the working directory, but we can verify it's set by running a command
      expect(customSandbox).toBeDefined();
    });
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  describe('lifecycle', () => {
    it('should start successfully', async () => {
      expect(sandbox.status).toBe('stopped');

      await sandbox.start();

      expect(sandbox.status).toBe('running');
    });

    it('should stop successfully', async () => {
      await sandbox.start();
      await sandbox.stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('should destroy successfully', async () => {
      await sandbox.start();
      await sandbox.destroy();

      expect(sandbox.status).toBe('stopped');
    });

    it('should report ready status', async () => {
      expect(await sandbox.isReady()).toBe(false);

      await sandbox.start();

      expect(await sandbox.isReady()).toBe(true);
    });
  });

  // ===========================================================================
  // getInfo
  // ===========================================================================
  describe('getInfo', () => {
    it('should return sandbox info', async () => {
      await sandbox.start();

      const info = await sandbox.getInfo();

      expect(info.id).toBe(sandbox.id);
      expect(info.name).toBe('LocalSandbox');
      expect(info.provider).toBe('local');
      expect(info.status).toBe('running');
      expect(info.resources?.memoryMB).toBeGreaterThan(0);
      expect(info.resources?.cpuCores).toBeGreaterThan(0);
      expect(info.metadata?.platform).toBe(os.platform());
      expect(info.metadata?.nodeVersion).toBe(process.version);
    });
  });

  // ===========================================================================
  // executeCommand
  // ===========================================================================
  describe('executeCommand', () => {
    beforeEach(async () => {
      await sandbox.start();
    });

    it('should execute command successfully', async () => {
      const result = await sandbox.executeCommand('echo', ['Hello, World!']);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello, World!');
      expect(result.exitCode).toBe(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });

    it('should handle command failure', async () => {
      const result = await sandbox.executeCommand('ls', ['nonexistent-directory-12345']);

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it('should use working directory', async () => {
      // Create a file in tempDir
      await fs.writeFile(path.join(tempDir, 'test-file.txt'), 'content');

      const result = await sandbox.executeCommand('ls', ['-1']);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test-file.txt');
    });

    it('should support custom cwd option', async () => {
      // Create a subdirectory with a file
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, 'subfile.txt'), 'content');

      const result = await sandbox.executeCommand('ls', ['-1'], { cwd: 'subdir' });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('subfile.txt');
    });

    it('should pass environment variables', async () => {
      const result = await sandbox.executeCommand('printenv', ['MY_CMD_VAR'], {
        env: { MY_CMD_VAR: 'cmd-value' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('cmd-value');
    });

    it('should throw SandboxNotReadyError when not started', async () => {
      const newSandbox = new LocalSandbox({ workingDirectory: tempDir });

      await expect(newSandbox.executeCommand('echo', ['test'])).rejects.toThrow(SandboxNotReadyError);
    });
  });

  // ===========================================================================
  // installPackage
  // ===========================================================================
  describe('installPackage', () => {
    it('should return error for unsupported package manager', async () => {
      const result = await sandbox.installPackage('test-package', {
        packageManager: 'unsupported' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported package manager');
    });

    // Note: We don't test actual package installation as it would modify the system
    // In a real test environment, we'd use a clean container or mock the execFile
  });

  // ===========================================================================
  // Timeout Handling
  // ===========================================================================
  describe('timeout handling', () => {
    beforeEach(async () => {
      await sandbox.start();
    });

    it('should respect custom timeout for command execution', async () => {
      // This should timeout quickly
      const result = await sandbox.executeCommand('sleep', ['5'], {
        timeout: 100, // Very short timeout
      });

      expect(result.success).toBe(false);
      // The error might be a timeout or killed signal
    });
  });

  // ===========================================================================
  // Working Directory
  // ===========================================================================
  describe('working directory', () => {
    it('should create working directory on start', async () => {
      const newDir = path.join(tempDir, 'new-sandbox-dir');
      const newSandbox = new LocalSandbox({ workingDirectory: newDir, inheritEnv: true });

      await newSandbox.start();

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);

      await newSandbox.destroy();
    });

    it('should execute command in working directory', async () => {
      await sandbox.start();

      // Create a file in the working directory
      await fs.writeFile(path.join(tempDir, 'data.txt'), 'file-content');

      // Read it using cat
      const result = await sandbox.executeCommand('cat', ['data.txt']);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('file-content');
    });
  });

  // ===========================================================================
  // Environment Variables
  // ===========================================================================
  describe('environment variables', () => {
    it('should inherit configured env vars', async () => {
      const envSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        env: { CONFIGURED_VAR: 'configured-value' },
        inheritEnv: true,
      });

      await envSandbox.start();

      const result = await envSandbox.executeCommand('printenv', ['CONFIGURED_VAR']);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('configured-value');

      await envSandbox.destroy();
    });

    it('should override configured env with execution env', async () => {
      const envSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        env: { OVERRIDE_VAR: 'original' },
        inheritEnv: true,
      });

      await envSandbox.start();

      const result = await envSandbox.executeCommand('printenv', ['OVERRIDE_VAR'], {
        env: { OVERRIDE_VAR: 'overridden' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('overridden');

      await envSandbox.destroy();
    });

    it('should default to inheritEnv: false', () => {
      const defaultSandbox = new LocalSandbox({ workingDirectory: tempDir });
      expect(defaultSandbox.inheritEnv).toBe(false);
    });

    it('should not inherit process.env when inheritEnv: false', async () => {
      // Set a test env var in the current process
      const testVarName = `MASTRA_TEST_VAR_${Date.now()}`;
      process.env[testVarName] = 'should-not-be-inherited';

      try {
        const isolatedSandbox = new LocalSandbox({
          workingDirectory: tempDir,
          inheritEnv: false,
          // Provide PATH so commands can be found
          env: { PATH: process.env.PATH! },
        });

        await isolatedSandbox.start();

        // Try to print the env var - should not be found
        const result = await isolatedSandbox.executeCommand('printenv', [testVarName]);

        // printenv returns exit code 1 when var is not found
        expect(result.success).toBe(false);

        await isolatedSandbox.destroy();
      } finally {
        delete process.env[testVarName];
      }
    });

    it('should inherit process.env when inheritEnv: true', async () => {
      // Set a test env var in the current process
      const testVarName = `MASTRA_TEST_VAR_${Date.now()}`;
      process.env[testVarName] = 'should-be-inherited';

      try {
        const inheritingSandbox = new LocalSandbox({
          workingDirectory: tempDir,
          inheritEnv: true,
        });

        await inheritingSandbox.start();

        const result = await inheritingSandbox.executeCommand('printenv', [testVarName]);

        expect(result.success).toBe(true);
        expect(result.stdout.trim()).toBe('should-be-inherited');

        await inheritingSandbox.destroy();
      } finally {
        delete process.env[testVarName];
      }
    });
  });

  // ===========================================================================
  // getFilesystem
  // ===========================================================================
  describe('getFilesystem', () => {
    it('should return undefined (local sandbox does not provide filesystem)', async () => {
      const fs = await sandbox.getFilesystem();
      expect(fs).toBeUndefined();
    });
  });

});
