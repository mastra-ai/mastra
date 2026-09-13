import { describe, expect, it } from 'vitest';
import {
  combineObservationGroupRanges,
  parseObservationGroups,
  reconcileObservationGroupsFromReflection,
  renderObservationGroupsForReflection,
  stripObservationGroups,
  wrapInObservationGroup,
} from '../observation-groups';

function group(id: string, range: string, content: string): string {
  return wrapInObservationGroup(content, range, id);
}

describe('parseObservationGroups', () => {
  it('parses id, range and content', () => {
    const groups = parseObservationGroups(group('g1', '1:5', 'Alpha'));
    expect(groups).toEqual([{ id: 'g1', range: '1:5', kind: undefined, content: 'Alpha' }]);
  });

  it('skips groups missing an id or range', () => {
    const observations = [
      '<observation-group id="g1">\nNo range\n</observation-group>',
      group('g2', '6:9', 'Beta'),
    ].join('\n\n');
    expect(parseObservationGroups(observations).map(g => g.id)).toEqual(['g2']);
  });
});

describe('combineObservationGroupRanges', () => {
  it('spans the first start to the last end for ordered groups', () => {
    const groups = parseObservationGroups([group('g1', '1:5', 'Alpha'), group('g2', '10:20', 'Beta')].join('\n\n'));
    expect(combineObservationGroupRanges(groups)).toBe('1:20');
  });

  // Groups reach this function in whatever order they were stored or filtered,
  // so position must not decide the span.
  it('spans lowest start to highest end when groups are unordered', () => {
    const groups = parseObservationGroups([group('g2', '10:20', 'Beta'), group('g1', '1:5', 'Alpha')].join('\n\n'));
    expect(combineObservationGroupRanges(groups)).toBe('1:20');
  });

  it('returns an empty string for no groups', () => {
    expect(combineObservationGroupRanges([])).toBe('');
  });

  it('lists distinct segments when a range is not numeric', () => {
    const groups = parseObservationGroups(
      [group('g1', 'msg-a:msg-b', 'Alpha'), group('g2', 'msg-c:msg-d', 'Beta')].join('\n\n'),
    );
    expect(combineObservationGroupRanges(groups)).toBe('msg-a:msg-b,msg-c:msg-d');
  });
});

describe('renderObservationGroupsForReflection', () => {
  it('renders each group with its own id and range', () => {
    const rendered = renderObservationGroupsForReflection(
      [group('g1', '1:5', 'Alpha'), group('g2', '6:9', 'Beta')].join('\n\n'),
    );
    expect(rendered).toContain('## Group `g1`');
    expect(rendered).toContain('_range: `1:5`_');
    expect(rendered).toContain('## Group `g2`');
    expect(rendered).toContain('_range: `6:9`_');
  });

  // Two groups can legitimately observe the same thing in different ranges;
  // keying the render by content collapsed them onto one id.
  it('keeps distinct ids when two groups share identical content', () => {
    const rendered = renderObservationGroupsForReflection(
      [group('g1', '1:5', 'User likes tea'), group('g2', '6:9', 'User likes tea')].join('\n\n'),
    );
    expect(rendered).toContain('## Group `g1`');
    expect(rendered).toContain('_range: `1:5`_');
    expect(rendered).toContain('## Group `g2`');
    expect(rendered).toContain('_range: `6:9`_');
  });

  it('returns null when there are no groups', () => {
    expect(renderObservationGroupsForReflection('plain observations')).toBeNull();
  });

  it('leaves ungrouped text in place', () => {
    const rendered = renderObservationGroupsForReflection(`leading note\n\n${group('g1', '1:5', 'Alpha')}`);
    expect(rendered).toContain('leading note');
    expect(rendered).toContain('## Group `g1`');
  });
});

describe('stripObservationGroups', () => {
  it('unwraps group tags and keeps the content', () => {
    const stripped = stripObservationGroups([group('g1', '1:5', 'Alpha'), group('g2', '6:9', 'Beta')].join('\n\n'));
    expect(stripped).toBe('Alpha\n\nBeta');
  });
});

describe('reconcileObservationGroupsFromReflection', () => {
  it('does not emit an inverted range when source groups are unordered', () => {
    const source = [group('g2', '10:20', 'Beta line'), group('g1', '1:5', 'Alpha line')].join('\n\n');

    const reconciled = reconcileObservationGroupsFromReflection('## Group `r1`\nBeta line\nAlpha line', source);

    const range = reconciled?.match(/range="(\d+):(\d+)"/);
    expect(range).not.toBeNull();
    expect(Number(range![1])).toBeLessThanOrEqual(Number(range![2]));
    expect(reconciled).toContain('range="1:20"');
  });

  it('returns null when the source has no groups', () => {
    expect(reconcileObservationGroupsFromReflection('anything', 'no groups here')).toBeNull();
  });
});
