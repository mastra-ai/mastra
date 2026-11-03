import { describe, expect, it } from 'vitest';
import { fitTargets } from './fitTargets';

const node = (id: string) => ({ id });

describe('fitTargets', () => {
  const nodes = ['focus', 'child', 'ring-a', 'ring-b', 'unrelated'].map(node);

  it('frames every page when nothing is focused', () => {
    expect(fitTargets(nodes, null, new Set()).map(n => n.id)).toEqual(nodes.map(n => n.id));
  });

  it('frames the focus and its neighbours, and the outer ring of linked pages too', () => {
    const ids = fitTargets(nodes, new Set(['focus', 'child']), new Set(['ring-a', 'ring-b'])).map(n => n.id);
    expect(ids).toEqual(['focus', 'child', 'ring-a', 'ring-b']);
  });

  it('leaves out pages that are neither neighbours nor linked', () => {
    expect(fitTargets(nodes, new Set(['focus']), new Set()).map(n => n.id)).toEqual(['focus']);
  });
});
