import { describe, expect, it } from 'vitest';

import {
  combineObservationGroupRanges,
  deriveObservationGroupProvenance,
  parseObservationGroups,
  reconcileObservationGroupsFromReflection,
  renderObservationGroupsForReflection,
  stripObservationGroups,
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

describe('observation group tags in observation content', () => {
  const quotedTag = `<observation-group id="outer" range="1:5">
- The format is <observation-group id="example" range="2:3"> with attributes
</observation-group>`;

  it('treats a tag mentioned inside a line as content, not as a nested group', () => {
    expect(parseObservationGroups(quotedTag)).toEqual([
      {
        id: 'outer',
        range: '1:5',
        kind: undefined,
        content: '- The format is <observation-group id="example" range="2:3"> with attributes',
      },
    ]);
  });

  it('keeps quoted tag text intact when stripping and rendering', () => {
    expect(stripObservationGroups(quotedTag)).toBe(
      '- The format is <observation-group id="example" range="2:3"> with attributes',
    );
    expect(renderObservationGroupsForReflection(quotedTag)).toBe(`## Group \`outer\`
_range: \`1:5\`_

- The format is <observation-group id="example" range="2:3"> with attributes`);
  });

  it('reads a line-started tag as a nested group so the complete group is recovered', () => {
    const observations = `<observation-group id="incomplete" range="1:2">
Incomplete
<observation-group id="complete" range="3:4">
Complete
</observation-group>`;

    expect(parseObservationGroups(observations)).toEqual([
      { id: 'complete', range: '3:4', kind: undefined, content: 'Complete' },
    ]);
    expect(stripObservationGroups(observations)).toBe('Incomplete\nComplete');
    expect(renderObservationGroupsForReflection(observations)).toBe(`Incomplete
## Group \`complete\`
_range: \`3:4\`_

Complete`);
  });

  it('drops an opening tag that never closes so no raw metadata leaks into stripped output', () => {
    const observations = `<observation-group id="complete" range="1:2">
Complete
</observation-group>
<observation-group id="truncated" range="3:4">
Truncated text`;

    expect(parseObservationGroups(observations)).toEqual([
      { id: 'complete', range: '1:2', kind: undefined, content: 'Complete' },
    ]);
    expect(stripObservationGroups(observations)).not.toContain('<observation-group');
    expect(stripObservationGroups(observations)).toContain('Truncated text');
  });

  it('recovers a complete group after an incomplete group that quotes an opening tag inline', () => {
    const quoted = '- The format is <observation-group id="example" range="2:3"> with attributes';
    const observations = `<observation-group id="incomplete" range="1:2">
${quoted}
<observation-group id="complete" range="3:4">
- A later fact
</observation-group>`;

    expect(parseObservationGroups(observations)).toEqual([
      { id: 'complete', range: '3:4', kind: undefined, content: '- A later fact' },
    ]);
    expect(stripObservationGroups(observations)).toBe(`${quoted}\n- A later fact`);
    expect(renderObservationGroupsForReflection(observations)).toBe(`${quoted}
## Group \`complete\`
_range: \`3:4\`_

- A later fact`);
  });

  it('stays linear when no opening tag starts a line', () => {
    // Every opening is inline and the content has newlines, so without the cached result each
    // nested-opening search would walk every remaining newline to the end of the input.
    const count = 80_000;
    const observations = 'a<observation-group id="x" range="1:1">\nv\n</observation-group>'.repeat(count);

    const started = performance.now();
    const groups = parseObservationGroups(observations);
    const elapsed = performance.now() - started;

    expect(groups).toEqual(
      Array.from({ length: count }, () => ({ id: 'x', range: '1:1', kind: undefined, content: 'v' })),
    );
    expect(stripObservationGroups(observations)).toBe('av'.repeat(count));
    expect(renderObservationGroupsForReflection(observations)).toBe('a## Group `x`\n_range: `1:1`_\n\nv'.repeat(count));
    expect(elapsed).toBeLessThan(2_000);
  });

  it('drops a lone unterminated opening tag and keeps its text', () => {
    const observations = `<observation-group id="only" range="1:2">
Lone text`;

    expect(stripObservationGroups(observations)).toBe('Lone text');
  });

  it('drops every unterminated opening tag, not just the first', () => {
    const observations = `<observation-group id="a" range="1:2">
Text A
<observation-group id="b" range="3:4">
Text B`;

    const stripped = stripObservationGroups(observations);
    expect(stripped).not.toContain('<observation-group');
    expect(stripped).toContain('Text A');
    expect(stripped).toContain('Text B');
  });

  it('keeps an inline tag mention that has no closing tag', () => {
    const observations = `<observation-group id="a" range="1:2">
Text A
The format is <observation-group id="example" range="2:3"> inline`;

    expect(stripObservationGroups(observations)).toContain(
      'The format is <observation-group id="example" range="2:3"> inline',
    );
  });
});

describe('combineObservationGroupRanges', () => {
  it('spans unordered numeric ranges by endpoint value', () => {
    expect(combineObservationGroupRanges([group('a', '10:20'), group('b', '1:5')])).toBe('1:20');
  });

  it('normalizes reversed numeric pairs and comma-separated segments', () => {
    expect(combineObservationGroupRanges([group('a', '10:5, 2:3'), group('b', '8:12')])).toBe('2:12');
    expect(combineObservationGroupRanges([group('a', '10:5')])).toBe('5:10');
  });

  it('compacts opaque segments to a bounded span instead of listing them', () => {
    expect(combineObservationGroupRanges([group('a', 'm1:m2'), group('b', 'm3:m4,m1:m2')])).toBe('m1:m4');
    expect(combineObservationGroupRanges([group('a', 'm1:m2'), group('b', 'm3:m4')])).toBe('m1:m4');
  });

  it('leaves segments that are not start:end pairs untouched', () => {
    expect(combineObservationGroupRanges([group('a', 'message-id')])).toBe('message-id');
    expect(combineObservationGroupRanges([group('a', '1:2:3')])).toBe('1:2:3');
    expect(combineObservationGroupRanges([group('a', '1:2'), group('b', 'message-id')])).toBe('1:2,message-id');
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

    expect(reconciled).toContain('range="m1:m4"');
    const rerendered = renderObservationGroupsForReflection(reconciled)!;
    expect(reconcileObservationGroupsFromReflection(rerendered, reconciled)).toContain('range="m1:m4"');
  });

  it('preserves each source range when duplicate-content groups are rendered and reconciled', () => {
    const source = `<observation-group id="g1" range="1:2">- Same fact</observation-group>
<observation-group id="g2" range="3:4">- Same fact</observation-group>`;
    const rendered = renderObservationGroupsForReflection(source)!;

    expect(reconcileObservationGroupsFromReflection(rendered, source)).toBe(
      `<observation-group id="g1" range="1:2" kind="reflection">
- Same fact
</observation-group>

<observation-group id="g2" range="3:4" kind="reflection">
- Same fact
</observation-group>`,
    );
  });
});

describe('deriveObservationGroupProvenance', () => {
  const source = `<observation-group id="A" range="1:2">- Fact A</observation-group>
<observation-group id="B" range="3:4">- Fact B</observation-group>`;

  it('keeps a retained heading id pinned to its own group', () => {
    expect(deriveObservationGroupProvenance(`## Group \`A\`\n\n- Fact A`, parseObservationGroups(source))).toEqual([
      { id: 'A', range: '1:2', kind: 'reflection', content: '- Fact A' },
    ]);
  });

  it('unions the other source groups whose facts the section also carries', () => {
    expect(
      deriveObservationGroupProvenance(`## Group \`A\`\n\n- Fact A\n- Fact B`, parseObservationGroups(source)),
    ).toEqual([{ id: 'A', range: '1:4', kind: 'reflection', content: '- Fact A\n- Fact B' }]);
  });

  it('does not widen a section to groups whose facts it already covers', () => {
    const duplicated = `<observation-group id="g1" range="1:2">- Same fact</observation-group>
<observation-group id="g2" range="3:4">- Same fact</observation-group>`;

    expect(
      deriveObservationGroupProvenance(`## Group \`g1\`\n\n- Same fact`, parseObservationGroups(duplicated)),
    ).toEqual([{ id: 'g1', range: '1:2', kind: 'reflection', content: '- Same fact' }]);
  });

  it('falls back to content matching when the heading id is not a source group', () => {
    expect(
      deriveObservationGroupProvenance(
        `## Group \`merged-project\`\n\n- Fact A\n- Fact B`,
        parseObservationGroups(source),
      ),
    ).toEqual([{ id: 'merged-project', range: '1:4', kind: 'reflection', content: '- Fact A\n- Fact B' }]);
  });

  it('spans opaque ranges in source order regardless of which group the heading names', () => {
    const opaque = `<observation-group id="g1" range="m1:m2">- Fact A</observation-group>
<observation-group id="g2" range="m3:m4">- Fact B</observation-group>`;
    const sourceGroups = parseObservationGroups(opaque);

    expect(deriveObservationGroupProvenance(`## Group \`g1\`\n\n- Fact A\n- Fact B`, sourceGroups)).toEqual([
      { id: 'g1', range: 'm1:m4', kind: 'reflection', content: '- Fact A\n- Fact B' },
    ]);
    expect(deriveObservationGroupProvenance(`## Group \`g2\`\n\n- Fact A\n- Fact B`, sourceGroups)).toEqual([
      { id: 'g2', range: 'm1:m4', kind: 'reflection', content: '- Fact A\n- Fact B' },
    ]);
  });

  it('does not widen to a group whose only shared line is already covered by the identified group', () => {
    const overlapping = `<observation-group id="A" range="1:2">- Shared
- Only A</observation-group>
<observation-group id="B" range="3:4">- Shared
- Only B</observation-group>`;

    expect(
      deriveObservationGroupProvenance(`## Group \`A\`\n\n- Shared\n- Only A`, parseObservationGroups(overlapping)),
    ).toEqual([{ id: 'A', range: '1:2', kind: 'reflection', content: '- Shared\n- Only A' }]);
  });
});

describe('malformed observation group input', () => {
  it('processes repeated unterminated group openings in linear time', () => {
    const observations = '<observation-group >' + 'a<observation-group >'.repeat(10_000);
    const start = performance.now();

    expect(renderObservationGroupsForReflection(observations)).toBeNull();

    expect(performance.now() - start).toBeLessThan(200);
  });
});
