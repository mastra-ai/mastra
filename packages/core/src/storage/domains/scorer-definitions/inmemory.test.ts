import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryScorerDefinitionsStorage } from './inmemory';

describe('InMemoryScorerDefinitionsStorage tenancy', () => {
  let db: InMemoryDB;
  let storage: InMemoryScorerDefinitionsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryScorerDefinitionsStorage({ db });
  });

  const baseSnapshot = {
    name: 'Tenant Scorer',
    type: 'llm-judge' as const,
    model: { provider: 'openai', name: 'gpt-4' },
    instructions: 'Evaluate accuracy',
  };

  it('persists organizationId/projectId on create', async () => {
    const created = await storage.create({
      scorerDefinition: {
        id: 'tenant-1',
        organizationId: 'org-a',
        projectId: 'proj-1',
        ...baseSnapshot,
      },
    });

    expect(created.organizationId).toBe('org-a');
    expect(created.projectId).toBe('proj-1');

    const fetched = await storage.getById('tenant-1');
    expect(fetched?.organizationId).toBe('org-a');
    expect(fetched?.projectId).toBe('proj-1');
  });

  it('keeps tenancy on the record, not the version snapshot', async () => {
    await storage.create({
      scorerDefinition: {
        id: 'tenant-1',
        organizationId: 'org-a',
        projectId: 'proj-1',
        ...baseSnapshot,
      },
    });

    const version = await storage.getLatestVersion('tenant-1');
    expect(version).not.toBeNull();
    expect((version as unknown as Record<string, unknown>).organizationId).toBeUndefined();
    expect((version as unknown as Record<string, unknown>).projectId).toBeUndefined();
  });

  describe('list filtering', () => {
    beforeEach(async () => {
      await storage.create({
        scorerDefinition: { id: 'a1', organizationId: 'org-a', projectId: 'proj-1', ...baseSnapshot },
      });
      await storage.create({
        scorerDefinition: { id: 'a2', organizationId: 'org-a', projectId: 'proj-2', ...baseSnapshot },
      });
      await storage.create({
        scorerDefinition: { id: 'b1', organizationId: 'org-b', projectId: 'proj-1', ...baseSnapshot },
      });
    });

    it('filters by organizationId', async () => {
      const result = await storage.list({ status: 'draft', organizationId: 'org-a' });
      expect(result.total).toBe(2);
      expect(result.scorerDefinitions.every(s => s.organizationId === 'org-a')).toBe(true);
    });

    it('filters by projectId', async () => {
      const result = await storage.list({ status: 'draft', projectId: 'proj-1' });
      expect(result.total).toBe(2);
      expect(result.scorerDefinitions.every(s => s.projectId === 'proj-1')).toBe(true);
    });

    it('filters by organizationId AND projectId together', async () => {
      const result = await storage.list({ status: 'draft', organizationId: 'org-a', projectId: 'proj-1' });
      expect(result.total).toBe(1);
      expect(result.scorerDefinitions[0]?.id).toBe('a1');
    });

    it('returns empty when tenancy does not match', async () => {
      const result = await storage.list({ status: 'draft', organizationId: 'org-c' });
      expect(result.total).toBe(0);
      expect(result.scorerDefinitions).toHaveLength(0);
    });

    it('propagates tenancy filters through listResolved', async () => {
      const result = await storage.listResolved({ status: 'draft', organizationId: 'org-a', projectId: 'proj-2' });
      expect(result.total).toBe(1);
      expect(result.scorerDefinitions[0]?.id).toBe('a2');
      expect(result.scorerDefinitions[0]?.organizationId).toBe('org-a');
    });
  });
});
