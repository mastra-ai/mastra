import { describe, it, expect } from 'vitest';
import { fetchJson, fetchApi } from '../utils.js';

const WS = 'test-workspace';

describe('workspace skills', () => {
  describe('GET /skills', () => {
    it('should list discovered skills', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/skills`);

      expect(status).toBe(200);
      expect(data.isSkillsConfigured).toBe(true);
      expect(data.skills).toBeInstanceOf(Array);
      expect(data.skills.length).toBe(1);

      expect(data.skills[0]).toEqual({
        name: 'test-skill',
        description: 'A test skill for smoke tests',
        path: 'skills/test-skill',
      });
    });
  });

  describe('GET /skills/:skillName', () => {
    it('should return skill details with instructions and references', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/skills/test-skill`);

      expect(status).toBe(200);
      expect(data.name).toBe('test-skill');
      expect(data.description).toBe('A test skill for smoke tests');
      expect(data.path).toBe('skills/test-skill');
      expect(data.instructions).toBe(
        '# Test Skill\n\nThis skill is used for smoke testing the workspace skills API.',
      );
      expect(data.source).toEqual({ type: 'local', projectPath: 'skills' });
      expect(data.references).toEqual(['example.md']);
      expect(data.scripts).toEqual([]);
      expect(data.assets).toEqual([]);
    });

    it('should return 404 for non-existent skill', async () => {
      const res = await fetchApi(`/api/workspaces/${WS}/skills/does-not-exist`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /skills/:skillName/references', () => {
    it('should list skill reference files', async () => {
      const { status, data } = await fetchJson<any>(`/api/workspaces/${WS}/skills/test-skill/references`);

      expect(status).toBe(200);
      expect(data.skillName).toBe('test-skill');
      expect(data.references).toEqual(['example.md']);
    });
  });

  describe('GET /skills/:skillName/references/:referencePath', () => {
    it('should return reference file content', async () => {
      const { status, data } = await fetchJson<any>(
        `/api/workspaces/${WS}/skills/test-skill/references/${encodeURIComponent('example.md')}`,
      );

      expect(status).toBe(200);
      expect(data.skillName).toBe('test-skill');
      expect(data.referencePath).toBe('example.md');
      expect(data.content).toBe('# Example Reference\n\nSome reference content.');
    });

    it('should return 404 for non-existent reference', async () => {
      const res = await fetchApi(
        `/api/workspaces/${WS}/skills/test-skill/references/${encodeURIComponent('missing.md')}`,
      );
      expect(res.status).toBe(404);
    });
  });
});
