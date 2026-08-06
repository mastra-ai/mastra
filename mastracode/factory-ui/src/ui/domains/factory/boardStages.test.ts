import { describe, expect, it } from 'vitest';

import { currentItemStageLabel } from './boardStages';
import type { WorkItem, WorkItemSource } from './services/workItems';

function workItem(source: WorkItemSource, stages: string[]): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'project-1',
    source,
    sourceKey: null,
    parentWorkItemId: null,
    title: 'Add universal command search',
    url: null,
    stages,
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('currentItemStageLabel', () => {
  it('reads the furthest column the item sits in', () => {
    expect(currentItemStageLabel(workItem('manual', ['triage', 'execute']))).toBe('Building');
  });

  it('ignores stages absent from the item board, which the board itself does not draw', () => {
    expect(currentItemStageLabel(workItem('manual', ['execute', 'obsolete']))).toBe('Building');
    expect(currentItemStageLabel(workItem('github-pr', ['execute', 'review']))).toBe('Reviewing');
  });

  it('falls back to Intake when no stage belongs to the item board', () => {
    expect(currentItemStageLabel(workItem('manual', []))).toBe('Intake');
    expect(currentItemStageLabel(workItem('github-pr', ['execute']))).toBe('Intake');
  });
});
