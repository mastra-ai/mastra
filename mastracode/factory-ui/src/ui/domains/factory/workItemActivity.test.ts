import { describe, expect, it } from 'vitest';

import type { AuditEventPage } from './services/audit';
import type { WorkItem } from './services/workItems';
import { workItemActivity } from './workItemActivity';

const item: WorkItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'user-creator',
  githubProjectId: 'factory-1',
  source: 'manual',
  sourceKey: null,
  parentWorkItemId: null,
  title: 'Ship activity cards',
  url: null,
  stages: ['review'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  revision: 1,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
};

function event({
  id,
  actorId,
  actorType,
  targetId = item.id,
  occurredAt,
}: {
  id: string;
  actorId: string;
  actorType: 'human' | 'agent';
  targetId?: string;
  occurredAt: string;
}) {
  return {
    id,
    orgId: 'org-1',
    actorId,
    actorType,
    action: 'factory.work_item.updated',
    targets: [{ type: 'work_item', id: targetId }],
    metadata: {},
    githubProjectId: 'factory-1',
    context: {},
    occurredAt,
  };
}

describe('workItemActivity', () => {
  it('uses the latest human event while retaining agent events in the timeline', () => {
    const page: AuditEventPage = {
      events: [
        event({
          id: 'agent-event',
          actorId: 'agent:thread-1',
          actorType: 'agent',
          occurredAt: '2026-08-05T10:00:00.000Z',
        }),
        event({
          id: 'human-event',
          actorId: 'user-ada',
          actorType: 'human',
          occurredAt: '2026-08-05T09:00:00.000Z',
        }),
        event({
          id: 'other-item-event',
          actorId: 'user-grace',
          actorType: 'human',
          targetId: 'item-2',
          occurredAt: '2026-08-05T11:00:00.000Z',
        }),
      ],
      actors: {
        'user-ada': { id: 'user-ada', name: 'Ada Lovelace', avatarUrl: 'https://avatars.example/ada.png' },
        'user-grace': { id: 'user-grace', name: 'Grace Hopper' },
      },
    };

    const activity = workItemActivity(item, page);

    expect(activity.lastWorker).toEqual(page.actors['user-ada']);
    expect(activity.events.map(candidate => candidate.id)).toEqual(['agent-event', 'human-event']);
  });

  it('falls back to the latest human stage actor when no audit event is available', () => {
    const activity = workItemActivity(
      {
        ...item,
        stageHistory: [
          { stage: 'triage', enteredAt: '2026-08-02T09:00:00.000Z', by: 'user-ada' },
          { stage: 'review', enteredAt: '2026-08-03T09:00:00.000Z', by: 'factory-rule-dispatcher' },
        ],
      },
      undefined,
    );

    expect(activity.lastWorker).toEqual({ id: 'user-ada', name: 'user-ada' });
  });
});
