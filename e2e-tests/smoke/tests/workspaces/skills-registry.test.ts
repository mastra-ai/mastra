import { describe, expect, it } from 'vitest';
import { fetchApi } from '../utils.js';

// skills.sh hits an external network service. These tests are tolerant of
// transient outages — they assert the route does not 500 and returns the
// expected envelope shape when the upstream is reachable.

describe('workspace skills.sh registry', () => {
  it('GET /workspaces/test-workspace/skills-sh/search returns results envelope', async () => {
    const res = await fetchApi('/api/workspaces/test-workspace/skills-sh/search?q=lint&limit=3');
    expect([200, 502, 503, 504]).toContain(res.status);
    if (res.status === 200) {
      const data: any = await res.json();
      expect(Array.isArray(data.skills)).toBe(true);
      expect(typeof data.count).toBe('number');
    }
  }, 30_000);

  it('GET /workspaces/test-workspace/skills-sh/popular returns an array', async () => {
    const res = await fetchApi('/api/workspaces/test-workspace/skills-sh/popular?limit=3');
    expect([200, 502, 503, 504]).toContain(res.status);
    if (res.status === 200) {
      const data: any = await res.json();
      // Shape varies — accept either an array or an object with `skills`.
      const skills = Array.isArray(data) ? data : data.skills;
      expect(Array.isArray(skills)).toBe(true);
    }
  }, 30_000);

  it('GET /workspaces/test-workspace/skills-sh/preview returns metadata for a known skill', async () => {
    const res = await fetchApi(
      '/api/workspaces/test-workspace/skills-sh/preview?owner=vercel-labs&repo=skills&path=find-skills',
    );
    expect([200, 400, 404, 502, 503, 504]).toContain(res.status);
    if (res.status === 200) {
      const data: any = await res.json();
      expect(typeof data.content).toBe('string');
      expect(data.content.length).toBeGreaterThan(0);
    }
  }, 30_000);
});
