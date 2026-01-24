import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AdminPgDB } from './db';
import { PostgresAdminStorage } from './storage';

/**
 * Integration tests for PostgresAdminStorage
 *
 * These tests require a running PostgreSQL database.
 * Use `docker compose up -d` to start the test database before running tests.
 *
 * Connection: localhost:5433, user: mastra, password: mastra, db: mastra_admin_test
 */

const TEST_CONNECTION_STRING = 'postgresql://mastra:mastra@localhost:5433/mastra_admin_test';

// Helper to clear the static schema registry between tests
function clearSchemaRegistry() {
  // Access private static field via any cast - only for testing
  (AdminPgDB as unknown as { schemaSetupRegistry: Map<string, unknown> }).schemaSetupRegistry.clear();
}

describe('PostgresAdminStorage', () => {
  // Use a single storage instance for all tests to avoid schema setup race conditions
  let storage: PostgresAdminStorage;
  const testSchemaName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    clearSchemaRegistry();
    storage = new PostgresAdminStorage({
      connectionString: TEST_CONNECTION_STRING,
      schemaName: testSchemaName,
    });
    await storage.init();
  });

  afterAll(async () => {
    if (storage) {
      try {
        await storage.db.none(`DROP SCHEMA IF EXISTS "${testSchemaName}" CASCADE`);
      } catch {
        // Ignore errors during cleanup
      }
      await storage.close();
    }
    clearSchemaRegistry();
  });

  // Helper to generate unique identifiers
  const uniqueId = () => crypto.randomUUID();
  const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const uniqueSlug = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should create storage with connection string', () => {
      expect(storage).toBeDefined();
      expect(storage.schemaName).toBe(testSchemaName);
    });

    it('should expose raw pool', () => {
      expect(storage.rawPool).toBeInstanceOf(Pool);
    });

    it('should expose db client', () => {
      expect(storage.db).toBeDefined();
      expect(typeof storage.db.query).toBe('function');
    });
  });

  describe('initialization variants', () => {
    it('should create storage with host config', async () => {
      clearSchemaRegistry();
      const schemaName = `test_host_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const storageWithHost = new PostgresAdminStorage({
        host: 'localhost',
        port: 5433,
        database: 'mastra_admin_test',
        user: 'mastra',
        password: 'mastra',
        schemaName,
      });

      await storageWithHost.init();
      expect(storageWithHost.schemaName).toBe(schemaName);

      // Cleanup
      await storageWithHost.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await storageWithHost.close();
    });

    it('should create storage with existing pool', async () => {
      clearSchemaRegistry();
      const schemaName = `test_pool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const pool = new Pool({ connectionString: TEST_CONNECTION_STRING });

      const storageWithPool = new PostgresAdminStorage({
        pool,
        schemaName,
      });

      await storageWithPool.init();
      expect(storageWithPool.schemaName).toBe(schemaName);
      expect(storageWithPool.rawPool).toBe(pool);

      // Cleanup - close storage but pool stays open (we don't own it)
      await storageWithPool.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await storageWithPool.close();
      await pool.end();
    });

    it('should skip initialization when disableInit is true', async () => {
      clearSchemaRegistry();
      const schemaName = `test_noinit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const storageNoInit = new PostgresAdminStorage({
        connectionString: TEST_CONNECTION_STRING,
        schemaName,
        disableInit: true,
      });

      await storageNoInit.init();

      // Schema should not exist
      const result = await storageNoInit.db.oneOrNone(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
        [schemaName],
      );
      expect(result).toBeNull();

      await storageNoInit.close();
    });
  });

  // ============================================================================
  // User Operations Tests
  // ============================================================================

  describe('user operations', () => {
    it('should create a user', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.name).toBe('Test User');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should get user by ID', async () => {
      const created = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Get By ID',
        avatarUrl: null,
      });

      const fetched = await storage.getUser(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should return null for non-existent user', async () => {
      const fetched = await storage.getUser(uniqueId());
      expect(fetched).toBeNull();
    });

    it('should get user by email', async () => {
      const email = uniqueEmail();
      await storage.createUser({
        id: uniqueId(),
        email,
        name: 'Find By Email',
        avatarUrl: null,
      });

      const fetched = await storage.getUserByEmail(email);
      expect(fetched).toBeDefined();
      expect(fetched!.email).toBe(email);
    });

    it('should update user', async () => {
      const created = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Original Name',
        avatarUrl: null,
      });

      const updated = await storage.updateUser(created.id, {
        name: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.png',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.avatarUrl).toBe('https://example.com/new-avatar.png');
    });

    it('should throw when updating non-existent user', async () => {
      await expect(storage.updateUser(uniqueId(), { name: 'New Name' })).rejects.toThrow(/User not found/);
    });
  });

  // ============================================================================
  // Team Operations Tests
  // ============================================================================

  describe('team operations', () => {
    it('should create a team', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Test Team',
        slug: uniqueSlug('team'),
        settings: { maxProjects: 10 },
      });

      expect(team).toBeDefined();
      expect(team.id).toBeDefined();
      expect(team.name).toBe('Test Team');
      expect(team.settings).toEqual({ maxProjects: 10 });
    });

    it('should get team by ID', async () => {
      const created = await storage.createTeam({
        id: uniqueId(),
        name: 'Get By ID Team',
        slug: uniqueSlug('get-id'),
        settings: {},
      });

      const fetched = await storage.getTeam(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should get team by slug', async () => {
      const slug = uniqueSlug('by-slug');
      await storage.createTeam({
        id: uniqueId(),
        name: 'By Slug Team',
        slug,
        settings: {},
      });

      const fetched = await storage.getTeamBySlug(slug);
      expect(fetched).toBeDefined();
      expect(fetched!.slug).toBe(slug);
    });

    it('should update team', async () => {
      const created = await storage.createTeam({
        id: uniqueId(),
        name: 'Update Team',
        slug: uniqueSlug('update'),
        settings: {},
      });

      const updated = await storage.updateTeam(created.id, {
        name: 'Updated Team Name',
        settings: { maxProjects: 5 },
      });

      expect(updated.name).toBe('Updated Team Name');
      expect(updated.settings).toEqual({ maxProjects: 5 });
    });

    it('should delete team', async () => {
      const created = await storage.createTeam({
        id: uniqueId(),
        name: 'Delete Team',
        slug: uniqueSlug('delete'),
        settings: {},
      });

      await storage.deleteTeam(created.id);

      const fetched = await storage.getTeam(created.id);
      expect(fetched).toBeNull();
    });

    it('should list teams for user', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Team List User',
        avatarUrl: null,
      });

      const team1 = await storage.createTeam({
        id: uniqueId(),
        name: 'User Team 1',
        slug: uniqueSlug('user-team-1'),
        settings: {},
      });

      const team2 = await storage.createTeam({
        id: uniqueId(),
        name: 'User Team 2',
        slug: uniqueSlug('user-team-2'),
        settings: {},
      });

      await storage.addTeamMember({ teamId: team1.id, userId: user.id, role: 'owner' });
      await storage.addTeamMember({ teamId: team2.id, userId: user.id, role: 'developer' });

      const result = await storage.listTeamsForUser(user.id);
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  // ============================================================================
  // Team Member Operations Tests
  // ============================================================================

  describe('team member operations', () => {
    it('should add team member', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Member User',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Member Team',
        slug: uniqueSlug('member'),
        settings: {},
      });

      const member = await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'developer',
      });

      expect(member).toBeDefined();
      expect(member.teamId).toBe(team.id);
      expect(member.userId).toBe(user.id);
      expect(member.role).toBe('developer');
    });

    it('should get team member', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Get Member User',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Get Member Team',
        slug: uniqueSlug('get-member'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'admin',
      });

      const fetched = await storage.getTeamMember(team.id, user.id);
      expect(fetched).toBeDefined();
      expect(fetched!.role).toBe('admin');
    });

    it('should list team members with user info', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'List Member User',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'List Member Team',
        slug: uniqueSlug('list-member'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'owner',
      });

      const result = await storage.listTeamMembers(team.id);
      expect(result.data.length).toBe(1);
      expect(result.data[0].user).toBeDefined();
      expect(result.data[0].user.email).toBe(user.email);
    });

    it('should update team member role', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Update Role User',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Update Role Team',
        slug: uniqueSlug('update-role'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'viewer',
      });

      const updated = await storage.updateTeamMemberRole(team.id, user.id, 'admin');
      expect(updated.role).toBe('admin');
    });

    it('should remove team member', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Remove Member User',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Remove Member Team',
        slug: uniqueSlug('remove-member'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'developer',
      });

      await storage.removeTeamMember(team.id, user.id);

      const fetched = await storage.getTeamMember(team.id, user.id);
      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // Team Invite Operations Tests
  // ============================================================================

  describe('team invite operations', () => {
    it('should create team invite', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Invite Creator',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Invite Team',
        slug: uniqueSlug('invite'),
        settings: {},
      });

      const invite = await storage.createTeamInvite({
        teamId: team.id,
        email: uniqueEmail(),
        role: 'developer',
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(invite).toBeDefined();
      expect(invite.role).toBe('developer');
    });

    it('should get invite by ID', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Get Invite Creator',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Get Invite Team',
        slug: uniqueSlug('get-invite'),
        settings: {},
      });

      const created = await storage.createTeamInvite({
        teamId: team.id,
        email: uniqueEmail(),
        role: 'viewer',
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const fetched = await storage.getTeamInvite(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should get invite by email', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Email Invite Creator',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Email Invite Team',
        slug: uniqueSlug('email-invite'),
        settings: {},
      });

      const inviteEmail = uniqueEmail();
      await storage.createTeamInvite({
        teamId: team.id,
        email: inviteEmail,
        role: 'admin',
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const fetched = await storage.getTeamInviteByEmail(team.id, inviteEmail);
      expect(fetched).toBeDefined();
      expect(fetched!.email).toBe(inviteEmail);
    });

    it('should list team invites', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'List Invite Creator',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'List Invite Team',
        slug: uniqueSlug('list-invite'),
        settings: {},
      });

      await storage.createTeamInvite({
        teamId: team.id,
        email: uniqueEmail(),
        role: 'developer',
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await storage.createTeamInvite({
        teamId: team.id,
        email: uniqueEmail(),
        role: 'viewer',
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invites = await storage.listTeamInvites(team.id);
      expect(invites.length).toBe(2);
    });

    it('should delete team invite', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Delete Invite Creator',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Delete Invite Team',
        slug: uniqueSlug('delete-invite'),
        settings: {},
      });

      const invite = await storage.createTeamInvite({
        teamId: team.id,
        email: uniqueEmail(),
        role: 'developer',
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await storage.deleteTeamInvite(invite.id);

      const fetched = await storage.getTeamInvite(invite.id);
      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // Project Operations Tests
  // ============================================================================

  describe('project operations', () => {
    it('should create a project', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Project Team',
        slug: uniqueSlug('project-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Test Project',
        slug: uniqueSlug('project'),
        sourceType: 'local',
        sourceConfig: { path: '/path/to/project' },
        defaultBranch: 'main',
        envVars: [],
      });

      expect(project).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.sourceType).toBe('local');
    });

    it('should get project by ID', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Get Project Team',
        slug: uniqueSlug('get-project-team'),
        settings: {},
      });

      const created = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Get By ID Project',
        slug: uniqueSlug('get-id-project'),
        sourceType: 'github',
        sourceConfig: { repoFullName: 'owner/repo', installationId: '123', isPrivate: false },
        defaultBranch: 'main',
        envVars: [],
      });

      const fetched = await storage.getProject(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should get project by slug', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Slug Project Team',
        slug: uniqueSlug('slug-project-team'),
        settings: {},
      });

      const slug = uniqueSlug('by-slug-project');
      await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'By Slug Project',
        slug,
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      const fetched = await storage.getProjectBySlug(team.id, slug);
      expect(fetched).toBeDefined();
      expect(fetched!.slug).toBe(slug);
    });

    it('should update project', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Update Project Team',
        slug: uniqueSlug('update-project-team'),
        settings: {},
      });

      const created = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Update Project',
        slug: uniqueSlug('update-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      const updated = await storage.updateProject(created.id, {
        name: 'Updated Project Name',
        defaultBranch: 'develop',
      });

      expect(updated.name).toBe('Updated Project Name');
      expect(updated.defaultBranch).toBe('develop');
    });

    it('should list projects for team', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'List Project Team',
        slug: uniqueSlug('list-project-team'),
        settings: {},
      });

      await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'List Project 1',
        slug: uniqueSlug('list-1'),
        sourceType: 'local',
        sourceConfig: { path: '/path1' },
        defaultBranch: 'main',
        envVars: [],
      });

      await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'List Project 2',
        slug: uniqueSlug('list-2'),
        sourceType: 'local',
        sourceConfig: { path: '/path2' },
        defaultBranch: 'main',
        envVars: [],
      });

      const result = await storage.listProjectsForTeam(team.id);
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should delete project', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Delete Project Team',
        slug: uniqueSlug('delete-project-team'),
        settings: {},
      });

      const created = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Delete Project',
        slug: uniqueSlug('delete-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      await storage.deleteProject(created.id);

      const fetched = await storage.getProject(created.id);
      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // Project Environment Variables Tests
  // ============================================================================

  describe('project environment variables', () => {
    let testProject: Awaited<ReturnType<typeof storage.createProject>>;

    beforeAll(async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Env Var Team',
        slug: uniqueSlug('env-var-team'),
        settings: {},
      });

      testProject = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Env Var Project',
        slug: uniqueSlug('env-var-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });
    });

    it('should set environment variable', async () => {
      const envVar = await storage.setProjectEnvVar(testProject.id, {
        key: `API_KEY_${Date.now()}`,
        encryptedValue: 'encrypted-value-123',
        isSecret: true,
      });

      expect(envVar).toBeDefined();
      expect(envVar.encryptedValue).toBe('encrypted-value-123');
      expect(envVar.isSecret).toBe(true);
    });

    it('should get environment variables', async () => {
      const key1 = `VAR_1_${Date.now()}`;
      const key2 = `VAR_2_${Date.now()}`;

      await storage.setProjectEnvVar(testProject.id, {
        key: key1,
        encryptedValue: 'value-1',
        isSecret: false,
      });

      await storage.setProjectEnvVar(testProject.id, {
        key: key2,
        encryptedValue: 'value-2',
        isSecret: true,
      });

      const envVars = await storage.getProjectEnvVars(testProject.id);
      expect(envVars.length).toBeGreaterThanOrEqual(2);
    });

    it('should update existing environment variable', async () => {
      const key = `UPDATE_VAR_${Date.now()}`;

      await storage.setProjectEnvVar(testProject.id, {
        key,
        encryptedValue: 'original-value',
        isSecret: false,
      });

      await storage.setProjectEnvVar(testProject.id, {
        key,
        encryptedValue: 'updated-value',
        isSecret: true,
      });

      const envVars = await storage.getProjectEnvVars(testProject.id);
      const updateVar = envVars.find(v => v.key === key);
      expect(updateVar).toBeDefined();
      expect(updateVar!.encryptedValue).toBe('updated-value');
      expect(updateVar!.isSecret).toBe(true);
    });

    it('should delete environment variable', async () => {
      const key = `DELETE_VAR_${Date.now()}`;

      await storage.setProjectEnvVar(testProject.id, {
        key,
        encryptedValue: 'delete-value',
        isSecret: false,
      });

      await storage.deleteProjectEnvVar(testProject.id, key);

      const envVars = await storage.getProjectEnvVars(testProject.id);
      const deleted = envVars.find(v => v.key === key);
      expect(deleted).toBeUndefined();
    });
  });

  // ============================================================================
  // Project API Token Tests
  // ============================================================================

  describe('project API tokens', () => {
    let testProject: Awaited<ReturnType<typeof storage.createProject>>;
    let tokenCreator: Awaited<ReturnType<typeof storage.createUser>>;

    beforeAll(async () => {
      tokenCreator = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Token Creator',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Token Team',
        slug: uniqueSlug('token-team'),
        settings: {},
      });

      testProject = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Token Project',
        slug: uniqueSlug('token-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });
    });

    it('should create API token', async () => {
      const token = await storage.createProjectApiToken({
        id: uniqueId(),
        projectId: testProject.id,
        name: 'Test Token',
        tokenPrefix: 'mst_',
        tokenHash: `hash_${Date.now()}_${Math.random()}`,
        scopes: ['read', 'write'],
        expiresAt: null,
        createdBy: tokenCreator.id,
      } as Parameters<typeof storage.createProjectApiToken>[0]);

      expect(token).toBeDefined();
      expect(token.name).toBe('Test Token');
      expect(token.tokenPrefix).toBe('mst_');
      expect(token.scopes).toEqual(['read', 'write']);
    });

    it('should get token by ID', async () => {
      const created = await storage.createProjectApiToken({
        id: uniqueId(),
        projectId: testProject.id,
        name: 'Get Token',
        tokenPrefix: 'mst_',
        tokenHash: `hash_get_${Date.now()}_${Math.random()}`,
        scopes: ['read'],
        expiresAt: null,
        createdBy: tokenCreator.id,
      } as Parameters<typeof storage.createProjectApiToken>[0]);

      const fetched = await storage.getProjectApiToken(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should get token by hash', async () => {
      const tokenHash = `hash_by_hash_${Date.now()}_${Math.random()}`;
      await storage.createProjectApiToken({
        id: uniqueId(),
        projectId: testProject.id,
        name: 'Hash Token',
        tokenPrefix: 'mst_',
        tokenHash,
        scopes: ['read'],
        expiresAt: null,
        createdBy: tokenCreator.id,
      } as Parameters<typeof storage.createProjectApiToken>[0]);

      const fetched = await storage.getProjectApiTokenByHash(tokenHash);
      expect(fetched).toBeDefined();
      expect(fetched!.tokenHash).toBe(tokenHash);
    });

    it('should list project tokens', async () => {
      // Create a new project for this test to get accurate count
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'List Token Team',
        slug: uniqueSlug('list-token-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'List Token Project',
        slug: uniqueSlug('list-token-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      await storage.createProjectApiToken({
        id: uniqueId(),
        projectId: project.id,
        name: 'List Token 1',
        tokenPrefix: 'mst_',
        tokenHash: `hash_list_1_${Date.now()}_${Math.random()}`,
        scopes: ['read'],
        expiresAt: null,
        createdBy: tokenCreator.id,
      } as Parameters<typeof storage.createProjectApiToken>[0]);

      await storage.createProjectApiToken({
        id: uniqueId(),
        projectId: project.id,
        name: 'List Token 2',
        tokenPrefix: 'mst_',
        tokenHash: `hash_list_2_${Date.now()}_${Math.random()}`,
        scopes: ['write'],
        expiresAt: null,
        createdBy: tokenCreator.id,
      } as Parameters<typeof storage.createProjectApiToken>[0]);

      const tokens = await storage.listProjectApiTokens(project.id);
      expect(tokens.length).toBe(2);
    });

    it('should update token last used', async () => {
      const created = await storage.createProjectApiToken({
        id: uniqueId(),
        projectId: testProject.id,
        name: 'Update Token',
        tokenPrefix: 'mst_',
        tokenHash: `hash_update_${Date.now()}_${Math.random()}`,
        scopes: ['read'],
        expiresAt: null,
        createdBy: tokenCreator.id,
      } as Parameters<typeof storage.createProjectApiToken>[0]);

      expect(created.lastUsedAt).toBeNull();

      await storage.updateProjectApiTokenLastUsed(created.id);

      const fetched = await storage.getProjectApiToken(created.id);
      expect(fetched!.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should delete token', async () => {
      const created = await storage.createProjectApiToken({
        id: uniqueId(),
        projectId: testProject.id,
        name: 'Delete Token',
        tokenPrefix: 'mst_',
        tokenHash: `hash_delete_${Date.now()}_${Math.random()}`,
        scopes: ['read'],
        expiresAt: null,
        createdBy: tokenCreator.id,
      } as Parameters<typeof storage.createProjectApiToken>[0]);

      await storage.deleteProjectApiToken(created.id);

      const fetched = await storage.getProjectApiToken(created.id);
      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // Deployment Operations Tests
  // ============================================================================

  describe('deployment operations', () => {
    let testProject: Awaited<ReturnType<typeof storage.createProject>>;

    beforeAll(async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Deployment Team',
        slug: uniqueSlug('deployment-team'),
        settings: {},
      });

      testProject = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Deployment Project',
        slug: uniqueSlug('deployment-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });
    });

    it('should create deployment', async () => {
      const deployment = await storage.createDeployment({
        id: uniqueId(),
        projectId: testProject.id,
        type: 'production',
        branch: 'main',
        slug: uniqueSlug('deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      expect(deployment).toBeDefined();
      expect(deployment.type).toBe('production');
      expect(deployment.branch).toBe('main');
      expect(deployment.status).toBe('pending');
    });

    it('should get deployment by ID', async () => {
      const created = await storage.createDeployment({
        id: uniqueId(),
        projectId: testProject.id,
        type: 'staging',
        branch: 'develop',
        slug: uniqueSlug('get-deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      const fetched = await storage.getDeployment(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should get deployment by slug', async () => {
      const slug = uniqueSlug('preview');
      await storage.createDeployment({
        id: uniqueId(),
        projectId: testProject.id,
        type: 'preview',
        branch: 'feature-x',
        slug,
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const fetched = await storage.getDeploymentBySlug(testProject.id, slug);
      expect(fetched).toBeDefined();
      expect(fetched!.slug).toBe(slug);
    });

    it('should update deployment', async () => {
      const created = await storage.createDeployment({
        id: uniqueId(),
        projectId: testProject.id,
        type: 'production',
        branch: `update-branch-${Date.now()}`,
        slug: uniqueSlug('update-deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      const updated = await storage.updateDeployment(created.id, {
        publicUrl: 'https://example.com',
        internalHost: 'localhost:3001',
      });

      expect(updated.publicUrl).toBe('https://example.com');
      expect(updated.internalHost).toBe('localhost:3001');
    });

    it('should update deployment status', async () => {
      const created = await storage.createDeployment({
        id: uniqueId(),
        projectId: testProject.id,
        type: 'production',
        branch: `status-branch-${Date.now()}`,
        slug: uniqueSlug('status-deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      const updated = await storage.updateDeploymentStatus(created.id, 'running');
      expect(updated.status).toBe('running');
    });

    it('should list deployments for project', async () => {
      // Create a new project for accurate count
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'List Deploy Team',
        slug: uniqueSlug('list-deploy-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'List Deploy Project',
        slug: uniqueSlug('list-deploy-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      await storage.createDeployment({
        id: uniqueId(),
        projectId: project.id,
        type: 'production',
        branch: 'main',
        slug: uniqueSlug('list-prod'),
        status: 'running',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      await storage.createDeployment({
        id: uniqueId(),
        projectId: project.id,
        type: 'preview',
        branch: 'feature',
        slug: uniqueSlug('list-preview'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: true,
        expiresAt: null,
      });

      const result = await storage.listDeploymentsForProject(project.id);
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should delete deployment', async () => {
      const created = await storage.createDeployment({
        id: uniqueId(),
        projectId: testProject.id,
        type: 'preview',
        branch: 'delete-me',
        slug: uniqueSlug('delete-deploy'),
        status: 'stopped',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: true,
        expiresAt: null,
      });

      await storage.deleteDeployment(created.id);

      const fetched = await storage.getDeployment(created.id);
      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // Build Operations Tests
  // ============================================================================

  describe('build operations', () => {
    let testDeployment: Awaited<ReturnType<typeof storage.createDeployment>>;

    beforeAll(async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Build Team',
        slug: uniqueSlug('build-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Build Project',
        slug: uniqueSlug('build-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      testDeployment = await storage.createDeployment({
        id: uniqueId(),
        projectId: project.id,
        type: 'production',
        branch: 'main',
        slug: uniqueSlug('build-deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });
    });

    it('should create build', async () => {
      const build = await storage.createBuild({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        trigger: 'manual',
        triggeredBy: 'user-123',
        commitSha: 'abc123',
        commitMessage: 'Initial commit',
        status: 'queued',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      expect(build).toBeDefined();
      expect(build.status).toBe('queued');
      expect(build.trigger).toBe('manual');
      expect(build.startedAt).toBeNull();
      expect(build.completedAt).toBeNull();
    });

    it('should get build by ID', async () => {
      const created = await storage.createBuild({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        trigger: 'webhook',
        triggeredBy: 'github',
        commitSha: 'def456',
        commitMessage: 'Feature commit',
        status: 'queued',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      const fetched = await storage.getBuild(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should update build status', async () => {
      const created = await storage.createBuild({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'ghi789',
        commitMessage: 'Test',
        status: 'queued',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      // Start building
      const building = await storage.updateBuildStatus(created.id, 'building');
      expect(building.status).toBe('building');
      expect(building.startedAt).toBeInstanceOf(Date);

      // Complete successfully
      const succeeded = await storage.updateBuildStatus(created.id, 'succeeded');
      expect(succeeded.status).toBe('succeeded');
      expect(succeeded.completedAt).toBeInstanceOf(Date);
    });

    it('should update build status with error message', async () => {
      const created = await storage.createBuild({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'error123',
        commitMessage: 'Test error',
        status: 'queued',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      const failed = await storage.updateBuildStatus(created.id, 'failed', 'Build failed: missing dependency');
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('Build failed: missing dependency');
      expect(failed.completedAt).toBeInstanceOf(Date);
    });

    it('should append build logs', async () => {
      const created = await storage.createBuild({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'logs123',
        commitMessage: 'Test logs',
        status: 'building',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      await storage.appendBuildLogs(created.id, 'Step 1: Installing dependencies\n');
      await storage.appendBuildLogs(created.id, 'Step 2: Building project\n');

      const fetched = await storage.getBuild(created.id);
      expect(fetched!.logs).toBe('Step 1: Installing dependencies\nStep 2: Building project\n');
    });

    it('should list builds for deployment', async () => {
      // Create a new deployment for accurate count
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'List Build Team',
        slug: uniqueSlug('list-build-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'List Build Project',
        slug: uniqueSlug('list-build-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      const deployment = await storage.createDeployment({
        id: uniqueId(),
        projectId: project.id,
        type: 'production',
        branch: 'main',
        slug: uniqueSlug('list-build-deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      await storage.createBuild({
        id: uniqueId(),
        deploymentId: deployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'list1',
        commitMessage: 'Build 1',
        status: 'succeeded',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      await storage.createBuild({
        id: uniqueId(),
        deploymentId: deployment.id,
        trigger: 'webhook',
        triggeredBy: 'github',
        commitSha: 'list2',
        commitMessage: 'Build 2',
        status: 'queued',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      const result = await storage.listBuildsForDeployment(deployment.id);
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  // ============================================================================
  // Build Queue Tests
  // ============================================================================

  describe('build queue operations', () => {
    it('should dequeue builds in FIFO order', async () => {
      // Create fresh deployment for queue test
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Queue Team',
        slug: uniqueSlug('queue-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Queue Project',
        slug: uniqueSlug('queue-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      const deployment = await storage.createDeployment({
        id: uniqueId(),
        projectId: project.id,
        type: 'production',
        branch: 'main',
        slug: uniqueSlug('queue-deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      // Create builds with different queued times
      const build1 = await storage.createBuild({
        id: uniqueId(),
        deploymentId: deployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'fifo1',
        commitMessage: 'First',
        status: 'queued',
        logs: '',
        queuedAt: new Date(Date.now() - 2000),
        errorMessage: null,
      });

      await storage.createBuild({
        id: uniqueId(),
        deploymentId: deployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'fifo2',
        commitMessage: 'Second',
        status: 'queued',
        logs: '',
        queuedAt: new Date(Date.now() - 1000),
        errorMessage: null,
      });

      // First dequeue should get the oldest build
      const dequeued1 = await storage.dequeueNextBuild();
      expect(dequeued1).toBeDefined();
      expect(dequeued1!.id).toBe(build1.id);
      expect(dequeued1!.commitSha).toBe('fifo1');
      expect(dequeued1!.status).toBe('building');
      expect(dequeued1!.startedAt).toBeInstanceOf(Date);
    });

    it('should return null when no queued builds', async () => {
      // Create a deployment with only non-queued builds
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Empty Queue Team',
        slug: uniqueSlug('empty-queue-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Empty Queue Project',
        slug: uniqueSlug('empty-queue-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      const deployment = await storage.createDeployment({
        id: uniqueId(),
        projectId: project.id,
        type: 'production',
        branch: 'main',
        slug: uniqueSlug('empty-queue-deploy'),
        status: 'pending',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      // Create a build that's already building
      await storage.createBuild({
        id: uniqueId(),
        deploymentId: deployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'building1',
        commitMessage: 'Already building',
        status: 'building',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });

      // Dequeue all queued builds first (from other tests)
      let dequeued = await storage.dequeueNextBuild();
      while (dequeued) {
        dequeued = await storage.dequeueNextBuild();
      }

      // Now queue should be empty
      const result = await storage.dequeueNextBuild();
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Running Server Operations Tests
  // ============================================================================

  describe('running server operations', () => {
    let testDeployment: Awaited<ReturnType<typeof storage.createDeployment>>;
    let testBuild: Awaited<ReturnType<typeof storage.createBuild>>;

    beforeAll(async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Server Team',
        slug: uniqueSlug('server-team'),
        settings: {},
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Server Project',
        slug: uniqueSlug('server-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      testDeployment = await storage.createDeployment({
        id: uniqueId(),
        projectId: project.id,
        type: 'production',
        branch: 'main',
        slug: uniqueSlug('server-deploy'),
        status: 'running',
        currentBuildId: null,
        publicUrl: null,
        internalHost: null,
        envVarOverrides: [],
        autoShutdown: false,
        expiresAt: null,
      });

      testBuild = await storage.createBuild({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        trigger: 'manual',
        triggeredBy: 'user',
        commitSha: 'server123',
        commitMessage: 'Server build',
        status: 'succeeded',
        logs: '',
        queuedAt: new Date(),
        errorMessage: null,
      });
    });

    it('should create running server', async () => {
      const server = await storage.createRunningServer({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        buildId: testBuild.id,
        processId: 12345,
        containerId: null,
        host: 'localhost',
        port: 3001,
        healthStatus: 'starting',
        lastHealthCheck: null,
        memoryUsageMb: null,
        cpuPercent: null,
        startedAt: new Date(),
      });

      expect(server).toBeDefined();
      expect(server.host).toBe('localhost');
      expect(server.port).toBe(3001);
      expect(server.healthStatus).toBe('starting');
      expect(server.stoppedAt).toBeNull();
    });

    it('should get running server by ID', async () => {
      const created = await storage.createRunningServer({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        buildId: testBuild.id,
        processId: 12346,
        containerId: null,
        host: 'localhost',
        port: 3002,
        healthStatus: 'healthy',
        lastHealthCheck: new Date(),
        memoryUsageMb: 256,
        cpuPercent: 5.5,
        startedAt: new Date(),
      });

      const fetched = await storage.getRunningServer(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should update running server', async () => {
      const created = await storage.createRunningServer({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        buildId: testBuild.id,
        processId: 12348,
        containerId: null,
        host: 'localhost',
        port: 3004,
        healthStatus: 'starting',
        lastHealthCheck: null,
        memoryUsageMb: null,
        cpuPercent: null,
        startedAt: new Date(),
      });

      const updated = await storage.updateRunningServer(created.id, {
        healthStatus: 'healthy',
        lastHealthCheck: new Date(),
        memoryUsageMb: 512,
        cpuPercent: 10.0,
      });

      expect(updated.healthStatus).toBe('healthy');
      expect(updated.memoryUsageMb).toBe(512);
      expect(updated.cpuPercent).toBe(10.0);
    });

    it('should stop running server', async () => {
      const created = await storage.createRunningServer({
        id: uniqueId(),
        deploymentId: testDeployment.id,
        buildId: testBuild.id,
        processId: 12349,
        containerId: null,
        host: 'localhost',
        port: 3005,
        healthStatus: 'healthy',
        lastHealthCheck: new Date(),
        memoryUsageMb: 256,
        cpuPercent: 5.0,
        startedAt: new Date(),
      });

      await storage.stopRunningServer(created.id);

      const fetched = await storage.getRunningServer(created.id);
      expect(fetched!.stoppedAt).toBeInstanceOf(Date);
    });

    it('should list running servers', async () => {
      const servers = await storage.listRunningServers();
      expect(Array.isArray(servers)).toBe(true);
    });
  });

  // ============================================================================
  // RBAC Operations Tests
  // ============================================================================

  describe('RBAC operations', () => {
    it('should get permissions for owner role', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'RBAC Owner',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'RBAC Owner Team',
        slug: uniqueSlug('rbac-owner'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'owner',
      });

      const permissions = await storage.getUserPermissionsForTeam(user.id, team.id);
      expect(permissions).toContain('team:delete');
      expect(permissions).toContain('project:delete');
      expect(permissions).toContain('member:manage');
    });

    it('should get permissions for admin role', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'RBAC Admin',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'RBAC Admin Team',
        slug: uniqueSlug('rbac-admin'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'admin',
      });

      const permissions = await storage.getUserPermissionsForTeam(user.id, team.id);
      expect(permissions).toContain('team:update');
      expect(permissions).toContain('project:delete');
      expect(permissions).not.toContain('team:delete');
      expect(permissions).not.toContain('team:manage');
    });

    it('should get permissions for developer role', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'RBAC Developer',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'RBAC Developer Team',
        slug: uniqueSlug('rbac-dev'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'developer',
      });

      const permissions = await storage.getUserPermissionsForTeam(user.id, team.id);
      expect(permissions).toContain('project:create');
      expect(permissions).toContain('deployment:deploy');
      expect(permissions).not.toContain('project:delete');
      expect(permissions).not.toContain('member:delete');
    });

    it('should get permissions for viewer role', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'RBAC Viewer',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'RBAC Viewer Team',
        slug: uniqueSlug('rbac-viewer'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'viewer',
      });

      const permissions = await storage.getUserPermissionsForTeam(user.id, team.id);
      expect(permissions).toContain('team:read');
      expect(permissions).toContain('project:read');
      expect(permissions).not.toContain('project:create');
      expect(permissions).not.toContain('deployment:deploy');
    });

    it('should return empty permissions for non-member', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Non-Member',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Non-Member Team',
        slug: uniqueSlug('non-member'),
        settings: {},
      });

      const permissions = await storage.getUserPermissionsForTeam(user.id, team.id);
      expect(permissions).toEqual([]);
    });

    it('should check specific permission - has permission', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Has Permission User',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Has Permission Team',
        slug: uniqueSlug('has-perm'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'developer',
      });

      const hasPermission = await storage.userHasPermission(user.id, team.id, 'project:create');
      expect(hasPermission).toBe(true);
    });

    it('should check specific permission - does not have permission', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'No Permission User',
        avatarUrl: null,
      });

      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'No Permission Team',
        slug: uniqueSlug('no-perm'),
        settings: {},
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'viewer',
      });

      const hasPermission = await storage.userHasPermission(user.id, team.id, 'project:create');
      expect(hasPermission).toBe(false);
    });
  });

  // ============================================================================
  // Pagination Tests
  // ============================================================================

  describe('pagination', () => {
    it('should paginate results correctly', async () => {
      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Pagination User',
        avatarUrl: null,
      });

      // Create 5 teams and add user to all
      for (let i = 0; i < 5; i++) {
        const team = await storage.createTeam({
          id: uniqueId(),
          name: `Pagination Team ${i}`,
          slug: uniqueSlug(`pagination-${i}`),
          settings: {},
        });
        await storage.addTeamMember({
          teamId: team.id,
          userId: user.id,
          role: 'developer',
        });
      }

      const page1 = await storage.listTeamsForUser(user.id, { page: 1, perPage: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.page).toBe(1);
      expect(page1.perPage).toBe(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await storage.listTeamsForUser(user.id, { page: 2, perPage: 2 });
      expect(page2.data.length).toBe(2);
      expect(page2.page).toBe(2);
      expect(page2.hasMore).toBe(true);

      const page3 = await storage.listTeamsForUser(user.id, { page: 3, perPage: 2 });
      expect(page3.data.length).toBe(1);
      expect(page3.page).toBe(3);
      expect(page3.hasMore).toBe(false);
    });

    it('should handle empty results', async () => {
      const nonExistentUser = uniqueId();
      const result = await storage.listTeamsForUser(nonExistentUser);
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should throw on invalid config', () => {
      expect(
        () =>
          new PostgresAdminStorage({
            // @ts-expect-error - Testing invalid config
            invalid: 'config',
          }),
      ).toThrow();
    });

    it('should throw on invalid schema name', () => {
      expect(
        () =>
          new PostgresAdminStorage({
            connectionString: TEST_CONNECTION_STRING,
            schemaName: 'invalid-schema-name!',
          }),
      ).toThrow(/invalid characters/);
    });

    it('should cascade delete on team deletion', async () => {
      const team = await storage.createTeam({
        id: uniqueId(),
        name: 'Cascade Team',
        slug: uniqueSlug('cascade'),
        settings: {},
      });

      const user = await storage.createUser({
        id: uniqueId(),
        email: uniqueEmail(),
        name: 'Cascade User',
        avatarUrl: null,
      });

      await storage.addTeamMember({
        teamId: team.id,
        userId: user.id,
        role: 'owner',
      });

      const project = await storage.createProject({
        id: uniqueId(),
        teamId: team.id,
        name: 'Cascade Project',
        slug: uniqueSlug('cascade-project'),
        sourceType: 'local',
        sourceConfig: { path: '/path' },
        defaultBranch: 'main',
        envVars: [],
      });

      // Delete team should cascade to members and projects
      await storage.deleteTeam(team.id);

      // Team member should be deleted
      const member = await storage.getTeamMember(team.id, user.id);
      expect(member).toBeNull();

      // Project should be deleted
      const deletedProject = await storage.getProject(project.id);
      expect(deletedProject).toBeNull();
    });
  });
});
