import { describe, expect, it } from 'vitest';

import { workBoard } from '../../../../e2e/ui/board-catalog';
import { reasonSummary, reworkReason } from './reworkReason';
import type { AuditEvent } from './services/audit';
import type { WorkItem } from './services/workItems';

type Card = Pick<WorkItem, 'id' | 'stages' | 'stageHistory' | 'metadata'>;

const FINDINGS = '## Findings\n- The retry loop never backs off.\n- Missing test for the empty page.';

function card(stage: string, overrides: Partial<Card> = {}): Card {
  return { id: 'card-1', stages: [stage], stageHistory: [], metadata: {}, ...overrides };
}

function moved(
  from: string,
  to: string,
  actorType: AuditEvent['actorType'],
  cause: string,
  occurredAt = '2026-11-06T10:00:00.000Z',
  itemId = 'card-1',
): AuditEvent {
  return {
    id: `${from}-${to}-${occurredAt}`,
    actorId: actorType === 'human' ? 'user-1' : actorType === 'agent' ? 'agent:work' : 'factory',
    actorType,
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: itemId }],
    metadata: { from, to, cause, revision: 3 },
    occurredAt,
  };
}

const phases = workBoard.phases;

describe('reworkReason', () => {
  it('gives the self-review findings when self-review sent the card from Review back to Building', () => {
    const item = card('execute', { metadata: { selfReviewVerdict: 'request changes', selfReviewFindings: FINDINGS } });

    expect(
      reworkReason(item, phases, [
        moved('review', 'execute', 'agent', 'Self-review requested changes on abc (round 1).'),
      ]),
    ).toEqual({ fromPhase: 'review', fromLabel: 'Review', reason: FINDINGS, movedBy: 'agent' });
  });

  it("does not give a person's later move back the findings an earlier self-review left on the card", () => {
    const item = card('execute', { metadata: { selfReviewVerdict: 'request changes', selfReviewFindings: FINDINGS } });

    expect(reworkReason(item, phases, [moved('review', 'execute', 'human', 'board_drag')])).toEqual({
      fromPhase: 'review',
      fromLabel: 'Review',
      movedBy: 'human',
    });
  });

  it("gives an agent's rationale when it sends the card from Building back to Planning", () => {
    const rationale = 'The plan misses the migration; replanning.';

    expect(reworkReason(card('planning'), phases, [moved('execute', 'planning', 'agent', rationale)])).toEqual({
      fromPhase: 'execute',
      fromLabel: 'Building',
      reason: rationale,
      movedBy: 'agent',
    });
  });

  it('gives no reason text when a person drags the card back', () => {
    expect(reworkReason(card('planning'), phases, [moved('execute', 'planning', 'human', 'board_drag')])).toEqual({
      fromPhase: 'execute',
      fromLabel: 'Building',
      movedBy: 'human',
    });
  });

  it('gives nothing for a forward move', () => {
    expect(reworkReason(card('execute'), phases, [moved('planning', 'execute', 'agent', 'Plan approved.')])).toBe(
      undefined,
    );
  });

  it("gives nothing when the latest move no longer matches the card's stage", () => {
    const events = [
      moved('execute', 'planning', 'agent', 'Replanning.', '2026-11-06T09:00:00.000Z'),
      moved('planning', 'execute', 'human', 'board_drag', '2026-11-06T08:00:00.000Z'),
    ];

    expect(reworkReason(card('execute'), phases, events)).toBe(undefined);
  });

  it("falls back to the stage history when the card's latest move went unrecorded", () => {
    const item = card('execute', {
      stageHistory: [
        {
          stage: 'execute',
          enteredAt: '2026-11-06T08:00:00.000Z',
          exitedAt: '2026-11-06T09:00:00.000Z',
          by: 'agent:work',
        },
        {
          stage: 'review',
          enteredAt: '2026-11-06T09:00:00.000Z',
          exitedAt: '2026-11-06T10:00:00.000Z',
          by: 'agent:work',
        },
        { stage: 'execute', enteredAt: '2026-11-06T10:00:00.000Z', by: 'user-1' },
      ],
    });

    expect(
      reworkReason(item, phases, [moved('execute', 'review', 'agent', 'Built.', '2026-11-06T09:00:00.000Z')]),
    ).toEqual({ fromPhase: 'review', fromLabel: 'Review', movedBy: 'human' });
  });

  it("gives no reason text when a session agent moves the card back through Factory's tools", () => {
    const event = { ...moved('review', 'execute', 'agent', 'factory_tools'), actorId: 'agent:session:session-1' };

    expect(reworkReason(card('execute'), phases, [event])).toEqual({
      fromPhase: 'review',
      fromLabel: 'Review',
      movedBy: 'agent',
    });
  });

  it('uses the latest move by time and ignores other cards', () => {
    const events = [
      moved('planning', 'execute', 'agent', 'Plan approved.', '2026-11-06T08:00:00.000Z'),
      moved('review', 'execute', 'agent', 'Tests fail on CI.', '2026-11-06T09:00:00.000Z'),
      moved('execute', 'planning', 'agent', 'Other card.', '2026-11-06T10:00:00.000Z', 'card-2'),
    ];

    expect(reworkReason(card('execute'), phases, events)?.reason).toBe('Tests fail on CI.');
  });

  it('falls back to the stage history when no move is in the recent events, still showing findings', () => {
    const item = card('execute', {
      metadata: { selfReviewVerdict: 'request changes', selfReviewFindings: FINDINGS },
      stageHistory: [
        {
          stage: 'execute',
          enteredAt: '2026-11-06T07:00:00.000Z',
          exitedAt: '2026-11-06T08:00:00.000Z',
          by: 'agent:work',
        },
        {
          stage: 'review',
          enteredAt: '2026-11-06T08:00:00.000Z',
          exitedAt: '2026-11-06T09:00:00.000Z',
          by: 'agent:work',
        },
        { stage: 'execute', enteredAt: '2026-11-06T09:00:00.000Z', by: 'agent:review' },
      ],
    });

    expect(reworkReason(item, phases, [])).toEqual({
      fromPhase: 'review',
      fromLabel: 'Review',
      reason: FINDINGS,
      movedBy: 'agent',
    });
  });

  it('gives an agent rationale when it sends a pull request card from PR review back to Intake', () => {
    expect(
      reworkReason(card('intake'), phases, [moved('pr-review', 'intake', 'agent', 'Needs a person to rebase.')]),
    ).toEqual({
      fromPhase: 'pr-review',
      fromLabel: 'PR review',
      reason: 'Needs a person to rebase.',
      movedBy: 'agent',
    });
  });

  it('ignores moves out of a terminal phase', () => {
    expect(reworkReason(card('intake'), phases, [moved('canceled', 'intake', 'human', 'board_drag')])).toBe(undefined);
  });

  it('summarises a reason as its first line that is not a heading, without Markdown markers', () => {
    expect(reasonSummary(FINDINGS)).toBe('The retry loop never backs off.');
    expect(reasonSummary('## Findings')).toBe('Findings');
    expect(reasonSummary('\n- The retry loop never backs off.')).toBe('The retry loop never backs off.');
  });
});
