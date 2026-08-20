import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import type { Mastra } from '../../mastra';
import type { MastraStorage } from '../../storage';
import type { MastraScorer } from '../base';
import { scoreThread, scoreThreads } from './scoreThreads';

function message(role: 'user' | 'assistant' | 'system', text: string, createdAt: Date): MastraDBMessage {
  return {
    id: `msg-${role}-${createdAt.getTime()}`,
    role,
    content: { format: 2, parts: [{ type: 'text', text }], content: text },
    createdAt,
  } as MastraDBMessage;
}

function scorerResult(overrides: Record<string, unknown> = {}) {
  return { runId: 'run-1', score: 0.9, input: {}, output: {}, ...overrides };
}

describe('scoreThread', () => {
  let memoryStore: { getThreadById: ReturnType<typeof vi.fn>; listMessages: ReturnType<typeof vi.fn> };
  let scoresStore: { saveScore: ReturnType<typeof vi.fn> };
  let storage: MastraStorage;
  let scorerRun: ReturnType<typeof vi.fn>;
  let scorer: MastraScorer;

  beforeEach(() => {
    memoryStore = { getThreadById: vi.fn(), listMessages: vi.fn() };
    scoresStore = {
      saveScore: vi.fn().mockImplementation(async payload => ({
        score: {
          ...payload,
          id: `score-${payload.threadId}-${Math.random()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })),
    };
    storage = {
      getStore: vi.fn().mockImplementation((domain: string) => {
        if (domain === 'memory') return Promise.resolve(memoryStore);
        if (domain === 'scores') return Promise.resolve(scoresStore);
        return Promise.resolve(undefined);
      }),
    } as unknown as MastraStorage;

    scorerRun = vi.fn().mockResolvedValue(scorerResult());
    scorer = {
      id: 'thread-scorer',
      name: 'thread-scorer',
      description: 'test',
      run: scorerRun,
    } as unknown as MastraScorer;
  });

  it('materializes the full thread and persists a THREAD-scoped score with threadId', async () => {
    memoryStore.getThreadById.mockResolvedValue({ id: 'th-1', resourceId: 'user-1' });
    memoryStore.listMessages.mockResolvedValue({
      messages: [
        message('user', 'hi', new Date('2026-01-01T00:00:00Z')),
        message('assistant', 'hello', new Date('2026-01-01T00:00:01Z')),
        message('user', 'follow up', new Date('2026-01-01T00:00:02Z')),
        message('assistant', 'answer', new Date('2026-01-01T00:00:03Z')),
      ],
    });

    const score = await scoreThread({ storage, scorer, target: { threadId: 'th-1' } });

    // Scorer invoked exactly once per thread with the whole conversation
    expect(scorerRun).toHaveBeenCalledTimes(1);
    const runArg = scorerRun.mock.calls[0]![0];
    expect(runArg.targetScope).toBe('thread');
    expect(runArg.input.inputMessages).toHaveLength(2);
    expect(runArg.output).toHaveLength(2);

    // Persisted with thread linkage
    const savedPayload = scoresStore.saveScore.mock.calls[0]![0];
    expect(savedPayload.threadId).toBe('th-1');
    expect(savedPayload.entityType).toBe('THREAD');
    expect(savedPayload.entityId).toBe('th-1');
    expect(savedPayload.resourceId).toBe('user-1');
    expect(savedPayload.scorerId).toBe('thread-scorer');
    expect(score.threadId).toBe('th-1');
  });

  it('fetches all messages without pagination limit, oldest first', async () => {
    memoryStore.getThreadById.mockResolvedValue({ id: 'th-1', resourceId: 'user-1' });
    memoryStore.listMessages.mockResolvedValue({ messages: [message('user', 'hi', new Date())] });

    await scoreThread({ storage, scorer, target: { threadId: 'th-1' } });

    expect(memoryStore.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'th-1', perPage: false, orderBy: { field: 'createdAt', direction: 'ASC' } }),
    );
  });

  it('throws for a missing thread', async () => {
    memoryStore.getThreadById.mockResolvedValue(null);
    await expect(scoreThread({ storage, scorer, target: { threadId: 'nope' } })).rejects.toThrow(/Thread not found/);
    expect(scorerRun).not.toHaveBeenCalled();
  });

  it('throws for an empty thread', async () => {
    memoryStore.getThreadById.mockResolvedValue({ id: 'th-empty', resourceId: 'user-1' });
    memoryStore.listMessages.mockResolvedValue({ messages: [] });
    await expect(scoreThread({ storage, scorer, target: { threadId: 'th-empty' } })).rejects.toThrow(/no messages/);
    expect(scorerRun).not.toHaveBeenCalled();
  });

  it('re-scoring the same thread creates a new score record (no overwrite)', async () => {
    memoryStore.getThreadById.mockResolvedValue({ id: 'th-1', resourceId: 'user-1' });
    memoryStore.listMessages.mockResolvedValue({ messages: [message('user', 'hi', new Date())] });

    const first = await scoreThread({ storage, scorer, target: { threadId: 'th-1' } });
    const second = await scoreThread({ storage, scorer, target: { threadId: 'th-1' } });

    expect(scoresStore.saveScore).toHaveBeenCalledTimes(2);
    // No caller-supplied id: each save creates a distinct record
    expect(scoresStore.saveScore.mock.calls[0]![0].id).toBeUndefined();
    expect(first.id).not.toBe(second.id);
  });

  it('scoreThreads batch captures per-thread failures without aborting', async () => {
    memoryStore.getThreadById.mockImplementation(async ({ threadId }: { threadId: string }) =>
      threadId === 'missing' ? null : { id: threadId, resourceId: 'user-1' },
    );
    memoryStore.listMessages.mockResolvedValue({ messages: [message('user', 'hi', new Date())] });

    const mastra = {
      getLogger: () => ({ trackException: vi.fn() }),
      getStorage: () => storage,
      getScorerById: () => scorer,
    } as unknown as Mastra;

    const result = await scoreThreads({
      scorerId: 'thread-scorer',
      targets: [{ threadId: 'th-1' }, { threadId: 'missing' }, { threadId: 'th-2' }],
      mastra,
    });

    expect(result.scoredCount).toBe(2);
    expect(result.failedCount).toBe(1);
    const failed = result.results.find(r => !r.ok);
    expect(failed?.threadId).toBe('missing');
  });
});
