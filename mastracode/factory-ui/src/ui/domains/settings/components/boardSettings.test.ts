import { describe, expect, it } from 'vitest';

import type { StoredBoardConfig } from '../../../../api/types';
import {
  describeCondition,
  INTAKE_FIELDS,
  listText,
  move,
  operatorsFor,
  parseList,
  parseValue,
  removePhase,
  renamePhase,
} from './boardSettings';

const phase = (key: string, nextPhases: string[] | null = null) => ({
  key,
  name: key,
  description: null,
  kind: key === 'done' ? ('terminal' as const) : ('resting' as const),
  runner: null,
  nextPhases,
  exitTool: null,
  autoApproveWhen: null,
});

const config: StoredBoardConfig = {
  revision: 1,
  updatedBy: null,
  updatedAt: null,
  boards: [
    {
      id: 'b1',
      key: 'work',
      name: 'Work',
      description: null,
      phases: [phase('open', ['doing']), phase('doing', ['done', 'open']), phase('done')],
      eventRoutes: [{ event: 'issue.closed', fromPhases: ['doing'], when: null, toPhaseKey: 'doing', enabled: true }],
    },
  ],
  intakeRoutes: [{ when: null, boardKey: 'work', phaseKey: 'doing', enabled: true }],
};

describe('board settings helpers', () => {
  it('parses comma lists and prints them back', () => {
    expect(parseList(' a, b ,a,, ')).toEqual(['a', 'b']);
    expect(parseList(' , ')).toBeNull();
    expect(listText(['a', 'b'])).toBe('a, b');
    expect(listText(null)).toBe('');
  });

  it('types condition values by operator and field', () => {
    expect(parseValue('x, y', 'in', 'text')).toEqual(['x', 'y']);
    expect(parseValue('true', 'equals', 'boolean')).toBe(true);
    expect(parseValue('anything', 'exists', 'text')).toBeUndefined();
    expect(parseValue('effort: low', 'contains', 'list')).toBe('effort: low');
    expect(operatorsFor('boolean').map(op => op.value)).toEqual(['equals', 'not_equals']);
    expect(operatorsFor('list').map(op => op.value)).not.toContain('equals');
  });

  it('describes a nested condition in words', () => {
    expect(
      describeCondition(
        {
          operator: 'AND',
          conditions: [
            { field: 'item.labels', operator: 'contains', value: 'bug' },
            {
              operator: 'OR',
              conditions: [
                { field: 'source.repository', operator: 'equals', value: 'acme/app' },
                { field: 'item.draft', operator: 'exists' },
              ],
            },
          ],
        },
        INTAKE_FIELDS,
      ),
    ).toBe('Labels contains bug and (Repository is acme/app or Is draft is set)');
    expect(describeCondition(null, INTAKE_FIELDS)).toBe('Everything else');
  });

  it('renames a phase everywhere it is referenced', () => {
    const next = renamePhase(config, 'work', 'doing', 'build');
    const board = next.boards[0];
    expect(board.phases.map(p => p.key)).toEqual(['open', 'build', 'done']);
    expect(board.phases[0].nextPhases).toEqual(['build']);
    expect(board.eventRoutes[0]).toMatchObject({ fromPhases: ['build'], toPhaseKey: 'build' });
    expect(next.intakeRoutes[0].phaseKey).toBe('build');
  });

  it('removes a phase and its references', () => {
    const next = removePhase(config, 'work', 'doing');
    const board = next.boards[0];
    expect(board.phases.map(p => p.key)).toEqual(['open', 'done']);
    expect(board.phases[0].nextPhases).toBeNull();
    expect(board.eventRoutes).toEqual([]);
    expect(next.intakeRoutes[0].phaseKey).toBeNull();
  });

  it('moves list entries within bounds', () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});
