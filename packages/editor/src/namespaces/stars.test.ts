import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraEditor } from '../index';

const mockLogger = () =>
  ({
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
    trackException: vi.fn(),
  }) as any;

const setup = async () => {
  const storage = new InMemoryStore();
  const editor = new MastraEditor({ logger: mockLogger() });
  const mastra = new Mastra({ storage, editor });
  await storage.init();

  const agentsStore = await storage.getStore('agents');
  if (!agentsStore) throw new Error('agents store missing');
  await agentsStore.create({
    agent: {
      id: 'agent-1',
      name: 'Agent 1',
      instructions: 'I help.',
      model: { provider: 'openai', name: 'gpt-4' },
    },
  });
  await agentsStore.create({
    agent: {
      id: 'agent-2',
      name: 'Agent 2',
      instructions: 'I also help.',
      model: { provider: 'openai', name: 'gpt-4' },
    },
  });

  return { storage, editor, mastra };
};

describe('EditorStarsNamespace', () => {
  it('star() persists row, increments starCount, and is idempotent', async () => {
    const { editor, storage } = await setup();

    const first = await editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });
    expect(first).toEqual({ starred: true, starCount: 1 });

    const second = await editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });
    expect(second).toEqual({ starred: true, starCount: 1 });

    const agentsStore = await storage.getStore('agents');
    const agent = await agentsStore?.getById('agent-1');
    expect(agent?.starCount).toBe(1);
  });

  it('unstar() removes the row, decrements starCount, and is idempotent', async () => {
    const { editor } = await setup();

    await editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });
    const after = await editor.stars.unstar({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });
    expect(after).toEqual({ starred: false, starCount: 0 });

    const again = await editor.stars.unstar({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });
    expect(again).toEqual({ starred: false, starCount: 0 });
  });

  it('isStarred() reports per-user state', async () => {
    const { editor } = await setup();

    await editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });

    expect(await editor.stars.isStarred({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' })).toBe(true);
    expect(await editor.stars.isStarred({ userId: 'u2', entityType: 'agent', entityId: 'agent-1' })).toBe(false);
    expect(await editor.stars.isStarred({ userId: 'u1', entityType: 'agent', entityId: 'agent-2' })).toBe(false);
  });

  it('isStarredBatch() returns the subset of candidate IDs starred by the caller', async () => {
    const { editor } = await setup();

    await editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });

    const result = await editor.stars.isStarredBatch({
      userId: 'u1',
      entityType: 'agent',
      entityIds: ['agent-1', 'agent-2', 'agent-missing'],
    });
    expect(result).toBeInstanceOf(Set);
    expect(Array.from(result).sort()).toEqual(['agent-1']);

    const empty = await editor.stars.isStarredBatch({
      userId: 'u1',
      entityType: 'agent',
      entityIds: [],
    });
    expect(empty.size).toBe(0);

    const otherUser = await editor.stars.isStarredBatch({
      userId: 'u2',
      entityType: 'agent',
      entityIds: ['agent-1', 'agent-2'],
    });
    expect(otherUser.size).toBe(0);
  });

  it('listStarredIds() returns only the caller’s starred IDs of the given type', async () => {
    const { editor } = await setup();

    await editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' });
    await editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-2' });
    await editor.stars.star({ userId: 'u2', entityType: 'agent', entityId: 'agent-1' });

    const u1 = await editor.stars.listStarredIds({ userId: 'u1', entityType: 'agent' });
    expect(u1.sort()).toEqual(['agent-1', 'agent-2']);

    const u2 = await editor.stars.listStarredIds({ userId: 'u2', entityType: 'agent' });
    expect(u2).toEqual(['agent-1']);

    const u3 = await editor.stars.listStarredIds({ userId: 'u3', entityType: 'agent' });
    expect(u3).toEqual([]);
  });

  it('throws if the storage domain is not configured', async () => {
    const editor = new MastraEditor({ logger: mockLogger() });
    // No mastra registered → no storage available.
    await expect(editor.stars.star({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' })).rejects.toThrow();
  });
});
