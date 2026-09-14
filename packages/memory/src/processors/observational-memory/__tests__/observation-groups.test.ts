import { describe, expect, it } from 'vitest';

import {
  combineObservationGroupRanges,
  reconcileObservationGroupsFromReflection,
  renderObservationGroupsForReflection,
  type ObservationGroup,
} from '../observation-groups';

function group(id: string, range: string, content = '- Fact'): ObservationGroup {
  return { id, range, content };
}

describe('renderObservationGroupsForReflection', () => {
  it('preserves each tag identity when group bodies are identical', () => {
    const observations = `<observation-group id="g1" range="1:2">
- Same fact
</observation-group>

<observation-group id="g2" range="3:4">
- Same fact
</observation-group>`;

    expect(renderObservationGroupsForReflection(observations)).toBe(`## Group \`g1\`
_range: \`1:2\`_

- Same fact

## Group \`g2\`
_range: \`3:4\`_

- Same fact`);
  });

  it('unwraps invalid tags without shifting valid tag identities', () => {
    const observations = `before
<observation-group range="0:0">
- Same fact
</observation-group>
<observation-group id="g1" range="1:2">
- Same fact
</observation-group>
after`;

    expect(renderObservationGroupsForReflection(observations)).toBe(`before
- Same fact
## Group \`g1\`
_range: \`1:2\`_

- Same fact
after`);
  });

  it('returns null when there are no valid groups', () => {
    expect(renderObservationGroupsForReflection('')).toBeNull();
    expect(renderObservationGroupsForReflection('<observation-group range="1:2">Fact</observation-group>')).toBeNull();
  });
});

describe('combineObservationGroupRanges', () => {
  it('spans unordered numeric ranges by endpoint value', () => {
    expect(combineObservationGroupRanges([group('a', '10:20'), group('b', '1:5')])).toBe('1:20');
  });

  it('normalizes reversed numeric pairs and comma-separated segments', () => {
    expect(combineObservationGroupRanges([group('a', '10:5, 2:3'), group('b', '8:12')])).toBe('2:12');
  });

  it('preserves opaque, malformed, singleton, and unsafe segments losslessly', () => {
    expect(combineObservationGroupRanges([group('a', 'm1:m2'), group('b', 'm3:m4,m1:m2')])).toBe('m1:m2,m3:m4');
    expect(combineObservationGroupRanges([group('a', '1:2'), group('b', 'message-id')])).toBe('1:2,message-id');
    expect(combineObservationGroupRanges([group('a', '1:2:3')])).toBe('1:2:3');
    expect(combineObservationGroupRanges([group('a', '9007199254740992:9007199254740993')])).toBe(
      '9007199254740992:9007199254740993',
    );
  });

  it('returns an empty string without mutating input', () => {
    const groups = [group('a', ' 1:2 '), group('b', '3:4')];
    const snapshot = structuredClone(groups);
    expect(combineObservationGroupRanges([])).toBe('');
    expect(combineObservationGroupRanges(groups)).toBe('1:4');
    expect(groups).toEqual(snapshot);
  });
});

describe('reconcileObservationGroupsFromReflection', () => {
  it('emits a valid numeric span for unordered source groups', () => {
    const source = `<observation-group id="a" range="10:20">- First</observation-group>
<observation-group id="b" range="1:5">- Second</observation-group>`;
    const reflection = `## Group \`merged\`\n\n- First\n- Second`;

    expect(reconcileObservationGroupsFromReflection(reflection, source)).toContain('range="1:20"');
  });

  it('keeps opaque provenance stable across repeated reconciliation', () => {
    const source = `<observation-group id="a" range="m1:m2">- First</observation-group>
<observation-group id="b" range="m3:m4">- Second</observation-group>`;
    const reflection = `## Group \`merged\`\n\n- First\n- Second`;
    const reconciled = reconcileObservationGroupsFromReflection(reflection, source)!;

    expect(reconciled).toContain('range="m1:m2,m3:m4"');
    const rerendered = renderObservationGroupsForReflection(reconciled)!;
    expect(reconcileObservationGroupsFromReflection(rerendered, reconciled)).toContain('range="m1:m2,m3:m4"');
  });
});
