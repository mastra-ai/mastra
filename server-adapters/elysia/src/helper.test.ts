import { Mastra } from '@mastra/core';
import Elysia from 'elysia';
import { describe, it, expect, beforeEach } from 'vitest';
import { getMastraOpenAPIDoc, clearMastraOpenAPICache } from './helper';
import { MastraServer } from './index';

describe('getMastraOpenAPIDoc', () => {
  let mastra: Mastra;
  let app: Elysia;
  let server: MastraServer;

  beforeEach(async () => {
    // Clear cache before each test
    clearMastraOpenAPICache();

    // Create minimal Mastra instance
    mastra = new Mastra({});

    // Create minimal Elysia app
    app = new Elysia();

    // Create MastraServer and initialize
    server = new MastraServer({ mastra, app });
    await server.init();
  });

  describe('Basic functionality', () => {
    it('should return OpenAPI documentation object with paths, components, and info', () => {
      const result = getMastraOpenAPIDoc(server);

      expect(result).toHaveProperty('paths');
      expect(result).toHaveProperty('info');
      expect(result.info).toHaveProperty('title');
      expect(result.info).toHaveProperty('version');
    });

    it('should return paths as an object', () => {
      const result = getMastraOpenAPIDoc(server);

      expect(typeof result.paths).toBe('object');
      expect(result.paths).not.toBeNull();
    });

    it('should have default info when no options provided', () => {
      const result = getMastraOpenAPIDoc(server);

      expect(result.info.title).toBe('Mastra API');
      expect(result.info.version).toBe('1.0.0');
      expect(result.info.description).toBe('Mastra Server API');
    });
  });

  describe('Custom options', () => {
    it('should use custom title when provided', () => {
      const result = getMastraOpenAPIDoc(server, {
        title: 'My Custom API',
      });

      expect(result.info.title).toBe('My Custom API');
    });

    it('should use custom version when provided', () => {
      const result = getMastraOpenAPIDoc(server, {
        version: '2.0.0',
      });

      expect(result.info.version).toBe('2.0.0');
    });

    it('should use custom description when provided', () => {
      const result = getMastraOpenAPIDoc(server, {
        description: 'Custom API description',
      });

      expect(result.info.description).toBe('Custom API description');
    });

    it('should merge all custom info fields', () => {
      const result = getMastraOpenAPIDoc(server, {
        title: 'Custom Title',
        version: '3.0.0',
        description: 'Custom Description',
      });

      expect(result.info.title).toBe('Custom Title');
      expect(result.info.version).toBe('3.0.0');
      expect(result.info.description).toBe('Custom Description');
    });
  });

  describe('Prefix handling', () => {
    it('should apply prefix to all paths when server has prefix', async () => {
      // Create server with prefix
      const serverWithPrefix = new MastraServer({
        mastra,
        app: new Elysia(),
        prefix: '/api',
      });
      await serverWithPrefix.init();

      const result = getMastraOpenAPIDoc(serverWithPrefix);

      // All paths should start with /api
      const paths = Object.keys(result.paths);
      if (paths.length > 0) {
        paths.forEach(path => {
          expect(path.startsWith('/api')).toBe(true);
        });
      }
    });

    it('should not have double slashes in prefixed paths', async () => {
      const serverWithPrefix = new MastraServer({
        mastra,
        app: new Elysia(),
        prefix: '/api/',
      });
      await serverWithPrefix.init();

      const result = getMastraOpenAPIDoc(serverWithPrefix);

      const paths = Object.keys(result.paths);
      paths.forEach(path => {
        expect(path).not.toMatch(/\/\//);
      });
    });

    it('should handle paths without prefix when prefix is empty', async () => {
      const serverNoPrefix = new MastraServer({
        mastra,
        app: new Elysia(),
        prefix: '',
      });
      await serverNoPrefix.init();

      const result = getMastraOpenAPIDoc(serverNoPrefix);

      expect(result.paths).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should return same object on repeated calls (cached)', () => {
      const result1 = getMastraOpenAPIDoc(server);
      const result2 = getMastraOpenAPIDoc(server);

      expect(result1).toBe(result2); // Same reference
    });

    it('should return fresh object when cache is cleared', () => {
      const result1 = getMastraOpenAPIDoc(server);
      clearMastraOpenAPICache();
      const result2 = getMastraOpenAPIDoc(server);

      expect(result1).not.toBe(result2); // Different references
      expect(result1).toEqual(result2); // But same structure
    });

    it('should return fresh object when clearCache option is true', () => {
      const result1 = getMastraOpenAPIDoc(server);
      const result2 = getMastraOpenAPIDoc(server, { clearCache: true });

      expect(result1).not.toBe(result2); // Different references
    });

    it('should cache separately for different server configurations', async () => {
      const server1 = new MastraServer({ mastra, app: new Elysia(), prefix: '/api' });
      await server1.init();

      const server2 = new MastraServer({ mastra, app: new Elysia(), prefix: '/v2' });
      await server2.init();

      const result1 = getMastraOpenAPIDoc(server1);
      const result2 = getMastraOpenAPIDoc(server2);

      // Should have different paths due to different prefixes
      expect(result1.paths).not.toEqual(result2.paths);
    });
  });

  describe('Components', () => {
    it('should include components if present in OpenAPI spec', () => {
      const result = getMastraOpenAPIDoc(server);

      // Components might be present depending on route schemas
      if (result.components) {
        expect(typeof result.components).toBe('object');
      }
    });
  });

  describe('Error handling', () => {
    it('should handle server without initialization gracefully', () => {
      const uninitializedServer = new MastraServer({ mastra, app: new Elysia() });

      // Should not throw, might return empty paths
      expect(() => getMastraOpenAPIDoc(uninitializedServer)).not.toThrow();
    });
  });
});

describe('clearMastraOpenAPICache', () => {
  it('should be callable without errors', () => {
    expect(() => clearMastraOpenAPICache()).not.toThrow();
  });

  it('should clear all cached entries', () => {
    const mastra = new Mastra({});
    const app = new Elysia();
    const server = new MastraServer({ mastra, app });

    // Generate cache
    getMastraOpenAPIDoc(server);

    // Clear cache
    clearMastraOpenAPICache();

    // Next call should generate fresh result
    const result = getMastraOpenAPIDoc(server);
    expect(result).toBeDefined();
  });
});
