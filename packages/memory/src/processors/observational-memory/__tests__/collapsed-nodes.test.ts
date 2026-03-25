import { describe, expect, it } from 'vitest';

import {
  buildAnchorTree,
  findCollapsedNodeById,
  findNodeByAnchorId,
  injectAnchorIds,
  parseCollapsedNodes,
  parsePositionalId,
  renderCollapsedNodesForAgent,
  renderCollapsedNodesForReflector,
  stripEphemeralAnchorIds,
  wrapInCollapsed,
} from '../index';

describe('collapsed nodes and positional anchor ids', () => {
  it('injects positional anchor ids across nested indentation', () => {
    const observations = `Date: Mar 24, 2026
- Top level one
- Top level two
  - Nested one
  - Nested two
    - Nested deep
- Top level three`;

    const anchored = injectAnchorIds(observations, 'positional').split('\n');

    expect(anchored[0]).toBe('Date: Mar 24, 2026');
    expect(anchored[1]).toBe('[O1] - Top level one');
    expect(anchored[2]).toBe('[O2] - Top level two');
    expect(anchored[3]).toBe('  [O2.1] - Nested one');
    expect(anchored[4]).toBe('  [O2.2] - Nested two');
    expect(anchored[5]).toBe('    [O2.2.1] - Nested deep');
    expect(anchored[6]).toBe('[O3] - Top level three');
  });

  it('parses positional anchor paths and finds nodes by anchor id', () => {
    const anchored = injectAnchorIds(`- Parent\n  - Child\n    - Grandchild\n- Second`, 'positional');
    const tree = buildAnchorTree(anchored);

    expect(parsePositionalId('O2.3.1')).toEqual(['O2', 'O2.3', 'O2.3.1']);
    expect(findNodeByAnchorId(tree, 'O1.1')?.line).toContain('Child');
    expect(findNodeByAnchorId(tree, 'O1.1.1')?.line).toContain('Grandchild');
    expect(findNodeByAnchorId(tree, 'O9')).toBeNull();
  });

  it('parses nested collapsed nodes', () => {
    const text = `- Before\n${wrapInCollapsed(
      'c1',
      'Summary one',
      `- Child one\n${wrapInCollapsed('c2', 'Nested summary', '- Nested child')}`,
    )}\n- After`;

    const nodes = parseCollapsedNodes(text);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toEqual({
      id: 'c1',
      summary: 'Summary one',
      children: `- Child one\n${wrapInCollapsed('c2', 'Nested summary', '- Nested child')}`,
    });
    expect(nodes[1]).toEqual({
      id: 'c2',
      summary: 'Nested summary',
      children: '- Nested child',
    });
  });

  it('renders collapsed nodes for the main agent as summaries with refs', () => {
    const observations = `- Start\n${wrapInCollapsed('c1', 'Compressed thread work', '- detail one\n- detail two')}\n- End`;

    expect(renderCollapsedNodesForAgent(observations)).toBe(`- Start\n* Compressed thread work [ref:c1]\n- End`);
  });

  it('renders collapsed nodes for the reflector with positional anchor ids', () => {
    const observations = `- Start\n${wrapInCollapsed('c1', 'Compressed thread work', '- detail one\n  - nested detail')}\n- End`;

    const rendered = renderCollapsedNodesForReflector(observations);

    expect(rendered).toContain('[O1] - Start');
    expect(rendered).toContain('[O2] <collapsed id="c1" summary="Compressed thread work">');
    expect(rendered).toContain('[O2.1] - detail one');
    expect(rendered).toContain('[O2.1.1] - nested detail');
    expect(rendered).toContain('[O3] - End');
  });

  it('finds collapsed nodes by ref id and strips positional anchors', () => {
    const observations = `- Start\n${wrapInCollapsed('c1', 'Compressed thread work', '- detail one')}\n- End`;
    const rendered = renderCollapsedNodesForReflector(observations);

    expect(findCollapsedNodeById(observations, 'c1')).toEqual({
      id: 'c1',
      summary: 'Compressed thread work',
      children: '- detail one',
    });
    expect(stripEphemeralAnchorIds(rendered)).toContain('<collapsed id="c1" summary="Compressed thread work">');
  });
});
