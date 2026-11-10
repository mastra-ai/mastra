import { describe, expect, it } from 'vitest';

import type { StoredPhaseInfo } from '../../../../api/types';
import { movePhase } from '../boardDraft';

const phases: StoredPhaseInfo[] = ['intake', 'triage', 'planning', 'done'].map(key => ({
  key,
  name: key,
  kind: 'working',
}));
const keys = (list: StoredPhaseInfo[]) => list.map(phase => phase.key);

describe('movePhase', () => {
  it('moves a phase to a new position', () => {
    expect(keys(movePhase(phases, 3, 1))).toEqual(['intake', 'done', 'triage', 'planning']);
    expect(keys(movePhase(phases, 1, 2))).toEqual(['intake', 'planning', 'triage', 'done']);
  });

  it('keeps the first phase first', () => {
    expect(keys(movePhase(phases, 0, 2))).toEqual(keys(phases));
    expect(keys(movePhase(phases, 2, 0))).toEqual(['intake', 'planning', 'triage', 'done']);
  });

  it('stops at the last position', () => {
    expect(keys(movePhase(phases, 1, 9))).toEqual(['intake', 'planning', 'done', 'triage']);
  });
});
