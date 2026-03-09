import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { MastraCompositeStore } from './base';
import { FilesystemStore } from './filesystem';
import { FilesystemDB } from './filesystem-db';
import { InMemoryStore } from './mock';

// =============================================================================
// FilesystemDB Tests
// =============================================================================

describe('FilesystemDB', () => {
  let dir: string;
  let db: FilesystemDB;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-fs-test-'));
    db = new FilesystemDB(dir);
    await db.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('creates the directory', async () => {
      const newDir = join(dir, 'nested', 'subdir');
      const newDb = new FilesystemDB(newDir);
      await newDb.init();
      // Should not throw — directory was created
      await newDb.set('test.json', 'key1', { value: 1 });
      const result = await newDb.get<{ value: number }>('test.json', 'key1');
      expect(result).toEqual({ value: 1 });
    });
  });

  describe('get/set/remove', () => {
    it('returns null for missing keys', async () => {
      const result = await db.get('test.json', 'missing');
      expect(result).toBeNull();
    });

    it('stores and retrieves a value', async () => {
      await db.set('test.json', 'key1', { name: 'hello', count: 42 });
      const result = await db.get<{ name: string; count: number }>('test.json', 'key1');
      expect(result).toEqual({ name: 'hello', count: 42 });
    });

    it('updates an existing value', async () => {
      await db.set('test.json', 'key1', { name: 'v1' });
      await db.set('test.json', 'key1', { name: 'v2' });
      const result = await db.get<{ name: string }>('test.json', 'key1');
      expect(result).toEqual({ name: 'v2' });
    });

    it('removes a value', async () => {
      await db.set('test.json', 'key1', { name: 'hello' });
      await db.remove('test.json', 'key1');
      const result = await db.get('test.json', 'key1');
      expect(result).toBeNull();
    });

    it('getAll returns all values', async () => {
      await db.set('test.json', 'a', { id: 'a' });
      await db.set('test.json', 'b', { id: 'b' });
      const all = await db.getAll<{ id: string }>('test.json');
      expect(all).toHaveLength(2);
      expect(all.map(v => v.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('date serialization', () => {
    it('preserves Date objects through JSON roundtrip', async () => {
      const now = new Date();
      await db.set('test.json', 'key1', { createdAt: now });

      // Invalidate cache to force re-read from disk
      db.invalidateCache('test.json');

      const result = await db.get<{ createdAt: Date }>('test.json', 'key1');
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.createdAt.getTime()).toBe(now.getTime());
    });
  });

  describe('clearDomain', () => {
    it('clears all data in a domain', async () => {
      await db.set('test.json', 'a', { id: 'a' });
      await db.set('test.json', 'b', { id: 'b' });
      await db.clearDomain('test.json');
      const all = await db.getAll('test.json');
      expect(all).toHaveLength(0);
    });
  });

  describe('readDomain with empty/missing file', () => {
    it('returns empty object for non-existent file', async () => {
      const data = await db.readDomain('nonexistent.json');
      expect(data).toEqual({});
    });
  });
});

// =============================================================================
// FilesystemStore Integration Tests
// =============================================================================

describe('FilesystemStore', () => {
  let dir: string;
  let store: FilesystemStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-fsstore-test-'));
    store = new FilesystemStore({ dir });
    await store.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('agents', () => {
    it('creates and retrieves an agent', async () => {
      const agents = await store.getStore('agents');
      expect(agents).toBeDefined();

      const created = await agents!.create({
        agent: {
          id: 'agent-1',
          name: 'Test Agent',
          authorId: 'user-1',
          instructions: 'Be helpful',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      expect(created.id).toBe('agent-1');
      expect(created.status).toBe('draft');
      expect(created.authorId).toBe('user-1');

      // Resolve with version
      const resolved = await agents!.getByIdResolved('agent-1');
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe('Test Agent');
      expect(resolved!.instructions).toBe('Be helpful');
    });

    it('updates an agent', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: {
          id: 'agent-1',
          name: 'Test Agent',
          instructions: 'Be helpful',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      const updated = await agents!.update({
        id: 'agent-1',
        status: 'published',
        metadata: { tag: 'test' },
      });

      expect(updated.status).toBe('published');
      expect(updated.metadata).toEqual({ tag: 'test' });
    });

    it('lists agents', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent 1', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });
      await agents!.create({
        agent: { id: 'a2', name: 'Agent 2', instructions: 'y', model: { provider: 'openai', name: 'gpt-4' } },
      });

      const list = await agents!.list();
      expect(list.agents).toHaveLength(2);
      expect(list.total).toBe(2);
    });

    it('deletes an agent and its versions', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent 1', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      await agents!.delete('a1');
      const result = await agents!.getById('a1');
      expect(result).toBeNull();

      const versions = await agents!.countVersions('a1');
      expect(versions).toBe(0);
    });
  });

  describe('version management', () => {
    it('creates initial version on entity creation', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent 1', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      const count = await agents!.countVersions('a1');
      expect(count).toBe(1);

      const latest = await agents!.getLatestVersion('a1');
      expect(latest).toBeDefined();
      expect(latest!.versionNumber).toBe(1);
      expect(latest!.agentId).toBe('a1');
    });

    it('can create additional versions', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent 1', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      const v2Id = crypto.randomUUID();
      await agents!.createVersion({
        id: v2Id,
        agentId: 'a1',
        versionNumber: 2,
        name: 'Agent 1 Updated',
        instructions: 'y',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['instructions'],
        changeMessage: 'Updated instructions',
      });

      const count = await agents!.countVersions('a1');
      expect(count).toBe(2);

      const latest = await agents!.getLatestVersion('a1');
      expect(latest!.versionNumber).toBe(2);
    });

    it('getVersionByNumber returns correct version', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent 1', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      const v1 = await agents!.getVersionByNumber('a1', 1);
      expect(v1).toBeDefined();
      expect(v1!.versionNumber).toBe(1);
    });

    it('listVersions paginates correctly', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent 1', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      // Add more versions
      for (let i = 2; i <= 5; i++) {
        await agents!.createVersion({
          id: crypto.randomUUID(),
          agentId: 'a1',
          versionNumber: i,
          name: `Agent v${i}`,
          instructions: `version ${i}`,
          model: { provider: 'openai', name: 'gpt-4' },
          changedFields: ['instructions'],
        });
      }

      const page1 = await agents!.listVersions({ agentId: 'a1', page: 0, perPage: 2 });
      expect(page1.versions).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);
    });
  });

  describe('prompt blocks', () => {
    it('creates and resolves a prompt block', async () => {
      const promptBlocks = await store.getStore('promptBlocks');
      expect(promptBlocks).toBeDefined();

      await promptBlocks!.create({
        promptBlock: {
          id: 'pb-1',
          name: 'Greeting',
          content: 'Hello {{name}}',
        },
      });

      const resolved = await promptBlocks!.getByIdResolved('pb-1');
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe('Greeting');
      expect(resolved!.content).toBe('Hello {{name}}');
    });
  });

  describe('skills with version-on-update', () => {
    it('creates new version when config fields are updated', async () => {
      const skills = await store.getStore('skills');
      expect(skills).toBeDefined();

      await skills!.create({
        skill: {
          id: 'skill-1',
          name: 'My Skill',
          description: 'A test skill',
          instructions: 'Do the thing',
        },
      });

      // Update config fields — should create a new version
      await skills!.update({
        id: 'skill-1',
        description: 'Updated description',
      });

      const count = await skills!.countVersions('skill-1');
      expect(count).toBe(2);

      const latest = await skills!.getLatestVersion('skill-1');
      expect(latest!.versionNumber).toBe(2);
    });

    it('does not create version for metadata-only updates', async () => {
      const skills = await store.getStore('skills');
      await skills!.create({
        skill: {
          id: 'skill-1',
          name: 'My Skill',
          description: 'A test skill',
          instructions: 'Do the thing',
        },
      });

      // Only update status — should NOT create a new version
      await skills!.update({
        id: 'skill-1',
        status: 'published',
      });

      const count = await skills!.countVersions('skill-1');
      expect(count).toBe(1);
    });

    it('auto-publishes when activeVersionId is set', async () => {
      const skills = await store.getStore('skills');
      await skills!.create({
        skill: {
          id: 'skill-1',
          name: 'My Skill',
          description: 'A test skill',
          instructions: 'Do the thing',
        },
      });

      const v1 = await skills!.getLatestVersion('skill-1');
      const updated = await skills!.update({
        id: 'skill-1',
        activeVersionId: v1!.id,
      });

      expect(updated.status).toBe('published');
    });
  });

  describe('on-disk format', () => {
    it('only writes published configs to disk', async () => {
      const agents = await store.getStore('agents');

      // Create a draft agent — nothing should be on disk
      await agents!.create({
        agent: { id: 'a1', name: 'Draft Agent', instructions: 'draft', model: { provider: 'openai', name: 'gpt-4' } },
      });

      const { existsSync } = await import('node:fs');
      const agentsFileExists = existsSync(join(dir, 'agents.json'));
      if (agentsFileExists) {
        const rawDraft = JSON.parse(readFileSync(join(dir, 'agents.json'), 'utf-8'));
        expect(rawDraft).toEqual({});
      }
      // Either the file doesn't exist (no writes for drafts) or it's empty — both are correct

      // Publish the agent — now it should be on disk
      const v1 = await agents!.getLatestVersion('a1');
      await agents!.update({
        id: 'a1',
        activeVersionId: v1!.id,
        status: 'published',
      });

      const rawPublished = JSON.parse(readFileSync(join(dir, 'agents.json'), 'utf-8'));
      expect(rawPublished['a1']).toBeDefined();
      expect(rawPublished['a1'].name).toBe('Draft Agent');
      expect(rawPublished['a1'].instructions).toBe('draft');
      expect(rawPublished['a1'].model).toEqual({ provider: 'openai', name: 'gpt-4' });
    });

    it('disk format has no version metadata', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Clean Agent', instructions: 'hi', model: { provider: 'openai', name: 'gpt-4' } },
      });

      // Publish
      const v1 = await agents!.getLatestVersion('a1');
      await agents!.update({
        id: 'a1',
        activeVersionId: v1!.id,
        status: 'published',
      });

      const raw = JSON.parse(readFileSync(join(dir, 'agents.json'), 'utf-8'));
      const agentOnDisk = raw['a1'];

      // Should NOT have version metadata
      expect(agentOnDisk.id).toBeUndefined();
      expect(agentOnDisk.agentId).toBeUndefined();
      expect(agentOnDisk.versionNumber).toBeUndefined();
      expect(agentOnDisk.changedFields).toBeUndefined();
      expect(agentOnDisk.changeMessage).toBeUndefined();
      expect(agentOnDisk.createdAt).toBeUndefined();

      // Should have snapshot config
      expect(agentOnDisk.name).toBe('Clean Agent');
      expect(agentOnDisk.instructions).toBe('hi');
    });

    it('only persists used agent fields, strips unused fields like workflows', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: {
          id: 'a1',
          name: 'Filtered Agent',
          instructions: 'hello',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: { myTool: { id: 'myTool' } },
          workflows: { wf1: { id: 'wf1' } },
          agents: { sub1: { id: 'sub1' } },
          memory: { default: { lastMessages: 10 } },
          scorers: { s1: { id: 's1' } },
          skills: { sk1: { id: 'sk1' } },
          workspace: { default: { id: 'ws1' } },
          mcpClients: { mc1: { selectedTools: ['t1'] } },
          requestContextSchema: { type: 'object' },
        } as any,
      });

      const v1 = await agents!.getLatestVersion('a1');
      await agents!.update({ id: 'a1', activeVersionId: v1!.id, status: 'published' });

      const raw = JSON.parse(readFileSync(join(dir, 'agents.json'), 'utf-8'));
      const agentOnDisk = raw['a1'];

      // Should have persisted fields
      expect(agentOnDisk.name).toBe('Filtered Agent');
      expect(agentOnDisk.instructions).toBe('hello');
      expect(agentOnDisk.model).toEqual({ provider: 'openai', name: 'gpt-4' });
      expect(agentOnDisk.tools).toEqual({ myTool: { id: 'myTool' } });
      expect(agentOnDisk.mcpClients).toEqual({ mc1: { selectedTools: ['t1'] } });
      expect(agentOnDisk.requestContextSchema).toEqual({ type: 'object' });

      // Should NOT have unused fields
      expect(agentOnDisk.workflows).toBeUndefined();
      expect(agentOnDisk.agents).toBeUndefined();
      expect(agentOnDisk.memory).toBeUndefined();
      expect(agentOnDisk.scorers).toBeUndefined();
      expect(agentOnDisk.skills).toBeUndefined();
      expect(agentOnDisk.workspace).toBeUndefined();
    });

    it('no separate versions file on disk', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      const { existsSync } = await import('node:fs');
      expect(existsSync(join(dir, 'agent-versions.json'))).toBe(false);
    });

    it('delete removes entity from disk', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      // Publish first so it appears on disk
      const v1 = await agents!.getLatestVersion('a1');
      await agents!.update({ id: 'a1', activeVersionId: v1!.id, status: 'published' });

      let raw = JSON.parse(readFileSync(join(dir, 'agents.json'), 'utf-8'));
      expect(raw['a1']).toBeDefined();

      // Delete
      await agents!.delete('a1');

      raw = JSON.parse(readFileSync(join(dir, 'agents.json'), 'utf-8'));
      expect(raw['a1']).toBeUndefined();
    });
  });

  describe('data persistence across instances', () => {
    it('published data persists when a new store instance is created', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: {
          id: 'a1',
          name: 'Persistent Agent',
          instructions: 'persist me',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      // Publish so it gets written to disk
      const v1 = await agents!.getLatestVersion('a1');
      await agents!.update({ id: 'a1', activeVersionId: v1!.id, status: 'published' });

      // Create a new store instance pointing at the same directory
      const store2 = new FilesystemStore({ dir });
      await store2.init();
      const agents2 = await store2.getStore('agents');

      const resolved = await agents2!.getByIdResolved('a1');
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe('Persistent Agent');
      expect(resolved!.instructions).toBe('persist me');
    });

    it('draft data does NOT persist across instances', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Draft Agent', instructions: 'draft', model: { provider: 'openai', name: 'gpt-4' } },
      });

      // Don't publish — just create a new store instance
      const store2 = new FilesystemStore({ dir });
      await store2.init();
      const agents2 = await store2.getStore('agents');

      const result = await agents2!.getById('a1');
      expect(result).toBeNull();
    });
  });

  describe('dangerouslyClearAll', () => {
    it('clears all data for a domain', async () => {
      const agents = await store.getStore('agents');
      await agents!.create({
        agent: { id: 'a1', name: 'Agent 1', instructions: 'x', model: { provider: 'openai', name: 'gpt-4' } },
      });

      await agents!.dangerouslyClearAll();

      const list = await agents!.list();
      expect(list.agents).toHaveLength(0);
      expect(list.total).toBe(0);
    });
  });
});

// =============================================================================
// MastraCompositeStore `editor` shorthand tests
// =============================================================================

describe('MastraCompositeStore editor shorthand', () => {
  let dir: string;
  let fsStore: FilesystemStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-editor-shorthand-'));
    fsStore = new FilesystemStore({ dir });
    await fsStore.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('routes editor domains to the editor store', async () => {
    const defaultStore = new InMemoryStore();
    const composite = new MastraCompositeStore({
      id: 'test-composite',
      default: defaultStore,
      editor: fsStore,
    });
    await composite.init();

    // Editor domain should come from the filesystem store
    const agents = await composite.getStore('agents');
    expect(agents).toBeDefined();

    await agents!.create({
      agent: {
        id: 'a1',
        name: 'Test',
        instructions: 'hi',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });

    const resolved = await agents!.getByIdResolved('a1');
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe('Test');

    // Non-editor domain should come from the default store
    const memory = await composite.getStore('memory');
    expect(memory).toBeDefined();
  });

  it('domain overrides take precedence over editor', async () => {
    const defaultStore = new InMemoryStore();
    const inMemoryAgents = await defaultStore.getStore('agents');

    const composite = new MastraCompositeStore({
      id: 'test-composite-override',
      default: defaultStore,
      editor: fsStore,
      domains: {
        agents: inMemoryAgents!,
      },
    });
    await composite.init();

    // agents is overridden by domains, so it should come from defaultStore (InMemory)
    const agents = await composite.getStore('agents');
    expect(agents).toBeDefined();

    await agents!.create({
      agent: {
        id: 'a1',
        name: 'Override Test',
        instructions: 'hi',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });

    // The filesystem store should NOT have this agent
    const fsAgents = await fsStore.getStore('agents');
    const fsResult = await fsAgents!.getById('a1');
    expect(fsResult).toBeNull();
  });
});
