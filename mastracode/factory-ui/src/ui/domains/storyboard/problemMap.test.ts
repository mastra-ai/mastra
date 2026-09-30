import { describe, expect, it } from 'vitest';

import { linkedNodes, PROBLEM_MAP_EDGES, PROBLEM_MAP_MERMAID, placeNodes } from './problemMap';
import { PROBLEM_MAP_NODES } from './problemMapNodes';
import { STORIES } from './stories';

const ids = Object.keys(PROBLEM_MAP_NODES);
const nodes = Object.values(PROBLEM_MAP_NODES);

describe('problem map', () => {
  it('places every node exactly once, so none is missing from the page or the mermaid', () => {
    expect(placeNodes().map(placed => placed.id)).toEqual(expect.arrayContaining(ids));
    expect(placeNodes()).toHaveLength(ids.length);
  });

  it('declares every node and every edge in the mermaid string', () => {
    for (const id of ids) expect(PROBLEM_MAP_MERMAID).toMatch(new RegExp(`\\b${id}\\[`));
    for (const edge of PROBLEM_MAP_EDGES) {
      expect(ids).toContain(edge.source);
      expect(ids).toContain(edge.target);
      expect(PROBLEM_MAP_MERMAID).toContain(`${edge.source} --> ${edge.target}`);
    }
  });

  it('links every story to one the storyboard can open', () => {
    const storyIds = STORIES.map(story => story.id);
    for (const node of nodes) if (node.story) expect(storyIds).toContain(node.story);
  });

  it('gives every solution a story unless it is an open question', () => {
    for (const node of nodes) if (node.column === 'solution' && !node.open) expect(node.story).not.toBeNull();
  });

  it('links a hovered problem to its whole chain, not to problems sharing its solution', () => {
    const linked = linkedNodes('p_owner');
    expect([...linked]).toEqual(expect.arrayContaining(['p_owner', 's_facts', 'r_crowded', 'f_chips']));
    expect(linked.has('p_author')).toBe(false);
    expect(linkedNodes('s_facts').has('p_author')).toBe(true);
  });

  it('keeps labels at eight words or fewer', () => {
    for (const node of nodes) expect(node.label.split(/\s+/).length, node.label).toBeLessThanOrEqual(8);
  });
});
