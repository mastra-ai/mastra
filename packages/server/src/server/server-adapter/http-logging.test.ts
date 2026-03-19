import { Mastra } from '@mastra/core/mastra';
import type { HttpLoggingConfig } from '@mastra/core/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MastraServer } from './index';

// Mock server adapter for testing
class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();
}

describe('HTTP Logging Configuration', () => {
  let mastra: Mastra;
  let mockApp: any;

  beforeEach(() => {
    mockApp = {};
  });

  describe('parseLoggingConfig', () => {
    it('should return undefined when apiReqLogs is not set', () => {
      mastra = new Mastra({});
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      // Access protected property for testing
      const config = (adapter as any).httpLoggingConfig;
      expect(config).toBeUndefined();
    });

    it('should return undefined when apiReqLogs is false', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: false,
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      const config = (adapter as any).httpLoggingConfig;
      expect(config).toBeUndefined();
    });

    it('should return default config when apiReqLogs is true', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: true,
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      const config: HttpLoggingConfig = (adapter as any).httpLoggingConfig;
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.level).toBe('info');
      expect(config.redactHeaders).toEqual(['authorization', 'cookie']);
      expect(config.excludePaths).toBeUndefined();
      expect(config.includeHeaders).toBeUndefined();
      expect(config.includeQueryParams).toBeUndefined();
    });

    it('should merge user config with defaults', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              level: 'debug',
              excludePaths: ['/health', '/ready'],
              includeQueryParams: true,
            },
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      const config: HttpLoggingConfig = (adapter as any).httpLoggingConfig;
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.level).toBe('debug');
      expect(config.excludePaths).toEqual(['/health', '/ready']);
      expect(config.includeQueryParams).toBe(true);
      expect(config.redactHeaders).toEqual(['authorization', 'cookie']); // Default value
    });

    it('should merge custom redactHeaders with defaults', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              redactHeaders: ['x-api-key', 'x-secret'],
            },
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      const config: HttpLoggingConfig = (adapter as any).httpLoggingConfig;
      expect(config.redactHeaders).toEqual(['authorization', 'cookie', 'x-api-key', 'x-secret']);
    });

    it('should support all log levels', () => {
      const levels: Array<'debug' | 'info' | 'warn'> = ['debug', 'info', 'warn'];

      levels.forEach(level => {
        mastra = new Mastra({
          server: {
            build: {
              apiReqLogs: {
                enabled: true,
                level,
              },
            },
          },
        });
        const adapter = new TestMastraServer({ app: mockApp, mastra });
        const config: HttpLoggingConfig = (adapter as any).httpLoggingConfig;
        expect(config.level).toBe(level);
      });
    });

    it('should return undefined when enabled is false in object config', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: false,
              level: 'debug',
            },
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      const config = (adapter as any).httpLoggingConfig;
      expect(config).toBeUndefined();
    });
  });

  describe('shouldLogRequest', () => {
    it('should return false when logging is disabled', () => {
      mastra = new Mastra({});
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      expect((adapter as any).shouldLogRequest('/api/test')).toBe(false);
    });

    it('should return true when logging is enabled and path is not excluded', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: true,
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      expect((adapter as any).shouldLogRequest('/api/test')).toBe(true);
      expect((adapter as any).shouldLogRequest('/api/agents')).toBe(true);
    });

    it('should return false when path is in excludePaths', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              excludePaths: ['/health', '/ready', '/metrics'],
            },
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      expect((adapter as any).shouldLogRequest('/health')).toBe(false);
      expect((adapter as any).shouldLogRequest('/ready')).toBe(false);
      expect((adapter as any).shouldLogRequest('/metrics')).toBe(false);
      expect((adapter as any).shouldLogRequest('/api/test')).toBe(true);
    });

    it('should match exact paths and sub-paths for exclusion', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              excludePaths: ['/health'],
            },
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      expect((adapter as any).shouldLogRequest('/health')).toBe(false);
      expect((adapter as any).shouldLogRequest('/health/check')).toBe(false);
      expect((adapter as any).shouldLogRequest('/healthcheck')).toBe(true);
      expect((adapter as any).shouldLogRequest('/api/health')).toBe(true);
    });

    it('should handle empty excludePaths array', () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              excludePaths: [],
            },
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      expect((adapter as any).shouldLogRequest('/health')).toBe(true);
      expect((adapter as any).shouldLogRequest('/api/test')).toBe(true);
    });
  });

  describe('integration with init lifecycle', () => {
    it('should call registerHttpLoggingMiddleware during init', async () => {
      mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: true,
          },
        },
      });
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      await adapter.init();

      expect(adapter.registerHttpLoggingMiddleware).toHaveBeenCalled();
    });

    it('should call registerHttpLoggingMiddleware even when disabled', async () => {
      mastra = new Mastra({});
      const adapter = new TestMastraServer({ app: mockApp, mastra });

      await adapter.init();

      expect(adapter.registerHttpLoggingMiddleware).toHaveBeenCalled();
    });
  });
});
