import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSandboxTestSuite } from '../../../../../workspaces/_test-utils/src/sandbox/factory';

import { RequestContext } from '../../request-context';
import { IsolationUnavailableError } from './errors';
import { LocalSandbox } from './local-sandbox';
import * as gcsMod from './mounts/gcs';
import * as platformMod from './mounts/platform';
import * as s3Mod from './mounts/s3';
import { MountToolNotFoundError } from './mounts/types';
import { detectIsolation, isIsolationAvailable, isSeatbeltAvailable, isBwrapAvailable } from './native-sandbox';

describe('LocalSandbox', () => {
  let tempDir: string;
  let sandbox: LocalSandbox;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-local-sandbox-test-'));
    // PATH is included by default, so basic commands work out of the box
    sandbox = new LocalSandbox({ workingDirectory: tempDir });
  });

  afterEach(async () => {
    // Clean up
    try {
      await sandbox._destroy();
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
      expect(defaultSandbox.status).toBe('pending');
      // Default working directory is .sandbox/ in cwd
      expect(defaultSandbox.workingDirectory).toBe(path.join(process.cwd(), '.sandbox'));
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
      expect(sandbox.status).toBe('pending');

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });

    it('should stop successfully', async () => {
      await sandbox._start();
      await sandbox._stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('should destroy successfully', async () => {
      await sandbox._start();
      await sandbox._destroy();

      expect(sandbox.status).toBe('destroyed');
    });

    it('should report ready status', async () => {
      expect(await sandbox.isReady()).toBe(false);

      await sandbox._start();

      expect(await sandbox.isReady()).toBe(true);
    });
  });

  // ===========================================================================
  // getInfo
  // ===========================================================================
  describe('getInfo', () => {
    it('should return sandbox info', async () => {
      await sandbox._start();

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
  // getInstructions
  // ===========================================================================
  describe('getInstructions', () => {
    it('should return auto-generated instructions with working directory', () => {
      const instructions = sandbox.getInstructions();
      expect(instructions).toContain('Local command execution');
      expect(instructions).toContain(tempDir);
    });

    it('should return custom instructions when override is provided', () => {
      const sb = new LocalSandbox({
        workingDirectory: tempDir,
        instructions: 'Custom sandbox instructions.',
      });
      expect(sb.getInstructions()).toBe('Custom sandbox instructions.');
    });

    it('should return empty string when override is empty string', () => {
      const sb = new LocalSandbox({
        workingDirectory: tempDir,
        instructions: '',
      });
      expect(sb.getInstructions()).toBe('');
    });

    it('should return auto-generated instructions when no override', () => {
      const sb = new LocalSandbox({ workingDirectory: tempDir });
      expect(sb.getInstructions()).toContain('Local command execution');
    });

    it('should support function form that extends auto instructions', () => {
      const sb = new LocalSandbox({
        workingDirectory: tempDir,
        instructions: ({ defaultInstructions }) => `${defaultInstructions}\nExtra sandbox info.`,
      });
      const result = sb.getInstructions();
      expect(result).toContain('Local command execution');
      expect(result).toContain('Extra sandbox info.');
    });

    it('should pass requestContext to function form', () => {
      const ctx = new RequestContext([['tenant', 'acme']]);
      const fn = vi.fn(({ defaultInstructions, requestContext }: any) => {
        return `${defaultInstructions} tenant=${requestContext?.get('tenant')}`;
      });
      const sb = new LocalSandbox({
        workingDirectory: tempDir,
        instructions: fn,
      });
      const result = sb.getInstructions({ requestContext: ctx });
      expect(fn).toHaveBeenCalledOnce();
      expect(result).toContain('tenant=acme');
      expect(result).toContain('Local command execution');
    });
  });

  // ===========================================================================
  // executeCommand
  // ===========================================================================
  describe('executeCommand', () => {
    beforeEach(async () => {
      await sandbox._start();
    });

    it('should execute command successfully', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      const result = await sandbox.executeCommand('echo', ['Hello, World!']);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello, World!');
      expect(result.exitCode).toBe(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });

    it('should handle command failure', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      const result = await sandbox.executeCommand('ls', ['nonexistent-directory-12345']);

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it('should use working directory', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      // Create a file in tempDir
      await fs.writeFile(path.join(tempDir, 'test-file.txt'), 'content');

      const result = await sandbox.executeCommand('ls', ['-1']);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test-file.txt');
    });

    it('should support custom cwd option', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      // Create a subdirectory with a file
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, 'subfile.txt'), 'content');

      const result = await sandbox.executeCommand('ls', ['-1'], { cwd: subDir });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('subfile.txt');
    });

    it('should pass environment variables', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      const result = await sandbox.executeCommand('printenv', ['MY_CMD_VAR'], {
        env: { MY_CMD_VAR: 'cmd-value' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('cmd-value');
    });

    it('should auto-start when executeCommand is called without start()', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      const newSandbox = new LocalSandbox({ workingDirectory: tempDir });

      // Should auto-start and execute successfully
      const result = await newSandbox.executeCommand('echo', ['test']);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('test');
      expect(newSandbox.status).toBe('running');

      await newSandbox._destroy();
    });
  });

  // ===========================================================================
  // Timeout Handling
  // ===========================================================================
  describe('timeout handling', () => {
    beforeEach(async () => {
      await sandbox._start();
    });

    it('should respect custom timeout for command execution', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
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

      await newSandbox._start();

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);

      await newSandbox._destroy();
    });

    it('should execute command in working directory', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      await sandbox._start();

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
      if (os.platform() === 'win32') return; // Uses POSIX commands
      const envSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        env: { PATH: process.env.PATH!, CONFIGURED_VAR: 'configured-value' },
      });

      await envSandbox._start();

      const result = await envSandbox.executeCommand('printenv', ['CONFIGURED_VAR']);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('configured-value');

      await envSandbox._destroy();
    });

    it('should override configured env with execution env', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      const envSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        env: { PATH: process.env.PATH!, OVERRIDE_VAR: 'original' },
      });

      await envSandbox._start();

      const result = await envSandbox.executeCommand('printenv', ['OVERRIDE_VAR'], {
        env: { OVERRIDE_VAR: 'overridden' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('overridden');

      await envSandbox._destroy();
    });

    it('should not inherit process.env by default', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      // Set a test env var in the current process
      const testVarName = `MASTRA_TEST_VAR_${Date.now()}`;
      process.env[testVarName] = 'should-not-be-inherited';

      try {
        const isolatedSandbox = new LocalSandbox({
          workingDirectory: tempDir,
          // Provide PATH so commands can be found, but not the test var
          env: { PATH: process.env.PATH! },
        });

        await isolatedSandbox._start();

        // Try to print the env var - should not be found
        const result = await isolatedSandbox.executeCommand('printenv', [testVarName]);

        // printenv returns exit code 1 when var is not found
        expect(result.success).toBe(false);

        await isolatedSandbox._destroy();
      } finally {
        delete process.env[testVarName];
      }
    });

    it('should include process.env when explicitly spread', async () => {
      if (os.platform() === 'win32') return; // Uses POSIX commands
      // Set a test env var in the current process
      const testVarName = `MASTRA_TEST_VAR_${Date.now()}`;
      process.env[testVarName] = 'should-be-included';

      try {
        const fullEnvSandbox = new LocalSandbox({
          workingDirectory: tempDir,
          env: { ...process.env },
        });

        await fullEnvSandbox._start();

        const result = await fullEnvSandbox.executeCommand('printenv', [testVarName]);

        expect(result.success).toBe(true);
        expect(result.stdout.trim()).toBe('should-be-included');

        await fullEnvSandbox._destroy();
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
      await sandboxedSandbox._destroy();
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
      await sandbox._start();
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

      await seatbeltSandbox._start();

      // Check that profile file was created in .sandbox-profiles folder (outside working directory)
      // Filename is based on hash of workspace path and config
      const configHash = crypto
        .createHash('sha256')
        .update(tempDir)
        .update(JSON.stringify({}))
        .digest('hex')
        .slice(0, 8);
      const profilePath = path.join(process.cwd(), '.sandbox-profiles', `seatbelt-${configHash}.sb`);
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

      await seatbeltSandbox._destroy();
    });

    it('should execute commands in seatbelt sandbox', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox._start();

      const result = await seatbeltSandbox.executeCommand('echo', ['Hello from sandbox']);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello from sandbox');

      await seatbeltSandbox._destroy();
    });

    it('should allow file operations within workspace', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox._start();

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

      await seatbeltSandbox._destroy();
    });

    it('should block file writes outside workspace', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox._start();

      // Try to write to user's home directory (not in allowed paths)
      // Note: /tmp and /var/folders are allowed for temp files, so we test elsewhere
      const homeDir = os.homedir();
      const blockedPath = path.join(homeDir, `.seatbelt-block-test-${Date.now()}.txt`);
      const result = await seatbeltSandbox.executeCommand('sh', ['-c', `echo "blocked" > "${blockedPath}"`]);

      // Should fail due to sandbox restrictions
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Operation not permitted');

      // Clean up just in case (shouldn't exist)
      await fs.unlink(blockedPath).catch(() => {});

      await seatbeltSandbox._destroy();
    });

    it('should block network access by default', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
        nativeSandbox: {
          allowNetwork: false, // Default, but explicit for test clarity
        },
      });

      await seatbeltSandbox._start();

      // Try to make a network request - should fail
      const result = await seatbeltSandbox.executeCommand('curl', ['-s', '--max-time', '2', 'http://httpbin.org/get']);

      // Should fail due to network isolation
      expect(result.success).toBe(false);

      await seatbeltSandbox._destroy();
    });

    it('should allow network access when configured', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
        nativeSandbox: {
          allowNetwork: true,
        },
      });

      await seatbeltSandbox._start();

      // DNS lookup should work with network enabled
      const result = await seatbeltSandbox.executeCommand('sh', [
        '-c',
        'python3 -c "import socket; socket.gethostbyname(\'localhost\')" && echo "ok"',
      ]);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('ok');

      await seatbeltSandbox._destroy();
    });

    it('should clean up seatbelt profile on destroy', async () => {
      if (os.platform() !== 'darwin') {
        return;
      }

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'seatbelt',
      });

      await seatbeltSandbox._start();
      // Profile uses hash-based filename in .sandbox-profiles folder (outside working directory)
      const configHash = crypto
        .createHash('sha256')
        .update(tempDir)
        .update(JSON.stringify({}))
        .digest('hex')
        .slice(0, 8);
      const profilePath = path.join(process.cwd(), '.sandbox-profiles', `seatbelt-${configHash}.sb`);

      // Profile should exist
      expect(
        await fs
          .access(profilePath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);

      await seatbeltSandbox._destroy();

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

      await bwrapSandbox._start();

      const result = await bwrapSandbox.executeCommand('echo', ['Hello from bwrap']);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello from bwrap');

      await bwrapSandbox._destroy();
    });

    it('should allow file operations within workspace', async () => {
      if (os.platform() !== 'linux' || !isBwrapAvailable()) {
        return;
      }

      const bwrapSandbox = new LocalSandbox({
        workingDirectory: tempDir,
        isolation: 'bwrap',
      });

      await bwrapSandbox._start();

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

      await bwrapSandbox._destroy();
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

      await bwrapSandbox._start();

      // This should fail due to network isolation
      const result = await bwrapSandbox.executeCommand('node', [
        '-e',
        `require('http').get('http://httpbin.org/get', (res) => process.exit(0)).on('error', () => process.exit(1))`,
      ]);

      // Should fail (network unreachable)
      expect(result.success).toBe(false);

      await bwrapSandbox._destroy();
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

      await bwrapSandbox._start();

      // This should work with network enabled
      // Use a simple DNS lookup as it's faster than HTTP
      const result = await bwrapSandbox.executeCommand('node', [
        '-e',
        `require('dns').lookup('localhost', (err) => process.exit(err ? 1 : 0))`,
      ]);

      expect(result.success).toBe(true);

      await bwrapSandbox._destroy();
    });
  });

  // ===========================================================================
  // Mount Operations
  // ===========================================================================
  describe('mount operations', () => {
    let mountSandbox: LocalSandbox;
    let mountDir: string;

    function makeMockFs(overrides: Record<string, unknown> = {}) {
      return {
        id: 'test-s3',
        provider: 's3',
        getMountConfig: () => ({ type: 's3' as const, bucket: 'my-bucket', region: 'us-east-1' }),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        deleteFile: vi.fn(),
        listFiles: vi.fn(),
        stat: vi.fn(),
        exists: vi.fn(),
        getInstructions: vi.fn(),
        init: vi.fn(),
        ...overrides,
      };
    }

    beforeEach(async () => {
      mountDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-mount-test-'));
      mountSandbox = new LocalSandbox({ workingDirectory: mountDir });
      await mountSandbox._start();
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      try {
        // Clear active mount paths so destroy doesn't try to unmount
        // (mocks are already restored at this point)
        (mountSandbox as any)._activeMountPaths.clear();
        mountSandbox.mounts.clear();
        await mountSandbox._destroy();
      } catch {
        // Ignore
      }
      try {
        await fs.rm(mountDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should have a MountManager (because mount() is defined)', () => {
      expect(mountSandbox.mounts).toBeDefined();
    });

    it('should create symlink for local filesystem mount', async () => {
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);

      // Create a source directory with a file
      const sourceDir = path.join(mountDir, 'local-source');
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'hello from local');

      const mountPath = '/local-data';
      const result = await mountSandbox.mount(
        makeMockFs({
          id: 'test-local',
          provider: 'local',
          getMountConfig: () => ({ type: 'local' as const, basePath: sourceDir }),
        }) as any,
        mountPath,
      );

      expect(result.success).toBe(true);
      expect(result.mountPath).toBe(mountPath);

      // Verify symlink was created
      const hostPath = path.join(mountDir, 'local-data');
      const stats = await fs.lstat(hostPath);
      expect(stats.isSymbolicLink()).toBe(true);

      // Verify symlink target
      const target = await fs.readlink(hostPath);
      expect(target).toBe(sourceDir);

      // Verify files are accessible through symlink
      const content = await fs.readFile(path.join(hostPath, 'test.txt'), 'utf-8');
      expect(content).toBe('hello from local');
    });

    it('should dispatch to mountS3 for S3 config', async () => {
      const mountS3Spy = vi.spyOn(s3Mod, 'mountS3').mockResolvedValue(undefined);
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);

      const mountPath = '/s3-data';
      const result = await mountSandbox.mount(makeMockFs() as any, mountPath);

      expect(result.success).toBe(true);
      expect(result.mountPath).toBe(mountPath);
      expect(mountS3Spy).toHaveBeenCalledTimes(1);
      // mountS3 receives the resolved host path (workingDir/s3-data)
      expect(mountS3Spy.mock.calls[0]![0]).toBe(path.join(mountDir, 's3-data'));
    });

    it('should dispatch to mountGCS for GCS config', async () => {
      const mountGCSSpy = vi.spyOn(gcsMod, 'mountGCS').mockResolvedValue(undefined);
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);

      const mountPath = '/gcs-data';
      const result = await mountSandbox.mount(
        makeMockFs({
          id: 'test-gcs',
          provider: 'gcs',
          getMountConfig: () => ({ type: 'gcs' as const, bucket: 'my-gcs-bucket' }),
        }) as any,
        mountPath,
      );

      expect(result.success).toBe(true);
      expect(mountGCSSpy).toHaveBeenCalledTimes(1);
      expect(mountGCSSpy.mock.calls[0]![0]).toBe(path.join(mountDir, 'gcs-data'));
    });

    it('should reject invalid mount paths', async () => {
      const mockFs = makeMockFs();

      await expect(mountSandbox.mount(mockFs as any, 'relative/path')).rejects.toThrow('Invalid mount path');
      await expect(mountSandbox.mount(mockFs as any, '/tmp/bad path')).rejects.toThrow('Invalid mount path');
    });

    it('should return error for unsupported mount type', async () => {
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);

      const mountPath = '/ftp-data';
      const result = await mountSandbox.mount(
        makeMockFs({
          id: 'test-unknown',
          provider: 'unknown',
          getMountConfig: () => ({ type: 'ftp' }),
        }) as any,
        mountPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported mount type');
    });

    it('should return error when filesystem has no mount config', async () => {
      const mountPath = '/local';
      const result = await mountSandbox.mount(
        makeMockFs({
          id: 'test-no-config',
          provider: 'local',
          getMountConfig: undefined,
        }) as any,
        mountPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not provide a mount config');
    });

    it('should reject non-empty directories', async () => {
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);

      // Pre-create a non-empty directory under working directory
      const hostDir = path.join(mountDir, 'nonempty');
      await fs.mkdir(hostDir, { recursive: true });
      await fs.writeFile(path.join(hostDir, 'existing.txt'), 'content');

      const result = await mountSandbox.mount(makeMockFs() as any, '/nonempty');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not empty');
    });

    it('should unmount and clean up marker files', async () => {
      vi.spyOn(s3Mod, 'mountS3').mockResolvedValue(undefined);
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);
      vi.spyOn(platformMod, 'unmountFuse').mockResolvedValue(undefined);

      const mountPath = '/s3-cleanup';
      const mountResult = await mountSandbox.mount(makeMockFs() as any, mountPath);
      expect(mountResult.success).toBe(true);

      await mountSandbox.unmount(mountPath);

      expect(mountSandbox.mounts.has(mountPath)).toBe(false);
    });

    it('should unmount all mounts on stop()', async () => {
      vi.spyOn(s3Mod, 'mountS3').mockResolvedValue(undefined);
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);
      const unmountSpy = vi.spyOn(platformMod, 'unmountFuse').mockResolvedValue(undefined);

      const mountPath = '/stop-test';
      await mountSandbox.mount(makeMockFs() as any, mountPath);

      await mountSandbox._stop();

      expect(unmountSpy).toHaveBeenCalled();
    });

    it('should unmount all mounts on destroy()', async () => {
      vi.spyOn(s3Mod, 'mountS3').mockResolvedValue(undefined);
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);
      const unmountSpy = vi.spyOn(platformMod, 'unmountFuse').mockResolvedValue(undefined);

      const mountPath = '/destroy-test';
      await mountSandbox.mount(makeMockFs() as any, mountPath);

      await mountSandbox._destroy();

      expect(unmountSpy).toHaveBeenCalled();
      expect(mountSandbox.mounts.entries.size).toBe(0);
    });

    it('should add mount path to seatbelt isolation readWritePaths', async () => {
      if (os.platform() !== 'darwin') return;

      vi.spyOn(s3Mod, 'mountS3').mockResolvedValue(undefined);
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);
      vi.spyOn(platformMod, 'unmountFuse').mockResolvedValue(undefined);

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: mountDir,
        isolation: 'seatbelt',
      });
      await seatbeltSandbox._start();

      const mountPath = '/seatbelt-test';
      await seatbeltSandbox.mount(makeMockFs() as any, mountPath);

      const info = await seatbeltSandbox.getInfo();
      const isoConfig = info.metadata?.isolationConfig as { readWritePaths?: string[] } | undefined;
      // Isolation allowlist uses the resolved host path
      expect(isoConfig?.readWritePaths).toEqual(expect.arrayContaining([path.join(mountDir, 'seatbelt-test')]));

      // Clear before destroy to avoid real unmount attempts
      (seatbeltSandbox as any)._activeMountPaths.clear();
      seatbeltSandbox.mounts.clear();
      await seatbeltSandbox._destroy();
    });

    it('should handle mount failure gracefully', async () => {
      vi.spyOn(s3Mod, 'mountS3').mockRejectedValue(new Error('mount command failed'));
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);

      const mountPath = '/fail-test';
      const result = await mountSandbox.mount(makeMockFs() as any, mountPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('mount command failed');
      expect(result.unavailable).toBeUndefined();
    });

    it('should mark mount as unavailable when FUSE tool is not installed', async () => {
      vi.spyOn(s3Mod, 'mountS3').mockRejectedValue(
        new MountToolNotFoundError('s3fs is not installed. Install s3fs via Homebrew: brew install s3fs'),
      );
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(false);

      const mountPath = '/unavail-test';
      const result = await mountSandbox.mount(makeMockFs() as any, mountPath);

      expect(result.success).toBe(false);
      expect(result.unavailable).toBe(true);
      expect(result.error).toContain('s3fs is not installed');
    });

    it('should skip mount if already mounted with matching config', async () => {
      const mountS3Spy = vi.spyOn(s3Mod, 'mountS3').mockResolvedValue(undefined);
      vi.spyOn(platformMod, 'isMountPoint').mockResolvedValue(true);
      vi.spyOn(platformMod, 'unmountFuse').mockResolvedValue(undefined);

      const mountPath = '/existing';
      const hostPath = path.join(mountDir, 'existing');
      const config = { type: 's3' as const, bucket: 'my-bucket', region: 'us-east-1' };

      // Write a matching marker file using the resolved host path
      const markerFilename = mountSandbox.mounts.markerFilename(hostPath);
      const configHash = mountSandbox.mounts.computeConfigHash(config);
      const markerDir = '/tmp/.mastra-mounts';
      await fs.mkdir(markerDir, { recursive: true });
      await fs.writeFile(path.join(markerDir, markerFilename), `${hostPath}|${configHash}`);

      try {
        const result = await mountSandbox.mount(makeMockFs({ getMountConfig: () => config }) as any, mountPath);
        expect(result.success).toBe(true);
        // Should NOT have called mountS3 since it was already mounted with matching config
        expect(mountS3Spy).not.toHaveBeenCalled();
      } finally {
        await fs.unlink(path.join(markerDir, markerFilename)).catch(() => {});
      }
    });
  });
});

/**
 * Shared Sandbox Conformance Tests
 *
 * Verifies LocalSandbox conforms to the WorkspaceSandbox interface.
 * Same suite that runs against E2BSandbox.
 */
createSandboxTestSuite({
  suiteName: 'LocalSandbox Conformance',
  createSandbox: async options => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-local-sandbox-conformance-'));
    const realDir = await fs.realpath(dir);
    return new LocalSandbox({ workingDirectory: realDir, env: { PATH: process.env.PATH!, ...options?.env } });
  },
  capabilities: {
    supportsMounting: false,
    supportsReconnection: false,
    supportsConcurrency: true,
    supportsEnvVars: true,
    supportsWorkingDirectory: true,
    supportsTimeout: true,
    defaultCommandTimeout: 10000,
    supportsStreaming: true,
  },
  testDomains: {
    commandExecution: true,
    lifecycle: true,
    mountOperations: false,
    reconnection: false,
    processManagement: true,
  },
  testTimeout: 10000,
  fastOnly: false,
});
