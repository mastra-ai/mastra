import { describe, expect, it } from 'vitest';

import { groupConsecutive } from './group-consecutive';

type Part = { type: 'tool'; id: string } | { type: 'text' };
type ToolPart = Extract<Part, { type: 'tool' }>;

const tool = (id: string): Part => ({ type: 'tool', id });
const text: Part = { type: 'text' };

const rules = {
  key: (part: ToolPart) => part.id,
  joins: (part: Part): part is ToolPart => part.type === 'tool',
};

describe('groupConsecutive', () => {
  it('folds a run of three or more under its first member', () => {
    const groups = groupConsecutive([tool('a'), tool('b'), tool('c'), tool('d')], rules);

    expect([...groups.byFirstKey.keys()]).toEqual(['a']);
    expect(groups.byFirstKey.get('a')?.map(part => part.id)).toEqual(['a', 'b', 'c', 'd']);
    expect([...groups.memberKeys]).toEqual(['b', 'c', 'd']);
  });

  it('leaves a shorter run as individual rows', () => {
    const groups = groupConsecutive([tool('a'), tool('b')], rules);

    expect(groups.byFirstKey.size).toBe(0);
    expect(groups.memberKeys.size).toBe(0);
  });

  it('ends a run at an item that does not join, and starts another after it', () => {
    const groups = groupConsecutive(
      [tool('a'), tool('b'), tool('c'), text, tool('d'), tool('e'), text, tool('f'), tool('g'), tool('h')],
      rules,
    );

    expect([...groups.byFirstKey.keys()]).toEqual(['a', 'f']);
    expect(groups.memberKeys.has('e')).toBe(false);
  });

  it('takes a custom minimum', () => {
    const groups = groupConsecutive([tool('a'), tool('b')], { ...rules, min: 2 });

    expect([...groups.byFirstKey.keys()]).toEqual(['a']);
  });
});
