import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSandboxTestSuite } from '../../../../../workspaces/_test-utils/src/sandbox/factory';

import { RequestContext } from '../../request-context';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import { IsolationUnavailableError } from './errors';
import { LocalSandbox, MARKER_DIR } from './local-sandbox';
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
        .update(JSON.stringify({ readWritePaths: [], readOnlyPaths: [] }))
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
        .update(JSON.stringify({ readWritePaths: [], readOnlyPaths: [] }))
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
  // Mount Operations (symlink-only)
  // ===========================================================================
  describe.skipIf(os.platform() === 'win32')('mount operations', () => {
    let mountSandbox: LocalSandbox;
    let mountDir: string;

    function makeMockLocalFs(basePath: string, overrides: Partial<WorkspaceFilesystem> = {}): WorkspaceFilesystem {
      return {
        id: 'test-local',
        name: 'MockLocalFilesystem',
        provider: 'local',
        getMountConfig: () => ({ type: 'local' as const, basePath }),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        deleteFile: vi.fn(),
        listFiles: vi.fn(),
        stat: vi.fn(),
        exists: vi.fn(),
        getInstructions: vi.fn(),
        init: vi.fn(),
        ...overrides,
      } as WorkspaceFilesystem;
    }

    beforeEach(async () => {
      mountDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-mount-test-'));
      mountSandbox = new LocalSandbox({ workingDirectory: mountDir });
      await mountSandbox._start();
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      try {
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
      // Create a source directory with a file
      const sourceDir = path.join(mountDir, 'local-source');
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'hello from local');

      const mountPath = '/local-data';
      const result = await mountSandbox.mount(makeMockLocalFs(sourceDir), mountPath);

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

    it('should reject invalid mount paths', async () => {
      const sourceDir = path.join(mountDir, 'src');
      await fs.mkdir(sourceDir, { recursive: true });
      const mockFs = makeMockLocalFs(sourceDir);

      await expect(mountSandbox.mount(mockFs, 'relative/path')).rejects.toThrow('Invalid mount path');
      await expect(mountSandbox.mount(mockFs, '/tmp/bad path')).rejects.toThrow('Invalid mount path');
      await expect(mountSandbox.mount(mockFs, '/')).rejects.toThrow('Invalid mount path');
    });

    it('should reject mount paths with path traversal segments', async () => {
      const sourceDir = path.join(mountDir, 'src');
      await fs.mkdir(sourceDir, { recursive: true });
      const mockFs = makeMockLocalFs(sourceDir);

      await expect(mountSandbox.mount(mockFs, '/data/../etc')).rejects.toThrow('Path segments cannot be "." or ".."');
      await expect(mountSandbox.mount(mockFs, '/./data')).rejects.toThrow('Path segments cannot be "." or ".."');
      await expect(mountSandbox.mount(mockFs, '/..')).rejects.toThrow('Path segments cannot be "." or ".."');
    });

    it('should return error for unsupported mount type', async () => {
      const mountPath = '/ftp-data';
      const result = await mountSandbox.mount(
        {
          ...makeMockLocalFs('/tmp'),
          id: 'test-unknown',
          provider: 'unknown',
          getMountConfig: () => ({ type: 'ftp' }),
        } as any,
        mountPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported mount type');
    });

    it('should return error when filesystem has no mount config', async () => {
      const mountPath = '/local';
      const result = await mountSandbox.mount(
        {
          ...makeMockLocalFs('/tmp'),
          id: 'test-no-config',
          provider: 'local',
          getMountConfig: undefined,
        } as any,
        mountPath,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not provide a mount config');
    });

    it('should reject non-empty directories', async () => {
      // Pre-create a non-empty directory under working directory
      const hostDir = path.join(mountDir, 'nonempty');
      await fs.mkdir(hostDir, { recursive: true });
      await fs.writeFile(path.join(hostDir, 'existing.txt'), 'content');

      const sourceDir = path.join(mountDir, 'src-nonempty');
      await fs.mkdir(sourceDir, { recursive: true });

      const result = await mountSandbox.mount(makeMockLocalFs(sourceDir), '/nonempty');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not empty');
    });

    it('should detect existing symlink mounts (local) with matching config', async () => {
      const mountPath = '/local-data';
      const hostPath = path.join(mountDir, 'local-data');
      const basePath = path.join(mountDir, 'source-dir');
      const config = { type: 'local' as const, basePath };

      // Create source directory and symlink (simulating a previous mount)
      await fs.mkdir(basePath, { recursive: true });
      await fs.writeFile(path.join(basePath, 'test.txt'), 'hello');
      await fs.symlink(basePath, hostPath);

      // Write a matching marker file
      const markerFilename = mountSandbox.mounts.markerFilename(hostPath);
      const configHash = mountSandbox.mounts.computeConfigHash(config);
      await fs.mkdir(MARKER_DIR, { recursive: true });
      await fs.writeFile(path.join(MARKER_DIR, markerFilename), `${hostPath}|${configHash}`);

      try {
        const result = await mountSandbox.mount(makeMockLocalFs(basePath), mountPath);
        expect(result.success).toBe(true);
        // Symlink should still point to the source
        const target = await fs.readlink(hostPath);
        expect(target).toBe(basePath);
      } finally {
        await fs.unlink(path.join(MARKER_DIR, markerFilename)).catch(() => {});
        await fs.unlink(hostPath).catch(() => {});
      }
    });

    it('should refuse to replace a foreign symlink (no marker file)', async () => {
      const mountPath = '/foreign-link';
      const hostPath = path.join(mountDir, 'foreign-link');
      const foreignTarget = path.join(mountDir, 'foreign-target');
      const ourBasePath = path.join(mountDir, 'our-target');

      // Create a symlink that someone else made (no marker file)
      await fs.mkdir(foreignTarget, { recursive: true });
      await fs.symlink(foreignTarget, hostPath);

      try {
        const result = await mountSandbox.mount(makeMockLocalFs(ourBasePath), mountPath);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not created by Mastra');
      } finally {
        await fs.unlink(hostPath).catch(() => {});
      }
    });

    it('should not remove symlink target directory on unmount', async () => {
      const sourceDir = path.join(mountDir, 'source-persist');
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'important.txt'), 'do not delete');

      const mountPath = '/persist-test';
      const hostPath = path.join(mountDir, 'persist-test');

      const result = await mountSandbox.mount(makeMockLocalFs(sourceDir), mountPath);
      expect(result.success).toBe(true);

      // Unmount — should remove the symlink, NOT the source directory
      await mountSandbox.unmount(mountPath);

      // Symlink should be gone
      await expect(fs.lstat(hostPath)).rejects.toThrow();
      // Source directory and its contents should be intact
      const content = await fs.readFile(path.join(sourceDir, 'important.txt'), 'utf-8');
      expect(content).toBe('do not delete');
    });

    it('should write marker file with correct format after successful mount', async () => {
      const sourceDir = path.join(mountDir, 'marker-source');
      await fs.mkdir(sourceDir, { recursive: true });

      const mountPath = '/marker-test';
      const hostPath = path.join(mountDir, 'marker-test');
      const config = { type: 'local' as const, basePath: sourceDir };

      const result = await mountSandbox.mount(makeMockLocalFs(sourceDir), mountPath);
      expect(result.success).toBe(true);

      // Read and verify marker file
      const markerFilename = mountSandbox.mounts.markerFilename(hostPath);
      const markerPath = path.join(MARKER_DIR, markerFilename);

      try {
        const content = await fs.readFile(markerPath, 'utf-8');
        const parsed = mountSandbox.mounts.parseMarkerContent(content.trim());
        expect(parsed).not.toBeNull();
        expect(parsed!.path).toBe(hostPath);
        // Config hash should match what we'd compute for the same config
        const expectedHash = mountSandbox.mounts.computeConfigHash(config);
        expect(parsed!.configHash).toBe(expectedHash);
      } finally {
        await fs.unlink(markerPath).catch(() => {});
      }
    });

    it('should remount when our marker exists but config hash differs (symlink)', async () => {
      const mountPath = '/local-data';
      const hostPath = path.join(mountDir, 'local-data');
      const oldBasePath = path.join(mountDir, 'old-source');
      const newBasePath = path.join(mountDir, 'new-source');
      const oldConfig = { type: 'local' as const, basePath: oldBasePath };

      // Create both source directories
      await fs.mkdir(oldBasePath, { recursive: true });
      await fs.mkdir(newBasePath, { recursive: true });
      await fs.writeFile(path.join(newBasePath, 'new.txt'), 'new content');

      // Simulate previous mount: symlink + marker with old config
      await fs.symlink(oldBasePath, hostPath);
      const markerFilename = mountSandbox.mounts.markerFilename(hostPath);
      const oldHash = mountSandbox.mounts.computeConfigHash(oldConfig);
      await fs.mkdir(MARKER_DIR, { recursive: true });
      await fs.writeFile(path.join(MARKER_DIR, markerFilename), `${hostPath}|${oldHash}`);

      try {
        const result = await mountSandbox.mount(makeMockLocalFs(newBasePath), mountPath);
        expect(result.success).toBe(true);

        // Symlink should now point to the new source
        const target = await fs.readlink(hostPath);
        expect(target).toBe(newBasePath);

        // New content should be accessible
        const content = await fs.readFile(path.join(hostPath, 'new.txt'), 'utf-8');
        expect(content).toBe('new content');
      } finally {
        await fs.unlink(path.join(MARKER_DIR, markerFilename)).catch(() => {});
        await fs.unlink(hostPath).catch(() => {});
      }
    });

    it('should resolve mount paths under workingDirectory only', () => {
      const hostPath = mountSandbox['resolveHostPath']('/local');
      expect(hostPath).toBe(path.join(mountDir, 'local'));

      const nestedPath = mountSandbox['resolveHostPath']('/deep/nested/mount');
      expect(nestedPath).toBe(path.join(mountDir, 'deep/nested/mount'));

      // Leading slashes are stripped — paths always resolve under workingDirectory
      const multiSlash = mountSandbox['resolveHostPath']('///triple');
      expect(multiSlash).toBe(path.join(mountDir, 'triple'));
    });

    it('should handle unmount of non-existent mount path gracefully', async () => {
      // Unmounting a path that was never mounted should not throw
      await expect(mountSandbox.unmount('/never-mounted')).resolves.not.toThrow();
    });

    it('should unmount all active symlink mounts on stop()', async () => {
      const sourceA = path.join(mountDir, 'src-a');
      const sourceB = path.join(mountDir, 'src-b');
      await fs.mkdir(sourceA, { recursive: true });
      await fs.mkdir(sourceB, { recursive: true });

      await mountSandbox.mount(makeMockLocalFs(sourceA, { id: 'a' }), '/mount-a');
      await mountSandbox.mount(makeMockLocalFs(sourceB, { id: 'b' }), '/mount-b');

      expect(mountSandbox['_activeMountPaths'].size).toBe(2);

      await mountSandbox._stop();
      expect(mountSandbox['_activeMountPaths'].size).toBe(0);

      // Symlinks should be cleaned up
      await expect(fs.lstat(path.join(mountDir, 'mount-a'))).rejects.toThrow();
      await expect(fs.lstat(path.join(mountDir, 'mount-b'))).rejects.toThrow();
    });

    it('should unmount all active symlink mounts on destroy()', async () => {
      const source = path.join(mountDir, 'src-destroy');
      await fs.mkdir(source, { recursive: true });

      await mountSandbox.mount(makeMockLocalFs(source), '/destroy-mount');

      expect(mountSandbox['_activeMountPaths'].size).toBe(1);

      await mountSandbox._destroy();
      expect(mountSandbox['_activeMountPaths'].size).toBe(0);
    });

    it('should add mount path to seatbelt isolation readWritePaths', async () => {
      if (os.platform() !== 'darwin') return;

      const seatbeltSandbox = new LocalSandbox({
        workingDirectory: mountDir,
        isolation: 'seatbelt',
      });
      await seatbeltSandbox._start();

      const source = path.join(mountDir, 'seatbelt-source');
      await fs.mkdir(source, { recursive: true });

      const mountPath = '/seatbelt-test';
      await seatbeltSandbox.mount(makeMockLocalFs(source), mountPath);

      const info = await seatbeltSandbox.getInfo();
      const isoConfig = info.metadata?.isolationConfig as { readWritePaths?: string[] } | undefined;
      // Isolation allowlist uses the resolved host path
      expect(isoConfig?.readWritePaths).toEqual(expect.arrayContaining([path.join(mountDir, 'seatbelt-test')]));

      await seatbeltSandbox._destroy();
    });

    it('should block mounting over a regular file', async () => {
      const mountPath = '/file-conflict';
      const hostPath = path.join(mountDir, 'file-conflict');
      await fs.writeFile(hostPath, 'i am a file');

      const source = path.join(mountDir, 'src-conflict');
      await fs.mkdir(source, { recursive: true });

      const result = await mountSandbox.mount(makeMockLocalFs(source), mountPath);

      expect(result.success).toBe(false);

      // The file should still be intact
      const content = await fs.readFile(hostPath, 'utf-8');
      expect(content).toBe('i am a file');
    });

    it('should not mount over a non-empty directory with hidden files', async () => {
      const mountPath = '/hidden-files';
      const hostPath = path.join(mountDir, 'hidden-files');
      await fs.mkdir(hostPath, { recursive: true });
      await fs.writeFile(path.join(hostPath, '.hidden'), 'secret');

      const source = path.join(mountDir, 'src-hidden');
      await fs.mkdir(source, { recursive: true });

      const result = await mountSandbox.mount(makeMockLocalFs(source), mountPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not empty');

      // Hidden file should still be there
      const content = await fs.readFile(path.join(hostPath, '.hidden'), 'utf-8');
      expect(content).toBe('secret');
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
