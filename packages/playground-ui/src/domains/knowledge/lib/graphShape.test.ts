import { describe, expect, it } from 'vitest';

import type { KnowledgePagePayload } from '../pageTypes';
import {
  GRAPH_CHILD_CAP,
  PLACEHOLDER_CAP,
  WANTED_CIRCLE_CAP,
  graphShape,
  isChildPlaceholder,
  isScopeGroup,
  lazyGraph,
  radialLayout,
} from './graphShape';

const nobody = { author: 'agent' };
function page(id: string, parentId: string | null, fields: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: 'site',
    parentId,
    isScope: parentId === null,
    position: id,
    name: id,
    version: 1,
    createdBy: nobody,
    updatedBy: nobody,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...fields,
  };
}

// site ─ blog ─ post-1 ─ draft
//      │      └ post-2
//      └ docs ─ guide
const pages = [
  page('site', null, { address: 'site:mastra' }),
  page('blog', 'site'),
  page('post-1', 'blog'),
  page('post-2', 'blog'),
  page('draft', 'post-1'),
  page('docs', 'site'),
  page('guide', 'docs'),
];

describe('graphShape', () => {
  describe('when a page is focused', () => {
    const shape = graphShape(pages, 'blog');

    it('counts parent links from the focus, either way they run', () => {
      expect(Object.fromEntries(shape.depth)).toEqual({
        blog: 0,
        site: 1,
        'post-1': 1,
        'post-2': 1,
        docs: 2,
        draft: 2,
        guide: 3,
      });
    });

    it('draws the focus, its parent and its children as full circles, and everything farther as dots', () => {
      expect(Object.fromEntries(shape.form)).toEqual({
        site: 'full',
        blog: 'full',
        'post-1': 'full',
        'post-2': 'full',
        draft: 'dot',
        docs: 'dot',
        guide: 'dot',
      });
    });

    it('colours each dot by the branch around the focus it hangs under', () => {
      expect(shape.branch.get('draft')).toBe('post-1');
      expect(shape.branch.get('guide')).toBe('site');
    });
  });

  describe('when a dot is focused', () => {
    it('grows it into a full circle and shrinks what is now far away', () => {
      const shape = graphShape(pages, 'draft');
      expect(shape.form.get('draft')).toBe('full');
      expect(shape.form.get('post-1')).toBe('full');
      expect(shape.form.get('blog')).toBe('dot');
    });
  });

  describe('when nothing is focused', () => {
    it('centres on the only root scope', () => {
      const shape = graphShape(pages, null);
      expect(shape.center).toBe('site');
      expect(shape.form.get('blog')).toBe('full');
      expect(shape.form.get('post-1')).toBe('dot');
    });

    it('puts several root scopes on the first ring as full circles, with their children as dots', () => {
      const shape = graphShape([...pages, page('other', null, { address: 'resource:docs' })], null);
      expect(shape.center).toBeNull();
      expect(shape.form.get('site')).toBe('full');
      expect(shape.form.get('other')).toBe('full');
      expect(shape.form.get('blog')).toBe('dot');
    });
  });

  it('draws a page the focus cannot reach as a dot', () => {
    const shape = graphShape([...pages, page('elsewhere', null)], 'blog');
    expect(shape.depth.has('elsewhere')).toBe(false);
    expect(shape.form.get('elsewhere')).toBe('dot');
  });
});

describe('radialLayout', () => {
  const size = (p: KnowledgePagePayload) => (graphShape(pages, 'blog').form.get(p.id) === 'full' ? 108 : 14);

  it('puts the focus at the centre and its parent straight above it', () => {
    const positions = radialLayout(pages, graphShape(pages, 'blog'), size);
    expect(positions.get('blog')).toEqual({ x: 0, y: 0 });
    const parent = positions.get('site');
    expect(parent?.x).toBeCloseTo(0);
    expect(parent?.y).toBeLessThan(0);
  });

  it('puts each depth on its own ring, farther out the deeper it is', () => {
    const positions = radialLayout(pages, graphShape(pages, 'blog'), size);
    const distance = (id: string) => Math.hypot(positions.get(id)?.x ?? 0, positions.get(id)?.y ?? 0);
    expect(distance('post-1')).toBeCloseTo(distance('site'));
    expect(distance('draft')).toBeGreaterThan(distance('post-1'));
    expect(distance('guide')).toBeGreaterThan(distance('docs'));
  });

  it('keeps children near their parent', () => {
    const positions = radialLayout(pages, graphShape(pages, 'blog'), size);
    const angle = (id: string) => Math.atan2(positions.get(id)?.y ?? 0, positions.get(id)?.x ?? 0);
    expect(Math.abs(angle('draft') - angle('post-1'))).toBeLessThan(Math.abs(angle('draft') - angle('post-2')));
  });

  it('lays the same pages out the same way every time', () => {
    const shape = graphShape(pages, 'blog');
    expect(radialLayout(pages, shape, size)).toEqual(radialLayout([...pages].reverse(), shape, size));
  });
});

describe('lazyGraph', () => {
  const base = { rootKey: '', openGroups: new Set<string>() };

  it('draws the focus, two links around it, and its whole path up, but not farther cousins', () => {
    const deep = [...pages, page('deeper', 'draft')];
    const graph = lazyGraph({
      ...base,
      pages: deep,
      loadedParents: new Set(['', 'site', 'blog', 'post-1', 'draft', 'docs']),
      focusId: 'draft',
    });
    expect(graph.pages.map(p => p.id).sort()).toEqual(['blog', 'deeper', 'draft', 'post-1', 'site']);
    expect(graph.wanted).toEqual(['draft', 'post-1']);
  });

  it('stands in dots for the children of a page whose level has not loaded, from its count', () => {
    const graph = lazyGraph({
      ...base,
      pages: [page('site', null, { address: 'site:mastra' }), page('blog', 'site', { childCount: 281 })],
      loadedParents: new Set(['', 'site']),
      focusId: 'site',
    });
    const standIns = graph.pages.filter(isChildPlaceholder);
    expect(standIns).toHaveLength(PLACEHOLDER_CAP);
    expect(standIns.every(p => p.parentId === 'blog')).toBe(true);
    expect(standIns[0]?.name).toBe('281 pages under blog');
  });

  it('caps the children it draws and counts the rest', () => {
    const many = Array.from({ length: 30 }, (_, index) => page(`p${String(index).padStart(2, '0')}`, 'blog'));
    const graph = lazyGraph({
      ...base,
      pages: [page('site', null), page('blog', 'site', { childCount: 30 }), ...many],
      loadedParents: new Set(['', 'site', 'blog']),
      focusId: 'blog',
    });
    expect(graph.hiddenChildren.get('blog')).toEqual({ hidden: 30 - GRAPH_CHILD_CAP, drawn: GRAPH_CHILD_CAP });
  });

  it('collapses sibling memory scopes into one circle per type until opened, but not under the focus', () => {
    const threads = Array.from({ length: 5 }, (_, index) =>
      page(`t${index}`, 'resource', { isScope: true, address: `thread:${index}` }),
    );
    const input = {
      ...base,
      pages: [page('site', null), page('resource', null, { address: 'resource:docs' }), ...threads],
      loadedParents: new Set(['', 'site', 'resource']),
      focusId: null,
    };
    const collapsed = lazyGraph(input);
    const groups = collapsed.pages.filter(isScopeGroup);
    expect(groups.map(p => p.name)).toEqual(['5 thread scopes']);
    expect(collapsed.pages.some(p => p.id === 't0')).toBe(false);

    const opened = lazyGraph({ ...input, openGroups: new Set([groups[0]?.id as string]) });
    expect(opened.pages.filter(p => p.id.startsWith('t'))).toHaveLength(5);

    const focused = lazyGraph({ ...input, focusId: 'resource' });
    expect(focused.pages.some(isScopeGroup)).toBe(false);
  });

  it('wants the roots when nothing is focused', () => {
    const graph = lazyGraph({
      ...base,
      pages: [page('a', null), page('b', null)],
      loadedParents: new Set(['']),
      focusId: null,
    });
    expect(graph.wanted).toEqual(['a', 'b']);
  });

  it('also wants the children of the circles it draws, so their children show as dots, up to a cap', () => {
    const kids = Array.from({ length: 15 }, (_, index) =>
      page(`k${String(index).padStart(2, '0')}`, 'site', { childCount: 3 }),
    );
    const graph = lazyGraph({
      ...base,
      pages: [page('site', null, { address: 'site:mastra' }), ...kids, page('leaf', 'site')],
      loadedParents: new Set(['', 'site']),
      focusId: 'site',
    });
    expect(graph.wanted[0]).toBe('site');
    expect(graph.wanted).toHaveLength(1 + WANTED_CIRCLE_CAP);
    expect(graph.wanted).not.toContain('leaf');
  });

  it('keeps wanting a circle once its children have loaded, so the host does not drop the level again', () => {
    const input = {
      ...base,
      pages: [page('site', null, { address: 'site:mastra' }), page('blog', 'site', { childCount: 2 })],
      focusId: 'site',
    };
    const before = lazyGraph({ ...input, loadedParents: new Set(['', 'site']) });
    const after = lazyGraph({ ...input, loadedParents: new Set(['', 'site', 'blog']) });
    expect(before.wanted).toEqual(['site', 'blog']);
    expect(after.wanted).toEqual(before.wanted);
  });
});
