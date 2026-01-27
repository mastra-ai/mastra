/**
 * Project Management Demo
 *
 * Demonstrates project creation, environment variables, and deployments.
 */

import 'dotenv/config';

import { MastraAdmin } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalProjectSource } from '@mastra/source-local';
import { resolve } from 'path';

// Use valid UUID
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000003';

async function main() {
  console.log('Project Management Demo\n');

  const storage = new PostgresAdminStorage({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/mastra_admin',
  });

  const projectsDir = process.env['PROJECTS_DIR'] ?? resolve(process.cwd(), '../');
  const source = new LocalProjectSource({
    basePaths: [projectsDir],
    maxDepth: 3,
  });

  const admin = new MastraAdmin({
    licenseKey: 'dev',
    storage,
    source,
  });

  await admin.init();

  try {
    // Ensure user exists
    let user = await admin.getUser(DEMO_USER_ID);
    if (!user) {
      await storage.createUser({
        id: DEMO_USER_ID,
        email: 'projects-demo@example.com',
        name: 'Projects Demo User',
        avatarUrl: null,
      });
      console.log('Created demo user\n');
    }

    // Create a team
    let team;
    try {
      team = await admin.createTeam(DEMO_USER_ID, {
        name: 'Projects Demo Team',
        slug: 'projects-demo',
      });
      console.log(`Created team: ${team.name}\n`);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const teams = await admin.listTeams(DEMO_USER_ID);
        team = teams.data.find(t => t.slug === 'projects-demo');
        console.log(`Using existing team: ${team?.name}\n`);
      }
    }

    if (!team) throw new Error('Failed to get team');

    // Discover local projects
    console.log('Discovering local Mastra projects...');
    const discovered = await source.listProjects(team.id);
    console.log(`Found ${discovered.length} project(s):\n`);

    for (const proj of discovered.slice(0, 3)) {
      console.log(`  ${proj.name}`);
      console.log(`    Path: ${proj.path}`);
      console.log(`    Type: ${proj.type}`);
      if (proj.metadata) {
        console.log(`    Package Manager: ${proj.metadata.packageManager}`);
        console.log(`    Has Dependencies: ${proj.metadata.hasDependencies}`);
      }
      console.log();
    }

    // Create projects from discovered
    console.log('Creating projects in MastraAdmin...\n');
    const createdProjects = [];

    for (const disc of discovered.slice(0, 2)) {
      const slug = disc.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      try {
        const project = await admin.createProject(DEMO_USER_ID, team.id, {
          name: disc.name,
          slug,
          sourceType: 'local',
          sourceConfig: { path: disc.path },
          defaultBranch: 'main',
        });
        console.log(`Created project: ${project.name}`);
        createdProjects.push(project);
      } catch (e: unknown) {
        const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
          const projects = await admin.listProjects(DEMO_USER_ID, team.id);
          const existing = projects.data.find(p => p.slug === slug);
          if (existing) {
            console.log(`Project exists: ${existing.name}`);
            createdProjects.push(existing);
          }
        }
      }
    }

    console.log();

    // Set environment variables for first project
    if (createdProjects[0]) {
      const project = createdProjects[0];
      console.log(`Setting environment variables for ${project.name}...`);

      const envVars = [
        { key: 'DATABASE_URL', value: 'postgresql://localhost/mydb', isSecret: true },
        { key: 'REDIS_URL', value: 'redis://localhost:6379', isSecret: true },
        { key: 'LOG_LEVEL', value: 'info', isSecret: false },
        { key: 'NODE_ENV', value: 'production', isSecret: false },
      ];

      for (const env of envVars) {
        await admin.setEnvVar(DEMO_USER_ID, project.id, env.key, env.value, env.isSecret);
        console.log(`  Set: ${env.key} (${env.isSecret ? 'encrypted' : 'plain'})`);
      }

      console.log();

      // Create deployments
      console.log(`Creating deployments for ${project.name}...`);

      const deploymentConfigs = [
        { type: 'production' as const, branch: 'main' },
        { type: 'staging' as const, branch: 'develop' },
        { type: 'preview' as const, branch: 'feature/new-feature', autoShutdown: true },
      ];

      for (const config of deploymentConfigs) {
        const slug = `${config.branch.replace('/', '-')}--${project.slug}`;
        try {
          const deployment = await admin.createDeployment(DEMO_USER_ID, project.id, {
            ...config,
            slug,
          });
          console.log(`  Created: ${deployment.slug} (${deployment.type})`);
        } catch (e: unknown) {
          const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
            console.log(`  Exists: ${slug} (${config.type})`);
          }
        }
      }

      console.log();

      // List deployments
      const deployments = await admin.listDeployments(DEMO_USER_ID, project.id);
      console.log(`Project has ${deployments.total} deployment(s):`);
      for (const dep of deployments.data) {
        console.log(`  - ${dep.slug}`);
        console.log(`    Type: ${dep.type}`);
        console.log(`    Branch: ${dep.branch}`);
        console.log(`    Status: ${dep.status}`);
        console.log(`    Auto-shutdown: ${dep.autoShutdown}`);
        console.log();
      }
    }

    console.log('Project demo complete!');
  } finally {
    await admin.shutdown();
  }
}

main().catch(console.error);
