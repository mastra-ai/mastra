import type { ObservationArchiveEntry } from '@mastra/core/storage';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { canRenderObservationArchiveCatalog, renderObservationArchiveCatalog } from '../archive-catalog';
import { ObservationalMemory } from '../observational-memory';

function createArchive(index: number, summary = `summary-${index}`): ObservationArchiveEntry {
  const archivedAt = new Date(Date.UTC(2026, 0, 31 - index));
  return {
    archiveId: `archive-${index}`,
    recordId: `record-${index}`,
    scope: 'thread',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    archivedAt,
    generationCount: 50 - index,
    observationTokenCount: 10,
    groups: [
      {
        groupId: `group-${index}`,
        summary,
        searchText: summary.toLowerCase(),
        messageRange: `message-${index}-a:message-${index}-b`,
        observedAt: { from: archivedAt, to: archivedAt },
        tokenCount: 10,
        textStart: 0,
        textEnd: summary.length,
      },
    ],
  };
}

function createArchiveOM(storage: InMemoryMemory, maxCatalogTokens: number): ObservationalMemory {
  return new ObservationalMemory({
    storage,
    scope: 'thread',
    model: 'openai/gpt-4o',
    observation: {
      archive: {
        afterTokens: 40_000,
        keepTokens: 8_000,
        maxCatalogTokens,
      },
    },
  });
}

describe('archived observation catalog rendering', () => {
  const countCharacters = (text: string) => text.length;

  it('never exceeds the configured hard ceiling at the exact boundary', () => {
    const archive = createArchive(0);
    const unconstrained = renderObservationArchiveCatalog({
      archives: [archive],
      hasMore: false,
      maxTokens: 10_000,
      countTokens: countCharacters,
    });
    expect(unconstrained.text).toBeDefined();

    const exact = renderObservationArchiveCatalog({
      archives: [archive],
      hasMore: false,
      maxTokens: unconstrained.text!.length,
      countTokens: countCharacters,
    });
    expect(exact.text).toBe(unconstrained.text);
    expect(exact.text!.length).toBe(unconstrained.text!.length);
  });

  it('truncates a single oversized label and preserves the hidden archive boundary', () => {
    const archives = [createArchive(0, 'x'.repeat(1_000)), createArchive(1)];
    const rendered = renderObservationArchiveCatalog({
      archives,
      hasMore: true,
      maxTokens: 700,
      countTokens: countCharacters,
    });

    expect(rendered.budgetFull).toBe(true);
    expect(rendered.text!.length).toBeLessThanOrEqual(700);
    expect(rendered.text).toContain('archive-id="archive-0"');
    expect(rendered.text).toContain('…</archived-observation>');
    expect(rendered.text).toContain('from-archive="archive-1"');
    expect(rendered.text).toContain('from-generation="49"');
  });

  it('omits the catalog when the wrapper and shortest hidden marker cannot fit', () => {
    const minimum = '<archived-observations>\n<hidden-archive-range />\n</archived-observations>'.length;
    expect(canRenderObservationArchiveCatalog(minimum - 1, countCharacters)).toBe(false);
    expect(
      renderObservationArchiveCatalog({
        archives: [createArchive(0)],
        hasMore: true,
        maxTokens: minimum - 1,
        countTokens: countCharacters,
      }),
    ).toEqual({ budgetFull: true });
  });
});

describe('archived observation catalog loading', () => {
  it('uses only 20 + 20 + 10 storage rows and keeps the catalog separate from live observations', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createArchiveOM(storage, 100_000);
    const record = await om.getOrCreateRecord('thread-1', 'resource-1');
    const pages = [
      { archives: Array.from({ length: 20 }, (_, index) => createArchive(index)), nextCursor: 'page-2' },
      { archives: Array.from({ length: 20 }, (_, index) => createArchive(index + 20)), nextCursor: 'page-3' },
      { archives: Array.from({ length: 10 }, (_, index) => createArchive(index + 40)), nextCursor: 'page-4' },
    ];
    const listSpy = vi.spyOn(storage, 'listObservationArchives');
    for (const page of pages) listSpy.mockResolvedValueOnce(page);

    const parts = await om.buildContextSystemMessages({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      record: { ...record, activeObservations: 'live observation' },
      currentDate: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(listSpy).toHaveBeenCalledTimes(3);
    expect(listSpy.mock.calls.map(([input]) => ({ limit: input.limit, cursor: input.cursor }))).toEqual([
      { limit: 20, cursor: undefined },
      { limit: 20, cursor: 'page-2' },
      { limit: 10, cursor: 'page-3' },
    ]);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'thread', threadId: 'thread-1', resourceId: 'resource-1' }),
    );

    const catalog = parts!.find(part => part.startsWith('<archived-observations>'));
    expect(catalog).toContain('archive-id="archive-0"');
    expect(catalog).toContain('archive-id="archive-49"');
    expect(catalog).toContain('after-archive="archive-49"');
    expect(parts).toContain('<observations>');
    expect(parts).toContain('live observation');
  });

  it('projects resource-owned archives through the current thread when retrieval is narrowed', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = new ObservationalMemory({
      storage,
      scope: 'resource',
      retrieval: { scope: 'thread' },
      model: 'openai/gpt-4o',
      observation: {
        archive: { afterTokens: 40_000, keepTokens: 8_000, maxCatalogTokens: 2_000 },
      },
    });
    const record = await om.getOrCreateRecord('thread-1', 'resource-1');
    const listSpy = vi.spyOn(storage, 'listObservationArchives').mockResolvedValue({ archives: [createArchive(0)] });

    await om.buildContextSystemMessages({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      record: { ...record, activeObservations: 'live observation' },
    });

    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'thread', threadId: 'thread-1', resourceId: 'resource-1' }),
    );
  });

  it('omits the catalog when storage has no archived generations', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createArchiveOM(storage, 2_000);
    const record = await om.getOrCreateRecord('thread-1', 'resource-1');
    const listSpy = vi.spyOn(storage, 'listObservationArchives').mockResolvedValue({ archives: [] });

    const parts = await om.buildContextSystemMessages({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      record: { ...record, activeObservations: 'live observation' },
    });

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(parts!.some(part => part.startsWith('<archived-observations>'))).toBe(false);
  });

  it('stops fetching once the catalog token budget is full', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createArchiveOM(storage, 200);
    const record = await om.getOrCreateRecord('thread-1', 'resource-1');
    const listSpy = vi.spyOn(storage, 'listObservationArchives').mockResolvedValue({
      archives: Array.from({ length: 20 }, (_, index) => createArchive(index, 'x'.repeat(240))),
      nextCursor: 'page-2',
    });

    const parts = await om.buildContextSystemMessages({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      record: { ...record, activeObservations: 'live observation' },
    });

    expect(listSpy).toHaveBeenCalledTimes(1);
    const catalog = parts!.find(part => part.startsWith('<archived-observations>'));
    expect(catalog).toBeDefined();
    expect(om.getTokenCounter().countObservations(catalog!)).toBeLessThanOrEqual(200);
  });

  it('does not load archives when even the minimum catalog cannot fit', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createArchiveOM(storage, 1);
    const record = await om.getOrCreateRecord('thread-1', 'resource-1');
    const listSpy = vi.spyOn(storage, 'listObservationArchives');

    const parts = await om.buildContextSystemMessages({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      record: { ...record, activeObservations: 'live observation' },
    });

    expect(listSpy).not.toHaveBeenCalled();
    expect(parts!.some(part => part.startsWith('<archived-observations>'))).toBe(false);
  });
});
