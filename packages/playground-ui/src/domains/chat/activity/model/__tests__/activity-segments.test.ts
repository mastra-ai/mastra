import { describe, expect, it } from 'vitest';

import type { ActivityMember } from '../activity-members';
import { activitySegments } from '../activity-segments';

const call = (key: string): ActivityMember => ({
  kind: 'call',
  key,
  toolName: 'view',
  args: {},
  status: 'done',
  row: key,
});
const thought = (key: string): ActivityMember => ({ kind: 'thought', key, content: { text: key } });
const shape = (members: ActivityMember[]) =>
  activitySegments(members).map(segment =>
    segment.kind === 'calls' ? segment.calls.map(member => member.key) : segment.key,
  );

describe('activitySegments', () => {
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
