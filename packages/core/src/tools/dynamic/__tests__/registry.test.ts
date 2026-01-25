import { describe, it, expect, beforeEach } from 'vitest';

import { createTool } from '../../tool';
import { createToolRegistry } from '../registry';
import type { ToolRegistry } from '../types';

// Helper to create mock tools
function createMockTool(id: string, description: string) {
  return createTool({
    id,
    description,
    execute: async () => ({ success: true }),
  });
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool = createMockTool('weather', 'Get weather for a location');
      registry.register(tool);

      expect(registry.size()).toBe(1);
      expect(registry.getToolNames()).toContain('weather');
    });

    it('should register multiple tools', () => {
      registry.register(createMockTool('weather', 'Get weather'));
      registry.register(createMockTool('calendar', 'Manage calendar events'));
      registry.register(createMockTool('email', 'Send and read emails'));

      expect(registry.size()).toBe(3);
      expect(registry.getToolNames()).toEqual(['weather', 'calendar', 'email']);
    });

    it('should update existing tool on duplicate registration', () => {
      const tool1 = createMockTool('weather', 'Old description');
      const tool2 = createMockTool('weather', 'New description');

      registry.register(tool1);
      registry.register(tool2);

      expect(registry.size()).toBe(1);
      const retrieved = registry.get('weather');
      expect(retrieved?.description).toBe('New description');
    });
  });

  describe('get', () => {
    it('should return tool by exact name', () => {
      const tool = createMockTool('github_create_issue', 'Create a GitHub issue');
      registry.register(tool);

      const retrieved = registry.get('github_create_issue');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('github_create_issue');
    });

    it('should return undefined for non-existent tool', () => {
      registry.register(createMockTool('weather', 'Get weather'));

      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // Register a diverse set of tools
      registry.register(createMockTool('github_create_issue', 'Create a new issue on GitHub'));
      registry.register(createMockTool('github_create_pr', 'Create a pull request on GitHub'));
      registry.register(createMockTool('github_search_code', 'Search code in GitHub repositories'));
      registry.register(createMockTool('linear_create_issue', 'Create a new issue in Linear'));
      registry.register(createMockTool('weather_forecast', 'Get weather forecast for a location'));
      registry.register(createMockTool('send_email', 'Send an email message'));
      registry.register(createMockTool('calendar_schedule', 'Schedule a calendar event'));
    });

    it('should find tools matching keyword', () => {
      const results = registry.search('github');

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.name.includes('github') || r.description.toLowerCase().includes('github'))).toBe(
        true,
      );
    });

    it('should find tools by description keywords', () => {
      const results = registry.search('issue');

      expect(results.length).toBe(2);
      const names = results.map(r => r.name);
      expect(names).toContain('github_create_issue');
      expect(names).toContain('linear_create_issue');
    });

    it('should boost exact name matches', () => {
      const results = registry.search('weather');

      expect(results.length).toBeGreaterThan(0);
      // weather_forecast should be first due to name match boost
      expect(results[0].name).toBe('weather_forecast');
    });

    it('should return empty array for no matches', () => {
      const results = registry.search('database');

      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const results = registry.search('');

      expect(results).toEqual([]);
    });

    it('should respect topK parameter', () => {
      const results = registry.search('create', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should include relevance scores', () => {
      const results = registry.search('github');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThan(0);
      });
    });

    it('should sort results by relevance score descending', () => {
      const results = registry.search('create');

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should truncate long descriptions', () => {
      const longDescription = 'A'.repeat(200);
      registry.register(createMockTool('long_desc_tool', longDescription));

      const results = registry.search('long');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].description.length).toBeLessThanOrEqual(150);
    });

    it('should handle multi-word queries', () => {
      const results = registry.search('create pull request');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('github_create_pr');
    });

    it('should be case insensitive', () => {
      const results1 = registry.search('GITHUB');
      const results2 = registry.search('github');

      expect(results1.map(r => r.name)).toEqual(results2.map(r => r.name));
    });

    it('should filter results by minScore', () => {
      const allResults = registry.search('a', 10, 0);
      const filteredResults = registry.search('a', 10, 5);

      expect(filteredResults.length).toBeLessThanOrEqual(allResults.length);
      filteredResults.forEach(r => {
        expect(r.score).toBeGreaterThan(5);
      });
    });
  });

  describe('getToolNames', () => {
    it('should return empty array when no tools registered', () => {
      expect(registry.getToolNames()).toEqual([]);
    });

    it('should return all registered tool names', () => {
      registry.register(createMockTool('tool1', 'Description 1'));
      registry.register(createMockTool('tool2', 'Description 2'));

      expect(registry.getToolNames()).toEqual(['tool1', 'tool2']);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count after registrations', () => {
      registry.register(createMockTool('tool1', 'Desc'));
      registry.register(createMockTool('tool2', 'Desc'));
      registry.register(createMockTool('tool3', 'Desc'));

      expect(registry.size()).toBe(3);
    });
  });
});
