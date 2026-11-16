import { describe, expect, it } from 'vitest';

import { awaitsAcceptance, defineBoard, workBoard } from '../boards/index.js';
import { triageWorkBoard } from '../boards/test-utils.js';
import { needsApproval } from './types.js';

describe('needsApproval', () => {
  const labeled = { workItem: { labels: ['bug', 'Status: Needs Approval'] } };
  const onWork = (stage: string) => awaitsAcceptance(workBoard, stage);

  it('holds a labeled card while it rests in Intake or Triage', () => {
    expect(needsApproval({ ...labeled, stages: ['intake'] }, onWork)).toBe(true);
    // Triage exists on the Work of projects stored before new projects' Work dropped it.
    expect(needsApproval({ ...labeled, stages: ['triage'] }, stage => awaitsAcceptance(triageWorkBoard, stage))).toBe(
      true,
    );
  });

  it('lets the card go once a person moved it on, even before the source drops the label', () => {
    expect(needsApproval({ ...labeled, stages: ['planning'] }, onWork)).toBe(false);
    expect(needsApproval({ ...labeled, stages: ['execute'] }, onWork)).toBe(false);
  });

  it("reads which phases still wait for acceptance from the card's own board, whatever they are called", () => {
    const ship = defineBoard({
      id: 'ship',
      name: 'Ship',
      initialPhase: 'inbox',
      phases: {
        inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['sort', 'make'] },
        sort: { name: 'Sort', kind: 'working', runner: { context: 'triage' }, nextPhases: ['inbox', 'make'] },
        make: { name: 'Make', kind: 'working', runner: { context: 'work' }, nextPhases: ['pr'] },
        pr: {
          name: 'PR',
          kind: 'working',
          runner: { context: 'review' },
          tools: ['factory_review_source', 'factory_record_review_verdict'],
          nextPhases: ['shipped'],
        },
        shipped: { name: 'Shipped', kind: 'terminal' },
      },
    });
    const onShip = (stage: string) => awaitsAcceptance(ship, stage);
    expect(needsApproval({ ...labeled, stages: ['inbox'] }, onShip)).toBe(true);
    expect(needsApproval({ ...labeled, stages: ['sort'] }, onShip)).toBe(true);
    expect(needsApproval({ ...labeled, stages: ['make'] }, onShip)).toBe(false);
    expect(needsApproval({ ...labeled, stages: ['pr'] }, onShip)).toBe(false);
    // Work's phase names mean nothing on another board.
    expect(needsApproval({ ...labeled, stages: ['intake'] }, onShip)).toBe(false);
  });

  it('holds nothing without the label', () => {
    expect(needsApproval({ workItem: { labels: ['bug'] }, stages: ['intake'] }, onWork)).toBe(false);
    expect(needsApproval({ workItem: { labels: [] }, stages: ['intake'] }, onWork)).toBe(false);
    const staleBoard = {
      workItem: { labels: [] },
      metadata: { labels: ['Status: Needs Approval'] },
      stages: ['intake'],
    };
    expect(needsApproval(staleBoard, onWork)).toBe(false);
  });

  it('ignores a legacy acceptance stamp: the label and the lane decide', () => {
    const legacy = { ...labeled, stages: ['intake'], acceptedAt: new Date() };
    expect(needsApproval(legacy, onWork)).toBe(true);
  });
});
