import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUserData, createTeamData, uniqueId, uniqueSlug } from '../../fixtures/factories.js';
import { createTestContext  } from '../../setup/test-context.js';
import type {TestContext} from '../../setup/test-context.js';

describe('Validation Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };
  let testTeam: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };

    const team = await ctx.admin.createTeam(testUser.id, createTeamData());
    testTeam = { id: team.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Team Validation', () => {
    describe('Name Validation', () => {
      it('should reject empty team name', async () => {
        await expect(
          ctx.admin.createTeam(testUser.id, { name: '', slug: uniqueSlug('test') }),
        ).rejects.toThrow(/name|empty|required/i);
      });

      it('should reject whitespace-only team name', async () => {
        await expect(
          ctx.admin.createTeam(testUser.id, { name: '   ', slug: uniqueSlug('test') }),
        ).rejects.toThrow(/name|empty|required|whitespace/i);
      });

      it('should accept valid team name', async () => {
        const team = await ctx.admin.createTeam(testUser.id, {
          name: 'Valid Team Name',
          slug: uniqueSlug('valid-team'),
        });
        expect(team.name).toBe('Valid Team Name');
      });

      it('should allow team names with special characters', async () => {
        const team = await ctx.admin.createTeam(testUser.id, {
          name: "Team's Name & More!",
          slug: uniqueSlug('special-team'),
        });
        expect(team.name).toBe("Team's Name & More!");
      });
    });

    describe('Slug Validation', () => {
      it('should reject empty slug', async () => {
        await expect(
          ctx.admin.createTeam(testUser.id, { name: 'Valid Name', slug: '' }),
        ).rejects.toThrow(/slug|empty|required/i);
      });

      it('should reject slug with spaces', async () => {
        await expect(
          ctx.admin.createTeam(testUser.id, { name: 'Valid Name', slug: 'invalid slug' }),
        ).rejects.toThrow(/slug|invalid|space/i);
      });

      it('should reject slug with uppercase letters', async () => {
        await expect(
          ctx.admin.createTeam(testUser.id, { name: 'Valid Name', slug: 'InvalidSlug' }),
        ).rejects.toThrow(/slug|invalid|uppercase|lowercase/i);
      });

      it('should reject slug with special characters', async () => {
        await expect(
          ctx.admin.createTeam(testUser.id, { name: 'Valid Name', slug: 'invalid!slug@' }),
        ).rejects.toThrow(/slug|invalid|character/i);
      });

      it('should accept valid slug with hyphens', async () => {
        const team = await ctx.admin.createTeam(testUser.id, {
          name: 'Test Team',
          slug: `valid-slug-${Date.now()}`,
        });
        expect(team.slug).toMatch(/^valid-slug-/);
      });

      it('should accept valid slug with numbers', async () => {
        const team = await ctx.admin.createTeam(testUser.id, {
          name: 'Test Team',
          slug: `team123-${Date.now()}`,
        });
        expect(team.slug).toMatch(/^team123-/);
      });
    });
  });

  describe('Project Validation', () => {
    describe('Name Validation', () => {
      it('should reject empty project name', async () => {
        await expect(
          ctx.admin.createProject(testUser.id, testTeam.id, {
            name: '',
            slug: uniqueSlug('test'),
            sourceType: 'local',
            sourceConfig: { path: '/tmp/test' },
          }),
        ).rejects.toThrow(/name|empty|required/i);
      });

      it('should accept valid project name', async () => {
        const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
          name: 'Valid Project Name',
          slug: uniqueSlug('valid-project'),
          sourceType: 'local',
          sourceConfig: { path: '/tmp/valid-project' },
        });
        expect(project.name).toBe('Valid Project Name');
      });
    });

    describe('Slug Validation', () => {
      it('should reject empty project slug', async () => {
        await expect(
          ctx.admin.createProject(testUser.id, testTeam.id, {
            name: 'Valid Name',
            slug: '',
            sourceType: 'local',
            sourceConfig: { path: '/tmp/test' },
          }),
        ).rejects.toThrow(/slug|empty|required/i);
      });

      it('should reject project slug with invalid characters', async () => {
        await expect(
          ctx.admin.createProject(testUser.id, testTeam.id, {
            name: 'Valid Name',
            slug: 'Invalid Slug!',
            sourceType: 'local',
            sourceConfig: { path: '/tmp/test' },
          }),
        ).rejects.toThrow(/slug|invalid/i);
      });
    });

    describe('Source Configuration Validation', () => {
      it('should reject empty source path for local source', async () => {
        await expect(
          ctx.admin.createProject(testUser.id, testTeam.id, {
            name: 'Test',
            slug: uniqueSlug('test'),
            sourceType: 'local',
            sourceConfig: { path: '' },
          }),
        ).rejects.toThrow(/path|empty|required|source/i);
      });

      it('should accept valid local source path', async () => {
        const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
          name: 'Test',
          slug: uniqueSlug('test-local'),
          sourceType: 'local',
          sourceConfig: { path: '/tmp/valid-path' },
        });
        expect(project.sourceType).toBe('local');
      });

      it('should reject missing source config', async () => {
        await expect(
          ctx.admin.createProject(testUser.id, testTeam.id, {
            name: 'Test',
            slug: uniqueSlug('test'),
            sourceType: 'local',
            sourceConfig: undefined as any,
          }),
        ).rejects.toThrow(/source|config|required/i);
      });
    });
  });

  describe('Deployment Validation', () => {
    let projectId: string;

    beforeAll(async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Deployment Test Project',
        slug: uniqueSlug('deployment-test'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/deployment-test' },
      });
      projectId = project.id;
    });

    describe('Type Validation', () => {
      it('should reject invalid deployment type', async () => {
        await expect(
          ctx.admin.createDeployment(testUser.id, projectId, {
            type: 'invalid' as any,
            branch: 'main',
          }),
        ).rejects.toThrow(/type|invalid|production|staging|preview/i);
      });

      it('should accept production type', async () => {
        const deployment = await ctx.admin.createDeployment(testUser.id, projectId, {
          type: 'production',
          branch: 'main',
        });
        expect(deployment.type).toBe('production');
      });

      it('should accept staging type', async () => {
        const deployment = await ctx.admin.createDeployment(testUser.id, projectId, {
          type: 'staging',
          branch: 'develop',
        });
        expect(deployment.type).toBe('staging');
      });

      it('should accept preview type', async () => {
        const deployment = await ctx.admin.createDeployment(testUser.id, projectId, {
          type: 'preview',
          branch: `feature-${Date.now()}`,
        });
        expect(deployment.type).toBe('preview');
      });
    });

    describe('Branch Validation', () => {
      it('should reject empty branch', async () => {
        await expect(
          ctx.admin.createDeployment(testUser.id, projectId, {
            type: 'preview',
            branch: '',
          }),
        ).rejects.toThrow(/branch|empty|required/i);
      });

      it('should accept valid branch name', async () => {
        const deployment = await ctx.admin.createDeployment(testUser.id, projectId, {
          type: 'preview',
          branch: `feature/valid-branch-${Date.now()}`,
        });
        expect(deployment.branch).toMatch(/^feature\/valid-branch-/);
      });
    });
  });

  describe('User Validation', () => {
    describe('Email Validation', () => {
      it('should reject empty email', async () => {
        await expect(
          ctx.storage.createUser({ ...createUserData(), email: '' }),
        ).rejects.toThrow(/email|empty|required/i);
      });

      it('should reject invalid email format', async () => {
        await expect(
          ctx.storage.createUser({ ...createUserData(), email: 'invalid-email' }),
        ).rejects.toThrow(/email|invalid|format/i);
      });

      it('should reject email without domain', async () => {
        await expect(
          ctx.storage.createUser({ ...createUserData(), email: 'user@' }),
        ).rejects.toThrow(/email|invalid/i);
      });

      it('should reject email without local part', async () => {
        await expect(
          ctx.storage.createUser({ ...createUserData(), email: '@example.com' }),
        ).rejects.toThrow(/email|invalid/i);
      });

      it('should accept valid email', async () => {
        const user = await ctx.storage.createUser(createUserData());
        expect(user.email).toMatch(/@example\.com$/);
      });

      it('should accept email with subdomain', async () => {
        const user = await ctx.storage.createUser({
          ...createUserData(),
          email: `test-${Date.now()}@sub.example.com`,
        });
        expect(user.email).toContain('@sub.example.com');
      });

      it('should accept email with plus addressing', async () => {
        const user = await ctx.storage.createUser({
          ...createUserData(),
          email: `test+tag-${Date.now()}@example.com`,
        });
        expect(user.email).toContain('+tag');
      });
    });

    describe('Name Validation', () => {
      it('should accept empty name', async () => {
        // Name can be empty or null in some cases
        const user = await ctx.storage.createUser({
          ...createUserData(),
          name: '',
        });
        expect(user).toBeDefined();
      });

      it('should accept valid name', async () => {
        const user = await ctx.storage.createUser({
          ...createUserData(),
          name: 'John Doe',
        });
        expect(user.name).toBe('John Doe');
      });

      it('should accept name with special characters', async () => {
        const user = await ctx.storage.createUser({
          ...createUserData(),
          name: "José María O'Brien-Smith",
        });
        expect(user.name).toBe("José María O'Brien-Smith");
      });
    });
  });

  describe('Environment Variable Validation', () => {
    let projectId: string;

    beforeAll(async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Env Var Test Project',
        slug: uniqueSlug('env-test'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/env-test' },
      });
      projectId = project.id;
    });

    it('should reject empty key', async () => {
      await expect(ctx.admin.setEnvVar(testUser.id, projectId, '', 'value', false)).rejects.toThrow(
        /key|empty|required/i,
      );
    });

    it('should reject key with invalid characters', async () => {
      await expect(ctx.admin.setEnvVar(testUser.id, projectId, 'invalid-key!', 'value', false)).rejects.toThrow(
        /key|invalid|character/i,
      );
    });

    it('should reject key starting with number', async () => {
      await expect(ctx.admin.setEnvVar(testUser.id, projectId, '123KEY', 'value', false)).rejects.toThrow(
        /key|invalid|start|number/i,
      );
    });

    it('should accept valid key with underscores', async () => {
      await expect(
        ctx.admin.setEnvVar(testUser.id, projectId, `VALID_KEY_${Date.now()}`, 'value', false),
      ).resolves.not.toThrow();
    });

    it('should accept empty value', async () => {
      await expect(
        ctx.admin.setEnvVar(testUser.id, projectId, `EMPTY_VALUE_${Date.now()}`, '', false),
      ).resolves.not.toThrow();
    });

    it('should accept value with special characters', async () => {
      await expect(
        ctx.admin.setEnvVar(testUser.id, projectId, `SPECIAL_VALUE_${Date.now()}`, 'pa$$w0rd!@#', true),
      ).resolves.not.toThrow();
    });
  });

  describe('Team Invite Validation', () => {
    it('should reject invalid email for invite', async () => {
      await expect(
        ctx.admin.inviteMember(testUser.id, testTeam.id, 'invalid-email', 'developer'),
      ).rejects.toThrow(/email|invalid/i);
    });

    it('should reject invalid role for invite', async () => {
      await expect(
        ctx.admin.inviteMember(testUser.id, testTeam.id, `valid-${Date.now()}@example.com`, 'invalid-role' as any),
      ).rejects.toThrow(/role|invalid/i);
    });

    it('should accept valid invite', async () => {
      const invite = await ctx.admin.inviteMember(
        testUser.id,
        testTeam.id,
        `valid-invite-${Date.now()}@example.com`,
        'developer',
      );
      expect(invite.id).toBeDefined();
    });
  });

  describe('Pagination Validation', () => {
    it('should reject negative page number', async () => {
      await expect(
        ctx.admin.listTeams(testUser.id, { page: -1 }),
      ).rejects.toThrow(/page|negative|invalid/i);
    });

    it('should reject zero page number', async () => {
      await expect(
        ctx.admin.listTeams(testUser.id, { page: 0 }),
      ).rejects.toThrow(/page|zero|invalid/i);
    });

    it('should reject negative perPage', async () => {
      await expect(
        ctx.admin.listTeams(testUser.id, { perPage: -10 }),
      ).rejects.toThrow(/perPage|negative|invalid/i);
    });

    it('should accept valid pagination', async () => {
      const result = await ctx.admin.listTeams(testUser.id, { page: 1, perPage: 10 });
      expect(result.data).toBeDefined();
      expect(result.page).toBe(1);
    });

    it('should handle empty results gracefully', async () => {
      const result = await ctx.admin.listTeams(testUser.id, { page: 1000, perPage: 10 });
      expect(result.data).toEqual([]);
    });
  });

  describe('ID Format Validation', () => {
    it('should reject invalid UUID format for team lookup', async () => {
      await expect(ctx.admin.getTeam(testUser.id, 'not-a-uuid')).rejects.toThrow();
    });

    it('should reject invalid UUID format for project lookup', async () => {
      await expect(ctx.admin.getProject(testUser.id, 'not-a-uuid')).rejects.toThrow();
    });

    it('should accept valid UUID format', async () => {
      const validUuid = uniqueId();
      // This should throw "not found" not "invalid format"
      await expect(ctx.admin.getTeam(testUser.id, validUuid)).rejects.toThrow(/not found|permission|access/i);
    });
  });
});
