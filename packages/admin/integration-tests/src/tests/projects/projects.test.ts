import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context.js';
import { createUserData, createTeamData, createProjectData, uniqueSlug } from '../../fixtures/factories.js';

/**
 * Helper to create project input with properly typed sourceConfig.
 * Uses 'as unknown as' to convert between the specific sourceConfig types
 * and the generic Record type expected by the API.
 */
function toProjectInput(projectData: ReturnType<typeof createProjectData>) {
  return {
    name: projectData.name,
    slug: projectData.slug,
    sourceType: projectData.sourceType,
    sourceConfig: projectData.sourceConfig as unknown as Record<string, unknown>,
  };
}

describe('Project Management Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };
  let testTeam: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test user and team
    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };

    const team = await ctx.admin.createTeam(testUser.id, createTeamData());
    testTeam = { id: team.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Project CRUD', () => {
    it('should create a project', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, toProjectInput(projectData));

      expect(project.id).toBeDefined();
      expect(project.name).toBe(projectData.name);
      expect(project.slug).toBe(projectData.slug);
      expect(project.teamId).toBe(testTeam.id);
      expect(project.sourceType).toBe(projectData.sourceType);
      expect(project.sourceConfig).toEqual(projectData.sourceConfig);
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a project with default branch', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Project with Branch',
        slug: uniqueSlug('branch-project'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/test' },
        defaultBranch: 'develop',
      });

      expect(project.defaultBranch).toBe('develop');
    });

    it('should create a project with GitHub source', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'GitHub Project',
        slug: uniqueSlug('github-project'),
        sourceType: 'github',
        sourceConfig: {
          repoFullName: 'owner/repo',
          installationId: 'inst-123',
          isPrivate: true,
        },
      });

      expect(project.sourceType).toBe('github');
      expect(project.sourceConfig).toEqual({
        repoFullName: 'owner/repo',
        installationId: 'inst-123',
        isPrivate: true,
      });
    });

    it('should get project by ID', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const created = await ctx.admin.createProject(testUser.id, testTeam.id, toProjectInput(projectData));

      const fetched = await ctx.admin.getProject(testUser.id, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.name).toBe(projectData.name);
    });

    it('should get project by slug', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      await ctx.admin.createProject(testUser.id, testTeam.id, toProjectInput(projectData));

      const project = await ctx.storage.getProjectBySlug(testTeam.id, projectData.slug);
      expect(project).not.toBeNull();
      expect(project!.slug).toBe(projectData.slug);
    });

    it('should return null for non-existent project', async () => {
      const project = await ctx.storage.getProject('non-existent-id');
      expect(project).toBeNull();
    });

    it('should return null for non-existent slug', async () => {
      const project = await ctx.storage.getProjectBySlug(testTeam.id, 'non-existent-slug');
      expect(project).toBeNull();
    });

    it('should list projects for team', async () => {
      // Create a new team with predictable project count
      const teamData = createTeamData();
      const team = await ctx.admin.createTeam(testUser.id, teamData);

      // Create multiple projects
      for (let i = 0; i < 3; i++) {
        const projectData = createProjectData({ teamId: team.id });
        await ctx.admin.createProject(testUser.id, team.id, toProjectInput(projectData));
      }

      const projects = await ctx.admin.listProjects(testUser.id, team.id);
      expect(projects.data.length).toBe(3);
      expect(projects.total).toBe(3);
    });

    it('should paginate projects', async () => {
      // Create a new team
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Create 5 projects
      for (let i = 0; i < 5; i++) {
        const projectData = createProjectData({ teamId: team.id });
        await ctx.admin.createProject(testUser.id, team.id, toProjectInput(projectData));
      }

      // Get first page
      const page1 = await ctx.admin.listProjects(testUser.id, team.id, { page: 1, perPage: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);

      // Get second page
      const page2 = await ctx.admin.listProjects(testUser.id, team.id, { page: 2, perPage: 2 });
      expect(page2.data.length).toBe(2);

      // Ensure different projects on different pages
      expect(page1.data[0].id).not.toBe(page2.data[0].id);
    });

    it('should update project', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Original Name',
        slug: uniqueSlug('update-project'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/original' },
      });

      const updated = await ctx.storage.updateProject(project.id, {
        name: 'Updated Name',
        sourceConfig: { path: '/tmp/updated' },
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.sourceConfig).toEqual({ path: '/tmp/updated' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(updated.createdAt.getTime());
    });

    it('should delete project', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, toProjectInput(projectData));

      await ctx.storage.deleteProject(project.id);

      const fetched = await ctx.storage.getProject(project.id);
      expect(fetched).toBeNull();
    });

    it('should enforce unique project slug within team', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const slug = `unique-slug-${Date.now()}`;

      await ctx.admin.createProject(testUser.id, team.id, {
        name: 'First Project',
        slug,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/first' },
      });

      await expect(
        ctx.admin.createProject(testUser.id, team.id, {
          name: 'Second Project',
          slug, // Same slug
          sourceType: 'local',
          sourceConfig: { path: '/tmp/second' },
        }),
      ).rejects.toThrow(/slug/i);
    });

    it('should allow same slug in different teams', async () => {
      const team1 = await ctx.admin.createTeam(testUser.id, createTeamData());
      const team2 = await ctx.admin.createTeam(testUser.id, createTeamData());
      const slug = `shared-slug-${Date.now()}`;

      const project1 = await ctx.admin.createProject(testUser.id, team1.id, {
        name: 'Project in Team 1',
        slug,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/team1' },
      });

      const project2 = await ctx.admin.createProject(testUser.id, team2.id, {
        name: 'Project in Team 2',
        slug,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/team2' },
      });

      expect(project1.slug).toBe(project2.slug);
      expect(project1.teamId).not.toBe(project2.teamId);
    });
  });

  describe('Project Source Configuration', () => {
    it('should store local source configuration', async () => {
      const localConfig = { path: '/home/user/projects/my-agent' };

      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Local Project',
        slug: uniqueSlug('local-config'),
        sourceType: 'local',
        sourceConfig: localConfig,
      });

      expect(project.sourceType).toBe('local');
      expect(project.sourceConfig).toEqual(localConfig);
    });

    it('should store GitHub source configuration', async () => {
      const githubConfig = {
        repoFullName: 'org/repo-name',
        installationId: 'installation-12345',
        isPrivate: false,
      };

      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'GitHub Project',
        slug: uniqueSlug('github-config'),
        sourceType: 'github',
        sourceConfig: githubConfig,
      });

      expect(project.sourceType).toBe('github');
      expect(project.sourceConfig).toEqual(githubConfig);
    });
  });

  describe('Project Defaults', () => {
    it('should use main as default branch if not specified', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Default Branch Project',
        slug: uniqueSlug('default-branch'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/default-branch' },
      });

      expect(project.defaultBranch).toBe('main');
    });

    it('should respect custom default branch', async () => {
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: 'Custom Branch Project',
        slug: uniqueSlug('custom-branch'),
        sourceType: 'local',
        sourceConfig: { path: '/tmp/custom-branch' },
        defaultBranch: 'master',
      });

      expect(project.defaultBranch).toBe('master');
    });
  });
});
