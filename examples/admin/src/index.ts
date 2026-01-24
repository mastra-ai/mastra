/**
 * MastraAdmin Demo Application
 *
 * This demo showcases the core functionality of the Mastra Admin platform:
 * - Team management
 * - Project management
 * - Deployment management
 * - Environment variable handling
 * - Local process runner (build & run Mastra servers)
 * - Local edge router (expose deployed servers)
 * - File-based observability storage
 *
 * Run with: pnpm dev
 */

import 'dotenv/config';

import { MastraAdmin, TeamRole } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalProjectSource } from '@mastra/source-local';
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalEdgeRouter } from '@mastra/router-local';
import { LocalFileStorage } from '@mastra/observability-file-local';
import { resolve } from 'path';

// Demo configuration - use valid UUIDs
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_EMAIL = 'demo@example.com';

async function main() {
  console.log('='.repeat(60));
  console.log('MastraAdmin Demo Application');
  console.log('='.repeat(60));
  console.log();

  // 1. Initialize Storage
  console.log('[1] Initializing PostgreSQL storage...');
  const storage = new PostgresAdminStorage({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/mastra_admin',
    schemaName: 'mastra_admin',
  });

  // 2. Initialize Project Source (discovers local Mastra projects)
  console.log('[2] Initializing local project source...');
  const projectsDir = process.env['PROJECTS_DIR'] ?? resolve(process.cwd(), '../');
  const source = new LocalProjectSource({
    basePaths: [projectsDir],
    watchChanges: false,
    maxDepth: 3,
  });

  // 3. Initialize Local Process Runner (builds and runs Mastra servers)
  console.log('[3] Initializing local process runner...');
  const runner = new LocalProcessRunner({
    portRange: { start: 4111, end: 4200 },
    maxConcurrentBuilds: 3,
    defaultBuildTimeoutMs: 600000, // 10 minutes
    logRetentionLines: 10000,
    buildDir: resolve(process.cwd(), '.mastra/builds'),
  });

  // 4. Initialize Local Edge Router (exposes deployed servers)
  console.log('[4] Initializing local edge router...');
  const router = new LocalEdgeRouter({
    strategy: 'port-mapping',
    baseDomain: 'localhost',
    portRange: { start: 3100, end: 3199 },
    logRoutes: true,
  });

  // 5. Initialize File Storage (for observability data)
  console.log('[5] Initializing local file storage...');
  const fileStorage = new LocalFileStorage({
    baseDir: resolve(process.cwd(), '.mastra/observability'),
    atomicWrites: true,
  });

  // 6. Create MastraAdmin instance
  console.log('[6] Creating MastraAdmin instance...');
  const admin = new MastraAdmin({
    licenseKey: 'dev', // Development license
    storage,
    source,
    runner,
    router,
    fileStorage,
  });

  // 7. Initialize
  console.log('[7] Initializing MastraAdmin...');
  await admin.init();
  console.log('    License tier:', admin.getLicenseInfo().tier);
  console.log('    Runner: LocalProcessRunner');
  console.log('    Router: LocalEdgeRouter');
  console.log('    FileStorage: LocalFileStorage');
  console.log();

  try {
    // Create demo user first
    console.log('[8] Ensuring demo user exists...');
    let demoUser = await admin.getUser(DEMO_USER_ID);
    if (!demoUser) {
      // Create user directly via storage (since this would normally come from auth)
      await storage.createUser({
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        name: 'Demo User',
        avatarUrl: null,
      });
      demoUser = await admin.getUser(DEMO_USER_ID);
      console.log('    Created demo user:', demoUser?.email);
    } else {
      console.log('    Demo user already exists:', demoUser.email);
    }
    console.log();

    // 9. Create a team
    console.log('[9] Creating a team...');
    let team;
    try {
      team = await admin.createTeam(DEMO_USER_ID, {
        name: 'Demo Team',
        slug: 'demo-team',
      });
      console.log('    Created team:', team.name, `(${team.id})`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('already exists')) {
        console.log('    Team already exists, fetching...');
        const teams = await admin.listTeams(DEMO_USER_ID);
        team = teams.data.find(t => t.slug === 'demo-team');
        if (team) {
          console.log('    Found team:', team.name, `(${team.id})`);
        }
      } else {
        throw e;
      }
    }
    console.log();

    if (!team) {
      throw new Error('Failed to create or find team');
    }

    // 10. List team members
    console.log('[10] Listing team members...');
    const members = await admin.getTeamMembers(DEMO_USER_ID, team.id);
    console.log(`    Team has ${members.total} member(s):`);
    for (const member of members.data) {
      console.log(`    - ${member.user.email} (${member.role})`);
    }
    console.log();

    // 11. Discover local projects
    console.log('[11] Discovering local Mastra projects...');
    const discoveredProjects = await source.listProjects(team.id);
    console.log(`    Found ${discoveredProjects.length} project(s) in ${projectsDir}:`);
    for (const proj of discoveredProjects.slice(0, 5)) {
      console.log(`    - ${proj.name} (${proj.path})`);
    }
    if (discoveredProjects.length > 5) {
      console.log(`    ... and ${discoveredProjects.length - 5} more`);
    }
    console.log();

    // 12. Create a project (using first discovered project or a mock)
    console.log('[12] Creating a project in MastraAdmin...');
    let project;
    try {
      const sourceConfig = discoveredProjects[0]
        ? { path: discoveredProjects[0].path }
        : { path: '/mock/project' };

      project = await admin.createProject(DEMO_USER_ID, team.id, {
        name: discoveredProjects[0]?.name ?? 'Demo Project',
        slug: 'demo-project',
        sourceType: 'local',
        sourceConfig,
        defaultBranch: 'main',
      });
      console.log('    Created project:', project.name, `(${project.id})`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('already exists')) {
        console.log('    Project already exists, fetching...');
        const projects = await admin.listProjects(DEMO_USER_ID, team.id);
        project = projects.data.find(p => p.slug === 'demo-project');
        if (project) {
          console.log('    Found project:', project.name, `(${project.id})`);
        }
      } else {
        throw e;
      }
    }
    console.log();

    if (!project) {
      throw new Error('Failed to create or find project');
    }

    // 13. Set environment variables
    console.log('[13] Setting environment variables...');
    await admin.setEnvVar(DEMO_USER_ID, project.id, 'DEMO_API_KEY', 'demo-api-key-12345', true);
    await admin.setEnvVar(DEMO_USER_ID, project.id, 'NODE_ENV', 'development', false);
    console.log('    Set DEMO_API_KEY (secret)');
    console.log('    Set NODE_ENV (plain)');

    const envVars = await admin.getEnvVars(DEMO_USER_ID, project.id);
    console.log(`    Project has ${envVars.length} env var(s)`);
    console.log();

    // 14. Create a deployment
    console.log('[14] Creating a deployment...');
    let deployment;
    try {
      deployment = await admin.createDeployment(DEMO_USER_ID, project.id, {
        type: 'production',
        branch: 'main',
        slug: 'main--demo-project',
      });
      console.log('    Created deployment:', deployment.slug, `(${deployment.id})`);
      console.log('    Status:', deployment.status);
    } catch (e: unknown) {
      // Handle both MastraAdminError and PostgreSQL unique constraint violation
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      const isAlreadyExists = e instanceof Error && e.message.includes('already exists');
      if (isPgDuplicate || isAlreadyExists) {
        console.log('    Deployment already exists, fetching...');
        const deployments = await admin.listDeployments(DEMO_USER_ID, project.id);
        deployment = deployments.data.find(d => d.slug === 'main--demo-project');
        if (deployment) {
          console.log('    Found deployment:', deployment.slug, `(${deployment.id})`);
        }
      } else {
        throw e;
      }
    }
    console.log();

    // 15. List all deployments
    console.log('[15] Listing project deployments...');
    const deployments = await admin.listDeployments(DEMO_USER_ID, project.id);
    console.log(`    Project has ${deployments.total} deployment(s):`);
    for (const dep of deployments.data) {
      console.log(`    - ${dep.slug} (${dep.type}) - ${dep.status}`);
    }
    console.log();

    // 16. Deploy functionality
    console.log('[16] Deploy functionality...');
    console.log('    The deploy() method creates a build and queues it for processing.');
    console.log('    With @mastra/runner-local, the build will be executed locally.');
    console.log('    With @mastra/router-local, the deployed server will be exposed via HTTP.');
    console.log('    To deploy, run: const build = await admin.deploy(userId, deploymentId);');
    console.log('    For a full deployment demo, run: pnpm demo:full');
    console.log();

    // Summary
    console.log('='.repeat(60));
    console.log('Demo Complete!');
    console.log('='.repeat(60));
    console.log();
    console.log('Summary:');
    console.log(`  - Team: ${team.name} (${team.slug})`);
    console.log(`  - Project: ${project.name} (${project.slug})`);
    console.log(`  - Deployments: ${deployments.total}`);
    console.log(`  - Discovered local projects: ${discoveredProjects.length}`);
    console.log();
    console.log('MVP Infrastructure:');
    console.log('  - @mastra/admin (Core orchestrator)');
    console.log('  - @mastra/admin-server (HTTP API)');
    console.log('  - @mastra/admin-pg (PostgreSQL storage)');
    console.log('  - @mastra/source-local (Local project discovery)');
    console.log('  - @mastra/runner-local (Local process runner)');
    console.log('  - @mastra/router-local (Local edge router)');
    console.log('  - @mastra/observability-file-local (Local file storage)');
    console.log();
    console.log('Next Steps:');
    console.log('  1. Run "pnpm demo:full" for a comprehensive demo with HTTP API');
    console.log('  2. Try deploying a project with admin.deploy()');
    console.log();

  } finally {
    // Cleanup
    console.log('Shutting down...');
    await admin.shutdown();
    console.log('Done.');
  }
}

main().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
