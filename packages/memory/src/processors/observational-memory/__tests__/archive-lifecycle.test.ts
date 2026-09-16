import type { ObservationGroupMetadata, ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { planObservationArchive } from '../archive-lifecycle';
import { wrapInObservationGroup } from '../observation-groups';

function createRecord(
  activeObservations: string,
  observationGroups?: ObservationGroupMetadata[],
): ObservationalMemoryRecord {
  const now = new Date('2026-01-02T03:04:05.000Z');
  return {
    id: 'record-1',
    scope: 'thread',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    recordState: 'active',
    writeEpoch: 0,
    createdAt: now,
    updatedAt: now,
    lastObservedAt: now,
    originType: 'initial',
    generationCount: 0,
    activeObservations,
    observationGroups,
    totalTokensObserved: 500,
    observationTokenCount: 500,
    pendingMessageTokens: 17,
    isReflecting: false,
    isObserving: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: {},
  };
}

const countTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));
const config = { afterTokens: 100, keepTokens: 20, maxCatalogTokens: 50 };

function metadata(groupId: string, messageRange: string): ObservationGroupMetadata {
  return {
    groupId,
    summary: `Summary for ${groupId}`,
    searchText: `summary for ${groupId}`,
    messageRange,
    kind: 'observation',
    tokenCount: 10,
  };
}

describe('observation archive lifecycle planning', () => {
  it('retires an exact prefix of complete groups and preserves interstitial legacy bytes', () => {
    const first = wrapInObservationGroup('Old fact α', 'm1:m2', 'group-old');
    const second = wrapInObservationGroup('Recent fact 😀', 'm3:m4', 'group-new');
    const observations = `legacy-prefix\n${first}\n\n--- custom boundary ---\n\n${second}\nlegacy-suffix`;
    const record = createRecord(observations, [metadata('group-old', 'm1:m2'), metadata('group-new', 'm3:m4')]);

    const plan = planObservationArchive(record, config, countTokens, new Date('2026-02-01T00:00:00.000Z'));

    expect(plan.status).toBe('ready');
    if (plan.status !== 'ready') return;
    expect(plan.input.retiredObservations + plan.input.retainedObservations).toBe(observations);
    expect(plan.input.retiredObservations).toContain('legacy-prefix');
    expect(plan.input.retiredObservations).toContain('Old fact α');
    expect(plan.input.retainedObservations).toContain('Recent fact 😀');
    expect(plan.input.retiredGroups.map(group => group.kind)).toContain('legacy');
    for (const group of plan.input.retiredGroups) {
      expect(plan.input.retiredObservations.slice(group.textStart, group.textEnd)).not.toBe('');
    }

    const retry = planObservationArchive(record, config, countTokens, new Date('2026-03-01T00:00:00.000Z'));
    expect(retry.status).toBe('ready');
    if (retry.status === 'ready') {
      expect(retry.input.archiveId).toBe(plan.input.archiveId);
      expect(retry.input.contentDigest).toBe(plan.input.contentDigest);
      expect(retry.input.retiredGroups.map(group => group.groupId)).toEqual(
        plan.input.retiredGroups.map(group => group.groupId),
      );
    }

    const retainedLegacyId = plan.input.retainedGroups.find(group => group.kind === 'legacy')?.groupId;
    const third = wrapInObservationGroup('Newest fact '.repeat(20), 'm5:m6', 'group-third');
    const successor = {
      ...record,
      id: 'record-2',
      generationCount: 1,
      activeObservations: `${plan.input.retainedObservations}\n\n${third}`,
      observationGroups: [...plan.input.retainedGroups, metadata('group-third', 'm5:m6')],
    };
    const secondPlan = planObservationArchive(successor, config, countTokens);
    expect(secondPlan.status).toBe('ready');
    if (secondPlan.status === 'ready' && retainedLegacyId) {
      expect(secondPlan.input.retiredGroups.map(group => group.groupId)).toContain(retainedLegacyId);
    }
  });

  it('does not split a resource thread section', () => {
    const first = wrapInObservationGroup('Old thread fact', 'a:b', 'group-a');
    const second = wrapInObservationGroup('New thread fact', 'c:d', 'group-b');
    const observations = `<thread id="thread-a">\n${first}\n${second}\n</thread>`;
    const record = {
      ...createRecord(observations, [
        { ...metadata('group-a', 'a:b'), sourceThreadId: 'thread-a' },
        { ...metadata('group-b', 'c:d'), sourceThreadId: 'thread-a' },
      ]),
      scope: 'resource' as const,
      threadId: null,
    };

    const plan = planObservationArchive(record, { ...config, keepTokens: 1 }, countTokens);

    expect(plan.status).toBe('no-progress');
  });

  it('derives the same no-progress key for one oversized newest group without mutable state', () => {
    const observations = wrapInObservationGroup('x'.repeat(1_000), 'a:z', 'oversized');
    const record = createRecord(observations, [metadata('oversized', 'a:z')]);

    const first = planObservationArchive(record, config, countTokens);
    const second = planObservationArchive(record, config, countTokens);

    expect(first).toEqual(second);
    expect(first.status).toBe('no-progress');
  });
});
