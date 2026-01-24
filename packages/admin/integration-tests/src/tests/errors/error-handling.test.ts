import { MastraAdminError, AdminErrorCategory, AdminErrorDomain } from '@mastra/admin';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUserData, createTeamData, uniqueId } from '../../fixtures/factories.js';
import { createTestContext  } from '../../setup/test-context.js';
import type {TestContext} from '../../setup/test-context.js';

describe('Error Handling Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('MastraAdminError Structure', () => {
    it('should have correct error structure', () => {
      const error = MastraAdminError.accessDenied('project', 'delete');

      expect(error).toBeInstanceOf(MastraAdminError);
      expect(error).toBeInstanceOf(Error);
      expect(error.id).toBe('ACCESS_DENIED');
      expect(error.domain).toBe(AdminErrorDomain.RBAC);
      expect(error.category).toBe(AdminErrorCategory.USER);
      expect(error.message).toContain('delete');
      expect(error.message).toContain('project');
    });

    it('should serialize to JSON correctly', () => {
      const error = MastraAdminError.projectNotFound('test-project-id');
      const json = error.toJSON();

      expect(json).toEqual({
        message: expect.any(String),
        code: 'PROJECT_NOT_FOUND',
        domain: AdminErrorDomain.PROJECT,
        category: AdminErrorCategory.USER,
        details: { projectId: 'test-project-id' },
      });
    });

    it('should preserve original error', () => {
      const originalError = new Error('Original error');
      const adminError = MastraAdminError.storageError('Storage failed', originalError);

      expect(adminError.originalError).toBe(originalError);
    });
  });

  describe('Error Factory Methods', () => {
    describe('License Errors', () => {
      it('should create invalid license error', () => {
        const error = MastraAdminError.invalidLicense('Custom message');

        expect(error.id).toBe('INVALID_LICENSE');
        expect(error.domain).toBe(AdminErrorDomain.LICENSE);
        expect(error.category).toBe(AdminErrorCategory.LICENSE);
        expect(error.message).toBe('Custom message');
      });

      it('should create license expired error', () => {
        const expiresAt = new Date('2024-01-01');
        const error = MastraAdminError.licenseExpired(expiresAt);

        expect(error.id).toBe('LICENSE_EXPIRED');
        expect(error.details).toEqual({ expiresAt: expiresAt.toISOString() });
      });

      it('should create feature not licensed error', () => {
        const error = MastraAdminError.featureNotLicensed('advanced-analytics');

        expect(error.id).toBe('FEATURE_NOT_LICENSED');
        expect(error.details).toEqual({ feature: 'advanced-analytics' });
      });

      it('should create license limit exceeded error', () => {
        const error = MastraAdminError.licenseLimitExceeded('Teams', 5, 3);

        expect(error.id).toBe('LICENSE_LIMIT_EXCEEDED');
        expect(error.details).toEqual({ limit: 'Teams', current: 5, max: 3 });
      });
    });

    describe('RBAC Errors', () => {
      it('should create access denied error', () => {
        const error = MastraAdminError.accessDenied('deployment', 'deploy');

        expect(error.id).toBe('ACCESS_DENIED');
        expect(error.domain).toBe(AdminErrorDomain.RBAC);
        expect(error.details).toEqual({ resource: 'deployment', action: 'deploy' });
      });

      it('should create role not found error', () => {
        const error = MastraAdminError.roleNotFound('custom-role');

        expect(error.id).toBe('ROLE_NOT_FOUND');
        expect(error.details).toEqual({ roleId: 'custom-role' });
      });
    });

    describe('Team Errors', () => {
      it('should create team not found error', () => {
        const error = MastraAdminError.teamNotFound('team-123');

        expect(error.id).toBe('TEAM_NOT_FOUND');
        expect(error.domain).toBe(AdminErrorDomain.TEAM);
        expect(error.details).toEqual({ teamId: 'team-123' });
      });

      it('should create team slug exists error', () => {
        const error = MastraAdminError.teamSlugExists('my-team');

        expect(error.id).toBe('TEAM_SLUG_EXISTS');
        expect(error.details).toEqual({ slug: 'my-team' });
      });

      it('should create user not team member error', () => {
        const error = MastraAdminError.userNotTeamMember('user-123', 'team-456');

        expect(error.id).toBe('USER_NOT_TEAM_MEMBER');
        expect(error.details).toEqual({ userId: 'user-123', teamId: 'team-456' });
      });
    });

    describe('Project Errors', () => {
      it('should create project not found error', () => {
        const error = MastraAdminError.projectNotFound('project-123');

        expect(error.id).toBe('PROJECT_NOT_FOUND');
        expect(error.domain).toBe(AdminErrorDomain.PROJECT);
        expect(error.details).toEqual({ projectId: 'project-123' });
      });

      it('should create project slug exists error', () => {
        const error = MastraAdminError.projectSlugExists('my-project', 'team-123');

        expect(error.id).toBe('PROJECT_SLUG_EXISTS');
        expect(error.details).toEqual({ slug: 'my-project', teamId: 'team-123' });
      });

      it('should create invalid project source error', () => {
        const error = MastraAdminError.invalidProjectSource('Path does not exist');

        expect(error.id).toBe('INVALID_PROJECT_SOURCE');
        expect(error.domain).toBe(AdminErrorDomain.SOURCE);
        expect(error.message).toBe('Path does not exist');
      });
    });

    describe('Deployment Errors', () => {
      it('should create deployment not found error', () => {
        const error = MastraAdminError.deploymentNotFound('deploy-123');

        expect(error.id).toBe('DEPLOYMENT_NOT_FOUND');
        expect(error.domain).toBe(AdminErrorDomain.DEPLOYMENT);
        expect(error.details).toEqual({ deploymentId: 'deploy-123' });
      });

      it('should create deployment already exists error', () => {
        const error = MastraAdminError.deploymentAlreadyExists('production', 'main');

        expect(error.id).toBe('DEPLOYMENT_ALREADY_EXISTS');
        expect(error.details).toEqual({ type: 'production', branch: 'main' });
      });
    });

    describe('Build Errors', () => {
      it('should create build not found error', () => {
        const error = MastraAdminError.buildNotFound('build-123');

        expect(error.id).toBe('BUILD_NOT_FOUND');
        expect(error.domain).toBe(AdminErrorDomain.BUILD);
        expect(error.details).toEqual({ buildId: 'build-123' });
      });

      it('should create build failed error', () => {
        const error = MastraAdminError.buildFailed('build-123', 'Compilation failed');

        expect(error.id).toBe('BUILD_FAILED');
        expect(error.category).toBe(AdminErrorCategory.SYSTEM);
        expect(error.details).toEqual({ buildId: 'build-123' });
      });

      it('should create build cancelled error', () => {
        const error = MastraAdminError.buildCancelled('build-123');

        expect(error.id).toBe('BUILD_CANCELLED');
        expect(error.details).toEqual({ buildId: 'build-123' });
      });
    });

    describe('Infrastructure Errors', () => {
      it('should create runner error', () => {
        const error = MastraAdminError.runnerError('Process crashed', { pid: 1234 });

        expect(error.id).toBe('RUNNER_ERROR');
        expect(error.domain).toBe(AdminErrorDomain.RUNNER);
        expect(error.category).toBe(AdminErrorCategory.SYSTEM);
        expect(error.details).toEqual({ pid: 1234 });
      });

      it('should create server start failed error', () => {
        const error = MastraAdminError.serverStartFailed('deploy-123', 'Port already in use');

        expect(error.id).toBe('SERVER_START_FAILED');
        expect(error.details).toEqual({ deploymentId: 'deploy-123' });
      });

      it('should create health check failed error', () => {
        const error = MastraAdminError.healthCheckFailed('server-123', 'Timeout after 30s');

        expect(error.id).toBe('HEALTH_CHECK_FAILED');
        expect(error.details).toEqual({ serverId: 'server-123' });
      });

      it('should create router error', () => {
        const error = MastraAdminError.routerError('Failed to register route', { port: 8080 });

        expect(error.id).toBe('ROUTER_ERROR');
        expect(error.domain).toBe(AdminErrorDomain.ROUTER);
        expect(error.details).toEqual({ port: 8080 });
      });

      it('should create route not found error', () => {
        const error = MastraAdminError.routeNotFound('route-123');

        expect(error.id).toBe('ROUTE_NOT_FOUND');
        expect(error.details).toEqual({ routeId: 'route-123' });
      });
    });

    describe('Configuration Errors', () => {
      it('should create configuration error', () => {
        const error = MastraAdminError.configurationError('Missing required config');

        expect(error.id).toBe('CONFIGURATION_ERROR');
        expect(error.domain).toBe(AdminErrorDomain.ADMIN);
        expect(error.category).toBe(AdminErrorCategory.CONFIG);
      });

      it('should create provider not configured error', () => {
        const error = MastraAdminError.providerNotConfigured('storage');

        expect(error.id).toBe('PROVIDER_NOT_CONFIGURED');
        expect(error.details).toEqual({ provider: 'storage' });
      });

      it('should create storage error', () => {
        const originalError = new Error('Connection refused');
        const error = MastraAdminError.storageError('Failed to connect', originalError);

        expect(error.id).toBe('STORAGE_ERROR');
        expect(error.domain).toBe(AdminErrorDomain.STORAGE);
        expect(error.originalError).toBe(originalError);
      });
    });
  });

  describe('Resource Not Found Errors', () => {
    it('should return null for non-existent user', async () => {
      const user = await ctx.storage.getUser(uniqueId());
      expect(user).toBeNull();
    });

    it('should throw for non-existent team access', async () => {
      await expect(ctx.admin.getTeam(testUser.id, uniqueId())).rejects.toThrow();
    });

    it('should throw for non-existent project access', async () => {
      await expect(ctx.admin.getProject(testUser.id, uniqueId())).rejects.toThrow();
    });

    it('should throw for non-existent deployment', async () => {
      await expect(ctx.admin.getDeployment(testUser.id, uniqueId())).rejects.toThrow();
    });

    it('should throw for non-existent build', async () => {
      await expect(ctx.admin.getBuild(testUser.id, uniqueId())).rejects.toThrow();
    });
  });

  describe('Permission Denied Errors', () => {
    it('should throw permission error for unauthorized team access', async () => {
      // Create a team owned by testUser
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Create another user with no access
      const otherUserData = createUserData();
      await ctx.storage.createUser(otherUserData);

      try {
        await ctx.admin.getTeam(otherUserData.id, team.id);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MastraAdminError);
        const adminError = error as MastraAdminError;
        expect(adminError.category).toBe(AdminErrorCategory.USER);
      }
    });

    it('should include proper error context', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const otherUserData = createUserData();
      await ctx.storage.createUser(otherUserData);

      try {
        await ctx.admin.getTeam(otherUserData.id, team.id);
        expect.fail('Should have thrown');
      } catch (error) {
        const adminError = error as MastraAdminError;
        expect(adminError.domain).toBeDefined();
        expect(adminError.message).toBeDefined();
        expect(adminError.id).toBeDefined();
      }
    });
  });

  describe('Duplicate Resource Errors', () => {
    it('should throw for duplicate team slug', async () => {
      const teamData = createTeamData();
      await ctx.admin.createTeam(testUser.id, teamData);

      await expect(ctx.admin.createTeam(testUser.id, { ...teamData, name: 'Different Name' })).rejects.toThrow(
        /slug|duplicate|exists/i,
      );
    });

    it('should throw for duplicate user email', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      await expect(ctx.storage.createUser({ ...createUserData(), email: userData.email })).rejects.toThrow(
        /email|duplicate|exists/i,
      );
    });

    it('should throw for duplicate project slug in team', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const slug = `test-slug-${Date.now()}`;
      await ctx.admin.createProject(testUser.id, team.id, {
        name: 'First',
        slug,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/first' },
      });

      await expect(
        ctx.admin.createProject(testUser.id, team.id, {
          name: 'Second',
          slug, // Same slug
          sourceType: 'local',
          sourceConfig: { path: '/tmp/second' },
        }),
      ).rejects.toThrow(/slug|duplicate|exists/i);
    });
  });

  describe('Error Category Classification', () => {
    it('should classify user errors correctly', () => {
      const userErrors = [
        MastraAdminError.accessDenied('resource', 'action'),
        MastraAdminError.teamNotFound('team-id'),
        MastraAdminError.projectNotFound('project-id'),
      ];

      userErrors.forEach(error => {
        expect(error.category).toBe(AdminErrorCategory.USER);
      });
    });

    it('should classify system errors correctly', () => {
      const systemErrors = [
        MastraAdminError.runnerError('message'),
        MastraAdminError.buildFailed('build-id', 'message'),
        MastraAdminError.storageError('message'),
      ];

      systemErrors.forEach(error => {
        expect(error.category).toBe(AdminErrorCategory.SYSTEM);
      });
    });

    it('should classify config errors correctly', () => {
      const configErrors = [
        MastraAdminError.configurationError('message'),
        MastraAdminError.providerNotConfigured('provider'),
      ];

      configErrors.forEach(error => {
        expect(error.category).toBe(AdminErrorCategory.CONFIG);
      });
    });

    it('should classify license errors correctly', () => {
      const licenseErrors = [
        MastraAdminError.invalidLicense(),
        MastraAdminError.licenseExpired(new Date()),
        MastraAdminError.featureNotLicensed('feature'),
      ];

      licenseErrors.forEach(error => {
        expect(error.category).toBe(AdminErrorCategory.LICENSE);
      });
    });
  });

  describe('Error Domain Classification', () => {
    it('should classify RBAC errors correctly', () => {
      const error = MastraAdminError.accessDenied('resource', 'action');
      expect(error.domain).toBe(AdminErrorDomain.RBAC);
    });

    it('should classify team errors correctly', () => {
      const error = MastraAdminError.teamNotFound('team-id');
      expect(error.domain).toBe(AdminErrorDomain.TEAM);
    });

    it('should classify project errors correctly', () => {
      const error = MastraAdminError.projectNotFound('project-id');
      expect(error.domain).toBe(AdminErrorDomain.PROJECT);
    });

    it('should classify deployment errors correctly', () => {
      const error = MastraAdminError.deploymentNotFound('deployment-id');
      expect(error.domain).toBe(AdminErrorDomain.DEPLOYMENT);
    });

    it('should classify build errors correctly', () => {
      const error = MastraAdminError.buildNotFound('build-id');
      expect(error.domain).toBe(AdminErrorDomain.BUILD);
    });

    it('should classify runner errors correctly', () => {
      const error = MastraAdminError.runnerError('message');
      expect(error.domain).toBe(AdminErrorDomain.RUNNER);
    });

    it('should classify router errors correctly', () => {
      const error = MastraAdminError.routerError('message');
      expect(error.domain).toBe(AdminErrorDomain.ROUTER);
    });

    it('should classify source errors correctly', () => {
      const error = MastraAdminError.invalidProjectSource('message');
      expect(error.domain).toBe(AdminErrorDomain.SOURCE);
    });

    it('should classify storage errors correctly', () => {
      const error = MastraAdminError.storageError('message');
      expect(error.domain).toBe(AdminErrorDomain.STORAGE);
    });

    it('should classify admin errors correctly', () => {
      const error = MastraAdminError.configurationError('message');
      expect(error.domain).toBe(AdminErrorDomain.ADMIN);
    });

    it('should classify license errors correctly', () => {
      const error = MastraAdminError.invalidLicense();
      expect(error.domain).toBe(AdminErrorDomain.LICENSE);
    });
  });
});
