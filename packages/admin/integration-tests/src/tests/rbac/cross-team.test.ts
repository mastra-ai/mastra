import type { TeamRole } from '@mastra/admin';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUserData, createTeamData } from '../../fixtures/factories.js';
import { createTestContext } from '../../setup/test-context.js';
import type { TestContext } from '../../setup/test-context.js';

describe('Cross-Team Access Integration Tests', () => {
  let ctx: TestContext;

  // Team A setup
  let teamAOwner: { id: string };
  let teamADeveloper: { id: string };
  let teamA: { id: string };
  let teamAProject: { id: string };

  // Team B setup
  let teamBOwner: { id: string };
  let teamBDeveloper: { id: string };
  let teamB: { id: string };
  let teamBProject: { id: string };

  // User with no team membership
  let outsiderUser: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create users for Team A
    const teamAOwnerData = createUserData({ name: 'Team A Owner' });
    const teamADeveloperData = createUserData({ name: 'Team A Developer' });
    await ctx.storage.createUser(teamAOwnerData);
    await ctx.storage.createUser(teamADeveloperData);
    teamAOwner = { id: teamAOwnerData.id };
    teamADeveloper = { id: teamADeveloperData.id };

    // Create users for Team B
    const teamBOwnerData = createUserData({ name: 'Team B Owner' });
    const teamBDeveloperData = createUserData({ name: 'Team B Developer' });
    await ctx.storage.createUser(teamBOwnerData);
    await ctx.storage.createUser(teamBDeveloperData);
    teamBOwner = { id: teamBOwnerData.id };
    teamBDeveloper = { id: teamBDeveloperData.id };

    // Create outsider user
    const outsiderData = createUserData({ name: 'Outsider User' });
    await ctx.storage.createUser(outsiderData);
    outsiderUser = { id: outsiderData.id };

    // Create Team A
    const createdTeamA = await ctx.admin.createTeam(teamAOwner.id, {
      ...createTeamData(),
      name: 'Team A',
      slug: `team-a-${Date.now()}`,
    });
    teamA = { id: createdTeamA.id };
    await ctx.storage.addTeamMember({ teamId: teamA.id, userId: teamADeveloper.id, role: 'developer' as TeamRole });

    // Create Team B
    const createdTeamB = await ctx.admin.createTeam(teamBOwner.id, {
      ...createTeamData(),
      name: 'Team B',
      slug: `team-b-${Date.now()}`,
    });
    teamB = { id: createdTeamB.id };
    await ctx.storage.addTeamMember({ teamId: teamB.id, userId: teamBDeveloper.id, role: 'developer' as TeamRole });

    // Create projects in each team
    const projectA = await ctx.admin.createProject(teamAOwner.id, teamA.id, {
      name: 'Team A Project',
      slug: `project-a-${Date.now()}`,
      sourceType: 'local',
      sourceConfig: { path: '/tmp/project-a' },
    });
    teamAProject = { id: projectA.id };

    const projectB = await ctx.admin.createProject(teamBOwner.id, teamB.id, {
      name: 'Team B Project',
      slug: `project-b-${Date.now()}`,
      sourceType: 'local',
      sourceConfig: { path: '/tmp/project-b' },
    });
    teamBProject = { id: projectB.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Cross-Team Team Access', () => {
    it('should NOT allow Team A user to access Team B', async () => {
      await expect(ctx.admin.getTeam(teamAOwner.id, teamB.id)).rejects.toThrow(/permission|access|not found/i);
    });

    it('should NOT allow Team B user to access Team A', async () => {
      await expect(ctx.admin.getTeam(teamBOwner.id, teamA.id)).rejects.toThrow(/permission|access|not found/i);
    });

    it('should NOT allow Team A developer to access Team B', async () => {
      await expect(ctx.admin.getTeam(teamADeveloper.id, teamB.id)).rejects.toThrow(/permission|access|not found/i);
    });

    it('should NOT allow outsider to access any team', async () => {
      await expect(ctx.admin.getTeam(outsiderUser.id, teamA.id)).rejects.toThrow(/permission|access|not found/i);
      await expect(ctx.admin.getTeam(outsiderUser.id, teamB.id)).rejects.toThrow(/permission|access|not found/i);
    });
  });

  describe('Cross-Team Project Access', () => {
    it('should NOT allow Team A owner to access Team B project', async () => {
      await expect(ctx.admin.getProject(teamAOwner.id, teamBProject.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });

    it('should NOT allow Team B owner to access Team A project', async () => {
      await expect(ctx.admin.getProject(teamBOwner.id, teamAProject.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });

    it('should NOT allow Team A developer to access Team B project', async () => {
      await expect(ctx.admin.getProject(teamADeveloper.id, teamBProject.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });

    it('should NOT allow outsider to access any project', async () => {
      await expect(ctx.admin.getProject(outsiderUser.id, teamAProject.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
      await expect(ctx.admin.getProject(outsiderUser.id, teamBProject.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });
  });

  describe('Cross-Team Project Operations', () => {
    it('should NOT allow Team A user to create project in Team B', async () => {
      await expect(
        ctx.admin.createProject(teamAOwner.id, teamB.id, {
          name: 'Cross Team Project',
          slug: `cross-project-${Date.now()}`,
          sourceType: 'local',
          sourceConfig: { path: '/tmp/cross-project' },
        }),
      ).rejects.toThrow(/permission|access|not found/i);
    });

    it('should NOT allow Team A user to delete Team B project', async () => {
      await expect(ctx.admin.deleteProject(teamAOwner.id, teamBProject.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });

    it('should NOT allow Team A user to set env vars on Team B project', async () => {
      await expect(
        ctx.admin.setEnvVar(teamAOwner.id, teamBProject.id, 'CROSS_TEAM_VAR', 'value', false),
      ).rejects.toThrow(/permission|access|not found/i);
    });
  });

  describe('Cross-Team Deployment Access', () => {
    let teamADeployment: { id: string };

    beforeAll(async () => {
      // Create deployment in Team A
      const deployment = await ctx.admin.createDeployment(teamAOwner.id, teamAProject.id, {
        type: 'production',
        branch: 'main',
      });
      teamADeployment = { id: deployment.id };
    });

    it('should NOT allow Team B user to access Team A deployment', async () => {
      await expect(ctx.admin.getDeployment(teamBOwner.id, teamADeployment.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });

    it('should NOT allow Team B user to deploy Team A deployment', async () => {
      await expect(ctx.admin.deploy(teamBOwner.id, teamADeployment.id)).rejects.toThrow(/permission|access|not found/i);
    });

    it('should NOT allow outsider to deploy any deployment', async () => {
      await expect(ctx.admin.deploy(outsiderUser.id, teamADeployment.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });
  });

  describe('Cross-Team Member Operations', () => {
    it('should NOT allow Team A owner to invite to Team B', async () => {
      await expect(
        ctx.admin.inviteMember(teamAOwner.id, teamB.id, `cross-invite-${Date.now()}@example.com`, 'developer'),
      ).rejects.toThrow(/permission|access|not found/i);
    });

    it('should NOT allow Team A owner to remove Team B members', async () => {
      await expect(ctx.admin.removeMember(teamAOwner.id, teamB.id, teamBDeveloper.id)).rejects.toThrow(
        /permission|access|not found/i,
      );
    });

    it('should NOT allow Team A owner to list Team B members', async () => {
      await expect(ctx.admin.getTeamMembers(teamAOwner.id, teamB.id)).rejects.toThrow(/permission|access|not found/i);
    });
  });

  describe('User with Multiple Team Memberships', () => {
    let multiTeamUser: { id: string };

    beforeAll(async () => {
      // Create a user who belongs to both teams
      const multiTeamUserData = createUserData({ name: 'Multi Team User' });
      await ctx.storage.createUser(multiTeamUserData);
      multiTeamUser = { id: multiTeamUserData.id };

      // Add to Team A as developer
      await ctx.storage.addTeamMember({ teamId: teamA.id, userId: multiTeamUser.id, role: 'developer' as TeamRole });

      // Add to Team B as viewer
      await ctx.storage.addTeamMember({ teamId: teamB.id, userId: multiTeamUser.id, role: 'viewer' as TeamRole });
    });

    it('should allow multi-team user to access Team A', async () => {
      const team = await ctx.admin.getTeam(multiTeamUser.id, teamA.id);
      expect(team).not.toBeNull();
      expect(team!.id).toBe(teamA.id);
    });

    it('should allow multi-team user to access Team B', async () => {
      const team = await ctx.admin.getTeam(multiTeamUser.id, teamB.id);
      expect(team).not.toBeNull();
      expect(team!.id).toBe(teamB.id);
    });

    it('should have developer permissions in Team A', async () => {
      // Can create project in Team A (developer permission)
      const project = await ctx.admin.createProject(multiTeamUser.id, teamA.id, {
        name: 'Multi User Project A',
        slug: `multi-project-a-${Date.now()}`,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/multi-project-a' },
      });
      expect(project).toBeDefined();
    });

    it('should have viewer permissions in Team B', async () => {
      // Can read project in Team B
      const project = await ctx.admin.getProject(multiTeamUser.id, teamBProject.id);
      expect(project).toBeDefined();

      // Cannot create project in Team B (viewer restriction)
      await expect(
        ctx.admin.createProject(multiTeamUser.id, teamB.id, {
          name: 'Multi User Project B',
          slug: `multi-project-b-${Date.now()}`,
          sourceType: 'local',
          sourceConfig: { path: '/tmp/multi-project-b' },
        }),
      ).rejects.toThrow(/permission|access/i);
    });

    it('should list teams correctly for multi-team user', async () => {
      const teams = await ctx.admin.listTeams(multiTeamUser.id);
      const teamIds = teams.data.map(t => t.id);
      expect(teamIds).toContain(teamA.id);
      expect(teamIds).toContain(teamB.id);
    });
  });

  describe('Permission Isolation Verification', () => {
    it('should only return teams user is member of', async () => {
      const teamsA = await ctx.admin.listTeams(teamAOwner.id);
      const teamIds = teamsA.data.map(t => t.id);

      expect(teamIds).toContain(teamA.id);
      expect(teamIds).not.toContain(teamB.id);
    });

    it('should only return projects from teams user belongs to', async () => {
      const projects = await ctx.admin.listProjects(teamAOwner.id, teamA.id);
      const projectIds = projects.data.map(p => p.id);

      expect(projectIds).toContain(teamAProject.id);
      expect(projectIds).not.toContain(teamBProject.id);
    });

    it('should return empty list for team user does not belong to', async () => {
      await expect(ctx.admin.listProjects(teamAOwner.id, teamB.id)).rejects.toThrow(/permission|access|not found/i);
    });
  });
});
