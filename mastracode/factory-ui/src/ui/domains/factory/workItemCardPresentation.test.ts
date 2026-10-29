import { describe, expect, it } from 'vitest';
import type { CardMove } from './cardPrimaryAction';
import type { WorkItemSessionRef } from './services/workItems';
import { primaryCardMove } from './workItemCardPresentation';

const investigate: CardMove = { label: 'Investigate', role: 'triage', stage: 'triage' };
const build: CardMove = { label: 'Build', role: 'work', stage: 'execute' };
const moves = [investigate, build];

function sessionRef(role: string): WorkItemSessionRef {
  return { sessionId: `session-${role}`, branch: 'factory/issue-1', threadId: `thread-${role}`, startedBy: 'user-1' };
}

function history(...stages: string[]) {
  return stages.map(stage => ({ stage }));
}

describe('primaryCardMove', () => {
  it("leads with the move of the lane the card's column is", () => {
    expect(primaryCardMove(moves, 'execute', { sessions: {} })).toBe(build);
  });

  it('skips a lane the card already had a run in', () => {
    expect(
      primaryCardMove(moves, 'intake', {
        sessions: { triage: sessionRef('triage') },
        stageHistory: history('intake', 'triage', 'intake'),
      }),
    ).toBe(build);
  });

  it('still offers Build to a card that was only planned, though Planning left a work session', () => {
    expect(
      primaryCardMove([build], 'intake', {
        sessions: { work: sessionRef('work') },
        stageHistory: history('intake', 'planning', 'intake'),
      }),
    ).toBe(build);
    expect(
      primaryCardMove([investigate, build], 'intake', {
        sessions: { triage: sessionRef('triage'), work: sessionRef('work') },
        stageHistory: history('intake', 'triage', 'planning', 'intake'),
      }),
    ).toBe(build);
  });

  it('falls back to the first move once every lane has had a run', () => {
    expect(
      primaryCardMove(moves, 'intake', {
        sessions: { triage: sessionRef('triage'), work: sessionRef('work') },
        stageHistory: history('intake', 'triage', 'execute', 'intake'),
      }),
    ).toBe(investigate);
  });
});
