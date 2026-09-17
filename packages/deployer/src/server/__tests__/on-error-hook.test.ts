import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { describe, it, expect } from 'vitest';
import { createHonoServer } from '../index';

describe('onError hook integration tests', () => {
  describe('Custom Error Handler', () => {
    it('should call custom onError handler when route handler throws', async () => {
      // Track if onError was called and with what error
      let onErrorCalled = false;
      let capturedError: Error | undefined;

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            onErrorCalled = true;
            capturedError = err;
            // Return custom formatted error response
            return c.json(
              {
                customError: true,
                message: err.message,
                timestamp: '2024-01-01T00:00:00Z',
              },
              500,
            );
          },
          apiRoutes: [
            registerApiRoute('/test/error', {
              method: 'GET',
              handler: () => {
                throw new Error('Test error for onError hook');
              },
              requiresAuth: false,
            }),
          ],
        },
      });

      const app = await createHonoServer(mastra, { tools: {} });

      const response = await app.request(new Request('http://localhost/test/error'));

      expect(response.status).toBe(500);

      const result = await response.json();

      // Verify custom error handler was called
      expect(onErrorCalled).toBe(true);
      expect(capturedError?.message).toBe('Test error for onError hook');

      // Verify custom response format was used
      expect(result).toEqual({
        customError: true,
        message: 'Test error for onError hook',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should allow sending errors to external services like Sentry', async () => {
      // Simulate sending to Sentry
      const sentryErrors: Error[] = [];

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            // Send to Sentry (simulated)
            sentryErrors.push(err);

            // Return formatted response
            return c.json({ error: 'Internal server error', sentryTracked: true }, 500);
          },
          apiRoutes: [
            registerApiRoute('/test/sentry', {
              method: 'POST',
              handler: () => {
                throw new Error('Error to track in Sentry');
              },
              requiresAuth: false,
            }),
          ],
        },
      });

      const app = await createHonoServer(mastra, { tools: {} });

      const response = await app.request(
        new Request('http://localhost/test/sentry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.sentryTracked).toBe(true);

      // Verify error was "sent to Sentry"
      expect(sentryErrors).toHaveLength(1);
      expect(sentryErrors[0]?.message).toBe('Error to track in Sentry');
    });

    it('should use default error handling when onError is not provided', async () => {
      const mastra = new Mastra({
        server: {
          apiRoutes: [
            registerApiRoute('/test/default-error', {
              method: 'GET',
              handler: () => {
                throw new Error('Default error handling');
              },
              requiresAuth: false,
            }),
          ],
        },
      });

      const app = await createHonoServer(mastra, { tools: {} });

      const response = await app.request(new Request('http://localhost/test/default-error'));

      expect(response.status).toBe(500);

      const result = await response.json();

      // Should use default error format from errorHandler
      expect(result.error).toBe('Internal Server Error');
    });

    it('should pass Hono context to onError handler for access to request details', async () => {
      let capturedPath: string | undefined;
      let capturedMethod: string | undefined;

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            // Access request details from context
            capturedPath = c.req.path;
            capturedMethod = c.req.method;

            return c.json(
              {
                error: err.message,
                path: c.req.path,
                method: c.req.method,
              },
              500,
            );
          },
          apiRoutes: [
            registerApiRoute('/test/context-access', {
              method: 'PUT',
              handler: () => {
                throw new Error('Context access test');
              },
              requiresAuth: false,
            }),
          ],
        },
      });

      const app = await createHonoServer(mastra, { tools: {} });

      const response = await app.request(
        new Request('http://localhost/test/context-access', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(500);

      const result = await response.json();

      // Verify context was accessible
      expect(capturedPath).toBe('/test/context-access');
      expect(capturedMethod).toBe('PUT');

      // Verify response includes context details
      expect(result.path).toBe('/test/context-access');
      expect(result.method).toBe('PUT');
    });

    it('should handle HTTPException errors with custom onError', async () => {
      let errorType: string | undefined;

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            errorType = err.constructor.name;
            // Custom formatting for all errors
            return c.json(
              {
                customHandled: true,
                errorType,
                message: err.message,
              },
              500,
            );
          },
          apiRoutes: [
            registerApiRoute('/test/http-exception', {
              method: 'GET',
              handler: () => {
                // Simulating an error that would normally be caught
                throw new Error('Some internal error');
              },
              requiresAuth: false,
            }),
          ],
        },
      });

      const app = await createHonoServer(mastra, { tools: {} });

      const response = await app.request(new Request('http://localhost/test/http-exception'));

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.customHandled).toBe(true);
      expect(result.errorType).toBe('Error');
    });
  });

  describe('Default Error Handler', () => {
    it('lets errorHandler serve a structured HTTPException response without re-serializing it', async () => {
      const { createVersionLabelApiError } = await import('@mastra/server/handlers/version-label-errors');
      const { errorHandler } = await import('../handlers/error');

      const error = createVersionLabelApiError('VERSION_LABELS_UNSUPPORTED', 'Version labels are unsupported.');
      const response = errorHandler(error as unknown as Error, {} as never, false);

      expect(response.status).toBe(501);
      await expect(response.json()).resolves.toEqual({
        error: { code: 'VERSION_LABELS_UNSUPPORTED', message: 'Version labels are unsupported.' },
      });
    });

    it('serves the structured response attached to a thrown HTTPException verbatim', async () => {
      const { createVersionLabelApiError } = await import('@mastra/server/handlers/version-label-errors');

      const mastra = new Mastra({
        logger: false,
        server: {
          apiRoutes: [
            registerApiRoute('/test/label-conflict', {
              method: 'GET',
              handler: () => {
                throw createVersionLabelApiError('LABEL_MOVE_CONFLICT', 'The label moved after it was read.', {
                  label: 'pr-101',
                  currentVersionId: 'version-2',
                });
              },
              requiresAuth: false,
            }),
          ],
        },
      });

      const app = await createHonoServer(mastra, { tools: {} });

      const response = await app.request(new Request('http://localhost/test/label-conflict'));

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'LABEL_MOVE_CONFLICT',
          message: 'The label moved after it was read.',
          details: { label: 'pr-101', currentVersionId: 'version-2' },
        },
      });
    });
  });
});
