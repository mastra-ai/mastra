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
      expect(
        body.skills.some(
          (s: any) =>
            s.name.toLowerCase().includes('react') ||
            s.displayName.toLowerCase().includes('react') ||
            s.source.toLowerCase().includes('react'),
        ),
      ).toBe(true);
    });

    it('supports owner filter', async () => {
      const res = await app.request('/api/skills?owner=vercel-labs');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills.every((s: any) => s.owner === 'vercel-labs')).toBe(true);
    });

    it('supports pagination', async () => {
      const res = await app.request('/api/skills?page=1&pageSize=5');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills.length).toBeLessThanOrEqual(5);
      expect(body.pageSize).toBe(5);
    });
  });

  describe('GET /api/skills/top', () => {
    it('returns top skills by installs', async () => {
      const res = await app.request('/api/skills/top');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.skills).toBeInstanceOf(Array);
      expect(body.skills.length).toBeGreaterThan(0);

      // Should be sorted by installs descending
      for (let i = 1; i < body.skills.length; i++) {
        expect(body.skills[i - 1].installs).toBeGreaterThanOrEqual(body.skills[i].installs);
      }
    });
  });

  describe('GET /api/skills/sources', () => {
    it('returns sources with counts', async () => {
      const res = await app.request('/api/skills/sources');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.sources).toBeInstanceOf(Array);
      expect(body.sources.length).toBeGreaterThan(0);
      expect(body.sources[0]).toHaveProperty('source');
      expect(body.sources[0]).toHaveProperty('skillCount');
      expect(body.sources[0]).toHaveProperty('totalInstalls');
    });
  });

  describe('GET /api/skills/owners', () => {
    it('returns owners with counts', async () => {
      const res = await app.request('/api/skills/owners');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.owners).toBeInstanceOf(Array);
      expect(body.owners.length).toBeGreaterThan(0);
      expect(body.owners[0]).toHaveProperty('owner');
      expect(body.owners[0]).toHaveProperty('skillCount');
    });
  });

  describe('GET /api/skills/agents', () => {
    it('returns supported AI agents', async () => {
      const res = await app.request('/api/skills/agents');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.agents).toBeInstanceOf(Array);
      expect(body.agents.length).toBeGreaterThan(0);
      expect(body.agents[0]).toHaveProperty('id');
      expect(body.agents[0]).toHaveProperty('name');
      expect(body.agents[0]).toHaveProperty('url');
      expect(body.agents[0]).toHaveProperty('iconUrl');
    });
  });

  describe('GET /api/skills/stats', () => {
    it('returns statistics', async () => {
      const res = await app.request('/api/skills/stats');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.totalSkills).toBeGreaterThan(0);
      expect(body.totalSources).toBeGreaterThan(0);
      expect(body.totalOwners).toBeGreaterThan(0);
      expect(body.totalInstalls).toBeGreaterThan(0);
      expect(body.scrapedAt).toBeDefined();
    });
  });

  describe('GET /api/skills/by-source/:owner/:repo', () => {
    it('returns skills from a specific source', async () => {
      const res = await app.request('/api/skills/by-source/vercel-labs/agent-skills');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.source).toBe('vercel-labs/agent-skills');
      expect(body.skills).toBeInstanceOf(Array);
      expect(body.skills.length).toBeGreaterThan(0);
      expect(body.skills.every((s: any) => s.source === 'vercel-labs/agent-skills')).toBe(true);
    });

    it('returns 404 for unknown source', async () => {
      const res = await app.request('/api/skills/by-source/unknown-owner/unknown-repo-xyz');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/skills/:skillId', () => {
    it('returns skill details', async () => {
      const res = await app.request('/api/skills/vercel-react-best-practices');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe('vercel-react-best-practices');
      expect(body.source).toBeDefined();
      expect(body.installs).toBeDefined();
    });

    it('returns 404 for unknown skill', async () => {
      const res = await app.request('/api/skills/unknown-skill-xyz-123');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/skills/:owner/:repo/:skillId', () => {
    it('returns specific skill with install command', async () => {
      const res = await app.request('/api/skills/vercel-labs/agent-skills/vercel-react-best-practices');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.source).toBe('vercel-labs/agent-skills');
      expect(body.skillId).toBe('vercel-react-best-practices');
      expect(body.installCommand).toContain('npx skills add');
    });
  });

  describe('GET /api/skills/:owner/:repo/:skillId/content', () => {
    it('fetches skill content from GitHub', async () => {
      // This test makes a real network request to GitHub
      const res = await app.request('/api/skills/vercel-labs/agent-skills/vercel-react-best-practices/content');

      // May be 200 or 404 depending on network/rate limits
      if (res.status === 200) {
        const body = await res.json();
        expect(body.source).toBe('vercel-labs/agent-skills');
        expect(body.metadata).toBeDefined();
        expect(body.instructions).toBeDefined();
      } else {
        // Accept 404 if skill path changed or rate limited
        expect(res.status).toBe(404);
      }
    }, 10000); // 10 second timeout for network request
  });

  describe('404 handling', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await app.request('/unknown-route');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Not Found');
    });
  });

  describe('Admin Routes', () => {
    describe('GET /api/admin/status', () => {
      it('returns scheduler and data status', async () => {
        const res = await app.request('/api/admin/status');
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.scheduler).toBeDefined();
        expect(typeof body.scheduler.running).toBe('boolean');
        expect(typeof body.scheduler.refreshing).toBe('boolean');
        expect(body.data).toBeDefined();
        expect(body.data.lastUpdated).toBeDefined();
      });
    });

    describe('POST /api/admin/scheduler/start', () => {
      it('starts the scheduler', async () => {
        const res = await app.request('/api/admin/scheduler/start', { method: 'POST' });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.message).toMatch(/scheduler/i);
      });
    });

    describe('POST /api/admin/scheduler/stop', () => {
      it('stops the scheduler', async () => {
        const res = await app.request('/api/admin/scheduler/stop', { method: 'POST' });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.message).toMatch(/scheduler/i);
      });
    });
  });

  describe('Admin Routes Disabled', () => {
    const appNoAdmin = createSkillsApiServer({ logging: false, enableAdmin: false });

    it('returns 404 for admin routes when disabled', async () => {
      const res = await appNoAdmin.request('/api/admin/status');
      expect(res.status).toBe(404);
    });
  });
});
