import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTestContext, type TestContext } from '../../setup/test-context.js';
import { createUserData, createTeamData, createProjectData, uniqueSlug } from '../../fixtures/factories.js';

/**
 * Creates a minimal mock Mastra project directory for testing builds.
 * This project contains the minimum files needed for a valid build.
 */
async function createMockMastraProject(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });

  // Create package.json
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(
      {
        name: 'test-mastra-project',
        version: '1.0.0',
        scripts: {
          build: 'echo "Building..."',
          start: 'node server.js',
        },
      },
      null,
      2,
    ),
  );

  // Create a simple server
  await fs.writeFile(
    path.join(projectPath, 'server.js'),
    `
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(200);
    res.end('Hello from test server');
  }
});
const port = process.env.PORT || 3000;
server.listen(port, () => console.log(\`Server running on port \${port}\`));
    `,
  );
}

describe('Deployment Lifecycle Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };
  let testTeam: { id: string };
  let testProject: { id: string; path: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test user and team
    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };

    const team = await ctx.admin.createTeam(testUser.id, createTeamData());
    testTeam = { id: team.id };

    // Create a simple test project on disk
    const projectPath = `/tmp/test-projects/test-project-${Date.now()}`;
    await createMockMastraProject(projectPath);

    const projectData = createProjectData({ teamId: testTeam.id });
    const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
      name: projectData.name,
      slug: projectData.slug,
      sourceType: 'local',
      sourceConfig: { path: projectPath },
    });
    testProject = { id: project.id, path: projectPath };
  });

  afterAll(async () => {
    // Cleanup test project directory
    if (testProject?.path) {
      await fs.rm(testProject.path, { recursive: true, force: true }).catch(() => {});
    }
    await ctx.cleanup();
  });

  describe('Deployment Creation', () => {
    it('should create a production deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      expect(deployment.id).toBeDefined();
      expect(deployment.type).toBe('production');
      expect(deployment.branch).toBe('main');
      expect(deployment.status).toBe('pending');
      expect(deployment.projectId).toBe(testProject.id);
      expect(deployment.createdAt).toBeInstanceOf(Date);
      expect(deployment.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a staging deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      expect(deployment.type).toBe('staging');
      expect(deployment.branch).toBe('develop');
      expect(deployment.status).toBe('pending');
    });

    it('should create a preview deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/new-feature',
      });

      expect(deployment.type).toBe('preview');
      expect(deployment.branch).toBe('feature/new-feature');
      expect(deployment.status).toBe('pending');
    });

    it('should create deployment with custom slug', async () => {
      const customSlug = `custom-slug-${Date.now()}`;
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/test',
        slug: customSlug,
      });

      expect(deployment.slug).toBe(customSlug);
    });

    it('should auto-generate slug from branch and project', async () => {
      // Create a new project with predictable slug
      const projectSlug = `slug-test-${Date.now()}`;
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Slug Test Project',
        slug: projectSlug,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/test' },
      });

      const deployment = await ctx.admin.createDeployment(testUser.id, project.id, {
        type: 'production',
        branch: 'main',
      });

      expect(deployment.slug).toBe(`main--${projectSlug}`);
    });

    it('should set autoShutdown true for preview deployments by default', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/auto-shutdown-test',
      });

      expect(deployment.autoShutdown).toBe(true);
    });

    it('should set autoShutdown false for production deployments by default', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      expect(deployment.autoShutdown).toBe(false);
    });

    it('should respect explicit autoShutdown setting', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
        autoShutdown: true,
      });

      expect(deployment.autoShutdown).toBe(true);
    });

    it('should have null currentBuildId initially', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      expect(deployment.currentBuildId).toBeNull();
    });

    it('should have null publicUrl initially', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      expect(deployment.publicUrl).toBeNull();
    });
  });

  describe('Deployment Retrieval', () => {
    it('should get deployment by ID', async () => {
      const created = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const fetched = await ctx.admin.getDeployment(testUser.id, created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.type).toBe('production');
      expect(fetched!.branch).toBe('main');
    });

    it('should return null for non-existent deployment', async () => {
      const deployment = await ctx.admin.getDeployment(testUser.id, 'non-existent-id');
      expect(deployment).toBeNull();
    });

    it('should get deployment by slug via storage', async () => {
      const slug = `get-by-slug-${Date.now()}`;
      const created = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/test',
        slug,
      });

      const fetched = await ctx.storage.getDeploymentBySlug(testProject.id, slug);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.slug).toBe(slug);
    });

    it('should list deployments for project', async () => {
      // Create a new project for isolated test
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'List Deployments Project',
        slug: uniqueSlug('list-deployments'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/test' },
      });

      // Create multiple deployments
      await ctx.admin.createDeployment(testUser.id, project.id, {
        type: 'production',
        branch: 'main',
      });
      await ctx.admin.createDeployment(testUser.id, project.id, {
        type: 'staging',
        branch: 'develop',
      });
      await ctx.admin.createDeployment(testUser.id, project.id, {
        type: 'preview',
        branch: 'feature/test',
      });

      const deployments = await ctx.admin.listDeployments(testUser.id, project.id);

      expect(deployments.data.length).toBe(3);
      expect(deployments.total).toBe(3);
    });

    it('should paginate deployments', async () => {
      // Create a new project for isolated test
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Paginate Deployments Project',
        slug: uniqueSlug('paginate-deployments'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/test' },
      });

      // Create 5 deployments
      for (let i = 0; i < 5; i++) {
        await ctx.admin.createDeployment(testUser.id, project.id, {
          type: 'preview',
          branch: `feature/test-${i}`,
        });
      }

      const page1 = await ctx.admin.listDeployments(testUser.id, project.id, { page: 1, perPage: 2 });
      const page2 = await ctx.admin.listDeployments(testUser.id, project.id, { page: 2, perPage: 2 });

      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);

      expect(page2.data.length).toBe(2);
      expect(page1.data[0].id).not.toBe(page2.data[0].id);
    });
  });

  describe('Build Workflow', () => {
    it('should trigger a build with deploy()', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      expect(build.id).toBeDefined();
      expect(build.status).toBe('queued');
      expect(build.trigger).toBe('manual');
      expect(build.triggeredBy).toBe(testUser.id);
      expect(build.deploymentId).toBe(deployment.id);
      expect(build.queuedAt).toBeInstanceOf(Date);
    });

    it('should trigger a build with custom trigger type', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id, {
        trigger: 'webhook',
        commitSha: 'abc123',
        commitMessage: 'Test commit from webhook',
      });

      expect(build.trigger).toBe('webhook');
      expect(build.commitSha).toBe('abc123');
      expect(build.commitMessage).toBe('Test commit from webhook');
    });

    it('should use HEAD as default commitSha', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/default-sha',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      expect(build.commitSha).toBe('HEAD');
    });

    it('should get build by ID', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const created = await ctx.admin.deploy(testUser.id, deployment.id);
      const fetched = await ctx.admin.getBuild(testUser.id, created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.deploymentId).toBe(deployment.id);
    });

    it('should return null for non-existent build', async () => {
      const build = await ctx.admin.getBuild(testUser.id, 'non-existent-id');
      expect(build).toBeNull();
    });

    it('should list builds for deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      // Trigger multiple builds
      await ctx.admin.deploy(testUser.id, deployment.id);
      await ctx.admin.deploy(testUser.id, deployment.id);
      await ctx.admin.deploy(testUser.id, deployment.id);

      const builds = await ctx.admin.listBuilds(testUser.id, deployment.id);

      expect(builds.data.length).toBe(3);
      expect(builds.total).toBe(3);
    });

    it('should paginate builds', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/paginate-builds',
      });

      // Trigger 5 builds
      for (let i = 0; i < 5; i++) {
        await ctx.admin.deploy(testUser.id, deployment.id);
      }

      const page1 = await ctx.admin.listBuilds(testUser.id, deployment.id, { page: 1, perPage: 2 });
      const page2 = await ctx.admin.listBuilds(testUser.id, deployment.id, { page: 2, perPage: 2 });

      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);

      expect(page2.data.length).toBe(2);
    });

    it('should have empty logs initially', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      expect(build.logs).toBe('');
    });

    it('should have null errorMessage initially', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      expect(build.errorMessage).toBeNull();
    });
  });

  describe('Build Queue Processing', () => {
    it('should queue build in orchestrator', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      await ctx.admin.deploy(testUser.id, deployment.id);

      const queueStatus = ctx.admin.getOrchestrator().getQueueStatus();
      expect(queueStatus.length).toBeGreaterThanOrEqual(1);
    });

    it('should cancel queued build', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      await ctx.admin.cancelBuild(testUser.id, build.id);

      const cancelledBuild = await ctx.admin.getBuild(testUser.id, build.id);
      expect(cancelledBuild!.status).toBe('cancelled');
    });

    it('should update build status via storage', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/status-test',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Simulate build status change via storage
      await ctx.storage.updateBuildStatus(build.id, 'building');

      const updatedBuild = await ctx.admin.getBuild(testUser.id, build.id);
      expect(updatedBuild!.status).toBe('building');
      expect(updatedBuild!.startedAt).toBeInstanceOf(Date);
    });

    it('should append build logs via storage', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/logs-test',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Append logs
      await ctx.storage.appendBuildLogs(build.id, 'Log line 1\n');
      await ctx.storage.appendBuildLogs(build.id, 'Log line 2\n');

      const updatedBuild = await ctx.admin.getBuild(testUser.id, build.id);
      expect(updatedBuild!.logs).toContain('Log line 1');
      expect(updatedBuild!.logs).toContain('Log line 2');
    });

    it('should mark build as succeeded', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/success-test',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Simulate successful build
      await ctx.storage.updateBuildStatus(build.id, 'building');
      await ctx.storage.updateBuildStatus(build.id, 'succeeded');

      const updatedBuild = await ctx.admin.getBuild(testUser.id, build.id);
      expect(updatedBuild!.status).toBe('succeeded');
      expect(updatedBuild!.completedAt).toBeInstanceOf(Date);
    });

    it('should mark build as failed with error message', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/failure-test',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Simulate failed build
      await ctx.storage.updateBuildStatus(build.id, 'building');
      await ctx.storage.updateBuildStatus(build.id, 'failed', 'Build compilation error');

      const updatedBuild = await ctx.admin.getBuild(testUser.id, build.id);
      expect(updatedBuild!.status).toBe('failed');
      expect(updatedBuild!.errorMessage).toBe('Build compilation error');
      expect(updatedBuild!.completedAt).toBeInstanceOf(Date);
    });

    it('should dequeue next build via storage', async () => {
      // This test validates that dequeueNextBuild returns a queued build
      // Note: Other tests may have also queued builds, so we just verify
      // that a queued build is returned from storage
      const queueDeployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/dequeue-test',
      });

      // Queue a build via storage directly
      const buildData = {
        id: crypto.randomUUID(),
        deploymentId: queueDeployment.id,
        trigger: 'manual' as const,
        triggeredBy: testUser.id,
        commitSha: 'abc123',
        commitMessage: 'Test commit',
        status: 'queued' as const,
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      };

      await ctx.storage.createBuild(buildData);

      // Dequeue - this returns the first queued build
      const dequeuedBuild = await ctx.storage.dequeueNextBuild();
      expect(dequeuedBuild).not.toBeNull();
      expect(dequeuedBuild!.status).toBe('queued');
      expect(dequeuedBuild!.deploymentId).toBeDefined();
    });
  });

  describe('Deployment Stop', () => {
    it('should stop a deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      // First set the deployment to running status via storage
      await ctx.storage.updateDeploymentStatus(deployment.id, 'running');

      // Stop the deployment
      await ctx.admin.stop(testUser.id, deployment.id);

      const stoppedDeployment = await ctx.admin.getDeployment(testUser.id, deployment.id);
      expect(stoppedDeployment!.status).toBe('stopped');
    });

    it('should update deployment status to stopped', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      // Set to running first
      await ctx.storage.updateDeploymentStatus(deployment.id, 'running');

      // Stop
      await ctx.admin.stop(testUser.id, deployment.id);

      const fetched = await ctx.storage.getDeployment(deployment.id);
      expect(fetched!.status).toBe('stopped');
    });
  });

  describe('Deployment Rollback', () => {
    it('should trigger rollback to previous build', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      // Create initial build
      const initialBuild = await ctx.admin.deploy(testUser.id, deployment.id, {
        commitSha: 'initial-sha',
        commitMessage: 'Initial deployment',
      });

      // Trigger rollback
      const rollbackBuild = await ctx.admin.rollback(testUser.id, deployment.id, initialBuild.id);

      expect(rollbackBuild.trigger).toBe('rollback');
      expect(rollbackBuild.commitSha).toBe('initial-sha');
      expect(rollbackBuild.commitMessage).toContain('Rollback');
      expect(rollbackBuild.status).toBe('queued');
    });

    it('should include original buildId in rollback commit message', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const originalBuild = await ctx.admin.deploy(testUser.id, deployment.id);
      const rollbackBuild = await ctx.admin.rollback(testUser.id, deployment.id, originalBuild.id);

      expect(rollbackBuild.commitMessage).toContain(originalBuild.id);
    });
  });

  describe('Running Server Management', () => {
    it('should return null when no server is running', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/no-server',
      });

      const server = await ctx.admin.getRunningServer(testUser.id, deployment.id);
      expect(server).toBeNull();
    });

    it('should create running server via storage', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Simulate server creation via storage
      const serverData = {
        id: crypto.randomUUID(),
        deploymentId: deployment.id,
        buildId: build.id,
        host: 'localhost',
        port: 3001,
        processId: 12345,
        containerId: null,
        healthStatus: 'healthy' as const,
        lastHealthCheck: new Date(),
        memoryUsageMb: 128,
        cpuPercent: 5,
        startedAt: new Date(),
      };

      const server = await ctx.storage.createRunningServer(serverData);

      expect(server.id).toBe(serverData.id);
      expect(server.deploymentId).toBe(deployment.id);
      expect(server.port).toBe(3001);
    });

    it('should get running server for deployment via storage', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Create running server
      const serverData = {
        id: crypto.randomUUID(),
        deploymentId: deployment.id,
        buildId: build.id,
        host: 'localhost',
        port: 3002,
        processId: 12346,
        containerId: null,
        healthStatus: 'healthy' as const,
        lastHealthCheck: new Date(),
        memoryUsageMb: 128,
        cpuPercent: 5,
        startedAt: new Date(),
      };

      await ctx.storage.createRunningServer(serverData);

      const server = await ctx.storage.getRunningServerForDeployment(deployment.id);
      expect(server).not.toBeNull();
      expect(server!.deploymentId).toBe(deployment.id);
    });

    it('should list running servers', async () => {
      const runningServers = await ctx.storage.listRunningServers();
      expect(Array.isArray(runningServers)).toBe(true);
    });

    it('should stop running server via storage', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/stop-server',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Create running server
      const serverData = {
        id: crypto.randomUUID(),
        deploymentId: deployment.id,
        buildId: build.id,
        host: 'localhost',
        port: 3003,
        processId: 12347,
        containerId: null,
        healthStatus: 'healthy' as const,
        lastHealthCheck: new Date(),
        memoryUsageMb: 128,
        cpuPercent: 5,
        startedAt: new Date(),
      };

      const server = await ctx.storage.createRunningServer(serverData);

      // Stop the server
      await ctx.storage.stopRunningServer(server.id);

      // Verify it's no longer in running servers list
      const runningServers = await ctx.storage.listRunningServers();
      const found = runningServers.find(s => s.id === server.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Deployment Status Updates', () => {
    it('should update deployment status to building', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      await ctx.storage.updateDeploymentStatus(deployment.id, 'building');

      const updated = await ctx.admin.getDeployment(testUser.id, deployment.id);
      expect(updated!.status).toBe('building');
    });

    it('should update deployment status to running', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      await ctx.storage.updateDeploymentStatus(deployment.id, 'running');

      const updated = await ctx.admin.getDeployment(testUser.id, deployment.id);
      expect(updated!.status).toBe('running');
    });

    it('should update deployment status to failed', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/fail',
      });

      await ctx.storage.updateDeploymentStatus(deployment.id, 'failed');

      const updated = await ctx.admin.getDeployment(testUser.id, deployment.id);
      expect(updated!.status).toBe('failed');
    });

    it('should update deployment with currentBuildId', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      await ctx.storage.updateDeployment(deployment.id, {
        currentBuildId: build.id,
        status: 'running',
      });

      const updated = await ctx.admin.getDeployment(testUser.id, deployment.id);
      expect(updated!.currentBuildId).toBe(build.id);
    });

    it('should update deployment with internalHost', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      await ctx.storage.updateDeployment(deployment.id, {
        internalHost: 'localhost:3000',
        status: 'running',
      });

      const updated = await ctx.admin.getDeployment(testUser.id, deployment.id);
      expect(updated!.internalHost).toBe('localhost:3000');
    });
  });

  describe('Deployment Deletion', () => {
    it('should delete deployment via storage', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/delete-test',
      });

      await ctx.storage.deleteDeployment(deployment.id);

      const deleted = await ctx.storage.getDeployment(deployment.id);
      expect(deleted).toBeNull();
    });

    it('should delete associated builds when deleting deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/cascade-delete',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      await ctx.storage.deleteDeployment(deployment.id);

      // Build should also be deleted
      const deletedBuild = await ctx.storage.getBuild(build.id);
      expect(deletedBuild).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should throw for non-existent deployment when deploying', async () => {
      await expect(ctx.admin.deploy(testUser.id, 'non-existent-id')).rejects.toThrow();
    });

    it('should throw for non-existent deployment when stopping', async () => {
      await expect(ctx.admin.stop(testUser.id, 'non-existent-id')).rejects.toThrow();
    });

    it('should throw for non-existent deployment when rolling back', async () => {
      await expect(ctx.admin.rollback(testUser.id, 'non-existent-id', 'build-id')).rejects.toThrow();
    });

    it('should throw for non-existent build when rolling back', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      await expect(ctx.admin.rollback(testUser.id, deployment.id, 'non-existent-build')).rejects.toThrow();
    });

    it('should throw for non-existent build when cancelling', async () => {
      await expect(ctx.admin.cancelBuild(testUser.id, 'non-existent-id')).rejects.toThrow();
    });

    it('should throw for non-existent project when creating deployment', async () => {
      await expect(
        ctx.admin.createDeployment(testUser.id, 'non-existent-project', {
          type: 'production',
          branch: 'main',
        }),
      ).rejects.toThrow();
    });
  });
});
