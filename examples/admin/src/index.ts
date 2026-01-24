/**
 * MastraAdmin Demo Application
 *
 * This demo showcases the core functionality of the Mastra Admin platform:
 * - Team management
 * - Project management
 * - Deployment management
 * - Environment variable handling
 *
 * Run with: pnpm dev
 */

import 'dotenv/config';

import { MastraAdmin, TeamRole } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalProjectSource } from '@mastra/source-local';
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

  // 3. Create MastraAdmin instance
  console.log('[3] Creating MastraAdmin instance...');
  const admin = new MastraAdmin({
    licenseKey: 'dev', // Development license
    storage,
    source,
    // Note: runner and router are not yet implemented
    // They will be added once @mastra/runner-local and @mastra/router-local are available
  });

  // 4. Initialize
  console.log('[4] Initializing MastraAdmin...');
  await admin.init();
  console.log('    License tier:', admin.getLicenseInfo().tier);
  console.log();

  try {
    // Create demo user first
    console.log('[5] Ensuring demo user exists...');
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

    // 5. Create a team
    console.log('[6] Creating a team...');
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

    // 6. List team members
    console.log('[7] Listing team members...');
    const members = await admin.getTeamMembers(DEMO_USER_ID, team.id);
    console.log(`    Team has ${members.total} member(s):`);
    for (const member of members.data) {
      console.log(`    - ${member.user.email} (${member.role})`);
    }
    console.log();

    // 7. Discover local projects
    console.log('[8] Discovering local Mastra projects...');
    const discoveredProjects = await source.listProjects(team.id);
    console.log(`    Found ${discoveredProjects.length} project(s) in ${projectsDir}:`);
    for (const proj of discoveredProjects.slice(0, 5)) {
      console.log(`    - ${proj.name} (${proj.path})`);
    }
    if (discoveredProjects.length > 5) {
      console.log(`    ... and ${discoveredProjects.length - 5} more`);
    }
    console.log();

    // 8. Create a project (using first discovered project or a mock)
    console.log('[9] Creating a project in MastraAdmin...');
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

    // 9. Set environment variables
    console.log('[10] Setting environment variables...');
    await admin.setEnvVar(DEMO_USER_ID, project.id, 'DEMO_API_KEY', 'demo-api-key-12345', true);
    await admin.setEnvVar(DEMO_USER_ID, project.id, 'NODE_ENV', 'development', false);
    console.log('    Set DEMO_API_KEY (secret)');
    console.log('    Set NODE_ENV (plain)');

    const envVars = await admin.getEnvVars(DEMO_USER_ID, project.id);
    console.log(`    Project has ${envVars.length} env var(s)`);
    console.log();

    // 10. Create a deployment
    console.log('[11] Creating a deployment...');
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

    // 11. List all deployments
    console.log('[12] Listing project deployments...');
    const deployments = await admin.listDeployments(DEMO_USER_ID, project.id);
    console.log(`    Project has ${deployments.total} deployment(s):`);
    for (const dep of deployments.data) {
      console.log(`    - ${dep.slug} (${dep.type}) - ${dep.status}`);
    }
    console.log();

    // Note about deploy functionality
    console.log('[13] Deploy functionality...');
    console.log('    Note: The deploy() method creates a build and queues it for processing.');
    console.log('    However, actual deployment requires @mastra/runner-local which is not yet implemented.');
    console.log('    Once runner-local is available, you can deploy with:');
    console.log('      const build = await admin.deploy(userId, deploymentId);');
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
    console.log('Next Steps:');
    console.log('  1. Run "pnpm demo:full" for a more comprehensive demo');
    console.log('  2. Check out AdminServer for HTTP API access');
    console.log('  3. Wait for @mastra/runner-local to enable actual deployments');
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
