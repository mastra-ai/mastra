import { describe, expect, it } from 'vitest';

import type { KnowledgePagePayload } from '../pageTypes';
import {
  CROWD_MIN_SCALE,
  CROWD_START,
  GRAPH_CHILD_CAP,
  HIGHER_LEVEL_CAP,
  PLACEHOLDER_CAP,
  READABLE_MIN_ZOOM,
  ROOT_CIRCLE_CAP,
  WANTED_CIRCLE_CAP,
  crowdScale,
  graphShape,
  isChildPlaceholder,
  isRestCircle,
  REST_BATCH,
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

  describe('higher levels', () => {
    it("draws the focus's ancestors and every scope as circles however far they sit", () => {
      const shape = graphShape(pages, 'draft');
      expect(shape.form.get('blog')).toBe('full');
      expect(shape.form.get('site')).toBe('full');
      expect(shape.level.get('blog')).toBe('ancestor');
      expect(shape.level.get('site')).toBe('scope');
      // Not above the focus, so still dots.
      expect(shape.form.get('docs')).toBe('dot');
      expect(shape.form.get('guide')).toBe('dot');
      expect(shape.level.has('docs')).toBe(false);
    });

    it("draws a scope that is not on the focus's path as a circle too", () => {
      const other = page('other', null, { address: 'resource:docs' });
      const shape = graphShape([...pages, other, page('far', 'other')], 'draft');
      expect(shape.form.get('other')).toBe('dot');
      const reached = graphShape([...pages, page('nested', 'guide', { isScope: true, address: 'thread:1' })], 'draft');
      expect(reached.form.get('nested')).toBe('full');
      expect(reached.level.get('nested')).toBe('scope');
    });

    it('keeps the number of far circles bounded', () => {
      const scopes = Array.from({ length: 15 }, (_, index) =>
        page(`s${String(index).padStart(2, '0')}`, 'guide', { isScope: true, address: `thread:${index}` }),
      );
      const shape = graphShape([...pages, ...scopes], 'draft');
      // The path up (blog, site) counts against the cap with the scopes.
      const circles = ['blog', 'site', ...scopes.map(scope => scope.id)].filter(id => shape.form.get(id) === 'full');
      expect(circles).toHaveLength(HIGHER_LEVEL_CAP);
    });
  });

  describe('when a dot is focused', () => {
    it('grows it into a full circle, keeping the pages above it as circles', () => {
      const shape = graphShape(pages, 'draft');
      expect(shape.form.get('draft')).toBe('full');
      expect(shape.form.get('post-1')).toBe('full');
      // Two links up, so no longer a neighbour, but still above the focus: a circle, not a dot.
      expect(shape.form.get('blog')).toBe('full');
      expect(shape.level.get('blog')).toBe('ancestor');
    });
  });

  describe('when a page with no children is focused', () => {
    const siblings = Array.from({ length: 12 }, (_, index) =>
      page(`s${String(index).padStart(2, '0')}`, 'blog', { childCount: 2 }),
    );
    const leaf = page('leaf', 'blog', { childCount: 0 });
    const shape = graphShape([...pages, leaf, ...siblings], 'leaf');

    it('draws its first siblings as circles, the rest as dots', () => {
      // The blog's other children (post-1, post-2) come first in position order and take two of the slots.
      const circles = ['post-1', 'post-2', ...siblings.map(sibling => sibling.id)].filter(
        id => shape.form.get(id) === 'full',
      );
      expect(circles).toEqual(['post-1', 'post-2', 's00', 's01', 's02', 's03', 's04', 's05']);
      expect(circles).toHaveLength(ROOT_CIRCLE_CAP);
      expect(shape.form.get('s11')).toBe('dot');
      expect(shape.form.get('leaf')).toBe('full');
    });

    it('leaves a focus that has children with just its own children as circles', () => {
      const parent = graphShape([...pages, leaf, ...siblings], 'blog');
      expect(parent.form.get('s00')).toBe('full');
      expect(parent.form.get('draft')).toBe('dot');
      const nested = graphShape(pages, 'post-1');
      expect(nested.form.get('post-2')).toBe('dot');
    });
  });

  describe('when nothing is focused', () => {
    it('centres on the only root scope', () => {
      const shape = graphShape(pages, null);
      expect(shape.center).toBe('site');
      expect(shape.form.get('blog')).toBe('full');
      expect(shape.form.get('post-1')).toBe('dot');
    });

    it('centres on the first root and draws the other roots beside its children, as circles', () => {
      const shape = graphShape([...pages, page('other', null, { address: 'resource:docs', position: 'z' })], null);
      expect(shape.center).toBe('site');
      expect(shape.depth.get('other')).toBe(1);
      expect(shape.form.get('other')).toBe('full');
      expect(shape.form.get('blog')).toBe('full');
      expect(shape.form.get('post-1')).toBe('dot');
    });

    it('draws every child of the first root as a circle, as it would for a focused scope', () => {
      const many = Array.from({ length: 12 }, (_, index) => page(`c${String(index).padStart(2, '0')}`, 'site'));
      const unfocused = graphShape([...pages, ...many], null);
      const focused = graphShape([...pages, ...many], 'site');
      expect(many.every(child => unfocused.form.get(child.id) === 'full')).toBe(true);
      expect([...unfocused.form]).toEqual([...focused.form]);
    });
  });

  it('puts the other roots one link out even when the first root has a parent that is not loaded', () => {
    const pages = [
      page('a', 'cut-off', { position: 'a' }),
      page('b', null, { position: 'b' }),
      page('c', null, { position: 'c' }),
    ];
    const shape = graphShape(pages, null);
    expect(shape.center).toBe('a');
    expect(shape.depth.get('b')).toBe(1);
    expect(shape.depth.get('c')).toBe(1);
    expect(shape.form.get('b')).toBe('full');
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

  describe('when the focus links to pages the hierarchy does not reach', () => {
    const strays = Array.from({ length: 9 }, (_, index) => page(`stray-${index}`, 'elsewhere'));
    const faraway = page('faraway', 'elsewhere');
    const all = [...pages, ...strays, faraway];
    const near = new Set(strays.map(stray => stray.id));
    const shape = graphShape(all, 'blog', near);
    const sizeOf = (p: KnowledgePagePayload) => (shape.form.get(p.id) === 'full' ? 108 : 20);
    const positions = radialLayout(all, shape, sizeOf, near);
    const at = (id: string) => positions.get(id) ?? { x: NaN, y: NaN };
    const gap = (a: string, b: string) =>
      Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y) - (sizeOf(byId(a)) + sizeOf(byId(b))) / 2;
    const byId = (id: string) => all.find(p => p.id === id) as KnowledgePagePayload;
    const toSegment = (id: string, from: string, to: string) => {
      const [p, a, b] = [at(id), at(from), at(to)];
      const length = Math.hypot(b.x - a.x, b.y - a.y) ** 2;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length));
      return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))) - sizeOf(byId(id)) / 2;
    };
    const ends = [...near];

    it('draws each link end as a labelled circle, like the focus children, and leaves far strays as dots', () => {
      for (const id of ends) expect(shape.form.get(id)).toBe('full');
      expect(shape.form.get('faraway')).toBe('dot');
    });

    it('keeps every circle clear of the focus, its parent, its children and each other', () => {
      for (const id of ends) {
        for (const other of ['blog', 'site', 'post-1', 'post-2', 'docs', ...ends.filter(end => end !== id)]) {
          expect(gap(id, other), `${id} vs ${other}`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('keeps them off the line from the focus to its parent and to each child', () => {
      for (const id of ends) {
        for (const to of ['site', 'post-1', 'post-2']) {
          expect(toSegment(id, 'blog', to), `${id} on blog->${to}`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('leaves them on the outer ring when they are not links of the focus', () => {
      const plain = radialLayout(all, graphShape(all, 'blog'), size);
      const far = (id: string) => Math.hypot(plain.get(id)?.x ?? 0, plain.get(id)?.y ?? 0);
      expect(far('stray-0')).toBeGreaterThan(far('draft'));
    });
  });

  describe('when the focus has children and links to pages in other branches', () => {
    // hub has 14 children, each with a grandchild (a dot), and 14 links into other branches.
    const kids = Array.from({ length: 14 }, (_, index) => page(`kid-${index}`, 'hub'));
    const grandkids = kids.map(kid => page(`${kid.id}-child`, kid.id));
    const strays = Array.from({ length: 14 }, (_, index) => page(`stray-${index}`, 'elsewhere'));
    const all = [page('site', null), page('hub', 'site'), ...kids, ...grandkids, page('elsewhere', null), ...strays];
    const near = new Set(strays.map(stray => stray.id));
    const shape = graphShape(all, 'hub', near);
    const sizeOf = (p: KnowledgePagePayload) =>
      strays.some(s => s.id === p.id) ? 86 : shape.form.get(p.id) === 'full' ? 76 : 20;
    const positions = radialLayout(all, shape, sizeOf, near);
    const at = (id: string) => positions.get(id) ?? { x: NaN, y: NaN };
    const from = (id: string) => Math.hypot(at(id).x, at(id).y);
    const reach = (id: string) => from(id) + sizeOf(all.find(p => p.id === id) as KnowledgePagePayload) / 2;

    it('puts the link ends on a ring beyond the children and the dots under them', () => {
      const inner = Math.max(...kids.map(kid => reach(kid.id)), ...grandkids.map(kid => reach(kid.id)));
      for (const stray of strays) expect(from(stray.id) - 43, stray.id).toBeGreaterThanOrEqual(inner);
    });

    it('keeps every link end at least 16px clear of every other drawn page', () => {
      const drawn = all.filter(p => positions.has(p.id) && p.id !== 'elsewhere');
      for (const stray of strays) {
        for (const other of drawn.filter(p => p.id !== stray.id)) {
          const gap =
            Math.hypot(at(stray.id).x - at(other.id).x, at(stray.id).y - at(other.id).y) - (86 + sizeOf(other)) / 2;
          expect(gap, `${stray.id} vs ${other.id}`).toBeGreaterThanOrEqual(other.id.startsWith('stray') ? 16 : 0);
        }
      }
    });

    it('leaves the children ring where it was', () => {
      const without = radialLayout(all, graphShape(all, 'hub'), sizeOf);
      for (const kid of kids) expect(positions.get(kid.id)).toEqual(without.get(kid.id));
    });
  });

  describe('when the focus has no children but links to pages in other branches', () => {
    const strays = Array.from({ length: 4 }, (_, index) => page(`stray-${index}`, 'elsewhere'));
    const all = [page('site', null), page('ward', 'site'), page('elsewhere', null), ...strays];
    const near = new Set(strays.map(stray => stray.id));
    const shape = graphShape(all, 'ward', near);
    const positions = radialLayout(all, shape, p => (strays.some(s => s.id === p.id) ? 86 : 76), near);

    it('keeps them on a ring close around it, not floating far off', () => {
      for (const stray of strays) {
        const { x, y } = positions.get(stray.id) ?? { x: NaN, y: NaN };
        expect(Math.hypot(x, y), stray.id).toBeLessThan(300);
      }
    });
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

  it("draws the top level exactly as it draws a focus on the first root's scope, with the same hidden count past the cap", () => {
    const kids = Array.from({ length: 60 }, (_, index) =>
      page(`k${String(index).padStart(2, '0')}`, 'site', { childCount: 3 }),
    );
    const input = { ...base, pages: [page('site', null, { address: 'site:mastra', childCount: 60 }), ...kids] };
    const loaded = new Set(['', 'site']);
    const none = lazyGraph({ ...input, loadedParents: loaded, focusId: null });
    const scope = lazyGraph({ ...input, loadedParents: loaded, focusId: 'site' });
    const shapeOf = (graph: typeof none, focus: string | null) => {
      const shape = graphShape(graph.pages, focus ?? graph.hub);
      return { center: shape.center, form: [...shape.form], depth: [...shape.depth] };
    };
    expect(none.hub).toBe('site');
    expect(none.pages.map(p => p.id)).toEqual(scope.pages.map(p => p.id));
    expect(shapeOf(none, null)).toEqual(shapeOf(scope, 'site'));
    // Past GRAPH_CHILD_CAP the rest is one "+N more" circle on the hub, not a fetch of the whole tree.
    const rest = none.pages.find(isRestCircle);
    expect(rest?.name).toBe(`+${60 - GRAPH_CHILD_CAP} more`);
    expect(none.wanted.length).toBeLessThanOrEqual(WANTED_CIRCLE_CAP + 2);
  });

  it("with nothing focused, draws the roots, their first children, and those children's own children", () => {
    const kids = Array.from({ length: 12 }, (_, index) =>
      page(`k${String(index).padStart(2, '0')}`, 'site', { childCount: 2 }),
    );
    const grand = page('g', 'k00');
    const graph = lazyGraph({
      ...base,
      pages: [
        page('site', null, { address: 'site:mastra', childCount: 12, position: 'a' }),
        page('other', null, { position: 'b' }),
        ...kids,
        grand,
      ],
      loadedParents: new Set(['', 'site', 'other', 'k00']),
      focusId: null,
    });
    const ids = graph.pages.map(p => p.id);
    expect(ids).toContain('g');
    // Every child of the first root is a circle, so each one that has not loaded stands in dots for its children.
    expect(graph.hub).toBe('site');
    expect(graph.pages.filter(p => isChildPlaceholder(p) && p.parentId === 'k11')).toHaveLength(2);
    expect(graph.pages.filter(p => isChildPlaceholder(p) && p.parentId === 'k01')).toHaveLength(2);
    expect(graph.wanted).toEqual(expect.arrayContaining(['site', 'other', 'k00', 'k01', 'k11']));
  });

  it("with a childless page focused, stands in its siblings' children as dots", () => {
    const siblings = Array.from({ length: 10 }, (_, index) =>
      page(`s${String(index).padStart(2, '0')}`, 'blog', { childCount: 3 }),
    );
    const graph = lazyGraph({
      ...base,
      pages: [
        page('site', null),
        page('blog', 'site', { childCount: 11 }),
        page('leaf', 'blog', { childCount: 0 }),
        ...siblings,
      ],
      loadedParents: new Set(['', 'site', 'blog', 'leaf']),
      focusId: 'leaf',
    });
    const standIns = (parent: string) => graph.pages.filter(p => isChildPlaceholder(p) && p.parentId === parent);
    expect(standIns('s00')).toHaveLength(3);
    expect(standIns('s09')).toHaveLength(0);
    expect(graph.wanted).toEqual(expect.arrayContaining(['leaf', 'blog', 's00']));
    expect(graph.wanted).not.toContain('s09');
  });

  it('caps the children it draws and counts the rest', () => {
    const many = Array.from({ length: 60 }, (_, index) => page(`p${String(index).padStart(2, '0')}`, 'blog'));
    const graph = lazyGraph({
      ...base,
      pages: [page('site', null), page('blog', 'site', { childCount: 60 }), ...many],
      loadedParents: new Set(['', 'site', 'blog']),
      focusId: 'blog',
    });
    expect(graph.hiddenChildren.get('blog')).toEqual({ hidden: 60 - GRAPH_CHILD_CAP, drawn: GRAPH_CHILD_CAP });
    const rest = graph.pages.find(isRestCircle);
    expect(rest?.name).toBe(`+${60 - GRAPH_CHILD_CAP} more`);
    expect(rest?.parentId).toBe('blog');
  });

  it('draws a batch more children for each reveal, and drops the rest circle once all are drawn', () => {
    const many = Array.from({ length: 60 }, (_, index) => page(`p${String(index).padStart(2, '0')}`, 'blog'));
    const input = {
      ...base,
      pages: [page('site', null), page('blog', 'site', { childCount: 60 }), ...many],
      loadedParents: new Set(['', 'site', 'blog']),
      focusId: 'blog',
    };
    const kids = (graph: ReturnType<typeof lazyGraph>) =>
      graph.pages.filter(candidate => candidate.parentId === 'blog' && !isRestCircle(candidate)).length;
    const once = lazyGraph({ ...input, revealed: new Map([['blog', REST_BATCH]]) });
    expect(kids(once)).toBe(GRAPH_CHILD_CAP + REST_BATCH);
    expect(once.pages.find(isRestCircle)).toBeUndefined();
    const part = lazyGraph({ ...input, cap: 40, revealed: new Map([['blog', 5]]) });
    expect(kids(part)).toBe(45);
    expect(part.pages.find(isRestCircle)?.name).toBe('+15 more');
  });

  it('collapses sibling memory scopes into one circle per type until opened, but not under the focus', () => {
    const threads = Array.from({ length: 5 }, (_, index) =>
      page(`t${index}`, 'resource', { isScope: true, address: `thread:${index}` }),
    );
    const input = {
      ...base,
      pages: [
        page('site', null, { position: 'a' }),
        page('resource', null, { address: 'resource:docs', position: 'b' }),
        ...threads,
      ],
      loadedParents: new Set(['', 'site', 'resource']),
      focusId: null,
    };
    const collapsed = lazyGraph(input);
    const groups = collapsed.pages.filter(isScopeGroup);
    expect(groups.map(p => p.name)).toEqual(['5 thread scopes']);
    expect(collapsed.pages.some(p => p.id === 't0')).toBe(false);

    const opened = lazyGraph({ ...input, openGroups: new Set([groups[0]?.id]) });
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
    const kids = Array.from({ length: 40 }, (_, index) =>
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

describe('crowdScale', () => {
  it('leaves a ring that fits at full size', () => {
    expect(crowdScale(1)).toBe(1);
    expect(crowdScale(CROWD_START)).toBe(1);
  });

  it('shrinks a crowded ring, but never below the smallest size', () => {
    expect(crowdScale(CROWD_START * 2)).toBeLessThan(1);
    expect(crowdScale(45)).toBeGreaterThanOrEqual(CROWD_MIN_SCALE);
    expect(crowdScale(10_000)).toBe(CROWD_MIN_SCALE);
  });
});

describe('readable framing', () => {
  it('draws up to 48 children as circles and counts the rest', () => {
    const many = Array.from({ length: 60 }, (_, index) => page(`p${String(index).padStart(2, '0')}`, 'blog'));
    const graph = lazyGraph({
      rootKey: '',
      openGroups: new Set<string>(),
      pages: [page('site', null), page('blog', 'site', { childCount: 60 }), ...many],
      loadedParents: new Set(['', 'site', 'blog']),
      focusId: 'blog',
    });
    const circles = graph.pages.filter(candidate => candidate.parentId === 'blog' && !isRestCircle(candidate));
    expect(circles).toHaveLength(GRAPH_CHILD_CAP);
    expect(graph.pages.find(isRestCircle)?.name).toBe(`+${60 - GRAPH_CHILD_CAP} more`);
  });

  it('staggers 45 circles over rows so all of them stay within reach of the centre at the readable zoom', () => {
    const kids = Array.from({ length: 45 }, (_, index) =>
      page(`c${index}`, 'hub', { position: `a${String(index).padStart(2, '0')}` }),
    );
    const all = [page('hub', null), ...kids];
    const positions = radialLayout(all, graphShape(all, 'hub'), () => 76);
    const farthest = Math.max(
      ...kids.map(kid => Math.hypot(positions.get(kid.id)?.x ?? 0, positions.get(kid.id)?.y ?? 0)),
    );
    // A pane 900px tall shows 450 / READABLE_MIN_ZOOM of the graph either side of the centre.
    expect(farthest + 76 / 2).toBeLessThan(450 / READABLE_MIN_ZOOM);
    const rings = new Set(
      kids.map(kid => Math.round(Math.hypot(positions.get(kid.id)?.x ?? 0, positions.get(kid.id)?.y ?? 0))),
    );
    expect(rings.size).toBeGreaterThan(1);
  });

  it('never frames the graph below a zoom at which circle names can be read', () => {
    expect(READABLE_MIN_ZOOM).toBeGreaterThanOrEqual(0.7);
  });
});
