import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LocalSandbox } from './local-sandbox';
import { SandboxNotReadyError, UnsupportedRuntimeError } from './sandbox';

describe('LocalSandbox', () => {
  let tempDir: string;
  let sandbox: LocalSandbox;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-sandbox-test-'));
    sandbox = new LocalSandbox({ workingDirectory: tempDir });
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

    it('should accept custom runtimes', () => {
      const customSandbox = new LocalSandbox({ runtimes: ['node', 'python'] });
      expect(customSandbox.supportedRuntimes).toEqual(['node', 'python']);
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

    it('should detect runtimes on start', async () => {
      await sandbox.start();

      // Node should always be available since we're running in Node
      expect(sandbox.supportedRuntimes).toContain('node');
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
  // executeCode
  // ===========================================================================
  describe('executeCode', () => {
    beforeEach(async () => {
      await sandbox.start();
    });

    it('should execute Node.js code', async () => {
      const result = await sandbox.executeCode('console.log("Hello, World!")', {
        runtime: 'node',
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello, World!');
      expect(result.exitCode).toBe(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });

    it('should handle code errors', async () => {
      const result = await sandbox.executeCode('throw new Error("Test error")', {
        runtime: 'node',
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Test error');
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle syntax errors', async () => {
      const result = await sandbox.executeCode('this is not valid javascript {{{', {
        runtime: 'node',
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it('should use default runtime when not specified', async () => {
      // Default runtime is the first detected, which should be 'node'
      const result = await sandbox.executeCode('console.log("default")');

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('default');
    });

    it('should pass environment variables', async () => {
      const result = await sandbox.executeCode('console.log(process.env.MY_VAR)', {
        runtime: 'node',
        env: { MY_VAR: 'test-value' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('test-value');
    });

    it('should throw SandboxNotReadyError when not started', async () => {
      const newSandbox = new LocalSandbox({ workingDirectory: tempDir });

      await expect(newSandbox.executeCode('console.log("test")')).rejects.toThrow(SandboxNotReadyError);
    });

    it('should throw UnsupportedRuntimeError for unknown runtime', async () => {
      await expect(
        sandbox.executeCode('code', {
          runtime: 'unknown-runtime' as any,
        }),
      ).rejects.toThrow(UnsupportedRuntimeError);
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
  // executeCode - Bash/Shell
  // ===========================================================================
  describe('executeCode - bash', () => {
    beforeEach(async () => {
      await sandbox.start();
    });

    it('should execute bash code', async () => {
      // Skip if bash not available
      if (!sandbox.supportedRuntimes.includes('bash')) {
        return;
      }

      const result = await sandbox.executeCode('echo "Hello from bash"', {
        runtime: 'bash',
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello from bash');
    });

    it('should handle bash script with variables', async () => {
      if (!sandbox.supportedRuntimes.includes('bash')) {
        return;
      }

      const code = `
NAME="World"
echo "Hello, $NAME!"
`;
      const result = await sandbox.executeCode(code, { runtime: 'bash' });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello, World!');
    });
  });

  // ===========================================================================
  // executeCode - Python (if available)
  // ===========================================================================
  describe('executeCode - python', () => {
    beforeEach(async () => {
      await sandbox.start();
    });

    it('should execute python code if available', async () => {
      // Skip if python not available
      if (!sandbox.supportedRuntimes.includes('python')) {
        return;
      }

      const result = await sandbox.executeCode('print("Hello from Python")', {
        runtime: 'python',
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello from Python');
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
  // defaultRuntime
  // ===========================================================================
  describe('defaultRuntime', () => {
    it('should return first detected runtime as default', async () => {
      await sandbox.start();

      // Node should be first since we're running in Node
      expect(sandbox.defaultRuntime).toBe('node');
    });

    it('should return node if no runtimes detected', () => {
      // Before start(), no runtimes are detected
      const newSandbox = new LocalSandbox({ workingDirectory: tempDir });

      // With no detected runtimes, falls back to 'node'
      expect(newSandbox.defaultRuntime).toBe('node');
    });

    it('should use configured runtimes over detected', () => {
      const configuredSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        runtimes: ['python', 'bash'],
      });

      expect(configuredSandbox.defaultRuntime).toBe('python');
    });
  });

  // ===========================================================================
  // Timeout Handling
  // ===========================================================================
  describe('timeout handling', () => {
    beforeEach(async () => {
      await sandbox.start();
    });

    it('should respect custom timeout for code execution', async () => {
      // This should timeout quickly
      const result = await sandbox.executeCode(
        `
        const start = Date.now();
        while (Date.now() - start < 5000) { /* busy wait */ }
        console.log("done");
      `,
        {
          runtime: 'node',
          timeout: 100, // Very short timeout
        },
      );

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
      const newSandbox = new LocalSandbox({ workingDirectory: newDir });

      await newSandbox.start();

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);

      await newSandbox.destroy();
    });

    it('should execute code in working directory', async () => {
      await sandbox.start();

      // Create a file in the working directory
      await fs.writeFile(path.join(tempDir, 'data.json'), '{"key": "value"}');

      // Read it from Node code
      const result = await sandbox.executeCode(
        `
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        console.log(data.key);
      `,
        { runtime: 'node' },
      );

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('value');
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
      });

      await envSandbox.start();

      const result = await envSandbox.executeCode('console.log(process.env.CONFIGURED_VAR)', {
        runtime: 'node',
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('configured-value');

      await envSandbox.destroy();
    });

    it('should override configured env with execution env', async () => {
      const envSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        env: { OVERRIDE_VAR: 'original' },
      });

      await envSandbox.start();

      const result = await envSandbox.executeCode('console.log(process.env.OVERRIDE_VAR)', {
        runtime: 'node',
        env: { OVERRIDE_VAR: 'overridden' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('overridden');

      await envSandbox.destroy();
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
