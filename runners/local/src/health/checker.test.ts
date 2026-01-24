import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { HealthChecker } from './checker';

describe('HealthChecker', () => {
  let server: Server;
  let port: number;
  let shouldFail: boolean;
  let statusCode: number;

  beforeAll(async () => {
    shouldFail = false;
    statusCode = 200;

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/health') {
        if (shouldFail) {
          res.writeHead(statusCode);
          res.end('Error');
        } else {
          res.writeHead(200);
          res.end('OK');
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const address = server.address();
        port = typeof address === 'object' && address ? address.port : 0;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  describe('check', () => {
    it('should return healthy for successful health check', async () => {
      shouldFail = false;
      const checker = new HealthChecker();

      const result = await checker.check('localhost', port);

      expect(result.healthy).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should return unhealthy for failed health check', async () => {
      shouldFail = true;
      statusCode = 500;
      const checker = new HealthChecker();

      const result = await checker.check('localhost', port);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('500');
    });

    it('should return unhealthy for connection errors', async () => {
      const checker = new HealthChecker({ timeoutMs: 1000 });

      const result = await checker.check('localhost', 1); // Port 1 should not be accessible

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Health check failed');
    });

    it('should use custom endpoint', async () => {
      const checker = new HealthChecker({ endpoint: '/custom-health' });

      const result = await checker.check('localhost', port);

      // Server returns 404 for non-/health endpoints
      expect(result.healthy).toBe(false);
    });

    it('should timeout when server is slow', async () => {
      const checker = new HealthChecker({ timeoutMs: 10 });

      // Connect to a port that won't respond quickly
      const result = await checker.check('localhost', 1);

      expect(result.healthy).toBe(false);
    });
  });

  describe('waitForHealthy', () => {
    it('should succeed when server is healthy', async () => {
      shouldFail = false;
      const checker = new HealthChecker({
        retryIntervalMs: 10,
        maxRetries: 3,
      });

      await expect(checker.waitForHealthy('localhost', port)).resolves.toBeUndefined();
    });

    it('should fail after max retries when server is unhealthy', async () => {
      shouldFail = true;
      statusCode = 500;
      const checker = new HealthChecker({
        retryIntervalMs: 10,
        maxRetries: 3,
      });

      await expect(checker.waitForHealthy('localhost', port)).rejects.toThrow(
        /failed to become healthy after 3 attempts/,
      );
    });

    it('should retry until server becomes healthy', async () => {
      let attempts = 0;
      const checkSpy = vi.fn();

      shouldFail = true;
      statusCode = 503;

      // After 2 attempts, server becomes healthy
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        attempts++;
        checkSpy();
        if (attempts >= 3) {
          shouldFail = false;
        }
        return originalFetch(url);
      }) as typeof fetch;

      const checker = new HealthChecker({
        retryIntervalMs: 10,
        maxRetries: 10,
      });

      try {
        await checker.waitForHealthy('localhost', port);
        expect(checkSpy).toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
        shouldFail = false;
      }
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const checker = new HealthChecker();

      // Can't directly inspect config, but we can verify behavior
      expect(checker).toBeDefined();
    });

    it('should merge partial configuration with defaults', () => {
      const checker = new HealthChecker({
        timeoutMs: 1000,
        // Other values should use defaults
      });

      expect(checker).toBeDefined();
    });
  });
});
