/**
 * Deployment Demo
 *
 * Demonstrates the full deployment lifecycle:
 * - Project setup with environment variables
 * - Triggering a deployment
 * - Monitoring build progress
 * - Accessing the deployed server
 */

import 'dotenv/config';

import { MastraAdmin, type Build, type Deployment } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { BuildWorker } from '@mastra/admin-server';
import { LocalProjectSource } from '@mastra/source-local';
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalEdgeRouter } from '@mastra/router-local';
import { LocalFileStorage } from '@mastra/observability-file-local';
import { resolve } from 'path';

// Use valid UUID
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000004';

// Poll interval for checking build status
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 300000; // 5 minutes

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBuild(
  admin: MastraAdmin,
  userId: string,
  buildId: string,
  onLog?: (logs: string) => void,
): Promise<Build> {
  const startTime = Date.now();
  let lastLogLength = 0;

  while (Date.now() - startTime < MAX_WAIT_MS) {
    const build = await admin.getBuild(userId, buildId);
    if (!build) {
      throw new Error(`Build ${buildId} not found`);
    }

    // Stream new logs
    if (onLog && build.logs && build.logs.length > lastLogLength) {
      const newLogs = build.logs.slice(lastLogLength);
      onLog(newLogs);
      lastLogLength = build.logs.length;
    }

    // Check terminal states
    if (build.status === 'succeeded') {
      console.log('\n  Build succeeded!');
      return build;
    }
    if (build.status === 'failed') {
      console.log('\n  Build failed:', build.errorMessage);
      return build;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Build timed out after ${MAX_WAIT_MS / 1000} seconds`);
}

class DeployDemo {
  private admin!: MastraAdmin;
  private storage!: PostgresAdminStorage;
  private runner!: LocalProcessRunner;
  private router!: LocalEdgeRouter;
  private buildWorker!: BuildWorker;

  async setup() {
    console.log('\n[Setup] Initializing deployment infrastructure...\n');

    // Initialize storage
    this.storage = new PostgresAdminStorage({
      connectionString:
        process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/mastra_admin',
      schemaName: 'mastra_admin',
    });

    // Initialize project source
    const projectsDir = process.env['PROJECTS_DIR'] ?? resolve(process.cwd(), '../');
    const source = new LocalProjectSource({
      basePaths: [projectsDir],
      watchChanges: false,
      maxDepth: 3,
    });

    // Initialize runner
    this.runner = new LocalProcessRunner({
      portRange: { start: 4111, end: 4200 },
      maxConcurrentBuilds: 3,
      defaultBuildTimeoutMs: 600000,
      logRetentionLines: 10000,
      buildDir: resolve(process.cwd(), '.mastra/builds'),
    });

    // Initialize router
    this.router = new LocalEdgeRouter({
      strategy: 'port-mapping',
      baseDomain: 'localhost',
      portRange: { start: 3100, end: 3199 },
      logRoutes: true,
    });

    // Initialize file storage
    const fileStorage = new LocalFileStorage({
      baseDir: resolve(process.cwd(), '.mastra/observability'),
      atomicWrites: true,
    });

    // Create MastraAdmin with full infrastructure
    this.admin = new MastraAdmin({
      licenseKey: 'dev',
      storage: this.storage,
      source,
      runner: this.runner,
      router: this.router,
      fileStorage,
    });

    await this.admin.init();

    // Create and start the build worker (processes the build queue)
    this.buildWorker = new BuildWorker({
      admin: this.admin,
      intervalMs: 1000, // Poll every second for demo responsiveness
      maxConcurrent: 1,
    });
    this.buildWorker.start();

    console.log('  Storage: PostgreSQL');
    console.log('  Source: LocalProjectSource');
    console.log('  Runner: LocalProcessRunner');
    console.log('  Router: LocalEdgeRouter');
    console.log('  BuildWorker: Started');
    console.log();
  }

  async ensureUser(): Promise<void> {
    let user = await this.admin.getUser(DEMO_USER_ID);
    if (!user) {
      await this.storage.createUser({
        id: DEMO_USER_ID,
        email: 'deploy-demo@example.com',
        name: 'Deploy Demo User',
        avatarUrl: null,
      });
      console.log('[User] Created demo user\n');
    }
  }

  async setupProject(): Promise<{ teamId: string; projectId: string; deploymentId: string }> {
    console.log('[Project] Setting up project for deployment...\n');

    // Create team
    let team;
    try {
      team = await this.admin.createTeam(DEMO_USER_ID, {
        name: 'Deploy Demo Team',
        slug: 'deploy-demo',
      });
      console.log('  Created team:', team.name);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const teams = await this.admin.listTeams(DEMO_USER_ID);
        team = teams.data.find(t => t.slug === 'deploy-demo');
        console.log('  Team exists:', team?.name);
      } else {
        throw e;
      }
    }

    if (!team) throw new Error('Failed to get team');

    // Discover a project to deploy
    const source = new LocalProjectSource({
      basePaths: [process.env['PROJECTS_DIR'] ?? resolve(process.cwd(), '../')],
      maxDepth: 3,
    });
    const discovered = await source.listProjects(team.id);

    if (discovered.length === 0) {
      console.log('\n  No Mastra projects found in PROJECTS_DIR');
      console.log('  Set PROJECTS_DIR to a directory containing Mastra projects');
      throw new Error('No projects to deploy');
    }

    const targetProject = discovered[0];
    console.log('  Found project:', targetProject.name);
    console.log('  Path:', targetProject.path);

    // Create project
    let project;
    const projectSlug = 'deploy-target';
    try {
      project = await this.admin.createProject(DEMO_USER_ID, team.id, {
        name: targetProject.name,
        slug: projectSlug,
        sourceType: 'local',
        sourceConfig: { path: targetProject.path },
        defaultBranch: 'main',
      });
      console.log('  Created project:', project.name);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const projects = await this.admin.listProjects(DEMO_USER_ID, team.id);
        project = projects.data.find(p => p.slug === projectSlug);
        console.log('  Project exists:', project?.name);
      } else {
        throw e;
      }
    }

    if (!project) throw new Error('Failed to get project');

    // Set environment variables
    console.log('  Setting environment variables...');
    await this.admin.setEnvVar(DEMO_USER_ID, project.id, 'NODE_ENV', 'production', false);
    await this.admin.setEnvVar(DEMO_USER_ID, project.id, 'PORT', '0', false); // Let runner assign port

    // Create deployment
    let deployment;
    const deploymentSlug = 'prod-deploy-target';
    try {
      deployment = await this.admin.createDeployment(DEMO_USER_ID, project.id, {
        type: 'production',
        branch: 'main',
        slug: deploymentSlug,
      });
      console.log('  Created deployment:', deployment.slug);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const deployments = await this.admin.listDeployments(DEMO_USER_ID, project.id);
        deployment = deployments.data.find(d => d.slug === deploymentSlug);
        console.log('  Deployment exists:', deployment?.slug);
      } else {
        throw e;
      }
    }

    if (!deployment) throw new Error('Failed to get deployment');

    console.log();
    return {
      teamId: team.id,
      projectId: project.id,
      deploymentId: deployment.id,
    };
  }

  async deploy(deploymentId: string): Promise<{ build: Build; deployment: Deployment }> {
    console.log('[Deploy] Triggering deployment...\n');

    // Trigger the deployment
    const build = await this.admin.deploy(DEMO_USER_ID, deploymentId, {
      trigger: 'manual',
      commitMessage: 'Demo deployment',
    });

    console.log('  Build ID:', build.id);
    console.log('  Status:', build.status);
    console.log('  Triggered by:', build.triggeredBy);
    console.log();

    // Wait for build to complete
    console.log('[Build] Waiting for build to complete...\n');
    console.log('  Build logs:');
    console.log('  ' + '-'.repeat(50));

    const completedBuild = await waitForBuild(this.admin, DEMO_USER_ID, build.id, logs => {
      // Indent and print new logs
      const lines = logs.split('\n').filter(l => l.trim());
      for (const line of lines) {
        console.log('  |', line);
      }
    });

    console.log('  ' + '-'.repeat(50));
    console.log();

    // Get updated deployment
    const deployment = await this.admin.getDeployment(DEMO_USER_ID, deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    return { build: completedBuild, deployment };
  }

  async showResults(build: Build, deployment: Deployment) {
    console.log('[Results] Deployment summary\n');

    console.log('  Build:');
    console.log('    ID:', build.id);
    console.log('    Status:', build.status);
    console.log('    Queued:', build.queuedAt);
    console.log('    Started:', build.startedAt);
    console.log('    Completed:', build.completedAt);
    if (build.errorMessage) {
      console.log('    Error:', build.errorMessage);
    }
    console.log();

    console.log('  Deployment:');
    console.log('    ID:', deployment.id);
    console.log('    Slug:', deployment.slug);
    console.log('    Status:', deployment.status);
    console.log('    Type:', deployment.type);
    console.log('    Branch:', deployment.branch);
    if (deployment.internalHost) {
      console.log('    Internal URL:', `http://${deployment.internalHost}`);
    }
    console.log();

    if (deployment.status === 'running' && deployment.internalHost) {
      console.log('  Server is running! Try:');
      console.log(`    curl http://${deployment.internalHost}/health`);
      console.log();
    }
  }

  async cleanup() {
    console.log('[Cleanup] Shutting down...');
    if (this.buildWorker) {
      await this.buildWorker.stop();
    }
    await this.admin.shutdown();
    console.log('  Done.\n');
  }

  async run() {
    try {
      await this.setup();
      await this.ensureUser();

      const { deploymentId } = await this.setupProject();
      const { build, deployment } = await this.deploy(deploymentId);

      await this.showResults(build, deployment);

      console.log('='.repeat(60));
      console.log('Deploy Demo Complete!');
      console.log('='.repeat(60));
      console.log();

      if (deployment.status === 'running') {
        console.log('The deployed server is running.');
        console.log('Run "pnpm demo:full" to see all running deployments.');
      } else {
        console.log('Deployment did not succeed. Check the logs above for errors.');
      }
      console.log();
    } catch (error) {
      console.error('\nDemo failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

const demo = new DeployDemo();

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down...');
  await demo.cleanup();
  process.exit(0);
});

demo.run();
