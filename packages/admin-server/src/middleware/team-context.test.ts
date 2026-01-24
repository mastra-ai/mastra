/**
 * Unit tests for team context middleware.
 */

import type { Context, Next } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  createMockMastraAdmin,
  createMockHonoContext,
  createMockNext,
  createMockTeam,
  createMockTeamMember,
} from '../__tests__/test-utils';
import { createTeamContextMiddleware } from './team-context';

describe('createTeamContextMiddleware', () => {
  let mockAdmin: ReturnType<typeof createMockMastraAdmin>;
  let middleware: ReturnType<typeof createTeamContextMiddleware>;

  beforeEach(() => {
    mockAdmin = createMockMastraAdmin();
    middleware = createTeamContextMiddleware(mockAdmin);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('without user context', () => {
    it('should skip when userId is not set', async () => {
      const context = createMockHonoContext({
        path: '/api/teams/team-123',
        params: { teamId: 'team-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(mockAdmin.getStorage().getTeamMember).not.toHaveBeenCalled();
    });
  });

  describe('with existing team context', () => {
    it('should skip when teamId is already set', async () => {
      const context = createMockHonoContext({
        path: '/api/teams/team-123',
        params: { teamId: 'team-123' },
        variables: {
          userId: 'user-123',
          teamId: 'already-set-team',
        },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(mockAdmin.getStorage().getTeamMember).not.toHaveBeenCalled();
    });
  });

  describe('team ID from route params', () => {
    it('should extract teamId from route params', async () => {
      const team = createMockTeam({ id: 'team-from-params' });
      const member = createMockTeamMember({ teamId: 'team-from-params', role: 'developer' as const });

      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);

      const context = createMockHonoContext({
        path: '/api/teams/team-from-params',
        params: { teamId: 'team-from-params' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getTeamMember).toHaveBeenCalledWith('team-from-params', 'user-123');
      expect(context.set).toHaveBeenCalledWith('team', team);
      expect(context.set).toHaveBeenCalledWith('teamId', 'team-from-params');
      expect(context.set).toHaveBeenCalledWith('teamRole', 'developer');
      expect(context.set).toHaveBeenCalledWith('teamMember', member);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('team ID from header', () => {
    it('should extract teamId from X-Team-Id header', async () => {
      const team = createMockTeam({ id: 'team-from-header' });
      const member = createMockTeamMember({ teamId: 'team-from-header' });

      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);

      const context = createMockHonoContext({
        path: '/api/projects',
        headers: { 'X-Team-Id': 'team-from-header' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(context.set).toHaveBeenCalledWith('teamId', 'team-from-header');
      expect(next).toHaveBeenCalled();
    });

    it('should not use header when disabled in config', async () => {
      const customMiddleware = createTeamContextMiddleware(mockAdmin, {
        allowHeader: false,
      });

      const context = createMockHonoContext({
        path: '/api/projects',
        headers: { 'X-Team-Id': 'team-from-header' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await customMiddleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getTeamMember).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('team ID from query param', () => {
    it('should extract teamId from query param', async () => {
      const team = createMockTeam({ id: 'team-from-query' });
      const member = createMockTeamMember({ teamId: 'team-from-query' });

      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);

      const context = createMockHonoContext({
        path: '/api/projects',
        query: { teamId: 'team-from-query' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(context.set).toHaveBeenCalledWith('teamId', 'team-from-query');
      expect(next).toHaveBeenCalled();
    });

    it('should not use query when disabled in config', async () => {
      const customMiddleware = createTeamContextMiddleware(mockAdmin, {
        allowQuery: false,
      });

      const context = createMockHonoContext({
        path: '/api/projects',
        query: { teamId: 'team-from-query' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await customMiddleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getTeamMember).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('priority of team ID sources', () => {
    it('should prefer route param over header', async () => {
      const team = createMockTeam({ id: 'team-from-param' });
      const member = createMockTeamMember({ teamId: 'team-from-param' });

      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);

      const context = createMockHonoContext({
        path: '/api/teams/team-from-param',
        params: { teamId: 'team-from-param' },
        headers: { 'X-Team-Id': 'team-from-header' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getTeamMember).toHaveBeenCalledWith('team-from-param', 'user-123');
    });

    it('should prefer header over query param', async () => {
      const team = createMockTeam({ id: 'team-from-header' });
      const member = createMockTeamMember({ teamId: 'team-from-header' });

      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(team);

      const context = createMockHonoContext({
        path: '/api/projects',
        headers: { 'X-Team-Id': 'team-from-header' },
        query: { teamId: 'team-from-query' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getStorage().getTeamMember).toHaveBeenCalledWith('team-from-header', 'user-123');
    });
  });

  describe('membership validation', () => {
    it('should return 403 when user is not a member', async () => {
      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(null);

      const context = createMockHonoContext({
        path: '/api/teams/team-123',
        params: { teamId: 'team-123' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      const response = await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).not.toHaveBeenCalled();
      expect(response?.status).toBe(403);
      const body = await response?.json();
      expect(body.error).toBe('Not a member of this team');
    });
  });

  describe('team not found', () => {
    it('should return 404 when team does not exist', async () => {
      const member = createMockTeamMember({ teamId: 'team-123' });

      mockAdmin.getStorage().getTeamMember = vi.fn().mockResolvedValue(member);
      mockAdmin.getStorage().getTeam = vi.fn().mockResolvedValue(null);

      const context = createMockHonoContext({
        path: '/api/teams/team-123',
        params: { teamId: 'team-123' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      const response = await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).not.toHaveBeenCalled();
      expect(response?.status).toBe(404);
      const body = await response?.json();
      expect(body.error).toBe('Team not found');
    });
  });

  describe('error handling', () => {
    it('should return 404 on storage error', async () => {
      mockAdmin.getStorage().getTeamMember = vi.fn().mockRejectedValue(new Error('DB error'));

      const context = createMockHonoContext({
        path: '/api/teams/team-123',
        params: { teamId: 'team-123' },
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      const response = await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).not.toHaveBeenCalled();
      expect(response?.status).toBe(404);
    });
  });

  describe('without team ID', () => {
    it('should continue without setting team context', async () => {
      const context = createMockHonoContext({
        path: '/api/users/me',
        variables: { userId: 'user-123' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(context.set).not.toHaveBeenCalledWith('teamId', expect.anything());
      expect(mockAdmin.getStorage().getTeamMember).not.toHaveBeenCalled();
    });
  });
});
