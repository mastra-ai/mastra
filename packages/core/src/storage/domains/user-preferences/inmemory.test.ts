import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryUserPreferencesStorage } from './inmemory';

describe('InMemoryUserPreferencesStorage', () => {
  let db: InMemoryDB;
  let storage: InMemoryUserPreferencesStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryUserPreferencesStorage({ db });
  });

  it('returns null when no preferences exist for a user', async () => {
    expect(await storage.get('user-missing')).toBeNull();
  });

  it('creates a new record on first update', async () => {
    const result = await storage.update('user-1', {
      agentStudio: { starredAgents: ['agent-1'], previewMode: true },
    });

    expect(result.userId).toBe('user-1');
    expect(result.agentStudio.starredAgents).toEqual(['agent-1']);
    expect(result.agentStudio.previewMode).toBe(true);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('merges subsequent updates onto the existing agentStudio record', async () => {
    await storage.update('user-1', {
      agentStudio: { starredAgents: ['agent-1'], appearance: 'light' },
    });
    const updated = await storage.update('user-1', {
      agentStudio: { starredSkills: ['skill-1'], appearance: 'dark' },
    });

    expect(updated.agentStudio).toEqual({
      starredAgents: ['agent-1'],
      starredSkills: ['skill-1'],
      appearance: 'dark',
    });
  });

  it('delete removes the record', async () => {
    await storage.update('user-1', { agentStudio: { starredAgents: ['a'] } });
    await storage.delete('user-1');
    expect(await storage.get('user-1')).toBeNull();
  });

  it('get returns a structural clone so callers cannot mutate the store', async () => {
    await storage.update('user-1', { agentStudio: { starredAgents: ['a'] } });
    const first = await storage.get('user-1');
    first!.agentStudio.starredAgents!.push('b');
    const second = await storage.get('user-1');
    expect(second!.agentStudio.starredAgents).toEqual(['a']);
  });
});
