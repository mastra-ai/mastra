import { describe, it, expect } from 'vitest';
import { createSkillsApiServer } from './server.js';

describe('Skills API Server', () => {
  const app = createSkillsApiServer({ logging: false });

  describe('GET /', () => {
    it('returns API information', async () => {
      const res = await app.request('/');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe('Skills.sh API');
      expect(body.endpoints).toBeDefined();
    });
  });

  describe('GET /health', () => {
    it('returns health status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('skills-api');
    });
  });

  describe('GET /api/skills', () => {
    it('returns paginated skills list', async () => {
      const res = await app.request('/api/skills');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThan(0);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(20);
    });

    it('supports search query', async () => {
      const res = await app.request('/api/skills?query=react');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills.length).toBeGreaterThan(0);
      expect(body.skills.some((s: any) => s.name.includes('react') || s.tags.includes('react'))).toBe(true);
    });

    it('supports category filter', async () => {
      const res = await app.request('/api/skills?category=development');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills.every((s: any) => s.category === 'development')).toBe(true);
    });

    it('supports pagination', async () => {
      const res = await app.request('/api/skills?page=1&pageSize=5');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills.length).toBeLessThanOrEqual(5);
      expect(body.pageSize).toBe(5);
    });

    it('supports featured filter', async () => {
      const res = await app.request('/api/skills?featured=true');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills.every((s: any) => s.featured === true)).toBe(true);
    });
  });

  describe('GET /api/skills/featured', () => {
    it('returns featured skills', async () => {
      const res = await app.request('/api/skills/featured');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills).toBeInstanceOf(Array);
      expect(body.skills.every((s: any) => s.featured === true)).toBe(true);
    });
  });

  describe('GET /api/skills/categories', () => {
    it('returns categories', async () => {
      const res = await app.request('/api/skills/categories');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.categories).toBeInstanceOf(Array);
      expect(body.categories.length).toBeGreaterThan(0);
      expect(body.categories[0]).toHaveProperty('name');
      expect(body.categories[0]).toHaveProperty('displayName');
    });
  });

  describe('GET /api/skills/tags', () => {
    it('returns tags', async () => {
      const res = await app.request('/api/skills/tags');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.tags).toBeInstanceOf(Array);
      expect(body.tags.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/skills/stats', () => {
    it('returns statistics', async () => {
      const res = await app.request('/api/skills/stats');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.totalSkills).toBeGreaterThan(0);
      expect(body.totalDownloads).toBeGreaterThan(0);
      expect(body.totalCategories).toBeGreaterThan(0);
    });
  });

  describe('GET /api/skills/:name', () => {
    it('returns skill details', async () => {
      const res = await app.request('/api/skills/code-review');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe('code-review');
      expect(body.description).toBeDefined();
      expect(body.version).toBeDefined();
    });

    it('returns 404 for unknown skill', async () => {
      const res = await app.request('/api/skills/unknown-skill-xyz');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/skills/:name/install', () => {
    it('returns installation instructions', async () => {
      const res = await app.request('/api/skills/code-review/install');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skill).toBeDefined();
      expect(body.instructions).toBeDefined();
      expect(body.instructions.npm).toBeDefined();
    });
  });

  describe('404 handling', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await app.request('/unknown-route');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Not Found');
    });
  });
});
