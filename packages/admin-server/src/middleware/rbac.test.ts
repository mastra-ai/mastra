/**
 * Unit tests for RBAC middleware.
 */

import type { Context, Next } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  createMockMastraAdmin,
  createMockHonoContext,
  createMockNext,
  createMockTeam,
  createMockTeamMember,
  createMockProject,
  createMockDeployment,
  createMockBuild,
  createMockRunningServer,
} from '../__tests__/test-utils';
import { createRBACMiddleware } from './rbac';

describe('createRBACMiddleware', () => {
  let mockAdmin: ReturnType<typeof createMockMastraAdmin>;
  let middleware: ReturnType<typeof createRBACMiddleware>;

  beforeEach(() => {
    mockAdmin = createMockMastraAdmin();
    middleware = createRBACMiddleware(mockAdmin);
  });

  describe('without user context', () => {
    it('should skip RBAC when userId is not set', async () => {
      const context = createMockHonoContext({
        path: '/api/teams/team-123',
        params: { teamId: 'team-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(context.set).not.toHaveBeenCalledWith('team', expect.anything());
      expect(mockAdmin.getStorage().getTeam).not.toHaveBeenCalled();
    });
  });

  describe('with direct teamId in path', () => {
    it('should load team context from teamId param', async () => {
      const team = createMockTeam({ id: 'team-456' });
      const member = createMockTeamMember({ teamId: 'team-456' });
      const permissions = ['team:read', 'project:read'];

      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);
      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getRBAC().getUserPermissions = vi.fn().mockResolvedValue(permissions);

      const context = createMockHonoContext({
        path: '/api/teams/team-456',
        params: { teamId: 'team-456' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(context.set).toHaveBeenCalledWith('team', team);
      expect(context.set).toHaveBeenCalledWith('teamId', 'team-456');
      expect(context.set).toHaveBeenCalledWith('teamMember', member);
      expect(context.set).toHaveBeenCalledWith('permissions', permissions);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('resolving teamId from projectId', () => {
    it('should resolve team context from projectId param', async () => {
      const project = createMockProject({ id: 'project-789', teamId: 'team-from-project' });
      const team = createMockTeam({ id: 'team-from-project' });
      const member = createMockTeamMember({ teamId: 'team-from-project' });
      const permissions = ['project:read'];

      mockAdmin.getStorage().getProject = vi.fn().mockResolvedValue(project);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);
      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getRBAC().getUserPermissions = vi.fn().mockResolvedValue(permissions);

      const context = createMockHonoContext({
        path: '/api/projects/project-789',
        params: { projectId: 'project-789' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getProject).toHaveBeenCalledWith('project-789');
      expect(context.set).toHaveBeenCalledWith('teamId', 'team-from-project');
      expect(next).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      mockAdmin.getStorage().getProject = vi.fn().mockResolvedValue(null);

      const context = createMockHonoContext({
        path: '/api/projects/unknown',
        params: { projectId: 'unknown' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(context.set).not.toHaveBeenCalledWith('teamId', expect.anything());
    });
  });

  describe('resolving teamId from deploymentId', () => {
    it('should resolve team context from deploymentId param', async () => {
      const deployment = createMockDeployment({ id: 'deploy-123', projectId: 'project-abc' });
      const project = createMockProject({ id: 'project-abc', teamId: 'team-from-deployment' });
      const team = createMockTeam({ id: 'team-from-deployment' });
      const member = createMockTeamMember({ teamId: 'team-from-deployment' });

      mockAdmin.getStorage().getDeployment = vi.fn().mockResolvedValue(deployment);
      mockAdmin.getStorage().getProject = vi.fn().mockResolvedValue(project);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);
      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);

      const context = createMockHonoContext({
        path: '/api/deployments/deploy-123',
        params: { deploymentId: 'deploy-123' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getDeployment).toHaveBeenCalledWith('deploy-123');
      expect(context.set).toHaveBeenCalledWith('teamId', 'team-from-deployment');
      expect(next).toHaveBeenCalled();
    });

    it('should handle deployment not found', async () => {
      mockAdmin.getStorage().getDeployment = vi.fn().mockResolvedValue(null);

      const context = createMockHonoContext({
        path: '/api/deployments/unknown',
        params: { deploymentId: 'unknown' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('resolving teamId from buildId', () => {
    it('should resolve team context from buildId param', async () => {
      const build = createMockBuild({ id: 'build-xyz', deploymentId: 'deploy-abc' });
      const deployment = createMockDeployment({ id: 'deploy-abc', projectId: 'project-123' });
      const project = createMockProject({ id: 'project-123', teamId: 'team-from-build' });
      const team = createMockTeam({ id: 'team-from-build' });
      const member = createMockTeamMember({ teamId: 'team-from-build' });

      mockAdmin.getStorage().getBuild = vi.fn().mockResolvedValue(build);
      mockAdmin.getStorage().getDeployment = vi.fn().mockResolvedValue(deployment);
      mockAdmin.getStorage().getProject = vi.fn().mockResolvedValue(project);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);
      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);

      const context = createMockHonoContext({
        path: '/api/builds/build-xyz',
        params: { buildId: 'build-xyz' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getBuild).toHaveBeenCalledWith('build-xyz');
      expect(context.set).toHaveBeenCalledWith('teamId', 'team-from-build');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('resolving teamId from serverId', () => {
    it('should resolve team context from serverId param', async () => {
      const server = createMockRunningServer({ id: 'server-99', deploymentId: 'deploy-88' });
      const deployment = createMockDeployment({ id: 'deploy-88', projectId: 'project-77' });
      const project = createMockProject({ id: 'project-77', teamId: 'team-from-server' });
      const team = createMockTeam({ id: 'team-from-server' });
      const member = createMockTeamMember({ teamId: 'team-from-server' });

      mockAdmin.getStorage().getRunningServer = vi.fn().mockResolvedValue(server);
      mockAdmin.getStorage().getDeployment = vi.fn().mockResolvedValue(deployment);
      mockAdmin.getStorage().getProject = vi.fn().mockResolvedValue(project);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);
      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);

      const context = createMockHonoContext({
        path: '/api/servers/server-99',
        params: { serverId: 'server-99' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getRunningServer).toHaveBeenCalledWith('server-99');
      expect(context.set).toHaveBeenCalledWith('teamId', 'team-from-server');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue on context resolution error', async () => {
      mockAdmin.getStorage().getTeam = vi.fn().mockRejectedValue(new Error('DB error'));

      const context = createMockHonoContext({
        path: '/api/teams/team-error',
        params: { teamId: 'team-error' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('priority of teamId resolution', () => {
    it('should prefer direct teamId over projectId', async () => {
      const team = createMockTeam({ id: 'direct-team' });
      const member = createMockTeamMember({ teamId: 'direct-team' });

      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);
      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);

      const context = createMockHonoContext({
        path: '/api/teams/direct-team/projects/project-123',
        params: { teamId: 'direct-team', projectId: 'project-123' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      // Should not call getProject since teamId is already available
      expect(mockAdmin.getStorage().getProject).not.toHaveBeenCalled();
      expect(context.set).toHaveBeenCalledWith('teamId', 'direct-team');
    });
  });
});
