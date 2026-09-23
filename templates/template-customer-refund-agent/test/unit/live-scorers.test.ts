import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveResponseOutputScorer, liveTriageOutputScorer } from '../../src/mastra/evals';
import { deterministicJsonModel } from '../fixtures/deterministic-language-model';
import { temporaryDatabasePath } from '../support/temp-path';

const databases: string[] = [];
const shutdowns: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.allSettled(shutdowns.splice(0).map(shutdown => shutdown()));
  vi.restoreAllMocks();
  vi.doUnmock('@mastra/core/llm');
  delete process.env.DISABLE_RUNTIME_SCORERS;
  await Promise.all(databases.splice(0).map(path => rm(path, { force: true })));
});

describe('live native scorer contracts', () => {
  it('extracts Mastra assistant-message output without ground truth', async () => {
    const output = [
      {
        role: 'assistant',
        content: JSON.stringify({
          intent: 'order_status',
          urgency: 'normal',
          sentiment: 'neutral',
          requiresHumanReview: false,
          confidence: 0.9,
          rationale: 'Synthetic output contract.',
        }),
      },
    ];
    await expect(liveTriageOutputScorer.run({ output })).resolves.toMatchObject({ score: 1 });
    await expect(liveResponseOutputScorer.run({ output })).resolves.toMatchObject({ score: 0 });
  });

  it('persists an automatic native score from the configured Mastra agent run', async () => {
    const path = temporaryDatabasePath('phase007-live-scorer');
    databases.push(path, `${path}-shm`, `${path}-wal`);
    process.env.DATABASE_URL = `file:${path}`;
    process.env.LOCAL_DEMO_DATABASE_URL = `file:${path}`;
    process.env.SUPPORT_SOURCE = 'mock';
    delete process.env.DISABLE_RUNTIME_SCORERS;
    vi.resetModules();
    vi.doMock('@mastra/core/llm', async importOriginal => {
      const actual = await importOriginal<typeof import('@mastra/core/llm')>();
      return {
        ...actual,
        ModelRouterEmbeddingModel: class DeterministicEmbeddingModel {},
      };
    });
    const { mastra, shutdownLocalMastra } = await import('../../src/mastra/index');
    shutdowns.push(shutdownLocalMastra);
    const triage = mastra.getAgent('triageAgent');
    triage.__updateModel({
      model: deterministicJsonModel({
        intent: 'order_status',
        urgency: 'normal',
        sentiment: 'neutral',
        requiresHumanReview: false,
        confidence: 0.9,
        rationale: 'The synthetic request asks about an order status.',
      }) as never,
    });
    const runId = 'phase007-native-live-scorer';
    const result = await triage.generate([{ role: 'user', content: 'where is my order?' }], {
      runId,
    });
    expect(result.runId).toBe(runId);
    const scoresStore = (await mastra.getStorage()!.getStore('scores')) as {
      listScoresByRunId(input: {
        runId: string;
        pagination: { page: number; perPage: false };
      }): Promise<{ scores: Array<Record<string, unknown>> }>;
    };
    await vi.waitFor(async () => {
      const stored = await scoresStore.listScoresByRunId({
        runId,
        pagination: { page: 0, perPage: false },
      });
      expect(stored.scores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            scorerId: 'live-triage-output-contract',
            entityId: 'triage-agent',
            runId,
            score: 1,
          }),
        ]),
      );
    });
  });
});
