import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LocalSandbox } from './local-sandbox';
import { detectIsolation, isIsolationAvailable, isSeatbeltAvailable, isBwrapAvailable } from './native-sandbox';
import { SandboxNotReadyError, IsolationUnavailableError } from './sandbox';

describe('LocalSandbox', () => {
  let tempDir: string;
  let sandbox: LocalSandbox;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-sandbox-test-'));
    // PATH is included by default, so basic commands work out of the box
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
      const newSandbox = new LocalSandbox({ workingDirectory: newDir });

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
    it('should use configured env vars', async () => {
      const envSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        env: { PATH: process.env.PATH!, CONFIGURED_VAR: 'configured-value' },
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
        env: { PATH: process.env.PATH!, OVERRIDE_VAR: 'original' },
      });

      await envSandbox.start();

      const result = await envSandbox.executeCommand('printenv', ['OVERRIDE_VAR'], {
        env: { OVERRIDE_VAR: 'overridden' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('overridden');

      await envSandbox.destroy();
    });

    it('should not inherit process.env by default', async () => {
      // Set a test env var in the current process
      const testVarName = `MASTRA_TEST_VAR_${Date.now()}`;
      process.env[testVarName] = 'should-not-be-inherited';

      try {
        const isolatedSandbox = new LocalSandbox({
          workingDirectory: tempDir,
          // Provide PATH so commands can be found, but not the test var
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

    it('should include process.env when explicitly spread', async () => {
      // Set a test env var in the current process
      const testVarName = `MASTRA_TEST_VAR_${Date.now()}`;
      process.env[testVarName] = 'should-be-included';

      try {
        const fullEnvSandbox = new LocalSandbox({
          workingDirectory: tempDir,
          env: { ...process.env },
        });

        await fullEnvSandbox.start();

        const result = await fullEnvSandbox.executeCommand('printenv', [testVarName]);

        expect(result.success).toBe(true);
        expect(result.stdout.trim()).toBe('should-be-included');

        await fullEnvSandbox.destroy();
      } finally {
        delete process.env[testVarName];
      }
    });
  });

  // ===========================================================================
  // Native Sandboxing - Detection
  // ===========================================================================
  describe('native sandboxing detection', () => {
    it('should have static detectIsolation method', () => {
      const result = LocalSandbox.detectIsolation();

      expect(result).toHaveProperty('backend');
      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('message');
    });

    it('should detect seatbelt on macOS', () => {
      if (os.platform() !== 'darwin') {
        return; // Skip on non-macOS
      }

      const result = detectIsolation();
      expect(result.backend).toBe('seatbelt');
      // sandbox-exec is built-in on macOS
      expect(result.available).toBe(true);
    });

    it('should detect bwrap availability on Linux', () => {
      if (os.platform() !== 'linux') {
        return; // Skip on non-Linux
      }

      const result = detectIsolation();
      expect(result.backend).toBe('bwrap');
      // bwrap may or may not be installed
      expect(typeof result.available).toBe('boolean');
    });

    it('should return none on Windows', () => {
      if (os.platform() !== 'win32') {
        return; // Skip on non-Windows
      }

      const result = detectIsolation();
      expect(result.backend).toBe('none');
      expect(result.available).toBe(false);
    });

    it('should correctly report isIsolationAvailable', () => {
      expect(isIsolationAvailable('none')).toBe(true);

      if (os.platform() === 'darwin') {
        expect(isIsolationAvailable('seatbelt')).toBe(true);
        expect(isIsolationAvailable('bwrap')).toBe(false);
      } else if (os.platform() === 'linux') {
        expect(isIsolationAvailable('seatbelt')).toBe(false);
        // bwrap may or may not be installed
      }
    });
  });

  // ===========================================================================
  // Native Sandboxing - Configuration
  // ===========================================================================
  describe('native sandboxing configuration', () => {
    it('should default to isolation: none', () => {
      const defaultSandbox = new LocalSandbox();
      expect(defaultSandbox.isolation).toBe('none');
    });

    it('should accept isolation option', async () => {
      const detection = detectIsolation();
      if (!detection.available) {
        return; // Skip if no native sandboxing available
      }

      const sandboxedSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: detection.backend,
      });

      expect(sandboxedSandbox.isolation).toBe(detection.backend);
      await sandboxedSandbox.destroy();
    });

    it('should throw error when unavailable backend requested', () => {
      // Request an unavailable backend
      const unavailableBackend = os.platform() === 'darwin' ? 'bwrap' : 'seatbelt';

      expect(
        () =>
          new LocalSandbox({
            workingDirectory: tempDir,
            isolation: unavailableBackend as 'seatbelt' | 'bwrap',
          }),
      ).toThrow(IsolationUnavailableError);
    });

    it('should include isolation in getInfo', async () => {
      await sandbox.start();
      const info = await sandbox.getInfo();

      expect(info.metadata?.isolation).toBe('none');
    });
  });

  // ===========================================================================
  // Native Sandboxing - Seatbelt (macOS only)
  // ===========================================================================
  describe('seatbelt isolation (macOS)', () => {
    beforeEach(async () => {
      if (os.platform() !== 'darwin' || !isSeatbeltAvailable()) {
        return;
      }
    });

    it('should create seatbelt profile on start', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox.start();

      // Check that profile file was created
      const profilePath = path.join(tempDir, '.sandbox.sb');
      const profileExists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false);
      expect(profileExists).toBe(true);

      // Check profile content
      const profileContent = await fs.readFile(profilePath, 'utf-8');
      expect(profileContent).toContain('(version 1)');
      expect(profileContent).toContain('(deny default');
      expect(profileContent).toContain('(allow file-read*)');
      expect(profileContent).toContain('(allow file-write* (subpath');

      await seatbeltSandbox.destroy();
    });

    it('should execute commands in seatbelt sandbox', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox.start();

      const result = await seatbeltSandbox.executeCommand('echo', ['Hello from sandbox']);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello from sandbox');

      await seatbeltSandbox.destroy();
    });

    it('should allow file operations within workspace', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox.start();

      // Write a file inside the workspace
      const result = await seatbeltSandbox.executeCommand('sh', [
        '-c',
        `echo "test content" > "${tempDir}/sandbox-test.txt"`,
      ]);
      expect(result.success).toBe(true);

      // Read it back
      const readResult = await seatbeltSandbox.executeCommand('cat', [`${tempDir}/sandbox-test.txt`]);
      expect(readResult.success).toBe(true);
      expect(readResult.stdout.trim()).toBe('test content');

      await seatbeltSandbox.destroy();
    });

    it('should clean up seatbelt profile on destroy', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox.start();
      const profilePath = path.join(tempDir, '.sandbox.sb');

      // Profile should exist
      expect(
        await fs
          .access(profilePath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);

      await seatbeltSandbox.destroy();

      // Profile should be cleaned up
      expect(
        await fs
          .access(profilePath)
          .then(() => true)
          .catch(() => false),
      ).toBe(false);
    });
  });

  // ===========================================================================
  // Native Sandboxing - Bubblewrap (Linux only)
  // ===========================================================================
  describe('bwrap isolation (Linux)', () => {
    it('should execute commands in bwrap sandbox', async () => {
      if (os.platform() !== 'linux' || !isBwrapAvailable()) {
        return;
      }

      const bwrapSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'bwrap',
      });

      await bwrapSandbox.start();

      const result = await bwrapSandbox.executeCommand('echo', ['Hello from bwrap']);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello from bwrap');

      await bwrapSandbox.destroy();
    });

    it('should allow file operations within workspace', async () => {
      if (os.platform() !== 'linux' || !isBwrapAvailable()) {
        return;
      }

      const bwrapSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'bwrap',
      });

      await bwrapSandbox.start();

      // Write a file inside the workspace using Node.js
      const writeResult = await bwrapSandbox.executeCommand('node', [
        '-e',
        `require('fs').writeFileSync('${tempDir}/bwrap-test.txt', 'bwrap content')`,
      ]);
      expect(writeResult.success).toBe(true);

      // Read it back
      const readResult = await bwrapSandbox.executeCommand('cat', [`${tempDir}/bwrap-test.txt`]);
      expect(readResult.success).toBe(true);
      expect(readResult.stdout.trim()).toBe('bwrap content');

      await bwrapSandbox.destroy();
    });

    it('should isolate network by default', async () => {
      if (os.platform() !== 'linux' || !isBwrapAvailable()) {
        return;
      }

      const bwrapSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'bwrap',
        nativeSandbox: {
          allowNetwork: false, // Default, but explicit for test clarity
        },
      });

      await bwrapSandbox.start();

      // This should fail due to network isolation
      const result = await bwrapSandbox.executeCommand('node', [
        '-e',
        `require('http').get('http://httpbin.org/get', (res) => process.exit(0)).on('error', () => process.exit(1))`,
      ]);

      // Should fail (network unreachable)
      expect(result.success).toBe(false);

      await bwrapSandbox.destroy();
    });

    it('should allow network when configured', async () => {
      if (os.platform() !== 'linux' || !isBwrapAvailable()) {
        return;
      }

      const bwrapSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'bwrap',
        nativeSandbox: {
          allowNetwork: true,
        },
      });

      await bwrapSandbox.start();

      // This should work with network enabled
      // Use a simple DNS lookup as it's faster than HTTP
      const result = await bwrapSandbox.executeCommand('node', [
        '-e',
        `require('dns').lookup('localhost', (err) => process.exit(err ? 1 : 0))`,
      ]);

      expect(result.success).toBe(true);

      await bwrapSandbox.destroy();
    });
  });
});
