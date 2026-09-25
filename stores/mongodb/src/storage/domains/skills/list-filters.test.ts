import { describe, expect, it, vi } from 'vitest';

import { MongoDBSkillsStorage } from './index';

type SkillRow = { id: string; status: 'draft' | 'published'; authorId: string; visibility: 'public' };

const rows: SkillRow[] = [
  { id: 'draft-skill', status: 'draft', authorId: 'owner', visibility: 'public' },
  { id: 'published-skill', status: 'published', authorId: 'owner', visibility: 'public' },
];

function matches(row: SkillRow, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    const actual = row[key as keyof SkillRow];
    if (value && typeof value === 'object' && '$in' in value) {
      return (value.$in as string[]).includes(actual);
    }
    return actual === value;
  });
}

describe('MongoDB skills list filters', () => {
  it('applies status and entityIds before count and pagination', async () => {
    const countDocuments = vi.fn(async (filter: Record<string, unknown>) => rows.filter(row => matches(row, filter)).length);
    const find = vi.fn((filter: Record<string, unknown>) => {
      let selected = rows.filter(row => matches(row, filter));
      const cursor = {
        sort: () => cursor,
        skip: (offset: number) => {
          selected = selected.slice(offset);
          return cursor;
        },
        limit: (limit: number) => {
          selected = selected.slice(0, limit);
          return cursor;
        },
        toArray: async () => selected,
      };
      return cursor;
    });
    const skills = new MongoDBSkillsStorage({
      connectorHandler: {
        getCollection: async () => ({ countDocuments, find }) as any,
        close: async () => {},
      },
    });

    const published = await skills.list({ status: 'published' });
    expect(published.skills.map(skill => skill.id)).toEqual(['published-skill']);
    expect(published.total).toBe(1);
    expect(countDocuments).toHaveBeenLastCalledWith({ status: 'published' });

    const scoped = await skills.list({ entityIds: ['published-skill'], status: 'published', perPage: 1 });
    expect(scoped.skills.map(skill => skill.id)).toEqual(['published-skill']);
    expect(scoped.total).toBe(1);
    expect(scoped.hasMore).toBe(false);
    expect(find).toHaveBeenLastCalledWith({ status: 'published', id: { $in: ['published-skill'] } });

    const other = await skills.list({ entityIds: ['draft-skill'], status: 'published' });
    expect(other).toMatchObject({ skills: [], total: 0, hasMore: false });

    const empty = await skills.list({ entityIds: [] });
    expect(empty).toMatchObject({ skills: [], total: 0, hasMore: false });
    expect(countDocuments).toHaveBeenCalledTimes(3);
  });
});
