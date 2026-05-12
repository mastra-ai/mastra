import { describe, it, expect } from 'vitest';
import { fetchJson } from '../utils.js';

describe('workspace metadata', () => {
  describe('GET /workspaces', () => {
    it('should list all registered workspaces with capabilities', async () => {
      const { status, data } = await fetchJson<any>('/api/workspaces');

      expect(status).toBe(200);
      expect(data.workspaces).toBeInstanceOf(Array);
      expect(data.workspaces.length).toBeGreaterThan(0);

      const ws = data.workspaces.find((w: any) => w.id === 'test-workspace');
      expect(ws).toBeDefined();
      expect(ws.name).toBe('Test Workspace');
      expect(ws.source).toBe('mastra');
      expect(ws.capabilities).toEqual({
        hasFilesystem: true,
        hasSandbox: false,
        canBM25: false,
        canVector: false,
        canHybrid: false,
        hasSkills: true,
      });
      expect(ws.safety).toEqual({ readOnly: false });
    });
  });

  describe('GET /workspaces/:workspaceId', () => {
    it('should return workspace details with filesystem info', async () => {
      const { status, data } = await fetchJson<any>('/api/workspaces/test-workspace');

      expect(status).toBe(200);
      expect(data.isWorkspaceConfigured).toBe(true);
      expect(data.id).toBe('test-workspace');
      expect(data.name).toBe('Test Workspace');
      expect(data.status).toBe('ready');
      expect(data.capabilities).toEqual({
        hasFilesystem: true,
        hasSandbox: false,
        canBM25: false,
        canVector: false,
        canHybrid: false,
        hasSkills: true,
      });
      expect(data.safety).toEqual({ readOnly: false });
      expect(data.filesystem).toMatchObject({
        name: 'LocalFilesystem',
        provider: 'local',
        status: 'ready',
      });
    });

    it('should return isWorkspaceConfigured: false for non-existent workspace', async () => {
      const { status, data } = await fetchJson<any>('/api/workspaces/does-not-exist');

      expect(status).toBe(200);
      expect(data.isWorkspaceConfigured).toBe(false);
    });
  });
});
