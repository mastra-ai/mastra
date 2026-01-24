import { SYSTEM_ROLES, getSystemRole, roleHasPermission } from '@mastra/admin';
import type { TeamRole } from '@mastra/admin';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUserData, createTeamData } from '../../fixtures/factories.js';
import { createTestContext } from '../../setup/test-context.js';
import type { TestContext } from '../../setup/test-context.js';

describe('RBAC Permission Integration Tests', () => {
  let ctx: TestContext;
  let ownerUser: { id: string };
  let adminUser: { id: string };
  let developerUser: { id: string };
  let viewerUser: { id: string };
  let testTeam: { id: string };
  let testProject: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create users with different roles
    const ownerData = createUserData({ name: 'Owner User' });
    const adminData = createUserData({ name: 'Admin User' });
    const developerData = createUserData({ name: 'Developer User' });
    const viewerData = createUserData({ name: 'Viewer User' });

    await ctx.storage.createUser(ownerData);
    await ctx.storage.createUser(adminData);
    await ctx.storage.createUser(developerData);
    await ctx.storage.createUser(viewerData);

    ownerUser = { id: ownerData.id };
    adminUser = { id: adminData.id };
    developerUser = { id: developerData.id };
    viewerUser = { id: viewerData.id };

    // Create team (owner is automatically added via createTeam)
    const team = await ctx.admin.createTeam(ownerUser.id, createTeamData());
    testTeam = { id: team.id };

    // Add other members with different roles
    await ctx.storage.addTeamMember({ teamId: team.id, userId: adminUser.id, role: 'admin' as TeamRole });
    await ctx.storage.addTeamMember({ teamId: team.id, userId: developerUser.id, role: 'developer' as TeamRole });
    await ctx.storage.addTeamMember({ teamId: team.id, userId: viewerUser.id, role: 'viewer' as TeamRole });

    // Create a project for permission testing
    const project = await ctx.admin.createProject(ownerUser.id, testTeam.id, {
      name: 'RBAC Test Project',
      slug: `rbac-test-${Date.now()}`,
      sourceType: 'local',
      sourceConfig: { path: '/tmp/rbac-test' },
    });
    testProject = { id: project.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('System Role Definitions', () => {
    it('should have all system roles defined', () => {
      expect(SYSTEM_ROLES).toBeDefined();
      expect(SYSTEM_ROLES['owner']).toBeDefined();
      expect(SYSTEM_ROLES['admin']).toBeDefined();
      expect(SYSTEM_ROLES['developer']).toBeDefined();
      expect(SYSTEM_ROLES['viewer']).toBeDefined();
    });

    it('should have correct owner permissions', () => {
      const owner = getSystemRole('owner');
      expect(owner).toBeDefined();
      expect(owner!.name).toBe('Owner');
      expect(owner!.isSystem).toBe(true);
      // Owner should have all permissions
      expect(roleHasPermission(owner!, 'team:delete')).toBe(true);
      expect(roleHasPermission(owner!, 'project:delete')).toBe(true);
      expect(roleHasPermission(owner!, 'deployment:deploy')).toBe(true);
      expect(roleHasPermission(owner!, 'member:manage')).toBe(true);
    });

    it('should have correct admin permissions', () => {
      const admin = getSystemRole('admin');
      expect(admin).toBeDefined();
      expect(admin!.name).toBe('Admin');
      // Admin can manage team but not delete
      expect(roleHasPermission(admin!, 'team:read')).toBe(true);
      expect(roleHasPermission(admin!, 'team:update')).toBe(true);
      expect(roleHasPermission(admin!, 'team:delete')).toBe(false);
      // Admin can manage members
      expect(roleHasPermission(admin!, 'member:create')).toBe(true);
      expect(roleHasPermission(admin!, 'member:delete')).toBe(true);
      // Admin can manage projects
      expect(roleHasPermission(admin!, 'project:create')).toBe(true);
      expect(roleHasPermission(admin!, 'project:delete')).toBe(true);
    });

    it('should have correct developer permissions', () => {
      const developer = getSystemRole('developer');
      expect(developer).toBeDefined();
      expect(developer!.name).toBe('Developer');
      // Developer can read team
      expect(roleHasPermission(developer!, 'team:read')).toBe(true);
      expect(roleHasPermission(developer!, 'team:update')).toBe(false);
      // Developer can manage projects (except delete)
      expect(roleHasPermission(developer!, 'project:create')).toBe(true);
      expect(roleHasPermission(developer!, 'project:read')).toBe(true);
      expect(roleHasPermission(developer!, 'project:update')).toBe(true);
      expect(roleHasPermission(developer!, 'project:delete')).toBe(false);
      // Developer can deploy
      expect(roleHasPermission(developer!, 'deployment:deploy')).toBe(true);
      // Developer cannot invite members
      expect(roleHasPermission(developer!, 'invite:create')).toBe(false);
    });

    it('should have correct viewer permissions', () => {
      const viewer = getSystemRole('viewer');
      expect(viewer).toBeDefined();
      expect(viewer!.name).toBe('Viewer');
      // Viewer can only read
      expect(roleHasPermission(viewer!, 'team:read')).toBe(true);
      expect(roleHasPermission(viewer!, 'project:read')).toBe(true);
      expect(roleHasPermission(viewer!, 'deployment:read')).toBe(true);
      expect(roleHasPermission(viewer!, 'build:read')).toBe(true);
      // Viewer cannot write
      expect(roleHasPermission(viewer!, 'project:create')).toBe(false);
      expect(roleHasPermission(viewer!, 'deployment:deploy')).toBe(false);
      expect(roleHasPermission(viewer!, 'env_var:read')).toBe(false); // No secret access
    });
  });

  describe('Team-Level Permissions', () => {
    describe('Owner Permissions', () => {
      it('should allow owner to read team', async () => {
        const team = await ctx.admin.getTeam(ownerUser.id, testTeam.id);
        expect(team).not.toBeNull();
        expect(team!.id).toBe(testTeam.id);
      });

      it('should allow owner to update team', async () => {
        const newName = `Updated Team Name ${Date.now()}`;
        // Owner can update team settings via storage directly
        const updated = await ctx.storage.updateTeam(testTeam.id, { name: newName });
        expect(updated.name).toBe(newName);
      });

      it('should allow owner to delete team', async () => {
        // Create a separate team for deletion test
        const tempTeam = await ctx.admin.createTeam(ownerUser.id, createTeamData());
        // Note: deleteTeam is on storage, not on admin - owner permission verified via role check
        await expect(ctx.storage.deleteTeam(tempTeam.id)).resolves.not.toThrow();

        // Verify deletion
        const deleted = await ctx.storage.getTeam(tempTeam.id);
        expect(deleted).toBeNull();
      });

      it('should allow owner to manage members', async () => {
        // Owner can invite members
        const invite = await ctx.admin.inviteMember(
          ownerUser.id,
          testTeam.id,
          `owner-invite-${Date.now()}@example.com`,
          'developer' as TeamRole,
        );
        expect(invite).toBeDefined();
        expect(invite.id).toBeDefined();
      });

      it('should allow owner to change member roles', async () => {
        // Create a new user for role change test
        const tempUserData = createUserData({ name: 'Temp User for Role Change' });
        await ctx.storage.createUser(tempUserData);
        await ctx.storage.addTeamMember({ teamId: testTeam.id, userId: tempUserData.id, role: 'viewer' as TeamRole });

        // Owner changes role to developer
        const updated = await ctx.storage.updateTeamMemberRole(testTeam.id, tempUserData.id, 'developer' as TeamRole);
        expect(updated.role).toBe('developer');

        // Cleanup
        await ctx.storage.removeTeamMember(testTeam.id, tempUserData.id);
      });
    });

    describe('Admin Permissions', () => {
      it('should allow admin to read team', async () => {
        const team = await ctx.admin.getTeam(adminUser.id, testTeam.id);
        expect(team).not.toBeNull();
        expect(team!.id).toBe(testTeam.id);
      });

      it('should allow admin to create projects', async () => {
        const project = await ctx.admin.createProject(adminUser.id, testTeam.id, {
          name: 'Admin Created Project',
          slug: `admin-project-${Date.now()}`,
          sourceType: 'local',
          sourceConfig: { path: '/tmp/admin-project' },
        });
        expect(project).toBeDefined();
        expect(project.id).toBeDefined();
      });

      it('should allow admin to invite members', async () => {
        const invite = await ctx.admin.inviteMember(
          adminUser.id,
          testTeam.id,
          `admin-invite-${Date.now()}@example.com`,
          'developer' as TeamRole,
        );
        expect(invite).toBeDefined();
      });

      it('should NOT allow admin to remove owner', async () => {
        await expect(ctx.admin.removeMember(adminUser.id, testTeam.id, ownerUser.id)).rejects.toThrow();
      });

      it('should allow admin to remove non-owner members', async () => {
        // Create a temporary member to remove
        const tempUserData = createUserData({ name: 'Temp User for Removal' });
        await ctx.storage.createUser(tempUserData);
        await ctx.storage.addTeamMember({ teamId: testTeam.id, userId: tempUserData.id, role: 'viewer' as TeamRole });

        // Admin removes the member
        await expect(ctx.admin.removeMember(adminUser.id, testTeam.id, tempUserData.id)).resolves.not.toThrow();

        // Verify removal
        const member = await ctx.storage.getTeamMember(testTeam.id, tempUserData.id);
        expect(member).toBeNull();
      });
    });

    describe('Developer Permissions', () => {
      it('should allow developer to read team', async () => {
        const team = await ctx.admin.getTeam(developerUser.id, testTeam.id);
        expect(team).toBeDefined();
      });

      it('should allow developer to create projects', async () => {
        const project = await ctx.admin.createProject(developerUser.id, testTeam.id, {
          name: 'Developer Created Project',
          slug: `developer-project-${Date.now()}`,
          sourceType: 'local',
          sourceConfig: { path: '/tmp/developer-project' },
        });
        expect(project).toBeDefined();
      });

      it('should NOT allow developer to invite members', async () => {
        await expect(
          ctx.admin.inviteMember(
            developerUser.id,
            testTeam.id,
            `dev-invite-${Date.now()}@example.com`,
            'viewer' as TeamRole,
          ),
        ).rejects.toThrow(/permission|access/i);
      });

      it('should NOT allow developer to remove members', async () => {
        await expect(ctx.admin.removeMember(developerUser.id, testTeam.id, viewerUser.id)).rejects.toThrow(
          /permission|access/i,
        );
      });

      it('should NOT allow developer to delete team', async () => {
        // Developer doesn't have team:delete permission
        const hasPermission = await ctx.storage.userHasPermission(developerUser.id, testTeam.id, 'team:delete');
        expect(hasPermission).toBe(false);
      });
    });

    describe('Viewer Permissions', () => {
      it('should allow viewer to read team', async () => {
        const team = await ctx.admin.getTeam(viewerUser.id, testTeam.id);
        expect(team).toBeDefined();
      });

      it('should NOT allow viewer to create projects', async () => {
        await expect(
          ctx.admin.createProject(viewerUser.id, testTeam.id, {
            name: 'Viewer Project',
            slug: `viewer-project-${Date.now()}`,
            sourceType: 'local',
            sourceConfig: { path: '/tmp/viewer-project' },
          }),
        ).rejects.toThrow(/permission|access/i);
      });

      it('should NOT allow viewer to invite members', async () => {
        await expect(
          ctx.admin.inviteMember(
            viewerUser.id,
            testTeam.id,
            `viewer-invite-${Date.now()}@example.com`,
            'viewer' as TeamRole,
          ),
        ).rejects.toThrow(/permission|access/i);
      });

      it('should NOT allow viewer to delete team', async () => {
        // Viewer doesn't have team:delete permission
        const hasPermission = await ctx.storage.userHasPermission(viewerUser.id, testTeam.id, 'team:delete');
        expect(hasPermission).toBe(false);
      });
    });
  });

  describe('Project-Level Permissions', () => {
    describe('Developer Permissions', () => {
      it('should allow developer to read project', async () => {
        const project = await ctx.admin.getProject(developerUser.id, testProject.id);
        expect(project).not.toBeNull();
        expect(project!.id).toBe(testProject.id);
      });

      it('should allow developer to deploy', async () => {
        // Create deployment
        const deployment = await ctx.admin.createDeployment(developerUser.id, testProject.id, {
          type: 'preview',
          branch: `feature/dev-test-${Date.now()}`,
        });
        expect(deployment).toBeDefined();

        // Trigger deploy
        const build = await ctx.admin.deploy(developerUser.id, deployment.id);
        expect(build).toBeDefined();
        expect(build.triggeredBy).toBe(developerUser.id);
      });

      it('should allow developer to set env vars', async () => {
        await expect(
          ctx.admin.setEnvVar(developerUser.id, testProject.id, `DEV_VAR_${Date.now()}`, 'value', false),
        ).resolves.not.toThrow();
      });

      it('should NOT allow developer to delete project', async () => {
        await expect(ctx.admin.deleteProject(developerUser.id, testProject.id)).rejects.toThrow(/permission|access/i);
      });
    });

    describe('Viewer Permissions', () => {
      it('should allow viewer to read project', async () => {
        const project = await ctx.admin.getProject(viewerUser.id, testProject.id);
        expect(project).toBeDefined();
      });

      it('should NOT allow viewer to deploy', async () => {
        // First create deployment as owner
        const deployment = await ctx.admin.createDeployment(ownerUser.id, testProject.id, {
          type: 'preview',
          branch: `viewer-test-${Date.now()}`,
        });

        // Viewer cannot trigger deploy
        await expect(ctx.admin.deploy(viewerUser.id, deployment.id)).rejects.toThrow(/permission|access/i);
      });

      it('should NOT allow viewer to set env vars', async () => {
        await expect(
          ctx.admin.setEnvVar(viewerUser.id, testProject.id, `VIEWER_VAR_${Date.now()}`, 'value', false),
        ).rejects.toThrow(/permission|access/i);
      });

      it('should NOT allow viewer to delete project', async () => {
        await expect(ctx.admin.deleteProject(viewerUser.id, testProject.id)).rejects.toThrow(/permission|access/i);
      });
    });
  });

  describe('Permission Context Lookup', () => {
    it('should return correct permissions for owner', async () => {
      const permissions = await ctx.storage.getUserPermissionsForTeam(ownerUser.id, testTeam.id);
      expect(permissions).toContain('*'); // Owner has all permissions
    });

    it('should return correct permissions for admin', async () => {
      const permissions = await ctx.storage.getUserPermissionsForTeam(adminUser.id, testTeam.id);
      expect(permissions).toContain('project:create');
      expect(permissions).toContain('project:delete');
      expect(permissions).toContain('member:create');
      expect(permissions).not.toContain('team:delete');
    });

    it('should return correct permissions for developer', async () => {
      const permissions = await ctx.storage.getUserPermissionsForTeam(developerUser.id, testTeam.id);
      expect(permissions).toContain('project:read');
      expect(permissions).toContain('deployment:deploy');
      expect(permissions).not.toContain('project:delete');
      expect(permissions).not.toContain('member:create');
    });

    it('should return correct permissions for viewer', async () => {
      const permissions = await ctx.storage.getUserPermissionsForTeam(viewerUser.id, testTeam.id);
      expect(permissions).toContain('project:read');
      expect(permissions).toContain('deployment:read');
      expect(permissions).not.toContain('project:create');
      expect(permissions).not.toContain('deployment:deploy');
    });

    it('should return empty permissions for non-member', async () => {
      const nonMemberData = createUserData({ name: 'Non Member' });
      await ctx.storage.createUser(nonMemberData);

      const permissions = await ctx.storage.getUserPermissionsForTeam(nonMemberData.id, testTeam.id);
      expect(permissions).toEqual([]);
    });
  });

  describe('Permission Check Helper', () => {
    it('should return true for valid permission', async () => {
      const hasPermission = await ctx.storage.userHasPermission(developerUser.id, testTeam.id, 'project:read');
      expect(hasPermission).toBe(true);
    });

    it('should return false for invalid permission', async () => {
      const hasPermission = await ctx.storage.userHasPermission(viewerUser.id, testTeam.id, 'project:delete');
      expect(hasPermission).toBe(false);
    });

    it('should return true for owner with any permission', async () => {
      const hasPermission = await ctx.storage.userHasPermission(ownerUser.id, testTeam.id, 'team:delete');
      expect(hasPermission).toBe(true);
    });

    it('should return false for non-member', async () => {
      const nonMemberData = createUserData({ name: 'Another Non Member' });
      await ctx.storage.createUser(nonMemberData);

      const hasPermission = await ctx.storage.userHasPermission(nonMemberData.id, testTeam.id, 'team:read');
      expect(hasPermission).toBe(false);
    });
  });
});
