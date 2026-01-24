/**
 * MastraAdmin Full Demo
 *
 * This comprehensive demo showcases all available admin functionality:
 * - MastraAdmin direct usage
 * - AdminServer HTTP API
 * - Team/Project/Deployment lifecycle
 * - RBAC and permissions
 */

import 'dotenv/config';

import {
  MastraAdmin,
  TeamRole,
  LicenseFeature,
  type Team,
  type Project,
  type Deployment,
} from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { AdminServer } from '@mastra/admin-server';
import { LocalProjectSource } from '@mastra/source-local';
import { resolve } from 'path';

// Configuration - use valid UUIDs
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_EMAIL = 'demo@example.com';

class AdminDemo {
  private admin!: MastraAdmin;
  private server!: AdminServer;
  private storage!: PostgresAdminStorage;

  async setup() {
    console.log('\n[Setup] Initializing MastraAdmin platform...\n');

    // Initialize storage
    this.storage = new PostgresAdminStorage({
      connectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/mastra_admin',
      schemaName: 'mastra_admin',
    });

    // Initialize project source
    const projectsDir = process.env['PROJECTS_DIR'] ?? resolve(process.cwd(), '../');
    const source = new LocalProjectSource({
      basePaths: [projectsDir],
      watchChanges: false,
      maxDepth: 3,
    });

    // Create MastraAdmin
    this.admin = new MastraAdmin({
      licenseKey: 'dev',
      storage: this.storage,
      source,
    });

    await this.admin.init();
    console.log('  MastraAdmin initialized');
    console.log('  License:', this.admin.getLicenseInfo().tier);

    // Create AdminServer
    this.server = new AdminServer({
      admin: this.admin,
      port: PORT,
      cors: {
        origin: '*',
        credentials: true,
      },
    });

    await this.server.start();
    console.log(`  AdminServer running on http://localhost:${PORT}`);
    console.log();
  }

  async ensureUser(): Promise<void> {
    console.log('[Users] Ensuring demo user exists...');
    let user = await this.admin.getUser(DEMO_USER_ID);
    if (!user) {
      await this.storage.createUser({
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        name: 'Demo User',
        avatarUrl: null,
      });
      user = await this.admin.getUser(DEMO_USER_ID);
      console.log('  Created user:', user?.email);
    } else {
      console.log('  User exists:', user.email);
    }
    console.log();
  }

  async demoTeamManagement(): Promise<Team> {
    console.log('[Teams] Demonstrating team management...');

    // Create a team
    let team: Team | null = null;
    try {
      team = await this.admin.createTeam(DEMO_USER_ID, {
        name: 'Engineering Team',
        slug: 'engineering',
      });
      console.log('  Created team:', team.name);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const teams = await this.admin.listTeams(DEMO_USER_ID);
        team = teams.data.find(t => t.slug === 'engineering') ?? null;
        console.log('  Team already exists:', team?.name);
      } else {
        throw e;
      }
    }

    if (!team) {
      throw new Error('Failed to create or find team');
    }

    // List members
    const members = await this.admin.getTeamMembers(DEMO_USER_ID, team.id);
    console.log(`  Team has ${members.total} member(s)`);

    // Invite a member (will send to console)
    try {
      const invite = await this.admin.inviteMember(
        DEMO_USER_ID,
        team.id,
        'colleague@example.com',
        TeamRole.DEVELOPER,
      );
      console.log('  Invited:', invite.email, '(check console for email)');
    } catch (e) {
      console.log('  Invite already exists or failed');
    }

    console.log();
    return team;
  }

  async demoProjectManagement(team: Team): Promise<Project> {
    console.log('[Projects] Demonstrating project management...');

    // Create a project
    let project: Project | null = null;
    try {
      project = await this.admin.createProject(DEMO_USER_ID, team.id, {
        name: 'AI Assistant',
        slug: 'ai-assistant',
        sourceType: 'local',
        sourceConfig: { path: '/projects/ai-assistant' },
        defaultBranch: 'main',
      });
      console.log('  Created project:', project.name);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const projects = await this.admin.listProjects(DEMO_USER_ID, team.id);
        project = projects.data.find(p => p.slug === 'ai-assistant') ?? null;
        console.log('  Project exists:', project?.name);
      } else {
        throw e;
      }
    }

    if (!project) {
      throw new Error('Failed to create or find project');
    }

    // Set environment variables
    console.log('  Setting environment variables...');
    await this.admin.setEnvVar(DEMO_USER_ID, project.id, 'OPENAI_API_KEY', 'sk-demo-key-12345', true);
    await this.admin.setEnvVar(DEMO_USER_ID, project.id, 'LOG_LEVEL', 'debug', false);
    await this.admin.setEnvVar(DEMO_USER_ID, project.id, 'MAX_TOKENS', '4096', false);

    const envVars = await this.admin.getEnvVars(DEMO_USER_ID, project.id);
    console.log(`  Project has ${envVars.length} env vars`);
    for (const env of envVars) {
      console.log(`    - ${env.key} (${env.isSecret ? 'secret' : 'plain'})`);
    }

    console.log();
    return project;
  }

  async demoDeploymentManagement(project: Project): Promise<Deployment> {
    console.log('[Deployments] Demonstrating deployment management...');

    // Create production deployment
    let prodDeployment: Deployment | null = null;
    try {
      prodDeployment = await this.admin.createDeployment(DEMO_USER_ID, project.id, {
        type: 'production',
        branch: 'main',
        slug: 'prod-ai-assistant',
      });
      console.log('  Created production deployment:', prodDeployment.slug);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const deployments = await this.admin.listDeployments(DEMO_USER_ID, project.id);
        prodDeployment = deployments.data.find(d => d.slug === 'prod-ai-assistant') ?? null;
        console.log('  Production deployment exists:', prodDeployment?.slug);
      } else {
        throw e;
      }
    }

    // Create staging deployment
    let stagingDeployment: Deployment | null = null;
    try {
      stagingDeployment = await this.admin.createDeployment(DEMO_USER_ID, project.id, {
        type: 'staging',
        branch: 'develop',
        slug: 'staging-ai-assistant',
      });
      console.log('  Created staging deployment:', stagingDeployment.slug);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const deployments = await this.admin.listDeployments(DEMO_USER_ID, project.id);
        stagingDeployment = deployments.data.find(d => d.slug === 'staging-ai-assistant') ?? null;
        console.log('  Staging deployment exists:', stagingDeployment?.slug);
      }
    }

    // Create preview deployment
    let previewDeployment: Deployment | null = null;
    try {
      previewDeployment = await this.admin.createDeployment(DEMO_USER_ID, project.id, {
        type: 'preview',
        branch: 'feature/new-agent',
        slug: 'preview-new-agent',
        autoShutdown: true,
      });
      console.log('  Created preview deployment:', previewDeployment.slug);
    } catch (e: unknown) {
      const isPgDuplicate = e && typeof e === 'object' && 'code' in e && e.code === '23505';
      if (isPgDuplicate || (e instanceof Error && e.message.includes('already exists'))) {
        const deployments = await this.admin.listDeployments(DEMO_USER_ID, project.id);
        previewDeployment = deployments.data.find(d => d.slug === 'preview-new-agent') ?? null;
        console.log('  Preview deployment exists:', previewDeployment?.slug);
      }
    }

    // List all deployments
    const deployments = await this.admin.listDeployments(DEMO_USER_ID, project.id);
    console.log(`  Project has ${deployments.total} deployment(s):`);
    for (const dep of deployments.data) {
      console.log(`    - ${dep.slug} (${dep.type}) [${dep.status}]`);
    }

    console.log();
    return prodDeployment!;
  }

  async demoHttpApi(team: Team, project: Project) {
    console.log('[HTTP API] Demonstrating AdminServer endpoints...');
    console.log(`  Base URL: http://localhost:${PORT}`);
    console.log();
    console.log('  Available endpoints:');
    console.log('    GET  /api/health          - Health check');
    console.log('    GET  /api/teams           - List teams');
    console.log('    POST /api/teams           - Create team');
    console.log('    GET  /api/teams/:id       - Get team');
    console.log('    GET  /api/projects        - List projects');
    console.log('    POST /api/projects        - Create project');
    console.log('    GET  /api/deployments     - List deployments');
    console.log('    POST /api/deployments/:id/deploy - Trigger deploy');
    console.log();
    console.log('  Try these curl commands:');
    console.log();
    console.log(`  # Health check`);
    console.log(`  curl http://localhost:${PORT}/api/health`);
    console.log();
    console.log(`  # List teams (requires auth header in production)`);
    console.log(`  curl http://localhost:${PORT}/api/teams`);
    console.log();
    console.log(`  # Get specific team`);
    console.log(`  curl http://localhost:${PORT}/api/teams/${team.id}`);
    console.log();
  }

  async demoLicenseFeatures() {
    console.log('[License] Demonstrating license features...');
    const license = this.admin.getLicenseInfo();

    console.log('  License Info:');
    console.log(`    Tier: ${license.tier}`);
    console.log(`    Max Teams: ${license.maxTeams ?? 'unlimited'}`);
    console.log(`    Max Projects: ${license.maxProjects ?? 'unlimited'}`);
    console.log(`    Max Users Per Team: ${license.maxUsersPerTeam ?? 'unlimited'}`);
    console.log();

    console.log('  Feature Checks:');
    console.log(`    ${LicenseFeature.GITHUB_SOURCE}: ${this.admin.hasFeature(LicenseFeature.GITHUB_SOURCE)}`);
    console.log(`    ${LicenseFeature.K8S_RUNNER}: ${this.admin.hasFeature(LicenseFeature.K8S_RUNNER)}`);
    console.log(`    ${LicenseFeature.SSO}: ${this.admin.hasFeature(LicenseFeature.SSO)}`);
    console.log(`    ${LicenseFeature.AUDIT_LOGS}: ${this.admin.hasFeature(LicenseFeature.AUDIT_LOGS)}`);
    console.log();
  }

  async cleanup() {
    console.log('[Cleanup] Shutting down...');
    await this.server.stop();
    await this.admin.shutdown();
    console.log('  Done.');
  }

  async run() {
    try {
      await this.setup();
      await this.ensureUser();

      const team = await this.demoTeamManagement();
      const project = await this.demoProjectManagement(team);
      const deployment = await this.demoDeploymentManagement(project);

      await this.demoLicenseFeatures();
      await this.demoHttpApi(team, project);

      console.log('='.repeat(60));
      console.log('Demo Complete!');
      console.log('='.repeat(60));
      console.log();
      console.log('The AdminServer is still running. Press Ctrl+C to stop.');
      console.log();

      // Keep running until interrupted
      await new Promise(() => {});
    } catch (error) {
      console.error('Demo failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

const demo = new AdminDemo();

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down...');
  await demo.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down...');
  await demo.cleanup();
  process.exit(0);
});

demo.run();
