import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context.js';
import { createUserData, createTeamData, uniqueEmail } from '../../fixtures/factories.js';

describe('Team Management Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string; email: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create a test user for all team tests
    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id, email: userData.email };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Team Creation', () => {
    it('should create a team with owner', async () => {
      const teamData = createTeamData();
      const team = await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      expect(team.id).toBeDefined();
      expect(team.name).toBe(teamData.name);
      expect(team.slug).toBe(teamData.slug);
      expect(team.createdAt).toBeInstanceOf(Date);
      expect(team.updatedAt).toBeInstanceOf(Date);
    });

    it('should add creator as owner', async () => {
      const teamData = createTeamData();
      const team = await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      const members = await ctx.admin.getTeamMembers(testUser.id, team.id);
      expect(members.data.length).toBe(1);
      expect(members.data[0].userId).toBe(testUser.id);
      expect(members.data[0].role).toBe('owner');
    });

    it('should enforce unique team slugs', async () => {
      const teamData = createTeamData();
      await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      await expect(
        ctx.admin.createTeam(testUser.id, {
          name: 'Different Name',
          slug: teamData.slug, // Same slug
        }),
      ).rejects.toThrow(/slug/i);
    });

    it('should allow different slugs for teams with same name', async () => {
      const name = 'Same Team Name';

      const team1 = await ctx.admin.createTeam(testUser.id, {
        name,
        slug: 'same-name-team-1',
      });

      const team2 = await ctx.admin.createTeam(testUser.id, {
        name,
        slug: 'same-name-team-2',
      });

      expect(team1.id).not.toBe(team2.id);
      expect(team1.name).toBe(team2.name);
      expect(team1.slug).not.toBe(team2.slug);
    });

    it('should store team settings', async () => {
      const teamData = createTeamData({
        settings: { theme: 'dark', notifications: true },
      });

      const team = await ctx.storage.createTeam(teamData);
      expect(team.settings).toEqual(teamData.settings);
    });
  });

  describe('Team Retrieval', () => {
    it('should get team by ID', async () => {
      const teamData = createTeamData();
      const created = await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      const retrieved = await ctx.admin.getTeam(testUser.id, created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe(teamData.name);
    });

    it('should get team by slug', async () => {
      const teamData = createTeamData();
      await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      const team = await ctx.storage.getTeamBySlug(teamData.slug);
      expect(team).not.toBeNull();
      expect(team!.slug).toBe(teamData.slug);
    });

    it('should return null for non-existent team', async () => {
      const team = await ctx.storage.getTeam('non-existent-id');
      expect(team).toBeNull();
    });

    it('should return null for non-existent slug', async () => {
      const team = await ctx.storage.getTeamBySlug('non-existent-slug');
      expect(team).toBeNull();
    });
  });

  describe('Team Member Management', () => {
    it('should invite a member to team', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const inviteEmail = uniqueEmail();

      const invite = await ctx.admin.inviteMember(testUser.id, team.id, inviteEmail, 'developer');

      expect(invite.id).toBeDefined();
      expect(invite.email).toBe(inviteEmail);
      expect(invite.teamId).toBe(team.id);
      expect(invite.role).toBe('developer');
      expect(invite.expiresAt).toBeInstanceOf(Date);
      expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should list team invites', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const inviteEmail = uniqueEmail();

      await ctx.admin.inviteMember(testUser.id, team.id, inviteEmail, 'developer');

      const invites = await ctx.storage.listTeamInvites(team.id);
      expect(invites.length).toBeGreaterThanOrEqual(1);
      expect(invites.some(i => i.email === inviteEmail)).toBe(true);
    });

    it('should get invite by email', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const inviteEmail = uniqueEmail();

      await ctx.admin.inviteMember(testUser.id, team.id, inviteEmail, 'viewer');

      const invite = await ctx.storage.getTeamInviteByEmail(team.id, inviteEmail);
      expect(invite).not.toBeNull();
      expect(invite!.email).toBe(inviteEmail);
      expect(invite!.role).toBe('viewer');
    });

    it('should add team member directly', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Create a new user to add as member
      const memberData = createUserData();
      await ctx.storage.createUser(memberData);

      // Add member directly via storage
      const member = await ctx.storage.addTeamMember({
        teamId: team.id,
        userId: memberData.id,
        role: 'developer',
      });

      expect(member.id).toBeDefined();
      expect(member.teamId).toBe(team.id);
      expect(member.userId).toBe(memberData.id);
      expect(member.role).toBe('developer');
    });

    it('should get team member', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const memberData = createUserData();
      await ctx.storage.createUser(memberData);
      await ctx.storage.addTeamMember({
        teamId: team.id,
        userId: memberData.id,
        role: 'admin',
      });

      const member = await ctx.storage.getTeamMember(team.id, memberData.id);
      expect(member).not.toBeNull();
      expect(member!.userId).toBe(memberData.id);
      expect(member!.role).toBe('admin');
    });

    it('should update team member role', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const memberData = createUserData();
      await ctx.storage.createUser(memberData);
      await ctx.storage.addTeamMember({
        teamId: team.id,
        userId: memberData.id,
        role: 'developer',
      });

      const updated = await ctx.storage.updateTeamMemberRole(team.id, memberData.id, 'admin');
      expect(updated.role).toBe('admin');
    });

    it('should remove team member', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Add a member
      const memberData = createUserData();
      await ctx.storage.createUser(memberData);
      await ctx.storage.addTeamMember({
        teamId: team.id,
        userId: memberData.id,
        role: 'developer',
      });

      // Verify member exists
      let member = await ctx.storage.getTeamMember(team.id, memberData.id);
      expect(member).not.toBeNull();

      // Remove member
      await ctx.storage.removeTeamMember(team.id, memberData.id);

      // Verify removal
      member = await ctx.storage.getTeamMember(team.id, memberData.id);
      expect(member).toBeNull();
    });

    it('should list team members with user information', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Add members
      const memberData = createUserData();
      await ctx.storage.createUser(memberData);
      await ctx.storage.addTeamMember({
        teamId: team.id,
        userId: memberData.id,
        role: 'developer',
      });

      const members = await ctx.admin.getTeamMembers(testUser.id, team.id);
      expect(members.data.length).toBe(2); // Owner + new member

      // Verify user information is included
      const newMember = members.data.find(m => m.userId === memberData.id);
      expect(newMember).toBeDefined();
      expect(newMember!.user).toBeDefined();
      expect(newMember!.user.email).toBe(memberData.email);
    });
  });

  describe('Team Listing', () => {
    it('should list teams for user', async () => {
      // Create a fresh user to have predictable team count
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      // Create multiple teams for this user
      await ctx.admin.createTeam(userData.id, createTeamData());
      await ctx.admin.createTeam(userData.id, createTeamData());

      const teams = await ctx.admin.listTeams(userData.id);
      expect(teams.data.length).toBe(2);
    });

    it('should paginate team list', async () => {
      // Create a user with many teams
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      // Create 5 teams
      for (let i = 0; i < 5; i++) {
        await ctx.admin.createTeam(userData.id, createTeamData());
      }

      // Get first page
      const page1 = await ctx.admin.listTeams(userData.id, { page: 1, perPage: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);

      // Get second page
      const page2 = await ctx.admin.listTeams(userData.id, { page: 2, perPage: 2 });
      expect(page2.data.length).toBe(2);
      expect(page2.hasMore).toBe(true);

      // Ensure different teams on different pages
      expect(page1.data[0].id).not.toBe(page2.data[0].id);

      // Get last page
      const page3 = await ctx.admin.listTeams(userData.id, { page: 3, perPage: 2 });
      expect(page3.data.length).toBe(1);
      expect(page3.hasMore).toBe(false);
    });

    it('should only list teams user is member of', async () => {
      // Create two users
      const user1Data = createUserData();
      const user2Data = createUserData();
      await ctx.storage.createUser(user1Data);
      await ctx.storage.createUser(user2Data);

      // User1 creates a team
      await ctx.admin.createTeam(user1Data.id, createTeamData());

      // User2 creates a different team
      await ctx.admin.createTeam(user2Data.id, createTeamData());

      // User1 should only see their team
      const user1Teams = await ctx.admin.listTeams(user1Data.id);
      expect(user1Teams.data.length).toBe(1);

      // User2 should only see their team
      const user2Teams = await ctx.admin.listTeams(user2Data.id);
      expect(user2Teams.data.length).toBe(1);

      // Teams should be different
      expect(user1Teams.data[0].id).not.toBe(user2Teams.data[0].id);
    });
  });

  describe('Team Updates', () => {
    it('should update team name', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const updated = await ctx.storage.updateTeam(team.id, { name: 'Updated Team Name' });
      expect(updated.name).toBe('Updated Team Name');
      expect(updated.slug).toBe(team.slug); // Slug unchanged
    });

    it('should update team slug', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const newSlug = `updated-slug-${Date.now()}`;

      const updated = await ctx.storage.updateTeam(team.id, { slug: newSlug });
      expect(updated.slug).toBe(newSlug);

      // Should be findable by new slug
      const found = await ctx.storage.getTeamBySlug(newSlug);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(team.id);

      // Old slug should not work
      const notFound = await ctx.storage.getTeamBySlug(team.slug);
      expect(notFound).toBeNull();
    });

    it('should update team settings', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const updated = await ctx.storage.updateTeam(team.id, {
        settings: {
          maxProjects: 10,
          maxConcurrentDeployments: 5,
          metadata: { feature1: true, feature2: 'value' },
        },
      });

      expect(updated.settings).toEqual({
        maxProjects: 10,
        maxConcurrentDeployments: 5,
        metadata: { feature1: true, feature2: 'value' },
      });
    });
  });

  describe('Team Deletion', () => {
    it('should delete team', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Verify team exists
      let found = await ctx.storage.getTeam(team.id);
      expect(found).not.toBeNull();

      // Delete team
      await ctx.storage.deleteTeam(team.id);

      // Verify team is deleted
      found = await ctx.storage.getTeam(team.id);
      expect(found).toBeNull();
    });

    it('should delete team members when team is deleted', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Add a member
      const memberData = createUserData();
      await ctx.storage.createUser(memberData);
      await ctx.storage.addTeamMember({
        teamId: team.id,
        userId: memberData.id,
        role: 'developer',
      });

      // Delete team
      await ctx.storage.deleteTeam(team.id);

      // Verify member association is gone
      const member = await ctx.storage.getTeamMember(team.id, memberData.id);
      expect(member).toBeNull();
    });

    it('should remove team from slug index when deleted', async () => {
      const teamData = createTeamData();
      const team = await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      // Delete team
      await ctx.storage.deleteTeam(team.id);

      // Slug should be available again
      const found = await ctx.storage.getTeamBySlug(teamData.slug);
      expect(found).toBeNull();

      // Should be able to create new team with same slug
      const newTeam = await ctx.admin.createTeam(testUser.id, {
        name: 'New Team',
        slug: teamData.slug,
      });
      expect(newTeam.slug).toBe(teamData.slug);
    });
  });

  describe('Team Invites', () => {
    it('should delete invite after use', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const inviteEmail = uniqueEmail();

      const invite = await ctx.admin.inviteMember(testUser.id, team.id, inviteEmail, 'developer');

      // Delete invite
      await ctx.storage.deleteTeamInvite(invite.id);

      // Verify invite is deleted
      const found = await ctx.storage.getTeamInvite(invite.id);
      expect(found).toBeNull();
    });

    it('should not find invite by email after deletion', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const inviteEmail = uniqueEmail();

      const invite = await ctx.admin.inviteMember(testUser.id, team.id, inviteEmail, 'developer');
      await ctx.storage.deleteTeamInvite(invite.id);

      const found = await ctx.storage.getTeamInviteByEmail(team.id, inviteEmail);
      expect(found).toBeNull();
    });
  });
});
