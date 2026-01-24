import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { Build, Project, ProjectSourceProvider, EdgeRouterProvider } from '@mastra/admin';
import { BuildStatus, DeploymentType, HealthStatus } from '@mastra/admin';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { LocalProcessRunner } from './runner';

describe('LocalProcessRunner', () => {
  let runner: LocalProcessRunner;
  let testDir: string;
  let mockProject: Project;
  let mockBuild: Build;
  let mockSourceProvider: ProjectSourceProvider;
  let mockRouterProvider: EdgeRouterProvider;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-test-'));

    // Create output directory with entry point
    const outputDir = path.join(testDir, '.mastra/output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'index.mjs'), 'export default {}');

    // Create package.json for build
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

    mockProject = {
      id: 'project-1',
      name: 'test-project',
      slug: 'test-project',
      sourceType: 'local',
      sourceConfig: { path: testDir },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Project;

    mockBuild = {
      id: 'build-1',
      projectId: 'project-1',
      status: BuildStatus.SUCCEEDED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Build;

    // Mock deployment kept for future deploy tests
    // (currently unused but setup for integration testing)
    void DeploymentType.PRODUCTION; // Reference to keep import

    mockSourceProvider = {
      type: 'local',
      getProjectPath: vi.fn().mockResolvedValue(testDir),
      validateSource: vi.fn().mockResolvedValue({ valid: true }),
    };

    mockRouterProvider = {
      type: 'local',
      registerRoute: vi.fn().mockResolvedValue({
        publicUrl: 'https://test-project.localhost',
        subdomain: 'test-project',
      }),
      removeRoute: vi.fn().mockResolvedValue(undefined),
      getRoute: vi.fn(),
    };

    runner = new LocalProcessRunner({
      portRange: { start: 49300, end: 49310 },
    });
    runner.setSource(mockSourceProvider);
    runner.setRouter(mockRouterProvider);
  });

  afterEach(async () => {
    if (runner) {
      try {
        await runner.shutdown();
      } catch {
        // Ignore shutdown errors in cleanup
      }
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create runner with default config', () => {
      const r = new LocalProcessRunner();
      expect(r.type).toBe('local');
    });

    it('should create runner with custom config', () => {
      const r = new LocalProcessRunner({
        portRange: { start: 5000, end: 5100 },
        maxConcurrentBuilds: 5,
        logRetentionLines: 5000,
      });
      expect(r.type).toBe('local');
    });
  });

  describe('setSource', () => {
    it('should set the source provider', () => {
      const r = new LocalProcessRunner();
      r.setSource(mockSourceProvider);
      expect(r).toBeDefined();
    });
  });

  describe('setRouter', () => {
    it('should set the router provider', () => {
      const r = new LocalProcessRunner();
      r.setRouter(mockRouterProvider);
      expect(r).toBeDefined();
    });
  });

  describe('build', () => {
    it('should throw if source provider not set', async () => {
      const r = new LocalProcessRunner();

      await expect(r.build(mockProject, mockBuild)).rejects.toThrow('Project source provider not configured');
    });

    it('should get project path from source provider', async () => {
      await runner.build(mockProject, mockBuild, { skipInstall: true });

      expect(mockSourceProvider.getProjectPath).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'project-1',
          name: 'test-project',
          type: 'local',
          path: testDir,
        }),
        expect.any(String),
      );
    });

    it('should stream logs to callback', async () => {
      const logs: string[] = [];
      await runner.build(mockProject, mockBuild, { skipInstall: true }, log => logs.push(log));

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.includes('Detected package manager'))).toBe(true);
    });

    it('should return build result', async () => {
      const result = await runner.build(mockProject, mockBuild, { skipInstall: true });

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = runner.getStats();

      expect(stats.runningProcesses).toBe(0);
      expect(stats.allocatedPorts).toEqual([]);
      expect(stats.availablePorts).toBe(11); // 49300-49310 = 11 ports
    });
  });

  describe('shutdown', () => {
    it('should not throw when no processes running', async () => {
      await expect(runner.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('getLogs', () => {
    it('should return empty string if server not found', async () => {
      const fakeServer = {
        id: 'non-existent',
        deploymentId: 'dep-1',
        buildId: 'build-1',
        processId: null,
        containerId: null,
        host: 'localhost',
        port: 4111,
        healthStatus: HealthStatus.HEALTHY,
        lastHealthCheck: new Date(),
        memoryUsageMb: null,
        cpuPercent: null,
        startedAt: new Date(),
        stoppedAt: null,
      };

      const logs = await runner.getLogs(fakeServer);

      expect(logs).toBe('');
    });
  });

  describe('streamLogs', () => {
    it('should return noop function if server not found', () => {
      const fakeServer = {
        id: 'non-existent',
        deploymentId: 'dep-1',
        buildId: 'build-1',
        processId: null,
        containerId: null,
        host: 'localhost',
        port: 4111,
        healthStatus: HealthStatus.HEALTHY,
        lastHealthCheck: new Date(),
        memoryUsageMb: null,
        cpuPercent: null,
        startedAt: new Date(),
        stoppedAt: null,
      };

      const cleanup = runner.streamLogs(fakeServer, vi.fn());

      expect(typeof cleanup).toBe('function');
      cleanup(); // Should not throw
    });
  });

  describe('getResourceUsage', () => {
    it('should return null values if no processId', async () => {
      const fakeServer = {
        id: 'test',
        deploymentId: 'dep-1',
        buildId: 'build-1',
        processId: null,
        containerId: null,
        host: 'localhost',
        port: 4111,
        healthStatus: HealthStatus.HEALTHY,
        lastHealthCheck: new Date(),
        memoryUsageMb: null,
        cpuPercent: null,
        startedAt: new Date(),
        stoppedAt: null,
      };

      const usage = await runner.getResourceUsage(fakeServer);

      expect(usage.memoryUsageMb).toBeNull();
      expect(usage.cpuPercent).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return unhealthy if server not tracked', async () => {
      const fakeServer = {
        id: 'non-existent',
        deploymentId: 'dep-1',
        buildId: 'build-1',
        processId: 12345,
        containerId: null,
        host: 'localhost',
        port: 4111,
        healthStatus: HealthStatus.HEALTHY,
        lastHealthCheck: new Date(),
        memoryUsageMb: null,
        cpuPercent: null,
        startedAt: new Date(),
        stoppedAt: null,
      };

      const result = await runner.healthCheck(fakeServer);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Process is not running');
    });
  });
});
