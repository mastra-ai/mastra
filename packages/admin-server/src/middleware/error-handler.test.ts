/**
 * Unit tests for error handler middleware.
 */

import { MastraAdminError, AdminErrorDomain } from '@mastra/admin';
import type { Context } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMockHonoContext } from '../__tests__/test-utils';
import { errorHandler } from './error-handler';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('MastraAdminError handling', () => {
    it('should handle LICENSE domain errors with 402 status', async () => {
      const error = MastraAdminError.invalidLicense('License expired');
      const context = createMockHonoContext({
        variables: { requestId: 'req-123' },
      });

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(402);
      const body = await response.json();
      expect(body.error).toBe('License expired');
      expect(body.code).toBe('INVALID_LICENSE');
      expect(body.requestId).toBe('req-123');
    });

    it('should handle RBAC domain errors with 403 status', async () => {
      const error = MastraAdminError.accessDenied('project', 'write');
      const context = createMockHonoContext({
        variables: { requestId: 'req-456' },
      });

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Access denied: cannot write on project');
      expect(body.code).toBe('ACCESS_DENIED');
    });

    it('should handle STORAGE domain errors with 500 status', async () => {
      const error = MastraAdminError.storageError('Database connection failed');
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Database connection failed');
    });

    it('should handle BUILD domain errors with 500 status', async () => {
      const error = MastraAdminError.buildFailed('build-123', 'npm install failed');
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('npm install failed');
    });

    it('should handle DEPLOYMENT domain errors with 400 status', async () => {
      const error = MastraAdminError.deploymentNotFound('deploy-123');
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Deployment not found: deploy-123');
    });

    it('should handle PROJECT domain errors with 400 status', async () => {
      const error = MastraAdminError.projectNotFound('project-123');
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Project not found: project-123');
    });

    it('should handle TEAM domain errors with 400 status', async () => {
      const error = MastraAdminError.teamNotFound('team-123');
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Team not found: team-123');
    });

    it('should handle BILLING domain errors with 402 status', async () => {
      const error = new MastraAdminError({
        id: 'BILLING_ERROR',
        text: 'Payment required',
        domain: AdminErrorDomain.BILLING,
        category: 'LICENSE' as const,
      });
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(402);
    });

    it('should include error details in response', async () => {
      const error = MastraAdminError.licenseLimitExceeded('teams', 10, 5);
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      const body = await response.json();
      expect(body.details).toEqual({ limit: 'teams', current: 10, max: 5 });
    });
  });

  describe('Zod validation error handling', () => {
    it('should handle Zod validation errors with 400 status', async () => {
      const zodError = {
        name: 'ZodError',
        message: 'Validation failed',
        issues: [
          { path: ['name'], message: 'Required' },
          { path: ['email'], message: 'Invalid email' },
        ],
      };
      const context = createMockHonoContext({
        variables: { requestId: 'req-789' },
      });

      const response = errorHandler(zodError as unknown as Error, context as unknown as Context);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation error');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.issues).toEqual([
        { path: 'name', message: 'Required' },
        { path: 'email', message: 'Invalid email' },
      ]);
      expect(body.requestId).toBe('req-789');
    });

    it('should handle nested path in Zod errors', async () => {
      const zodError = {
        name: 'ZodError',
        message: 'Validation failed',
        issues: [{ path: ['settings', 'maxProjects'], message: 'Must be positive' }],
      };
      const context = createMockHonoContext({});

      const response = errorHandler(zodError as unknown as Error, context as unknown as Context);

      const body = await response.json();
      expect(body.details.issues).toEqual([{ path: 'settings.maxProjects', message: 'Must be positive' }]);
    });

    it('should handle empty issues array', async () => {
      const zodError = {
        name: 'ZodError',
        message: 'Validation failed',
        issues: [],
      };
      const context = createMockHonoContext({});

      const response = errorHandler(zodError as unknown as Error, context as unknown as Context);

      const body = await response.json();
      expect(body.details.issues).toEqual([]);
    });
  });

  describe('generic error handling', () => {
    it('should handle generic errors with 500 status', async () => {
      const error = new Error('Something went wrong');
      const context = createMockHonoContext({
        variables: { requestId: 'req-999' },
      });

      const response = errorHandler(error, context as unknown as Context);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.requestId).toBe('req-999');
    });

    it('should log generic errors to console', async () => {
      const error = new Error('Unexpected error');
      const context = createMockHonoContext({});

      errorHandler(error, context as unknown as Context);

      expect(console.error).toHaveBeenCalledWith('Unhandled error:', error);
    });

    it('should handle errors without requestId', async () => {
      const error = new Error('No request ID');
      const context = createMockHonoContext({});

      const response = errorHandler(error, context as unknown as Context);

      const body = await response.json();
      expect(body.requestId).toBeUndefined();
    });
  });
});
