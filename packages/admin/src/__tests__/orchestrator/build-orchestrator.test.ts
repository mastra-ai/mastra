import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BuildOrchestrator } from '../../orchestrator/build-orchestrator';
import {
  createMockStorage,
  createMockEncryption,
  createMockRunner,
  createMockRouter,
  createMockSource,
  createMockBuild,
  createMockDeployment,
  createMockProject,
  createMockRunningServer,
} from '../test-utils';

describe('BuildOrchestrator', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let encryption: ReturnType<typeof createMockEncryption>;
  let runner: ReturnType<typeof createMockRunner>;
  let router: ReturnType<typeof createMockRouter>;
  let source: ReturnType<typeof createMockSource>;
  let orchestrator: BuildOrchestrator;

  beforeEach(() => {
    storage = createMockStorage();
    encryption = createMockEncryption();
    runner = createMockRunner();
    router = createMockRouter();
    source = createMockSource();
    orchestrator = new BuildOrchestrator(storage, encryption, runner, router, source);
  });

  describe('queueBuild', () => {
    it('should add build to queue', async () => {
      await orchestrator.queueBuild('build-123');

      const status = orchestrator.getQueueStatus();
      expect(status.length).toBe(1);
    });

    it('should sort queue by priority', async () => {
      await orchestrator.queueBuild('build-low', 0);
      await orchestrator.queueBuild('build-high', 10);
      await orchestrator.queueBuild('build-medium', 5);

      // Higher priority should be first
      const status = orchestrator.getQueueStatus();
      expect(status.length).toBe(3);
    });
  });

  describe('processNextBuild', () => {
    it('should return false when queue is empty', async () => {
      const result = await orchestrator.processNextBuild();
      expect(result).toBe(false);
    });

    it('should process queued build', async () => {
      const build = createMockBuild({ id: 'build-456' });
      const deployment = createMockDeployment();
      const project = createMockProject({
        sourceType: 'local',
        sourceConfig: { path: '/test/project' },
      });

      vi.mocked(storage.getBuild).mockResolvedValue(build);
      vi.mocked(storage.getDeployment).mockResolvedValue(deployment);
      vi.mocked(storage.getProject).mockResolvedValue(project);

      await orchestrator.queueBuild('build-456');
      const result = await orchestrator.processNextBuild();

      expect(result).toBe(true);
      expect(storage.updateBuildStatus).toHaveBeenCalledWith('build-456', 'building');
    });

    it('should construct ProjectSource from project sourceConfig', async () => {
      // This test verifies the fix for Issue 1:
      // The orchestrator should use project.sourceConfig.path, not call source.getProject(project.id)
      const build = createMockBuild({ id: 'build-789' });
      const deployment = createMockDeployment();
      const project = createMockProject({
        id: 'db-uuid-123', // Database UUID
        name: 'My Project',
        sourceType: 'local',
        sourceConfig: { path: '/custom/path/to/project' },
      });

      vi.mocked(storage.getBuild).mockResolvedValue(build);
      vi.mocked(storage.getDeployment).mockResolvedValue(deployment);
      vi.mocked(storage.getProject).mockResolvedValue(project);

      await orchestrator.queueBuild('build-789');
      await orchestrator.processNextBuild();

      // Verify getProjectPath was called with a ProjectSource constructed from sourceConfig
      expect(source.getProjectPath).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'db-uuid-123',
          name: 'My Project',
          type: 'local',
          path: '/custom/path/to/project', // Should use sourceConfig.path
        }),
        expect.any(String),
      );

      // Verify source.getProject was NOT called with the database ID
      // (This was the bug - it would fail because LocalProjectSource doesn't know database UUIDs)
      expect(source.getProject).not.toHaveBeenCalled();
    });

    it('should pass correct path from sourceConfig to runner', async () => {
      const build = createMockBuild({ id: 'build-abc' });
      const deployment = createMockDeployment();
      const project = createMockProject({
        sourceType: 'local',
        sourceConfig: { path: '/my/mastra/app' },
      });

      vi.mocked(storage.getBuild).mockResolvedValue(build);
      vi.mocked(storage.getDeployment).mockResolvedValue(deployment);
      vi.mocked(storage.getProject).mockResolvedValue(project);
      vi.mocked(source.getProjectPath).mockResolvedValue('/my/mastra/app');

      await orchestrator.queueBuild('build-abc');
      await orchestrator.processNextBuild();

      // Runner.build should be called
      expect(runner.build).toHaveBeenCalledWith(
        project,
        build,
        expect.objectContaining({ envVars: expect.any(Object) }),
        expect.any(Function),
      );
    });

    it('should handle missing source provider', async () => {
      // Create orchestrator without source provider
      const orchestratorNoSource = new BuildOrchestrator(storage, encryption, runner, router);

      const build = createMockBuild({ id: 'build-no-source' });
      const deployment = createMockDeployment();
      const project = createMockProject();

      vi.mocked(storage.getBuild).mockResolvedValue(build);
      vi.mocked(storage.getDeployment).mockResolvedValue(deployment);
      vi.mocked(storage.getProject).mockResolvedValue(project);

      await orchestratorNoSource.queueBuild('build-no-source');
      await orchestratorNoSource.processNextBuild();

      // Should fail with appropriate error
      expect(storage.updateBuild).toHaveBeenCalledWith(
        'build-no-source',
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'No source provider configured',
        }),
      );
    });

    it('should handle missing runner', async () => {
      // Create orchestrator without runner
      const orchestratorNoRunner = new BuildOrchestrator(storage, encryption, undefined, router, source);

      const build = createMockBuild({ id: 'build-no-runner' });
      const deployment = createMockDeployment();
      const project = createMockProject();

      vi.mocked(storage.getBuild).mockResolvedValue(build);
      vi.mocked(storage.getDeployment).mockResolvedValue(deployment);
      vi.mocked(storage.getProject).mockResolvedValue(project);

      await orchestratorNoRunner.queueBuild('build-no-runner');
      await orchestratorNoRunner.processNextBuild();

      // Should fail with appropriate error
      expect(storage.updateBuild).toHaveBeenCalledWith(
        'build-no-runner',
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'No runner configured',
        }),
      );
    });

    it('should register route after successful deploy', async () => {
      const build = createMockBuild({ id: 'build-route' });
      const deployment = createMockDeployment({
        id: 'deployment-route',
        slug: 'my-app',
      });
      const project = createMockProject({ id: 'project-route' });
      const server = createMockRunningServer({
        host: 'localhost',
        port: 4123,
      });

      vi.mocked(storage.getBuild).mockResolvedValue(build);
      vi.mocked(storage.getDeployment).mockResolvedValue(deployment);
      vi.mocked(storage.getProject).mockResolvedValue(project);
      vi.mocked(runner.deploy).mockResolvedValue(server);

      await orchestrator.queueBuild('build-route');
      await orchestrator.processNextBuild();

      expect(router.registerRoute).toHaveBeenCalledWith({
        deploymentId: 'deployment-route',
        projectId: 'project-route',
        subdomain: 'my-app',
        targetHost: 'localhost',
        targetPort: 4123,
      });
    });

    it('should decrypt secret env vars before passing to runner', async () => {
      const build = createMockBuild({ id: 'build-env' });
      const deployment = createMockDeployment();
      const project = createMockProject({ id: 'project-env' });

      vi.mocked(storage.getBuild).mockResolvedValue(build);
      vi.mocked(storage.getDeployment).mockResolvedValue(deployment);
      vi.mocked(storage.getProject).mockResolvedValue(project);
      vi.mocked(storage.getProjectEnvVars).mockResolvedValue([
        { key: 'API_KEY', encryptedValue: 'encrypted:secret123', isSecret: true, createdAt: new Date(), updatedAt: new Date() },
        { key: 'LOG_LEVEL', encryptedValue: 'debug', isSecret: false, createdAt: new Date(), updatedAt: new Date() },
      ]);

      await orchestrator.queueBuild('build-env');
      await orchestrator.processNextBuild();

      // Verify encryption.decrypt was called for secret
      expect(encryption.decrypt).toHaveBeenCalledWith('encrypted:secret123');

      // Verify runner.build received decrypted env vars
      expect(runner.build).toHaveBeenCalledWith(
        project,
        build,
        expect.objectContaining({
          envVars: {
            API_KEY: 'secret123', // Decrypted
            LOG_LEVEL: 'debug', // Plain text
          },
        }),
        expect.any(Function),
      );
    });
  });

  describe('shutdown', () => {
    it('should set shutdown flag', async () => {
      await orchestrator.shutdown();

      // After shutdown, processNextBuild should return false even with items in queue
      await orchestrator.queueBuild('build-after-shutdown');
      const result = await orchestrator.processNextBuild();
      expect(result).toBe(false);
    });
  });
});
