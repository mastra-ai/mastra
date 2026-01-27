import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { PostgresAdminStorage } from './storage';

const TEST_CONNECTION_STRING = 'postgresql://postgres:postgres@localhost:5438/mastra_admin_test';
const TEST_SCHEMA = 'mastra_admin_test';

describe('PostgresAdminStorage', () => {
  let pool: Pool;
  let storage: PostgresAdminStorage;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_CONNECTION_STRING });
    // Drop and recreate schema for clean tests
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  });

  afterAll(async () => {
    await storage?.close();
    await pool?.end();
  });

  beforeEach(async () => {
    // Drop and recreate schema for each test
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    storage = new PostgresAdminStorage({
      connectionString: TEST_CONNECTION_STRING,
      schemaName: TEST_SCHEMA,
    });
    await storage.init();
  });

  describe('init', () => {
    it('creates schema and tables', async () => {
      const result = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1
        ORDER BY table_name
      `, [TEST_SCHEMA]);

      const tableNames = result.rows.map(r => r.table_name);
      expect(tableNames).toContain('teams');
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('deployments');
      expect(tableNames).toContain('builds');
      expect(tableNames).toContain('migrations');
    });

    it('is idempotent', async () => {
      // Call init again - should not throw
      await storage.init();

      const result = await pool.query(`
        SELECT COUNT(*) FROM ${TEST_SCHEMA}.migrations
      `);
      expect(parseInt(result.rows[0].count)).toBe(1);
    });
  });

  describe('teams', () => {
    it('creates a team', async () => {
      const team = await storage.teams.create({
        name: 'Test Team',
        slug: 'test-team',
      });

      expect(team.id).toBeDefined();
      expect(team.name).toBe('Test Team');
      expect(team.slug).toBe('test-team');
      expect(team.createdAt).toBeInstanceOf(Date);
      expect(team.updatedAt).toBeInstanceOf(Date);
    });

    it('gets team by ID', async () => {
      const created = await storage.teams.create({
        name: 'Get By ID',
        slug: 'get-by-id',
      });

      const team = await storage.teams.getById(created.id);

      expect(team).not.toBeNull();
      expect(team?.name).toBe('Get By ID');
    });

    it('returns null for non-existent team', async () => {
      const team = await storage.teams.getById('00000000-0000-0000-0000-000000000000');
      expect(team).toBeNull();
    });

    it('gets team by slug', async () => {
      await storage.teams.create({
        name: 'Slug Team',
        slug: 'slug-team',
      });

      const team = await storage.teams.getBySlug('slug-team');

      expect(team).not.toBeNull();
      expect(team?.name).toBe('Slug Team');
    });

    it('lists all teams', async () => {
      await storage.teams.create({ name: 'Team 1', slug: 'team-1' });
      await storage.teams.create({ name: 'Team 2', slug: 'team-2' });

      const teams = await storage.teams.list();

      expect(teams).toHaveLength(2);
    });

    it('updates team', async () => {
      const created = await storage.teams.create({
        name: 'Original',
        slug: 'original',
      });

      const updated = await storage.teams.update(created.id, {
        name: 'Updated',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.slug).toBe('original');
    });

    it('deletes team', async () => {
      const created = await storage.teams.create({
        name: 'Delete Me',
        slug: 'delete-me',
      });

      await storage.teams.delete(created.id);

      const team = await storage.teams.getById(created.id);
      expect(team).toBeNull();
    });

    it('enforces unique slug', async () => {
      await storage.teams.create({ name: 'Team 1', slug: 'unique-slug' });

      await expect(
        storage.teams.create({ name: 'Team 2', slug: 'unique-slug' })
      ).rejects.toThrow();
    });
  });

  describe('projects', () => {
    let teamId: string;

    beforeEach(async () => {
      const team = await storage.teams.create({ name: 'Test Team', slug: 'test-team' });
      teamId = team.id;
    });

    it('creates a project', async () => {
      const project = await storage.projects.create({
        teamId,
        name: 'Test Project',
        slug: 'test-project',
        sourceType: 'local',
        sourceConfig: { path: '/path/to/project' },
        defaultBranch: 'main',
        envVars: [],
      });

      expect(project.id).toBeDefined();
      expect(project.teamId).toBe(teamId);
      expect(project.name).toBe('Test Project');
      expect(project.sourceConfig).toEqual({ path: '/path/to/project' });
    });

    it('gets project by ID', async () => {
      const created = await storage.projects.create({
        teamId,
        name: 'Get Project',
        slug: 'get-project',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });

      const project = await storage.projects.getById(created.id);

      expect(project).not.toBeNull();
      expect(project?.name).toBe('Get Project');
    });

    it('gets project by team ID and slug', async () => {
      await storage.projects.create({
        teamId,
        name: 'Slug Project',
        slug: 'slug-project',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });

      const project = await storage.projects.getBySlug(teamId, 'slug-project');

      expect(project).not.toBeNull();
      expect(project?.name).toBe('Slug Project');
    });

    it('lists projects by team', async () => {
      await storage.projects.create({
        teamId,
        name: 'Project 1',
        slug: 'project-1',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });
      await storage.projects.create({
        teamId,
        name: 'Project 2',
        slug: 'project-2',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });

      const projects = await storage.projects.listByTeam(teamId);

      expect(projects).toHaveLength(2);
    });

    it('updates project', async () => {
      const created = await storage.projects.create({
        teamId,
        name: 'Original',
        slug: 'original',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });

      const updated = await storage.projects.update(created.id, {
        name: 'Updated',
        defaultBranch: 'develop',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.defaultBranch).toBe('develop');
    });

    it('handles envVars as JSONB', async () => {
      const envVars = [
        { key: 'API_KEY', encryptedValue: 'encrypted123', isSecret: true },
        { key: 'DEBUG', encryptedValue: 'true', isSecret: false },
      ];

      const project = await storage.projects.create({
        teamId,
        name: 'Env Project',
        slug: 'env-project',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars,
      });

      expect(project.envVars).toHaveLength(2);
      expect(project.envVars[0].key).toBe('API_KEY');
      expect(project.envVars[0].isSecret).toBe(true);
    });

    it('handles malformed envVars JSONB gracefully', async () => {
      // Insert with empty object instead of array to test safeArray
      // This simulates corrupted JSONB data
      const result = await pool.query(`
        INSERT INTO ${TEST_SCHEMA}.projects
        (team_id, name, slug, source_type, source_config, default_branch, env_vars)
        VALUES ($1, 'Malformed Env', 'malformed-env', 'local', '{}', 'main', '{}')
        RETURNING id
      `, [teamId]);

      const project = await storage.projects.getById(result.rows[0].id);

      expect(project).not.toBeNull();
      // safeArray should convert {} to [] since it's not an array
      expect(project?.envVars).toEqual([]);
    });

    it('handles empty array envVars correctly', async () => {
      const project = await storage.projects.create({
        teamId,
        name: 'Empty Env',
        slug: 'empty-env',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });

      expect(project.envVars).toEqual([]);
    });

    it('cascades delete when team is deleted', async () => {
      const project = await storage.projects.create({
        teamId,
        name: 'Cascade Project',
        slug: 'cascade-project',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });

      await storage.teams.delete(teamId);

      const deleted = await storage.projects.getById(project.id);
      expect(deleted).toBeNull();
    });
  });

  describe('deployments', () => {
    let teamId: string;
    let projectId: string;

    beforeEach(async () => {
      const team = await storage.teams.create({ name: 'Test Team', slug: 'test-team' });
      teamId = team.id;
      const project = await storage.projects.create({
        teamId,
        name: 'Test Project',
        slug: 'test-project',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });
      projectId = project.id;
    });

    it('creates a deployment', async () => {
      const deployment = await storage.deployments.create({
        projectId,
        type: 'production',
        branch: 'main',
        slug: 'main',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });

      expect(deployment.id).toBeDefined();
      expect(deployment.projectId).toBe(projectId);
      expect(deployment.type).toBe('production');
      expect(deployment.status).toBe('pending');
    });

    it('gets deployment by ID', async () => {
      const created = await storage.deployments.create({
        projectId,
        type: 'staging',
        branch: 'develop',
        slug: 'develop',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });

      const deployment = await storage.deployments.getById(created.id);

      expect(deployment).not.toBeNull();
      expect(deployment?.type).toBe('staging');
    });

    it('lists deployments by project', async () => {
      await storage.deployments.create({
        projectId,
        type: 'production',
        branch: 'main',
        slug: 'main',
        status: 'running',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });
      await storage.deployments.create({
        projectId,
        type: 'staging',
        branch: 'develop',
        slug: 'develop',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });

      const deployments = await storage.deployments.listByProject(projectId);

      expect(deployments).toHaveLength(2);
    });

    it('lists deployments by status', async () => {
      await storage.deployments.create({
        projectId,
        type: 'production',
        branch: 'main',
        slug: 'main',
        status: 'running',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });
      await storage.deployments.create({
        projectId,
        type: 'staging',
        branch: 'develop',
        slug: 'develop',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });

      const running = await storage.deployments.listByStatus('running');
      const pending = await storage.deployments.listByStatus('pending');

      expect(running).toHaveLength(1);
      expect(pending).toHaveLength(1);
    });

    it('updates deployment', async () => {
      const created = await storage.deployments.create({
        projectId,
        type: 'production',
        branch: 'main',
        slug: 'main',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });

      const updated = await storage.deployments.update(created.id, {
        status: 'running',
        port: 4100,
        processId: 12345,
        publicUrl: 'http://app.mastra.local',
      });

      expect(updated.status).toBe('running');
      expect(updated.port).toBe(4100);
      expect(updated.processId).toBe(12345);
      expect(updated.publicUrl).toBe('http://app.mastra.local');
    });

    it('handles envVarOverrides as JSONB', async () => {
      const envVarOverrides = [
        { key: 'ENV', encryptedValue: 'production', isSecret: false },
      ];

      const deployment = await storage.deployments.create({
        projectId,
        type: 'production',
        branch: 'main',
        slug: 'main',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides,
      });

      expect(deployment.envVarOverrides).toHaveLength(1);
      expect(deployment.envVarOverrides[0].key).toBe('ENV');
    });

    it('cascades delete when project is deleted', async () => {
      const deployment = await storage.deployments.create({
        projectId,
        type: 'production',
        branch: 'main',
        slug: 'main',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });

      await storage.projects.delete(projectId);

      const deleted = await storage.deployments.getById(deployment.id);
      expect(deleted).toBeNull();
    });
  });

  describe('builds', () => {
    let teamId: string;
    let projectId: string;
    let deploymentId: string;

    beforeEach(async () => {
      const team = await storage.teams.create({ name: 'Test Team', slug: 'test-team' });
      teamId = team.id;
      const project = await storage.projects.create({
        teamId,
        name: 'Test Project',
        slug: 'test-project',
        sourceType: 'local',
        sourceConfig: {},
        defaultBranch: 'main',
        envVars: [],
      });
      projectId = project.id;
      const deployment = await storage.deployments.create({
        projectId,
        type: 'production',
        branch: 'main',
        slug: 'main',
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        port: null,
        processId: null,
        envVarOverrides: [],
      });
      deploymentId = deployment.id;
    });

    it('creates a build', async () => {
      const build = await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'queued',
        logPath: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      });

      expect(build.id).toBeDefined();
      expect(build.deploymentId).toBe(deploymentId);
      expect(build.trigger).toBe('manual');
      expect(build.status).toBe('queued');
    });

    it('gets build by ID', async () => {
      const created = await storage.builds.create({
        deploymentId,
        trigger: 'webhook',
        status: 'queued',
        logPath: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      });

      const build = await storage.builds.getById(created.id);

      expect(build).not.toBeNull();
      expect(build?.trigger).toBe('webhook');
    });

    it('lists builds by deployment', async () => {
      await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'succeeded',
        logPath: null,
        queuedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
      });
      await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'queued',
        logPath: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      });

      const builds = await storage.builds.listByDeployment(deploymentId);

      expect(builds).toHaveLength(2);
    });

    it('lists builds by status', async () => {
      await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'queued',
        logPath: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      });
      await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'building',
        logPath: null,
        queuedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      });

      const queued = await storage.builds.listByStatus('queued');
      const building = await storage.builds.listByStatus('building');

      expect(queued).toHaveLength(1);
      expect(building).toHaveLength(1);
    });

    it('updates build', async () => {
      const created = await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'queued',
        logPath: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      });

      const startedAt = new Date();
      const updated = await storage.builds.update(created.id, {
        status: 'building',
        startedAt,
        logPath: '/logs/build-123.log',
      });

      expect(updated.status).toBe('building');
      expect(updated.logPath).toBe('/logs/build-123.log');
      expect(updated.startedAt).toBeInstanceOf(Date);
    });

    it('updates build with error', async () => {
      const created = await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'building',
        logPath: null,
        queuedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      });

      const updated = await storage.builds.update(created.id, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: 'Build failed: npm install error',
      });

      expect(updated.status).toBe('failed');
      expect(updated.errorMessage).toBe('Build failed: npm install error');
    });

    it('cascades delete when deployment is deleted', async () => {
      const build = await storage.builds.create({
        deploymentId,
        trigger: 'manual',
        status: 'queued',
        logPath: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      });

      await storage.deployments.delete(deploymentId);

      const deleted = await storage.builds.getById(build.id);
      expect(deleted).toBeNull();
    });

    it('handles all build triggers', async () => {
      const triggers: Array<'manual' | 'webhook' | 'schedule'> = ['manual', 'webhook', 'schedule'];

      for (const trigger of triggers) {
        const build = await storage.builds.create({
          deploymentId,
          trigger,
          status: 'queued',
          logPath: null,
          queuedAt: new Date(),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
        });

        expect(build.trigger).toBe(trigger);
      }
    });

    it('handles all build statuses', async () => {
      const statuses: Array<'queued' | 'building' | 'deploying' | 'succeeded' | 'failed'> = [
        'queued',
        'building',
        'deploying',
        'succeeded',
        'failed',
      ];

      for (const status of statuses) {
        const build = await storage.builds.create({
          deploymentId,
          trigger: 'manual',
          status,
          logPath: null,
          queuedAt: new Date(),
          startedAt: status !== 'queued' ? new Date() : null,
          completedAt: status === 'succeeded' || status === 'failed' ? new Date() : null,
          errorMessage: null,
        });

        expect(build.status).toBe(status);
      }
    });
  });

  describe('updated_at trigger', () => {
    it('automatically updates updated_at on team update', async () => {
      const team = await storage.teams.create({ name: 'Trigger Test', slug: 'trigger-test' });
      const originalUpdatedAt = team.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      const updated = await storage.teams.update(team.id, { name: 'Updated Name' });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
