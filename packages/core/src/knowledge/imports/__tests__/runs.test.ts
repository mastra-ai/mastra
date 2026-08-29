import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../../storage';
import { Knowledge } from '../../index';

const scopeIds = ['org:acme', 'resource:mastra'];

function createKnowledge() {
  return new Knowledge({
    storage: new InMemoryStore({ id: 'import-state' }),
    importers: [
      {
        id: 'calendar',
        access: { 'resource:$resourceId': 'edit' },
        handler: async () => {},
      },
    ],
  });
}

describe('Knowledge importer state and runs', () => {
  it('scopes importer state to registered importers', async () => {
    const knowledge = createKnowledge();

    await expect(
      knowledge.setImportState({ importerId: 'unknown', binding: 'resource:one', key: 'cursor', value: 'x' }),
    ).rejects.toThrow('Knowledge importer unknown is not registered');
    await knowledge.setImportState({ importerId: 'calendar', binding: 'resource:one', key: 'cursor', value: 'one' });

    expect(await knowledge.getImportState({ importerId: 'calendar', binding: 'resource:one', key: 'cursor' })).toEqual(
      expect.objectContaining({ value: 'one' }),
    );
  });

  it('enforces registered trigger authority and hides unregistered run rows', async () => {
    const knowledge = createKnowledge();

    await expect(
      knowledge.createImportRun({
        importerId: 'calendar',
        binding: 'resource:one',
        importKind: 'static',
        triggerKind: 'webhook',
      }),
    ).rejects.toThrow('does not have a webhook trigger');

    const storage = await knowledge.getStorage();
    await expect(
      storage.createImportRun({
        importerId: 'calendar',
        binding: 'resource:one',
        importKind: 'static',
        triggerKind: 'programmatic',
        status: 'skipped',
      }),
    ).rejects.toThrow('Only cron-triggered Knowledge import runs can be created as skipped');
    await storage.createImportRun({
      id: 'z-hidden',
      importerId: 'other',
      binding: 'resource:one',
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    const visible = await knowledge.createImportRun({
      id: 'a-visible',
      importerId: 'calendar',
      binding: 'resource:one',
      importKind: 'static',
      triggerKind: 'programmatic',
    });

    expect(await knowledge.listImportRuns({ limit: 1 })).toEqual({ runs: [visible], nextCursor: undefined });
    await expect(
      knowledge.createNode({ name: 'Orphaned activity', kind: 'event', scopeIds, importRunId: 'missing-run' }),
    ).rejects.toThrow('Knowledge import run missing-run does not exist');
  });

  it('merges registered importer pages by queued time', async () => {
    const knowledge = createKnowledge();
    knowledge.registerImporter({
      id: 'issues',
      access: { 'resource:$resourceId': 'edit' },
      handler: async () => {},
    });
    const oldRun = await knowledge.createImportRun({
      id: 'z-old',
      importerId: 'calendar',
      binding: 'resource:one',
      importKind: 'static',
      triggerKind: 'programmatic',
      queuedAt: new Date('2026-08-28T12:00:00.000Z'),
    });
    const newRun = await knowledge.createImportRun({
      id: 'a-new',
      importerId: 'issues',
      binding: 'resource:one',
      importKind: 'static',
      triggerKind: 'programmatic',
      queuedAt: new Date('2026-08-28T13:00:00.000Z'),
    });

    const first = await knowledge.listImportRuns({ limit: 1 });
    expect(first).toEqual({ runs: [newRun], nextCursor: newRun.id });
    await expect(knowledge.listImportRuns({ limit: 1, after: first.nextCursor })).resolves.toEqual({
      runs: [oldRun],
      nextCursor: undefined,
    });
  });

  it('sanitizes terminal failures and preserves trace references', async () => {
    const knowledge = createKnowledge();
    const run = await knowledge.createImportRun({
      importerId: 'calendar',
      binding: 'resource:one',
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    await knowledge.updateImportRun({ id: run.id, status: 'running' });
    const failed = await knowledge.updateImportRun({
      id: run.id,
      status: 'failed',
      error: new Error(`secret\n${'x'.repeat(2_000)}`),
      transcriptThreadId: 'thread-1',
      traceId: 'trace-1',
    });

    expect(failed.error).toHaveLength(1_000);
    expect(failed.error).not.toContain('\n');
    expect(failed).toMatchObject({ status: 'failed', transcriptThreadId: 'thread-1', traceId: 'trace-1' });
  });
});
