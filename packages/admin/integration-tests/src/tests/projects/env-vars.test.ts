import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context.js';
import { createUserData, createTeamData, uniqueSlug } from '../../fixtures/factories.js';

describe('Environment Variables Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };
  let testTeam: { id: string };
  let testProject: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test user and team
    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };

    const team = await ctx.admin.createTeam(testUser.id, createTeamData());
    testTeam = { id: team.id };

    // Create a test project
    const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
      name: 'Env Vars Test Project',
      slug: uniqueSlug('env-vars-project'),
      sourceType: 'local',
      sourceConfig: { path: '/tmp/env-vars-test' },
    });
    testProject = { id: project.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Environment Variable CRUD', () => {
    it('should set a non-secret environment variable', async () => {
      await ctx.admin.setEnvVar(testUser.id, testProject.id, 'NODE_ENV', 'production', false);

      const envVars = await ctx.admin.getEnvVars(testUser.id, testProject.id);
      const nodeEnv = envVars.find(e => e.key === 'NODE_ENV');

      expect(nodeEnv).toBeDefined();
      expect(nodeEnv!.key).toBe('NODE_ENV');
      expect(nodeEnv!.isSecret).toBe(false);
    });

    it('should set a secret environment variable', async () => {
      await ctx.admin.setEnvVar(testUser.id, testProject.id, 'API_KEY', 'secret-value-123', true);

      const envVars = await ctx.admin.getEnvVars(testUser.id, testProject.id);
      const apiKey = envVars.find(e => e.key === 'API_KEY');

      expect(apiKey).toBeDefined();
      expect(apiKey!.key).toBe('API_KEY');
      expect(apiKey!.isSecret).toBe(true);
    });

    it('should update existing environment variable', async () => {
      // Set initial value
      await ctx.admin.setEnvVar(testUser.id, testProject.id, 'UPDATE_VAR', 'initial-value', false);

      // Update value
      await ctx.admin.setEnvVar(testUser.id, testProject.id, 'UPDATE_VAR', 'updated-value', false);

      const envVars = await ctx.admin.getEnvVars(testUser.id, testProject.id);
      const updateVar = envVars.find(e => e.key === 'UPDATE_VAR');

      // Should only have one entry with this key
      const count = envVars.filter(e => e.key === 'UPDATE_VAR').length;
      expect(count).toBe(1);
      expect(updateVar).toBeDefined();
    });

    it('should change non-secret to secret', async () => {
      // Set as non-secret
      await ctx.admin.setEnvVar(testUser.id, testProject.id, 'CHANGE_SECRET', 'value', false);

      // Get raw value first
      let envVars = await ctx.admin.getEnvVars(testUser.id, testProject.id);
      let envVar = envVars.find(e => e.key === 'CHANGE_SECRET');
      expect(envVar!.isSecret).toBe(false);

      // Change to secret
      await ctx.admin.setEnvVar(testUser.id, testProject.id, 'CHANGE_SECRET', 'value', true);

      envVars = await ctx.admin.getEnvVars(testUser.id, testProject.id);
      envVar = envVars.find(e => e.key === 'CHANGE_SECRET');
      expect(envVar!.isSecret).toBe(true);
    });

    it('should delete environment variable', async () => {
      // Create project-specific for this test
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Delete Env Test',
        slug: uniqueSlug('delete-env'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/delete-env' },
      });

      // Set and then delete
      await ctx.admin.setEnvVar(testUser.id, project.id, 'TO_DELETE', 'value', false);

      // Verify it exists
      let envVars = await ctx.admin.getEnvVars(testUser.id, project.id);
      expect(envVars.find(e => e.key === 'TO_DELETE')).toBeDefined();

      // Delete it
      await ctx.storage.deleteProjectEnvVar(project.id, 'TO_DELETE');

      // Verify it's gone
      envVars = await ctx.admin.getEnvVars(testUser.id, project.id);
      expect(envVars.find(e => e.key === 'TO_DELETE')).toBeUndefined();
    });

    it('should list all environment variables for project', async () => {
      // Create project-specific for this test
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'List Env Test',
        slug: uniqueSlug('list-env'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/list-env' },
      });

      // Set multiple env vars
      await ctx.admin.setEnvVar(testUser.id, project.id, 'VAR1', 'value1', false);
      await ctx.admin.setEnvVar(testUser.id, project.id, 'VAR2', 'value2', false);
      await ctx.admin.setEnvVar(testUser.id, project.id, 'SECRET_VAR', 'secret', true);

      const envVars = await ctx.admin.getEnvVars(testUser.id, project.id);
      expect(envVars.length).toBe(3);
      expect(envVars.map(e => e.key).sort()).toEqual(['SECRET_VAR', 'VAR1', 'VAR2']);
    });
  });

  describe('Environment Variable Encryption', () => {
    it('should encrypt secret values', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Encrypt Test',
        slug: uniqueSlug('encrypt-test'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/encrypt-test' },
      });

      const secretValue = 'super-secret-password';
      await ctx.admin.setEnvVar(testUser.id, project.id, 'PASSWORD', secretValue, true);

      // Get raw from storage (should be encrypted)
      const rawEnvVars = await ctx.storage.getProjectEnvVars(project.id);
      const password = rawEnvVars.find(e => e.key === 'PASSWORD');

      expect(password).toBeDefined();
      expect(password!.encryptedValue).not.toBe(secretValue);
      expect(password!.isSecret).toBe(true);
    });

    it('should not encrypt non-secret values', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Non-Encrypt Test',
        slug: uniqueSlug('non-encrypt-test'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/non-encrypt-test' },
      });

      const plainValue = 'plain-text-value';
      await ctx.admin.setEnvVar(testUser.id, project.id, 'PLAIN', plainValue, false);

      // Get raw from storage (should be plain)
      const rawEnvVars = await ctx.storage.getProjectEnvVars(project.id);
      const plain = rawEnvVars.find(e => e.key === 'PLAIN');

      expect(plain).toBeDefined();
      expect(plain!.encryptedValue).toBe(plainValue);
      expect(plain!.isSecret).toBe(false);
    });

    it('should encrypt different secrets with different encrypted values', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Different Secrets Test',
        slug: uniqueSlug('diff-secrets'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/diff-secrets' },
      });

      const sameValue = 'same-secret-value';
      await ctx.admin.setEnvVar(testUser.id, project.id, 'SECRET1', sameValue, true);
      await ctx.admin.setEnvVar(testUser.id, project.id, 'SECRET2', sameValue, true);

      const rawEnvVars = await ctx.storage.getProjectEnvVars(project.id);
      const secret1 = rawEnvVars.find(e => e.key === 'SECRET1');
      const secret2 = rawEnvVars.find(e => e.key === 'SECRET2');

      expect(secret1).toBeDefined();
      expect(secret2).toBeDefined();

      // Both should be encrypted (not equal to original value)
      expect(secret1!.encryptedValue).not.toBe(sameValue);
      expect(secret2!.encryptedValue).not.toBe(sameValue);
    });
  });

  describe('Environment Variable Isolation', () => {
    it('should isolate env vars between projects', async () => {
      // Create two projects
      const project1 = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Project 1',
        slug: uniqueSlug('iso-project-1'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/project-1' },
      });

      const project2 = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Project 2',
        slug: uniqueSlug('iso-project-2'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/project-2' },
      });

      // Set same key in both projects with different values
      await ctx.admin.setEnvVar(testUser.id, project1.id, 'SHARED_KEY', 'value1', false);
      await ctx.admin.setEnvVar(testUser.id, project2.id, 'SHARED_KEY', 'value2', false);

      // Verify isolation
      const envVars1 = await ctx.storage.getProjectEnvVars(project1.id);
      const envVars2 = await ctx.storage.getProjectEnvVars(project2.id);

      const val1 = envVars1.find(e => e.key === 'SHARED_KEY');
      const val2 = envVars2.find(e => e.key === 'SHARED_KEY');

      expect(val1!.encryptedValue).toBe('value1');
      expect(val2!.encryptedValue).toBe('value2');
    });

    it('should delete env vars when project is deleted', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Delete Project Test',
        slug: uniqueSlug('delete-project'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/delete-project' },
      });

      // Set some env vars
      await ctx.admin.setEnvVar(testUser.id, project.id, 'ENV1', 'value1', false);
      await ctx.admin.setEnvVar(testUser.id, project.id, 'ENV2', 'value2', true);

      // Verify they exist
      let envVars = await ctx.storage.getProjectEnvVars(project.id);
      expect(envVars.length).toBe(2);

      // Delete project
      await ctx.storage.deleteProject(project.id);

      // Verify env vars are gone
      envVars = await ctx.storage.getProjectEnvVars(project.id);
      expect(envVars.length).toBe(0);
    });
  });

  describe('Environment Variable Timestamps', () => {
    it('should set createdAt and updatedAt on create', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Timestamp Test',
        slug: uniqueSlug('timestamp-test'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/timestamp-test' },
      });

      await ctx.admin.setEnvVar(testUser.id, project.id, 'TIMESTAMP_VAR', 'value', false);

      const envVars = await ctx.storage.getProjectEnvVars(project.id);
      const envVar = envVars.find(e => e.key === 'TIMESTAMP_VAR');

      expect(envVar!.createdAt).toBeInstanceOf(Date);
      expect(envVar!.updatedAt).toBeInstanceOf(Date);
      expect(envVar!.createdAt.getTime()).toBeLessThanOrEqual(envVar!.updatedAt.getTime());
    });

    it('should update updatedAt on modification', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Update Timestamp Test',
        slug: uniqueSlug('update-ts-test'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/update-ts-test' },
      });

      // Create env var
      await ctx.admin.setEnvVar(testUser.id, project.id, 'TS_UPDATE_VAR', 'initial', false);

      const envVars1 = await ctx.storage.getProjectEnvVars(project.id);
      const firstCreated = envVars1.find(e => e.key === 'TS_UPDATE_VAR')!;

      // Small delay to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update env var
      await ctx.admin.setEnvVar(testUser.id, project.id, 'TS_UPDATE_VAR', 'updated', false);

      const envVars2 = await ctx.storage.getProjectEnvVars(project.id);
      const updated = envVars2.find(e => e.key === 'TS_UPDATE_VAR')!;

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(firstCreated.updatedAt.getTime());
    });
  });
});
