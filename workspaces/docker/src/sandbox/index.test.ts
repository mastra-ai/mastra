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

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createSandboxLifecycleTests } from '@internal/workspace-test-utils';
import { SandboxAbortError, SandboxError, SandboxNotReadyError } from '@mastra/core/workspace';
import { extract as tarExtract } from 'tar-stream';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

import { DockerSandbox } from './index';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const naturalExitChild = fileURLToPath(new URL('./fixtures/kill-helper-natural-exit-child.mts', import.meta.url));

// =============================================================================
// Mock Setup
// =============================================================================

const { mockContainer, mockExec, mockStream, mockDocker, resetMockDefaults } = vi.hoisted(() => {
  const mockStream = {
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
    writableEnded: false,
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
    putArchive: vi.fn().mockResolvedValue(undefined),
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
    mockContainer.putArchive.mockReset().mockResolvedValue(undefined);
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
    mockStream.destroy.mockReset();
    mockStream.writableEnded = false;
    mockStream.end.mockReset().mockImplementation((callback?: () => void) => {
      mockStream.writableEnded = true;
      callback?.();
    });
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

    it('uses workingDirectory as the container WorkingDir', async () => {
      const sandbox = new DockerSandbox({ workingDirectory: '/srv/app' });
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledWith(expect.objectContaining({ WorkingDir: '/srv/app' }));
      expect(sandbox.workingDirectory).toBe('/srv/app');
    });

    it('workingDirectory wins over the deprecated workingDir alias', async () => {
      const sandbox = new DockerSandbox({ workingDirectory: '/srv/app', workingDir: '/legacy' });
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledWith(expect.objectContaining({ WorkingDir: '/srv/app' }));
      expect(sandbox.workingDirectory).toBe('/srv/app');
    });

    it('the deprecated workingDir alias still applies', async () => {
      const sandbox = new DockerSandbox({ workingDir: '/legacy' });
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledWith(expect.objectContaining({ WorkingDir: '/legacy' }));
      expect(sandbox.workingDirectory).toBe('/legacy');
    });

    it('defaults to /workspace when neither option is set', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledWith(expect.objectContaining({ WorkingDir: '/workspace' }));
      expect(sandbox.workingDirectory).toBe('/workspace');
    });

    describe('template option', () => {
      const fakeTemplate = (overrides: Partial<{ workdir: string; status: 'ready' | 'failed' }> = {}) =>
        ({
          workdir: overrides.workdir,
          build: vi.fn(async () => ({
            status: overrides.status ?? 'ready',
            templateId: 'mastra-template:abc',
            error: overrides.status === 'failed' ? 'step failed' : undefined,
          })),
        }) as unknown as import('../template/template').DockerTemplate;

      it('rejects image and template together', () => {
        expect(() => new DockerSandbox({ image: 'x', template: fakeTemplate() })).toThrow(/mutually exclusive/);
      });

      it('builds the template on start and boots from its image, adopting its workdir', async () => {
        const template = fakeTemplate({ workdir: '/srv/repo' });
        const sandbox = new DockerSandbox({ template });
        await sandbox._start();

        expect(template.build).toHaveBeenCalledTimes(1);
        // Built on the sandbox's own daemon, not whatever the template defaulted to.
        expect(template.build).toHaveBeenCalledWith({ docker: mockDocker });
        expect(mockDocker.createContainer).toHaveBeenCalledWith(
          expect.objectContaining({ Image: 'mastra-template:abc', WorkingDir: '/srv/repo' }),
        );
        expect(sandbox.workingDirectory).toBe('/srv/repo');
      });

      it('keeps an explicit workingDirectory over the template workdir', async () => {
        const sandbox = new DockerSandbox({ template: fakeTemplate({ workdir: '/srv/repo' }), workingDirectory: '/x' });
        await sandbox._start();
        expect(mockDocker.createContainer).toHaveBeenCalledWith(expect.objectContaining({ WorkingDir: '/x' }));
      });

      it('resolves a template function on each container-creating start', async () => {
        const resolver = vi.fn(async () => fakeTemplate());
        const sandbox = new DockerSandbox({ template: resolver });
        await sandbox._start();
        expect(resolver).toHaveBeenCalledTimes(1);
      });

      it('fails start when the template build fails', async () => {
        const sandbox = new DockerSandbox({ template: fakeTemplate({ status: 'failed' }) });
        await expect(sandbox._start()).rejects.toThrow(/step failed/);
        expect(mockDocker.createContainer).not.toHaveBeenCalled();
      });
    });

    it('enables an init process (HostConfig.Init) by default to reap zombies', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({ HostConfig: expect.objectContaining({ Init: true }) }),
      );
    });

    it('allows disabling the init process via the init option', async () => {
      const sandbox = new DockerSandbox({ init: false });
      await sandbox._start();

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({ HostConfig: expect.objectContaining({ Init: false }) }),
      );
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

    it('should warn when privileged mode overlaps with capability or security options', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };
      const sandbox = new DockerSandbox({
        privileged: true,
        readonlyRootfs: true,
        capDrop: ['ALL'],
        capAdd: ['NET_BIND_SERVICE'],
        securityOpt: ['no-new-privileges:true'],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('capDrop, capAdd, securityOpt'),
        expect.objectContaining({
          fields: expect.arrayContaining(['capDrop', 'capAdd', 'securityOpt']),
          hostConfigFields: expect.arrayContaining(['CapDrop', 'CapAdd', 'SecurityOpt']),
        }),
      );
      expect(logger.warn.mock.calls.some(call => String(call[0]).includes('ReadonlyRootfs'))).toBe(false);
    });

    it('should not warn about privileged mode for empty capability or security options', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };
      const sandbox = new DockerSandbox({
        privileged: true,
        capDrop: [],
        capAdd: [],
        securityOpt: [],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should pass container hardening options to HostConfig', async () => {
      const sandbox = new DockerSandbox({
        memory: 512 * 1024 * 1024,
        memorySwap: 1024 * 1024 * 1024,
        cpuShares: 512,
        cpuQuota: 100_000,
        cpuPeriod: 100_000,
        pidsLimit: 256,
        readonlyRootfs: true,
        capDrop: ['ALL'],
        capAdd: ['NET_BIND_SERVICE'],
        securityOpt: ['no-new-privileges:true'],
        ulimits: [{ name: 'nofile', soft: 1024, hard: 2048 }],
        tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' },
      });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.HostConfig).toEqual(
        expect.objectContaining({
          Memory: 512 * 1024 * 1024,
          MemorySwap: 1024 * 1024 * 1024,
          CpuShares: 512,
          CpuQuota: 100_000,
          CpuPeriod: 100_000,
          PidsLimit: 256,
          ReadonlyRootfs: true,
          CapDrop: ['ALL'],
          CapAdd: ['NET_BIND_SERVICE'],
          SecurityOpt: ['no-new-privileges:true'],
          Ulimits: [{ Name: 'nofile', Soft: 1024, Hard: 2048 }],
          Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' },
        }),
      );
    });

    it('should map mounts to HostConfig.Mounts', async () => {
      const sandbox = new DockerSandbox({
        mounts: [
          {
            type: 'volume',
            source: 'project-data',
            target: '/work',
            readOnly: true,
            volumeOptions: { subpath: 'shared', noCopy: true, labels: { team: 'platform' } },
          },
          {
            type: 'bind',
            source: '/host/cache',
            target: '/cache',
            bindOptions: { propagation: 'rslave' },
          },
          {
            type: 'tmpfs',
            target: '/scratch',
            tmpfsOptions: { sizeBytes: 64 * 1024 * 1024, mode: 0o1777 },
          },
        ],
      });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.HostConfig.Mounts).toEqual([
        {
          Type: 'volume',
          Source: 'project-data',
          Target: '/work',
          ReadOnly: true,
          VolumeOptions: { Subpath: 'shared', NoCopy: true, Labels: { team: 'platform' } },
        },
        {
          Type: 'bind',
          Source: '/host/cache',
          Target: '/cache',
          BindOptions: { Propagation: 'rslave' },
        },
        {
          Type: 'tmpfs',
          Source: '',
          Target: '/scratch',
          TmpfsOptions: { SizeBytes: 64 * 1024 * 1024, Mode: 0o1777 },
        },
      ]);
    });

    it('should omit HostConfig.Mounts when no mounts are provided', async () => {
      const sandbox = new DockerSandbox({});
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.HostConfig.Mounts).toBeUndefined();
    });

    it('should pass both Binds and Mounts when volumes and mounts are combined', async () => {
      const sandbox = new DockerSandbox({
        volumes: { '/host/data': '/container/data' },
        mounts: [{ type: 'volume', source: 'vol', target: '/work', volumeOptions: { subpath: 'sub' } }],
      });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.HostConfig.Binds).toEqual(['/host/data:/container/data']);
      expect(createCall.HostConfig.Mounts).toEqual([
        { Type: 'volume', Source: 'vol', Target: '/work', VolumeOptions: { Subpath: 'sub' } },
      ]);
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

    it('should pass the sandbox id as the container name by default', async () => {
      const sandbox = new DockerSandbox({ id: 'test-sandbox' });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.name).toBe('test-sandbox');
    });

    it('should prefer an explicit name over the id', async () => {
      const sandbox = new DockerSandbox({ id: 'test-sandbox', name: 'custom-name' });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.name).toBe('custom-name');
    });

    it('should sanitize a name with characters Docker disallows', async () => {
      const sandbox = new DockerSandbox({ name: 'user/1001:dev' });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.name).toBe('user-1001-dev');
    });

    it('should prefix the name when it does not start with an alphanumeric', async () => {
      const sandbox = new DockerSandbox({ name: '-leading-dash' });
      await sandbox._start();

      const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
      expect(createCall.name).toBe('s--leading-dash');
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

    it('adopts the reconnected container working directory when none was given', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        Config: { WorkingDir: '/workspace/repo' },
      });

      const sandbox = new DockerSandbox({ id: 'existing-sandbox' });
      await sandbox._start();
      expect(sandbox.workingDirectory).toBe('/workspace/repo');

      const explicit = new DockerSandbox({ id: 'existing-sandbox', workingDirectory: '/custom' });
      await explicit._start();
      expect(explicit.workingDirectory).toBe('/custom');
    });

    it('should warn when requested hardening options differ on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Privileged: false,
          Memory: 256 * 1024 * 1024,
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        memory: 512 * 1024 * 1024,
        readonlyRootfs: true,
        capDrop: ['ALL'],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('requested Docker option(s) memory, readonlyRootfs, capDrop differ'),
        {
          containerId: 'existing-container-id',
          fields: ['memory', 'readonlyRootfs', 'capDrop'],
          hostConfigFields: ['Memory', 'ReadonlyRootfs', 'CapDrop'],
        },
      );
    });

    it('should warn about privileged capability options on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Privileged: true,
          CapDrop: ['ALL'],
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        privileged: true,
        capDrop: ['ALL'],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Privileged containers can bypass'), {
        fields: ['capDrop'],
        hostConfigFields: ['CapDrop'],
      });
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should warn when privileged is omitted but the reconnected container is privileged', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Privileged: true,
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({ id: 'existing-sandbox' });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'existing container is privileged, but this DockerSandbox did not request privileged mode',
        ),
        {
          containerId: 'existing-container-id',
          fields: ['privileged'],
          hostConfigFields: ['Privileged'],
        },
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should warn when privileged is disabled but the reconnected container is privileged', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Privileged: true,
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        privileged: false,
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('requested Docker option(s) privileged differ'),
        {
          containerId: 'existing-container-id',
          fields: ['privileged'],
          hostConfigFields: ['Privileged'],
        },
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should not warn when requested hardening options match on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Privileged: false,
          Memory: 512 * 1024 * 1024,
          ReadonlyRootfs: true,
          CapDrop: ['CAP_NET_RAW', 'ALL'],
          Ulimits: [{ Name: 'nofile', Soft: 1024, Hard: 2048 }],
          Tmpfs: { '/tmp': 'size=64m,rw' },
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        memory: 512 * 1024 * 1024,
        readonlyRootfs: true,
        capDrop: ['ALL', 'NET_RAW'],
        ulimits: [{ name: 'nofile', soft: 1024, hard: 2048 }],
        tmpfs: { '/tmp': 'rw,size=64m' },
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn when requested ulimits differ on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Ulimits: [{ Name: 'nofile', Soft: 1024, Hard: 2048 }],
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        ulimits: [{ name: 'nproc', soft: 1024, hard: 2048 }],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('requested Docker option(s) ulimits differ'), {
        containerId: 'existing-container-id',
        fields: ['ulimits'],
        hostConfigFields: ['Ulimits'],
      });
    });

    it('should warn when requested mounts differ on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Mounts: [{ Type: 'volume', Source: 'vol', Target: '/work', VolumeOptions: { Subpath: 'a' } }],
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        mounts: [{ type: 'volume', source: 'vol', target: '/work', volumeOptions: { subpath: 'b' } }],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('requested Docker option(s) mounts differ'), {
        containerId: 'existing-container-id',
        fields: ['mounts'],
        hostConfigFields: ['Mounts'],
      });
    });

    it('should not warn when requested mounts match on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          Mounts: [
            { Type: 'bind', Source: '/host/cache', Target: '/cache', BindOptions: { Propagation: 'rslave' } },
            { Type: 'volume', Source: 'vol', Target: '/work', VolumeOptions: { Subpath: 'shared' } },
          ],
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      // Requested in a different order than the inspected HostConfig to exercise normalization.
      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        mounts: [
          { type: 'volume', source: 'vol', target: '/work', volumeOptions: { subpath: 'shared' } },
          { type: 'bind', source: '/host/cache', target: '/cache', bindOptions: { propagation: 'rslave' } },
        ],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn when empty hardening collections reconnect to unset HostConfig fields', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          CapDrop: null,
          CapAdd: null,
          SecurityOpt: null,
          Ulimits: null,
          Tmpfs: null,
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        capDrop: [],
        capAdd: [],
        securityOpt: [],
        ulimits: [],
        tmpfs: {},
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn when Docker normalizes no-new-privileges separator on reconnect', async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: 'existing-container-id', State: 'running' }]);
      mockContainer.inspect.mockResolvedValue({
        Id: 'existing-container-id',
        State: { Status: 'running', Running: true },
        HostConfig: {
          SecurityOpt: ['no-new-privileges=true'],
        },
      });
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn(() => new Map()),
      };

      const sandbox = new DockerSandbox({
        id: 'existing-sandbox',
        securityOpt: ['no-new-privileges:true'],
      });
      (sandbox as any).__setLogger(logger);
      await sandbox._start();

      expect(logger.warn).not.toHaveBeenCalled();
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
          // Command is wrapped so it runs in its own process group; the user
          // command travels as the final positional arg.
          Cmd: [
            'sh',
            '-c',
            expect.stringContaining('setsid'),
            'sh',
            expect.stringMatching(/^\/tmp\/\.mastra-proc\//),
            'echo hello',
          ],
          AttachStdout: true,
          AttachStderr: true,
          AttachStdin: true,
          Tty: false,
        }),
      );
      expect(mockExec.start).toHaveBeenCalledWith({ hijack: true, stdin: true });
    });

    it('should close the writable side of the exec stream to signal EOF', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('cat');
      await handle.closeStdin();
      await handle.closeStdin();

      expect(mockStream.end).toHaveBeenCalledTimes(1);
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

    it('setEnv after construction reaches subsequent spawns', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'tok_1' }));
      await sandbox.processes!.spawn('echo hello');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: expect.arrayContaining(['GH_TOKEN=tok_1']),
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

    it('should leave kill and timeout flags unset for natural exits', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('echo hello');
      const waitPromise = handle.wait();

      const endHandler = mockStream.on.mock.calls.find(([event]) => event === 'end')?.[1] as () => Promise<void>;
      await endHandler();

      const result = await waitPromise;

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.killed).toBeUndefined();
      expect(result.timedOut).toBeUndefined();
    });

    it('should run each spawned command in its own process group via a unique pgid file', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      await sandbox.processes!.spawn('sleep 100');
      await sandbox.processes!.spawn('sleep 100');

      const firstCmd = mockContainer.exec.mock.calls[0]?.[0].Cmd as string[];
      const secondCmd = mockContainer.exec.mock.calls[1]?.[0].Cmd as string[];

      // Command is wrapped: ['sh', '-c', SPAWN_WRAPPER, 'sh', pgidFile, command]
      expect(firstCmd[0]).toBe('sh');
      expect(firstCmd[2]).toContain('setsid');
      expect(firstCmd[5]).toBe('sleep 100');

      const firstPgidFile = firstCmd[4];
      const secondPgidFile = secondCmd[4];
      expect(firstPgidFile).toMatch(/^\/tmp\/\.mastra-proc\//);
      // Each spawn gets a distinct pgid file so kill() targets only its own group
      expect(firstPgidFile).not.toEqual(secondPgidFile);
    });

    it('should kill by process group in the container PID namespace (not host PID)', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');

      const spawnCmd = mockContainer.exec.mock.calls[0]?.[0].Cmd as string[];
      const pgidFile = spawnCmd[4];

      // Capture the kill exec call
      const killStart = vi.fn().mockResolvedValue(undefined);
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: killStart,
        inspect: vi.fn().mockResolvedValue({ Running: false, ExitCode: 0 }),
      });

      const killed = await handle.kill();
      expect(killed).toBe(true);

      const killCall = mockContainer.exec.mock.calls[1]?.[0];
      expect(killCall.Cmd[0]).toBe('sh');
      expect(killCall.Cmd[1]).toBe('-c');
      const script = killCall.Cmd[2] as string;
      // The pgid file path is passed as a positional arg ($1), not interpolated,
      // so the script text is a static constant and the path travels in Cmd[4].
      expect(killCall.Cmd[4]).toBe(pgidFile);
      expect(pgidFile).not.toEqual('');
      // Signals the whole process group (negative PID) — kernel-enforced.
      expect(script).toContain('kill -STOP -"$pgid"');
      expect(script).toContain('kill -KILL -"$pgid"');
      expect(script).not.toContain('kill -9 -42');
      expect(killStart).toHaveBeenCalled();
    });

    it('should release the kill helper response stream after success', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');
      const helperResponse = { destroy: vi.fn() };
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: vi.fn().mockResolvedValue(helperResponse),
        inspect: vi.fn().mockResolvedValue({ Running: false, ExitCode: 0 }),
      });

      await expect(handle.kill()).resolves.toBe(true);

      expect(helperResponse.destroy).toHaveBeenCalledOnce();
    });

    it('should report kill failure (not a false "killed") when the helper exits non-zero', async () => {
      // Models the fail-closed guards in KILL_SCRIPT: when the PGID file is
      // unreadable/empty the helper exits 1 rather than 0. kill() must surface
      // that as false and must NOT mark the process killed or destroy the
      // stream — otherwise wait() would resolve with a bogus exit 137 while the
      // tree is still running (the exact bug this PR fixes).
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');

      // The kill helper exec runs but exits non-zero (unrecorded/empty PGID).
      const helperResponse = { destroy: vi.fn() };
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: vi.fn().mockResolvedValue(helperResponse),
        inspect: vi.fn().mockResolvedValue({ Running: false, ExitCode: 1 }),
      });

      const killed = await handle.kill();
      expect(killed).toBe(false);

      // Stream was not destroyed, so wait() has not been resolved by kill().
      expect(mockStream.destroy).not.toHaveBeenCalled();
      expect(helperResponse.destroy).toHaveBeenCalledOnce();
    });

    it('should release the kill helper response stream when inspection fails', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');
      const helperResponse = { destroy: vi.fn() };
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: vi.fn().mockResolvedValue(helperResponse),
        inspect: vi.fn().mockRejectedValue(new Error('inspect failed')),
      });

      await expect(handle.kill()).resolves.toBe(false);

      expect(helperResponse.destroy).toHaveBeenCalledOnce();
    });

    it('should release the kill helper response stream when polling fails', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');
      const helperResponse = { destroy: vi.fn() };
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: vi.fn().mockResolvedValue(helperResponse),
        inspect: vi.fn().mockResolvedValueOnce({ Running: true }).mockRejectedValueOnce(new Error('poll failed')),
      });

      await expect(handle.kill()).resolves.toBe(false);

      expect(helperResponse.destroy).toHaveBeenCalledOnce();
    });

    it('should preserve a successful kill result when response cleanup throws', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');
      const helperResponse = {
        destroy: vi.fn(() => {
          throw new Error('cleanup failed');
        }),
      };
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: vi.fn().mockResolvedValue(helperResponse),
        inspect: vi.fn().mockResolvedValue({ Running: false, ExitCode: 0 }),
      });

      await expect(handle.kill()).resolves.toBe(true);

      expect(helperResponse.destroy).toHaveBeenCalledOnce();
    });

    it('should preserve a failed kill result when response cleanup throws', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');
      const helperResponse = {
        destroy: vi.fn(() => {
          throw new Error('cleanup failed');
        }),
      };
      mockContainer.exec.mockResolvedValueOnce({
        id: 'kill-exec',
        start: vi.fn().mockResolvedValue(helperResponse),
        inspect: vi.fn().mockResolvedValue({ Running: false, ExitCode: 1 }),
      });

      await expect(handle.kill()).resolves.toBe(false);

      expect(helperResponse.destroy).toHaveBeenCalledOnce();
    });

    it.each(['without-stdin', 'with-stdin'] as const)(
      'should let a child process exit naturally after cleanup (%s)',
      async mode => {
        const child = spawn(process.execPath, ['--import', 'tsx', naturalExitChild, mode], {
          cwd: packageRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', chunk => {
          stderr += chunk;
        });

        const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`Natural-exit child timed out in ${mode} mode. stderr: ${stderr}`));
          }, 10000);
          child.once('error', error => {
            clearTimeout(timeout);
            reject(error);
          });
          child.once('close', (code, signal) => {
            clearTimeout(timeout);
            resolve({ code, signal });
          });
        });

        expect(exit).toEqual({ code: 0, signal: null });
        expect(stderr).toBe('');
      },
    );

    it('should mark explicit kill results as killed without timeout', async () => {
      const sandbox = new DockerSandbox();
      await sandbox._start();

      const handle = await sandbox.processes!.spawn('sleep 100');
      const waitPromise = handle.wait();
      await handle.kill();

      const closeHandler = mockStream.on.mock.calls.find(([event]) => event === 'close')?.[1] as () => void;
      closeHandler();

      const result = await waitPromise;

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(137);
      expect(result.killed).toBe(true);
      expect(result.timedOut).toBe(false);
    });

    it('should mark timeout results as killed and timed out', async () => {
      vi.useFakeTimers();
      try {
        const sandbox = new DockerSandbox();
        await sandbox._start();

        const handle = await sandbox.processes!.spawn('sleep 100', { timeout: 50 });
        const waitPromise = handle.wait();

        vi.advanceTimersByTime(50);

        const closeHandler = mockStream.on.mock.calls.find(([event]) => event === 'close')?.[1] as () => void;
        closeHandler();

        const result = await waitPromise;

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(137);
        expect(result.killed).toBe(true);
        expect(result.timedOut).toBe(true);
      } finally {
        vi.useRealTimers();
      }
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
  beforeEach(() => {
    resetMockDefaults();
  });

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

  it('should create a DockerSandbox instance with hardening config', async () => {
    const { dockerSandboxProvider } = await import('../provider');
    const sandbox = dockerSandboxProvider.createSandbox({
      image: 'node:22-slim',
      memory: 512 * 1024 * 1024,
      pidsLimit: 256,
      readonlyRootfs: true,
      capDrop: ['ALL'],
      securityOpt: ['no-new-privileges:true'],
      tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' },
    });
    await sandbox._start();

    const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
    expect(createCall.HostConfig).toEqual(
      expect.objectContaining({
        Memory: 512 * 1024 * 1024,
        PidsLimit: 256,
        ReadonlyRootfs: true,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' },
      }),
    );
  });

  it('should create a DockerSandbox instance with mounts config', async () => {
    const { dockerSandboxProvider } = await import('../provider');
    const sandbox = dockerSandboxProvider.createSandbox({
      image: 'node:22-slim',
      mounts: [{ type: 'volume', source: 'project-data', target: '/work', volumeOptions: { subpath: 'shared' } }],
    });
    await sandbox._start();

    const createCall = mockDocker.createContainer.mock.calls[0]?.[0];
    expect(createCall.HostConfig.Mounts).toEqual([
      { Type: 'volume', Source: 'project-data', Target: '/work', VolumeOptions: { Subpath: 'shared' } },
    ]);
  });

  it('should have config schema', async () => {
    const { dockerSandboxProvider } = await import('../provider');
    expect(dockerSandboxProvider.configSchema).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.image).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.timeout).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.memory).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.pidsLimit).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.capDrop).toBeDefined();
    expect((dockerSandboxProvider.configSchema as any)?.properties?.mounts).toBeDefined();
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

describe('DockerSandbox.clone', () => {
  it.each([
    { options: { workingDirectory: '/original' }, expected: '/original' },
    { options: { workingDir: '/legacy' }, expected: '/legacy' },
    { options: {}, expected: '/workspace' },
  ])('overrides the working directory for a $expected template', ({ options, expected }) => {
    const template = new DockerSandbox(options);
    const child = template.clone({ workingDirectory: '/clone' });

    expect(child.workingDirectory).toBe('/clone');
    expect(template.workingDirectory).toBe(expected);
    expect(child.clone().workingDirectory).toBe('/clone');
    expect(child.status).toBe('pending');
  });

  it.each([
    { options: { workingDirectory: '/original' }, expected: '/original' },
    { options: { workingDir: '/legacy' }, expected: '/legacy' },
    { options: {}, expected: '/workspace' },
  ])('inherits the $expected working directory without an override', ({ options, expected }) => {
    const template = new DockerSandbox(options);

    expect(template.clone().workingDirectory).toBe(expected);
    expect(template.clone({ workingDirectory: undefined }).workingDirectory).toBe(expected);
    expect(template.workingDirectory).toBe(expected);
  });

  it('constructs an unstarted sibling without any I/O', () => {
    const template = new DockerSandbox({ image: 'node:22', workingDir: '/workspace' });

    const child = template.clone({ id: 'mc-project-1' });

    expect(child).toBeInstanceOf(DockerSandbox);
    expect(child).not.toBe(template);
    expect(child.id).toBe('mc-project-1');
    expect(child.status).toBe('pending');
  });

  it('inherits template config and applies env override', () => {
    const template = new DockerSandbox({ image: 'node:22', workingDir: '/workspace', env: { BASE: '1' } });

    const child = template.clone({ env: { GITHUB_TOKEN: 'ghs_abc' } });

    expect(child['_constructorOptions']).toMatchObject({
      image: 'node:22',
      workingDir: '/workspace',
      env: { GITHUB_TOKEN: 'ghs_abc' },
    });
  });

  it('ignores idleTimeoutMinutes (Docker has no provider-side idle teardown)', () => {
    const template = new DockerSandbox({ image: 'node:22', timeout: 120_000 });

    const child = template.clone({ idleTimeoutMinutes: 15 });

    expect(child['_constructorOptions']).toMatchObject({ timeout: 120_000 });
  });

  it('inherits template defaults when no overrides are passed', () => {
    const template = new DockerSandbox({ image: 'node:22', env: { BASE: '1' } });

    const child = template.clone();

    expect(child.id).not.toBe(template.id);
    expect(child['_constructorOptions']).toMatchObject({ image: 'node:22', env: { BASE: '1' } });
  });
});

// =============================================================================
// writeFiles
// =============================================================================

interface ParsedEntry {
  name: string;
  mode?: number;
  content: string;
}

/** Parse the tar stream passed to container.putArchive into entries. */
async function parsePutArchive(): Promise<ParsedEntry[]> {
  const call = mockContainer.putArchive.mock.calls.at(-1);
  if (!call) throw new Error('putArchive was not called');
  const [stream, opts] = call as [NodeJS.ReadableStream, { path: string }];
  expect(opts.path).toBe('/');

  return await new Promise<ParsedEntry[]>((resolve, reject) => {
    const entries: ParsedEntry[] = [];
    const ex = tarExtract();
    ex.on('entry', (header, entryStream, next) => {
      const chunks: Buffer[] = [];
      entryStream.on('data', chunk => chunks.push(chunk as Buffer));
      entryStream.on('end', () => {
        entries.push({ name: header.name, mode: header.mode, content: Buffer.concat(chunks).toString('utf8') });
        next();
      });
      entryStream.resume();
    });
    ex.on('finish', () => resolve(entries));
    ex.on('error', reject);
    stream.pipe(ex);
  });
}

describe('DockerSandbox writeFiles', () => {
  beforeEach(() => {
    resetMockDefaults();
  });

  it('throws SandboxNotReadyError when the sandbox has not started', async () => {
    const sandbox = new DockerSandbox();
    await expect(sandbox.writeFiles([{ path: 'a.txt', content: 'hi' }])).rejects.toBeInstanceOf(SandboxNotReadyError);
    expect(mockContainer.putArchive).not.toHaveBeenCalled();
  });

  it('is a no-op for an empty file list', async () => {
    const sandbox = new DockerSandbox();
    await sandbox._start();

    await sandbox.writeFiles([]);
    expect(mockContainer.putArchive).not.toHaveBeenCalled();
  });

  it('resolves relative paths against the working directory', async () => {
    const sandbox = new DockerSandbox({ workingDirectory: '/srv/app' });
    await sandbox._start();

    await sandbox.writeFiles([{ path: 'src/index.js', content: 'console.log(1)' }]);

    const entries = await parsePutArchive();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('srv/app/src/index.js');
    expect(entries[0]!.content).toBe('console.log(1)');
    expect(entries[0]!.mode).toBe(0o644);
  });

  it('keeps absolute paths and strips the leading slash for the tar entry', async () => {
    const sandbox = new DockerSandbox({ workingDirectory: '/srv/app' });
    await sandbox._start();

    await sandbox.writeFiles([{ path: '/etc/config.json', content: '{}' }]);

    const entries = await parsePutArchive();
    expect(entries[0]!.name).toBe('etc/config.json');
  });

  it('preserves Buffer content and writes multiple files in one archive', async () => {
    const sandbox = new DockerSandbox({ workingDirectory: '/workspace' });
    await sandbox._start();

    await sandbox.writeFiles([
      { path: 'script.js', content: 'run()' },
      { path: 'data.bin', content: Buffer.from('binary') },
    ]);

    expect(mockContainer.putArchive).toHaveBeenCalledTimes(1);
    const entries = await parsePutArchive();
    expect(entries.map(e => e.name)).toEqual(['workspace/script.js', 'workspace/data.bin']);
    expect(entries.find(e => e.name === 'workspace/data.bin')!.content).toBe('binary');
  });

  it('wraps putArchive failures in a SandboxError', async () => {
    const sandbox = new DockerSandbox();
    await sandbox._start();
    mockContainer.putArchive.mockRejectedValueOnce(new Error('boom'));

    await expect(sandbox.writeFiles([{ path: 'a.txt', content: 'hi' }])).rejects.toBeInstanceOf(SandboxError);
  });

  it('honors an explicit file mode on the tar entry', async () => {
    const sandbox = new DockerSandbox({ workingDirectory: '/workspace' });
    await sandbox._start();

    await sandbox.writeFiles([{ path: 'run.sh', content: '#!/bin/sh\n', mode: 0o600 }]);

    const entries = await parsePutArchive();
    expect(entries[0]!.mode).toBe(0o600);
  });

  it('rejects invalid modes without uploading', async () => {
    const sandbox = new DockerSandbox({ workingDirectory: '/workspace' });
    await sandbox._start();
    mockContainer.putArchive.mockClear();

    for (const bad of [0, 0o1000, -1]) {
      await expect(sandbox.writeFiles([{ path: 'a', content: 'x', mode: bad }])).rejects.toBeInstanceOf(SandboxError);
    }
    expect(mockContainer.putArchive).not.toHaveBeenCalled();
  });

  it('rejects with SandboxAbortError when the signal is already aborted, without uploading', async () => {
    const sandbox = new DockerSandbox();
    await sandbox._start();

    const controller = new AbortController();
    controller.abort();

    await expect(
      sandbox.writeFiles([{ path: 'a.txt', content: 'hi' }], { abortSignal: controller.signal }),
    ).rejects.toBeInstanceOf(SandboxAbortError);
    expect(mockContainer.putArchive).not.toHaveBeenCalled();
  });

  it('rejects an empty write when the signal is already aborted', async () => {
    const sandbox = new DockerSandbox();
    await sandbox._start();

    const controller = new AbortController();
    controller.abort();

    await expect(sandbox.writeFiles([], { abortSignal: controller.signal })).rejects.toBeInstanceOf(SandboxAbortError);
    expect(mockContainer.putArchive).not.toHaveBeenCalled();
  });

  it('aborts an in-flight upload and rejects with SandboxAbortError', async () => {
    const sandbox = new DockerSandbox();
    await sandbox._start();

    // Model a real transfer: reject when the tar stream is destroyed (its body
    // ends), which is what terminates the putArchive request.
    mockContainer.putArchive.mockImplementationOnce((stream: NodeJS.ReadableStream) => {
      return new Promise((_resolve, reject) => {
        stream.on('error', err => reject(err));
        stream.on('close', () => reject(new Error('stream closed')));
      });
    });

    const controller = new AbortController();
    const promise = sandbox.writeFiles([{ path: 'a.txt', content: 'hi' }], { abortSignal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(SandboxAbortError);
    expect(mockContainer.putArchive).toHaveBeenCalledTimes(1);
  });

  it('completes normally and forwards the signal when a non-aborted signal is supplied', async () => {
    const sandbox = new DockerSandbox({ workingDirectory: '/workspace' });
    await sandbox._start();

    const controller = new AbortController();
    await sandbox.writeFiles([{ path: 'ok.txt', content: 'done' }], { abortSignal: controller.signal });

    expect(mockContainer.putArchive).toHaveBeenCalledTimes(1);
    const opts = mockContainer.putArchive.mock.calls.at(-1)![1] as { path: string; abortSignal?: AbortSignal };
    expect(opts.path).toBe('/');
    expect(opts.abortSignal).toBe(controller.signal);
    const entries = await parsePutArchive();
    expect(entries[0]!.name).toBe('workspace/ok.txt');
    expect(entries[0]!.content).toBe('done');
  });

  it('removes the abort listener after completion so a later abort is a no-op', async () => {
    const sandbox = new DockerSandbox();
    await sandbox._start();

    const controller = new AbortController();
    await sandbox.writeFiles([{ path: 'a.txt', content: 'hi' }], { abortSignal: controller.signal });

    // Listener was detached; aborting now must not throw or affect anything.
    expect(() => controller.abort()).not.toThrow();
  });
});
