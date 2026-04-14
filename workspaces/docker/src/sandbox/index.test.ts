/**
 * Docker Sandbox Provider Tests
 *
 * Tests Docker-specific functionality including:
 * - Constructor options and ID generation
 * - Race condition prevention in start()
 * - Container lifecycle (start, stop, destroy)
 * - Reconnection to existing containers
 * - Image pulling
 * - Environment variable handling
 * - Volume mount configuration
 * - Label management
 * - Process management
 * - Instructions and info
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { createSandboxLifecycleTests } from '@internal/workspace-test-utils';
import { SandboxNotReadyError } from '@mastra/core/workspace';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

import { DockerSandbox } from './index';

// =============================================================================
// Mock Setup
// =============================================================================

const { mockContainer, mockExec, mockDocker, resetMockDefaults } = vi.hoisted(() => {
  const mockStream = {
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };

  const mockExec = {
    id: 'exec-123',
    start: vi.fn().mockResolvedValue(mockStream),
    inspect: vi.fn().mockResolvedValue({
      Running: false,
      ExitCode: 0,
      Pid: 42,
    }),
  };

  const mockContainer = {
    id: 'container-abc123',
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({
      Id: 'container-abc123',
      Name: '/mastra-sandbox',
      Created: '2024-01-01T00:00:00.000Z',
      State: { Status: 'running', Running: true },
    }),
    exec: vi.fn().mockResolvedValue(mockExec),
  };

  const mockFollowProgress = vi.fn((_stream: any, onFinish: (err: Error | null) => void) => {
    onFinish(null);
  });

  const mockDocker = {
    createContainer: vi.fn().mockResolvedValue(mockContainer),
    getContainer: vi.fn().mockReturnValue(mockContainer),
    getImage: vi.fn().mockReturnValue({
      inspect: vi.fn().mockResolvedValue({}),
    }),
    pull: vi.fn().mockResolvedValue({}),
    listContainers: vi.fn().mockResolvedValue([]),
    modem: {
      followProgress: mockFollowProgress,
    },
  };

  const resetMockDefaults = () => {
    mockContainer.start.mockReset().mockResolvedValue(undefined);
    mockContainer.stop.mockReset().mockResolvedValue(undefined);
    mockContainer.remove.mockReset().mockResolvedValue(undefined);
    mockContainer.inspect.mockReset().mockResolvedValue({
      Id: 'container-abc123',
      Name: '/mastra-sandbox',
      Created: '2024-01-01T00:00:00.000Z',
      State: { Status: 'running', Running: true },
    });
    mockContainer.exec.mockReset().mockResolvedValue(mockExec);
    mockDocker.createContainer.mockReset().mockResolvedValue(mockContainer);
    mockDocker.getContainer.mockReset().mockReturnValue(mockContainer);
    mockDocker.getImage.mockReset().mockReturnValue({
      inspect: vi.fn().mockResolvedValue({}),
    });
    mockDocker.pull.mockReset().mockResolvedValue({});
    mockDocker.listContainers.mockReset().mockResolvedValue([]);
    mockFollowProgress.mockReset().mockImplementation((_stream: any, onFinish: (err: Error | null) => void) => {
      onFinish(null);
    });
    mockExec.start.mockReset().mockResolvedValue(mockStream);
    mockExec.inspect.mockReset().mockResolvedValue({
      Running: false,
      ExitCode: 0,
      Pid: 42,
    });
    mockStream.on.mockReset();
    mockStream.write.mockReset();
  };

  return { mockContainer, mockExec, mockStream, mockDocker, resetMockDefaults };
});

vi.mock('dockerode', () => {
  // dockerode exports a class via default export — must be callable with `new`
  function MockDocker() {
    return mockDocker;
  }
  return { default: MockDocker };
});

// =============================================================================
// Tests
// =============================================================================

describe('DockerSandbox', () => {
  beforeEach(() => {
    resetMockDefaults();
  });

  // ---------------------------------------------------------------------------
  // Constructor & Options
  // ---------------------------------------------------------------------------

  describe('constructor', () => {
    it('should use default options', () => {
      const sandbox = new DockerSandbox();
      expect(sandbox.id).toMatch(/^docker-sandbox-/);
      expect(sandbox.name).toBe('DockerSandbox');
      expect(sandbox.provider).toBe('docker');
      expect(sandbox.status).toBe('pending');
    });

    it('should use provided id', () => {
      const sandbox = new DockerSandbox({ id: 'my-sandbox' });
      expect(sandbox.id).toBe('my-sandbox');
    });

    it('should generate unique IDs', () => {
      const sandbox1 = new DockerSandbox();
      const sandbox2 = new DockerSandbox();
      expect(sandbox1.id).not.toBe(sandbox2.id);
    });

    it('should accept custom options', () => {
      const sandbox = new DockerSandbox({
        image: 'python:3.12-slim',
        workingDir: '/app',
        env: { NODE_ENV: 'test' },
        network: 'my-network',
        privileged: true,
        labels: { team: 'platform' },
      });
      expect(sandbox.id).toMatch(/^docker-sandbox-/);
    });

    it('should have processes manager', () => {
      const sandbox = new DockerSandbox();
      expect(sandbox.processes).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle: Race condition prevention
  // ---------------------------------------------------------------------------

  describe('race condition prevention', () => {
    it('should return the same promise for concurrent _start() calls', async () => {
      const sandbox = new DockerSandbox();

      const p1 = sandbox._start();
      const p2 = sandbox._start();

      await Promise.all([p1, p2]);

      // Only one container should have been created
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
    });

    it('should be idempotent — second _start() after completion is a no-op', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
    });

    it('should transition status from pending to running', async () => {
      const sandbox = new DockerSandbox();
      expect(sandbox.status).toBe('pending');

      await sandbox._start();
      expect(sandbox.status).toBe('running');
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle: Start
  // ---------------------------------------------------------------------------

  describe('start', () => {
    it('should create and start a container', async () => {
      const sandbox = new DockerSandbox({ image: 'node:22-slim' });
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'node:22-slim',
          Cmd: ['sleep', 'infinity'],
          WorkingDir: '/workspace',
          Tty: false,
          OpenStdin: true,
        }),
      );
      expect(mockContainer.start).toHaveBeenCalled();
      expect(sandbox.status).toBe('running');
    });

    it('should include environment variables', async () => {
      const sandbox = new DockerSandbox({
        env: { NODE_ENV: 'test', API_KEY: 'secret' },
      });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.Env).toEqual(expect.arrayContaining(['NODE_ENV=test', 'API_KEY=secret']));
    });

    it('should include bind mounts', async () => {
      const sandbox = new DockerSandbox({
        volumes: { '/host/data': '/container/data', '/host/config': '/container/config' },
      });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.HostConfig.Binds).toEqual(
        expect.arrayContaining(['/host/data:/container/data', '/host/config:/container/config']),
      );
    });

    it('should set network mode', async () => {
      const sandbox = new DockerSandbox({ network: 'my-network' });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.HostConfig.NetworkMode).toBe('my-network');
    });

    it('should set privileged mode', async () => {
      const sandbox = new DockerSandbox({ privileged: true });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.HostConfig.Privileged).toBe(true);
    });

    it('should include labels with mastra metadata', async () => {
      const sandbox = new DockerSandbox({
        id: 'test-sandbox',
        labels: { team: 'platform' },
      });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.Labels).toEqual({
        'mastra.sandbox': 'true',
        'mastra.sandbox.id': 'test-sandbox',
        team: 'platform',
      });
    });

    it('should pull image if not available locally', async () => {
      mockDocker.getImage.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(new Error('No such image')),
      });

      const sandbox = new DockerSandbox({ image: 'custom:latest' });
      await sandbox._start();

      expect(mockDocker.pull).toHaveBeenCalledWith('custom:latest');
      expect(mockDocker.createContainer).toHaveBeenCalled();
    });

    it('should not pull image if already available', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      expect(mockDocker.pull).not.toHaveBeenCalled();
    });

    it('should throw on image pull failure', async () => {
      mockDocker.getImage.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(new Error('No such image')),
      });
      mockDocker.pull.mockRejectedValue(new Error('unauthorized'));

      const sandbox = new DockerSandbox({ image: 'private:latest' });
      await expect(sandbox._start()).rejects.toThrow("Failed to pull Docker image 'private:latest'");
    });

    it('should use custom command', async () => {
      const sandbox = new DockerSandbox({
        command: ['tail', '-f', '/dev/null'],
      });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.Cmd).toEqual(['tail', '-f', '/dev/null']);
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle: Reconnection
  // ---------------------------------------------------------------------------

  describe('reconnection', () => {
    it('should reconnect to existing running container', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);

      const sandbox = new DockerSandbox({ id: 'existing-sandbox' });
      await sandbox._start();

      // Should NOT create a new container
      expect(mockDocker.createContainer).not.toHaveBeenCalled();
      // Should get the existing container
      expect(mockDocker.getContainer).toHaveBeenCalledWith('existing-container-id');
      expect(sandbox.status).toBe('running');
    });

    it('should start a stopped container on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'stopped-container-id', State: 'exited' }]);
      // Mock inspect to return stopped state
      mockContainer.inspect.mockResolvedValue({
        Id: 'stopped-container-id',
        State: { Status: 'exited', Running: false },
      });

      const sandbox = new DockerSandbox({ id: 'stopped-sandbox' });
      await sandbox._start();

      expect(mockDocker.createContainer).not.toHaveBeenCalled();
      expect(mockDocker.getContainer).toHaveBeenCalledWith('stopped-container-id');
      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('should search by label filter', async () => {
      const sandbox = new DockerSandbox({ id: 'label-sandbox' });
      await sandbox._start();

      expect(mockDocker.listContainers).toHaveBeenCalledWith({
        all: true,
        filters: {
          label: ['mastra.sandbox.id=label-sandbox'],
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle: Stop
  // ---------------------------------------------------------------------------

  describe('stop', () => {
    it('should stop the container with graceful timeout', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();
      await sandbox._stop();

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
    });

    it('should handle already stopped container', async () => {
      mockContainer.stop.mockRejectedValue(new Error('container already stopped'));

      const sandbox = new DockerSandbox();
      await sandbox._start();
      // Should not throw
      await sandbox._stop();
    });

    it('should be a no-op if container not started', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._stop();
      expect(mockContainer.stop).not.toHaveBeenCalled();
    });

    it('should clear process list after stop', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      // Spawn a process so the list is non-empty
      await sandbox.processes!.spawn('echo hello');
      let list = await sandbox.processes!.list();
      expect(list.length).toBe(1);

      await sandbox._stop();

      list = await sandbox.processes!.list();
      expect(list.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle: Destroy
  // ---------------------------------------------------------------------------

  describe('destroy', () => {
    it('should force remove the container', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();
      await sandbox._destroy();

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true, v: true });
    });

    it('should handle already removed container', async () => {
      mockContainer.remove.mockRejectedValue(new Error('no such container'));

      const sandbox = new DockerSandbox();
      await sandbox._start();
      // Should not throw
      await sandbox._destroy();
    });

    it('should be a no-op if container not started', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._destroy();
      expect(mockContainer.remove).not.toHaveBeenCalled();
    });

    it('should clear process list after destroy', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      // Spawn a process so the list is non-empty
      await sandbox.processes!.spawn('echo hello');
      const list = await sandbox.processes!.list();
      expect(list.length).toBe(1);

      await sandbox._destroy();

      // After destroy, list() would trigger ensureRunning() which re-starts the sandbox.
      // Verify the tracked map was cleared directly via the process manager.
      expect((sandbox.processes as any)._tracked.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Process management
  // ---------------------------------------------------------------------------

  describe('process management', () => {
    it('should have a process manager available after construction', () => {
      const sandbox = new DockerSandbox();
      expect(sandbox.processes).toBeDefined();
      expect(typeof sandbox.processes!.spawn).toBe('function');
      expect(typeof sandbox.processes!.list).toBe('function');
    });

    it('should create an exec instance when spawning', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      await sandbox.processes!.spawn('echo hello');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['sh', '-c', 'echo hello'],
          AttachStdout: true,
          AttachStderr: true,
          AttachStdin: true,
          Tty: false,
        }),
      );
      expect(mockExec.start).toHaveBeenCalledWith({ hijack: true, stdin: true });
    });

    it('should pass per-spawn environment variables', async () => {
      const sandbox = new DockerSandbox({ env: { GLOBAL: 'yes' } });
      await sandbox._start();

      await sandbox.processes!.spawn('echo hello', { env: { LOCAL: 'yes' } });

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: expect.arrayContaining(['GLOBAL=yes', 'LOCAL=yes']),
        }),
      );
    });

    it('should pass cwd option as WorkingDir', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      await sandbox.processes!.spawn('ls', { cwd: '/tmp' });

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          WorkingDir: '/tmp',
        }),
      );
    });

    it('should use process group kill (negative PID)', async () => {
      mockExec.inspect.mockResolvedValue({
        Running: true,
        ExitCode: null,
        Pid: 42,
      });

      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');

      // Reset the mock to capture the kill exec call
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: vi.fn().mockResolvedValue(undefined),
      });

      await handle.kill();

      // The second exec call should be the kill command with negative PID
      const killCall = mockContainer.exec.mock.calls[1]?.[0];
      expect(killCall.Cmd).toEqual(['sh', '-c', 'kill -9 -42 2>/dev/null || kill -9 42']);
    });

    it('should track spawned processes in list()', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      await sandbox.processes!.spawn('echo hello');
      const list = await sandbox.processes!.list();

      expect(list.length).toBe(1);
      expect(list[0]!.pid).toBe('exec-123');
    });
  });

  // ---------------------------------------------------------------------------
  // Instructions
  // ---------------------------------------------------------------------------

  describe('getInstructions', () => {
    it('should return default instructions', () => {
      const sandbox = new DockerSandbox({ image: 'python:3.12' });
      const instructions = sandbox.getInstructions();
      expect(instructions).toContain('Docker container');
      expect(instructions).toContain('python:3.12');
      expect(instructions).toContain('/workspace');
    });

    it('should use string override', () => {
      const sandbox = new DockerSandbox({
        instructions: 'Custom instructions',
      });
      expect(sandbox.getInstructions()).toBe('Custom instructions');
    });

    it('should use function override', () => {
      const sandbox = new DockerSandbox({
        instructions: ({ defaultInstructions }) => `${defaultInstructions}\nExtra info.`,
      });
      const instructions = sandbox.getInstructions();
      expect(instructions).toContain('Docker container');
      expect(instructions).toContain('Extra info.');
    });

    it('should suppress with empty string', () => {
      const sandbox = new DockerSandbox({ instructions: '' });
      expect(sandbox.getInstructions()).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Info
  // ---------------------------------------------------------------------------

  describe('getInfo', () => {
    it('should return basic info before start', async () => {
      const sandbox = new DockerSandbox({ id: 'info-test' });
      const info = await sandbox.getInfo();

      expect(info.id).toBe('info-test');
      expect(info.name).toBe('DockerSandbox');
      expect(info.provider).toBe('docker');
      expect(info.metadata).toEqual(
        expect.objectContaining({
          image: 'node:22-slim',
          workingDir: '/workspace',
        }),
      );
    });

    it('should include container info after start', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.metadata).toEqual(
        expect.objectContaining({
          containerId: 'container-abc123',
          containerName: '/mastra-sandbox',
          state: 'running',
        }),
      );
    });

    it('should include image in metadata', async () => {
      const sandbox = new DockerSandbox({ image: 'python:3.12' });
      const info = await sandbox.getInfo();

      expect((info.metadata as any).image).toBe('python:3.12');
    });
  });

  // ---------------------------------------------------------------------------
  // Container access
  // ---------------------------------------------------------------------------

  describe('container access', () => {
    it('should throw SandboxNotReadyError before start', () => {
      const sandbox = new DockerSandbox();
      expect(() => sandbox.container).toThrow(SandboxNotReadyError);
    });

    it('should return container after start', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();
      expect(sandbox.container).toBe(mockContainer);
    });
  });
});

// =============================================================================
// Provider Descriptor Tests
// =============================================================================

describe('dockerSandboxProvider', () => {
  it('should have correct metadata', async () => {
    const { dockerSandboxProvider } = await import('../provider');
    expect(dockerSandboxProvider.id).toBe('docker');
    expect(dockerSandboxProvider.name).toBe('Docker Sandbox');
    expect(dockerSandboxProvider.description).toBeDefined();
  });

  it('should create a DockerSandbox instance', async () => {
    const { dockerSandboxProvider } = await import('../provider');
    const sandbox = dockerSandboxProvider.createSandbox({
      image: 'node:22-slim',
    });
    expect(sandbox).toBeInstanceOf(DockerSandbox);
  });

  it('should have config schema', async () => {
    const { dockerSandboxProvider } = await import('../provider');
    expect(dockerSandboxProvider.configSchema).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.image).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.timeout).toBeDefined();
  });
});

// =============================================================================
// Shared Conformance Tests
// =============================================================================

/**
 * Shared conformance tests from _test-utils.
 * These validate that DockerSandbox conforms to the WorkspaceSandbox contract.
 */
describe('DockerSandbox Shared Conformance', () => {
  let sandbox: DockerSandbox;

  beforeAll(async () => {
    sandbox = new DockerSandbox({ id: `conformance-${Date.now()}` });
    await sandbox._start();
  });

  afterAll(async () => {
    await sandbox._destroy();
  });

  const getContext = () => ({
    sandbox: sandbox as any,
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      defaultCommandTimeout: 300_000,
      supportsStreaming: true,
      supportsStdin: true,
    },
    testTimeout: 5000,
    fastOnly: true,
    createSandbox: () => new DockerSandbox(),
  });

  createSandboxLifecycleTests(getContext);
});
