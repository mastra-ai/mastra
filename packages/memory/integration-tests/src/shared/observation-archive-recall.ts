import { randomUUID } from 'node:crypto';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { expect } from 'vitest';

type RestartableMemoryFactory = () => Promise<{ memory: Memory; close: () => Promise<void> }>;

export async function verifyObservationArchiveRecallAfterRestart(
  createMemory: RestartableMemoryFactory,
): Promise<void> {
  const threadId = randomUUID();
  const resourceId = randomUUID();
  const firstMessageId = randomUUID();
  const lastMessageId = randomUUID();
  const observations = 'The release owner is Maya and the staging region is cobalt.';
  const summary = 'Maya owns the cobalt staging release.';
  const observedAt = {
    from: new Date('2026-01-01T00:00:00.000Z'),
    to: new Date('2026-01-02T00:00:00.000Z'),
  };
  const messages: MastraDBMessage[] = [
    {
      id: firstMessageId,
      threadId,
      resourceId,
      role: 'user',
      createdAt: observedAt.from,
      content: { format: 2, parts: [{ type: 'text', text: 'Maya owns the release.' }] },
    },
    {
      id: lastMessageId,
      threadId,
      resourceId,
      role: 'assistant',
      createdAt: observedAt.to,
      content: { format: 2, parts: [{ type: 'text', text: 'The staging region is cobalt.' }] },
    },
  ];

  const first = await createMemory();
  try {
    await first.memory.createThread({ threadId, resourceId, title: 'Archive restart' });
    await first.memory.saveMessages({ messages });
    const store = await first.memory.storage.getStore('memory');
    const record = await store!.initializeObservationalMemory({
      threadId,
      resourceId,
      scope: 'thread',
      config: {},
    });
    await store!.updateActiveObservations({
      id: record.id,
      expectedWriteEpoch: 0,
      observations,
      observationGroups: [
        {
          groupId: 'restart-group',
          summary,
          searchText: `${summary} ${observations}`.normalize('NFKC').toLowerCase(),
          messageRange: `${firstMessageId}:${lastMessageId}`,
          observedAt,
          tokenCount: 12,
        },
      ],
      tokenCount: 12,
      lastObservedAt: observedAt.to,
      observedMessageIds: [firstMessageId, lastMessageId],
    });
  } finally {
    await first.close();
  }

  const restarted = await createMemory();
  try {
    const store = await restarted.memory.storage.getStore('memory');
    const record = await store!.getObservationalMemory(threadId, resourceId);
    expect(record?.observationGroups?.[0]?.summary).toBe(summary);

    await store!.createObservationArchiveGeneration({
      currentRecordId: record!.id,
      expectedGenerationCount: record!.generationCount,
      expectedWriteEpoch: record!.writeEpoch ?? 0,
      archiveId: 'restart-archive',
      archivedAt: new Date('2026-01-03T00:00:00.000Z'),
      contentDigest: 'restart-archive-digest',
      retiredObservations: observations,
      retiredObservationTokenCount: 12,
      retiredGroups: record!.observationGroups!.map(group => ({
        ...group,
        textStart: 0,
        textEnd: observations.length,
      })),
      retainedObservations: '',
      retainedObservationTokenCount: 0,
      retainedGroups: [],
    });

    const recall = restarted.memory.listTools().recall!;
    const context = { memory: restarted.memory, agent: { threadId, resourceId } } as any;
    const archived = (await recall.execute?.(
      { mode: 'observations', archiveId: 'restart-archive', groupId: 'restart-group' } as any,
      context,
    )) as any;
    expect(archived.observations).toBe(observations);
    expect(archived.archives[0].groups[0].summary).toBe(summary);
    expect(archived.source).toMatchObject({
      messageCursorStart: firstMessageId,
      messageCursorEnd: lastMessageId,
      sourceUnavailable: false,
    });

    const firstRaw = (await recall.execute?.(
      { mode: 'messages', cursor: archived.source.messageCursorStart, partIndex: 0, detail: 'high' } as any,
      context,
    )) as any;
    const lastRaw = (await recall.execute?.(
      { mode: 'messages', cursor: archived.source.messageCursorEnd, partIndex: 0, detail: 'high' } as any,
      context,
    )) as any;
    expect(firstRaw.text).toContain('Maya owns the release.');
    expect(lastRaw.text).toContain('The staging region is cobalt.');
  } finally {
    await restarted.close();
  }
}
