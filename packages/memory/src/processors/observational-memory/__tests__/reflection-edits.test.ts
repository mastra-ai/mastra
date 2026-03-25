import { describe, expect, it } from 'vitest';

import { injectAnchorIds } from '../anchor-ids';
import { wrapInCollapsed } from '../collapsed-nodes';
import { applyEdits } from '../reflection-edits';

describe('reflection edits', () => {
  it('combines sibling anchors into a collapsed node', () => {
    const observations = `- Alpha\n- Beta\n- Gamma`;
    const anchored = injectAnchorIds(observations, 'positional');

    const result = applyEdits(anchored, [
      { type: 'combine', id: 'c1', anchorIds: ['O1', 'O2'], summary: 'Combined work' },
    ]);

    expect(result).toBe(`${wrapInCollapsed('c1', 'Combined work', '- Alpha\n- Beta')}\n- Gamma`);
  });

  it('rewords a normal line', () => {
    const result = applyEdits(`- Alpha\n- Beta`, [{ type: 'reword', anchorId: 'O2', text: '- Reworded beta' }]);
    expect(result).toBe(`- Alpha\n- Reworded beta`);
  });

  it('rewords a collapsed summary', () => {
    const observations = `${wrapInCollapsed('c1', 'Old summary', '- Alpha\n- Beta')}\n- Gamma`;
    const result = applyEdits(observations, [{ type: 'reword', anchorId: 'O1', text: 'New summary' }]);

    expect(result).toContain('<collapsed id="c1" summary="New summary">');
  });

  it('nests items into an existing collapsed node at the end', () => {
    const observations = `${wrapInCollapsed('c1', 'Summary', '- Alpha')}\n- Beta\n- Gamma`;
    const result = applyEdits(observations, [{ type: 'nest', anchorIds: ['O2', 'O3'], into: 'c1', position: 'end' }]);

    expect(result).toBe(wrapInCollapsed('c1', 'Summary', '- Alpha\n- Beta\n- Gamma'));
  });

  it('applies edits sequentially and reindexes anchor ids between operations', () => {
    const observations = `- Alpha\n- Beta\n- Gamma`;
    const result = applyEdits(observations, [
      { type: 'combine', id: 'c1', anchorIds: ['O1', 'O2'], summary: 'Combined work' },
      { type: 'reword', anchorId: 'O2', text: '- Reworded gamma' },
    ]);

    expect(result).toBe(`${wrapInCollapsed('c1', 'Combined work', '- Alpha\n- Beta')}\n- Reworded gamma`);
  });

  it('rejects combine on non-sibling anchors', () => {
    expect(() =>
      applyEdits(`- Alpha\n  - Beta\n- Gamma`, [
        { type: 'combine', id: 'c1', anchorIds: ['O1', 'O1.1'], summary: 'Invalid combine' },
      ]),
    ).toThrow('combine requires anchorIds to be siblings');
  });
});
