import { describe, expect, it } from 'vitest';

import { groupTurns } from './turn-groups';

interface Entry {
  id: string;
  kind: 'user' | 'assistant' | 'gap';
}

const entry = (id: string, kind: Entry['kind']): Entry => ({ id, kind });

const rules = {
  key: (item: Entry) => item.id,
  opensTurn: (item: Entry) => item.kind === 'user',
  introduces: (item: Entry) => item.kind === 'gap',
};

const ids = (groups: ReturnType<typeof groupTurns<Entry>>) => groups.map(group => group.entries.map(e => e.id));

describe('groupTurns', () => {
  it('hangs a run under the message that asked for it', () => {
    const groups = groupTurns([entry('u1', 'user'), entry('a1', 'assistant'), entry('u2', 'user')], rules);

    expect(ids(groups)).toEqual([['u1', 'a1'], ['u2']]);
    expect(groups.map(group => group.opensTurn)).toEqual([true, true]);
  });

  it('moves a gap down into the turn it introduces', () => {
    const groups = groupTurns([entry('u1', 'user'), entry('g1', 'gap'), entry('u2', 'user')], rules);

    expect(ids(groups)).toEqual([['u1'], ['g1', 'u2']]);
  });

  it('keeps a reply that arrives before any opener as a turn that opens nothing', () => {
    const groups = groupTurns([entry('a0', 'assistant'), entry('u1', 'user')], rules);

    expect(ids(groups)).toEqual([['a0'], ['u1']]);
    expect(groups[0].opensTurn).toBe(false);
  });
});
