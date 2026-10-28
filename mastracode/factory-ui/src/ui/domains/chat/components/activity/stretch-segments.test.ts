import { describe, expect, it } from 'vitest';

import type { StretchView } from './activity-header';
import { stretchSegments } from './stretch-segments';

const call = (key: string): StretchView => ({
  kind: 'tool',
  key,
  tool: { toolCallId: key, toolName: 'view', args: {}, argsText: '', status: 'done', output: '' },
});
const thought = (key: string): StretchView => ({ kind: 'reasoning', key, part: { type: 'reasoning', reasoning: key } });
const shape = (members: StretchView[]) =>
  stretchSegments(members).map(segment =>
    segment.kind === 'calls' ? segment.tools.map(tool => tool.key) : segment.key,
  );

describe('stretchSegments', () => {
  it('folds the calls between two thoughts into a group and leaves a lone call as its own row', () => {
    expect(shape([thought('t1'), call('a'), thought('t2'), call('b'), call('c'), thought('t3')])).toEqual([
      't1',
      'a',
      't2',
      ['b', 'c'],
      't3',
    ]);
  });

  it('groups calls that open or close the stretch', () => {
    expect(shape([call('a'), call('b'), thought('t1'), call('c'), call('d')])).toEqual([['a', 'b'], 't1', ['c', 'd']]);
  });
});
