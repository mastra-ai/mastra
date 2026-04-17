import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FilesystemDB } from '../../filesystem-db';
import { FilesystemUserPreferencesStorage } from './filesystem';

describe('FilesystemUserPreferencesStorage', () => {
  let dir: string;
  let db: FilesystemDB;
  let storage: FilesystemUserPreferencesStorage;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'user-preferences-'));
    db = new FilesystemDB(dir);
    storage = new FilesystemUserPreferencesStorage({ db });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists preferences across new storage instances', async () => {
    await storage.update('user-1', { agentStudio: { starredAgents: ['a', 'b'] } });

    const other = new FilesystemUserPreferencesStorage({ db: new FilesystemDB(dir) });
    const result = await other.get('user-1');

    expect(result?.agentStudio.starredAgents).toEqual(['a', 'b']);
  });

  it('merges updates and preserves createdAt', async () => {
    const first = await storage.update('user-1', { agentStudio: { previewMode: true } });
    const second = await storage.update('user-1', { agentStudio: { appearance: 'dark' } });

    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(second.agentStudio.previewMode).toBe(true);
    expect(second.agentStudio.appearance).toBe('dark');
  });
});
