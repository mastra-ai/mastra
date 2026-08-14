import { describe, expect, it } from 'vitest';

import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '../../services/knowledge';
import {
  degreeMap,
  deriveMemoryElements,
  egoGraph,
  filterGraph,
  MEMORY_DOT_SIZE,
  MEMORY_JUNCTION_SIZE,
  MEMORY_PIN_SIZE,
  memoryPairEdges,
  NODE_SIZE_DOT,
  NODE_SIZE_MAX,
  NODE_SIZE_MIN,
  nodeSize,
  shouldShowLabel,
  toFlowGraph,
  weightedDegree,
} from './graphModel';
import { runLayout } from './layout';

function entity(id: string, overrides: Partial<KnowledgeGraphNode> = {}): KnowledgeGraphNode {
  return {
    id,
    name: `Entity ${id}`,
    kind: 'concept',
    scope: ['org:o', 'resource:r'],
    rung: 'resource',
    pinned: false,
    factCount: 1,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

function edge(source: string, target: string, type: 'wikilink' = 'wikilink'): KnowledgeGraphEdge {
  return { id: `${type}:${source}:${target}`, source, target, type, factId: 'f-1' };
}

describe('nodeSize (Amendments A3 + A5)', () => {
  it('weights incoming edges heavier than outgoing', () => {
    expect(nodeSize({ incoming: 4, outgoing: 0 }, 8)).toBeGreaterThan(nodeSize({ incoming: 1, outgoing: 4 }, 8));
  });

  it('anchors the most-connected node at max size and scales proportionally', () => {
    const max = weightedDegree({ incoming: 10, outgoing: 0 });
    expect(nodeSize({ incoming: 10, outgoing: 0 }, max)).toBe(NODE_SIZE_MAX);
    const half = nodeSize({ incoming: 5, outgoing: 0 }, max);
    expect(half - NODE_SIZE_MIN).toBe((NODE_SIZE_MAX - NODE_SIZE_MIN) / 2);
  });

  it('is monotonic in degree', () => {
    let previous = 0;
    for (let incoming = 1; incoming <= 8; incoming++) {
      const size = nodeSize({ incoming, outgoing: 0 }, 16);
      expect(size).toBeGreaterThanOrEqual(previous);
      previous = size;
    }
  });

  it('clamps at both ends', () => {
    expect(nodeSize({ incoming: 1, outgoing: 0 }, 1000)).toBeGreaterThanOrEqual(NODE_SIZE_MIN);
    expect(nodeSize({ incoming: 10_000, outgoing: 10_000 }, 10)).toBe(NODE_SIZE_MAX);
  });

  it('renders unreferenced entities as small dots without labels', () => {
    expect(shouldShowLabel({ incoming: 0, outgoing: 5 })).toBe(false);
    expect(shouldShowLabel({ incoming: 1, outgoing: 0 })).toBe(true);
    expect(nodeSize({ incoming: 0, outgoing: 5 }, 10)).toBe(NODE_SIZE_DOT);
  });
});

describe('degreeMap', () => {
  it('counts incoming and outgoing separately', () => {
    const degrees = degreeMap([edge('a', 'b'), edge('c', 'b'), edge('b', 'a')]);
    expect(degrees.get('b')).toEqual({ incoming: 2, outgoing: 1 });
    expect(degrees.get('a')).toEqual({ incoming: 1, outgoing: 1 });
    expect(degrees.get('c')).toEqual({ incoming: 0, outgoing: 1 });
  });
});

describe('filterGraph', () => {
  const nodes = [
    entity('org-1', { rung: 'org', scope: ['org:o'] }),
    entity('res-1'),
    entity('res-pinned', { pinned: true }),
  ];
  const edges = [edge('org-1', 'res-1'), edge('res-1', 'res-pinned')];

  it('shows everything with no filters', () => {
    const result = filterGraph(nodes, edges, { rungs: new Set(), pinnedOnly: false });
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });

  it('filters by rung and drops edges to hidden nodes', () => {
    const result = filterGraph(nodes, edges, { rungs: new Set(['resource'] as const), pinnedOnly: false });
    expect(result.nodes.map(node => node.id)).toEqual(['res-1', 'res-pinned']);
    expect(result.edges.map(e => e.id)).toEqual(['wikilink:res-1:res-pinned']);
  });

  it('pin filter keeps only accented entities', () => {
    const result = filterGraph(nodes, edges, { rungs: new Set(), pinnedOnly: true });
    expect(result.nodes.map(node => node.id)).toEqual(['res-pinned']);
    expect(result.edges).toHaveLength(0);
  });

  it('pin filter keeps the endpoints of a pinned edge (A9: pins mark relationships)', () => {
    const pinnedEdge: KnowledgeGraphEdge = { ...edge('org-1', 'res-1'), pinned: true };
    const result = filterGraph(nodes, [pinnedEdge], { rungs: new Set(), pinnedOnly: true });
    expect(result.nodes.map(node => node.id).sort()).toEqual(['org-1', 'res-1', 'res-pinned']);
    expect(result.edges).toEqual([pinnedEdge]);
  });

  it('pin filter keeps entities touched by pinned memories via pair edges (A11)', () => {
    const pairs = memoryPairEdges([{ id: 'm1', entityIds: ['org-1', 'res-1'], pinned: true, text: 'pinned link' }]);
    const result = filterGraph(nodes, pairs, { rungs: new Set(), pinnedOnly: true });
    expect(result.nodes.map(node => node.id).sort()).toEqual(['org-1', 'res-1', 'res-pinned']);
  });

  it('maps the pinned flag onto flow edges (A9)', () => {
    const flow = toFlowGraph(nodes, [{ ...edge('org-1', 'res-1'), pinned: true }, edge('res-1', 'res-pinned')]);
    expect(flow.edges.map(e => e.data?.pinned)).toEqual([true, false]);
  });
});

describe('deriveMemoryElements (Amendment A11)', () => {
  const mem = (id: string, entityIds: string[], pinned = false) => ({ id, entityIds, pinned, text: `memory ${id}` });

  it('renders a single-entity memory as a dot with a hugging stub edge, entity as the edge source', () => {
    const owner = entity('a', { factCount: 3 });
    const { memoryNodes, memoryEdges } = deriveMemoryElements([owner], [mem('m1', ['a'])]);
    expect(memoryNodes).toEqual([expect.objectContaining({ id: 'mem:m1', kind: 'dot', size: MEMORY_DOT_SIZE })]);
    expect(memoryEdges).toEqual([expect.objectContaining({ id: 'mem:m1:stub', source: 'a', target: 'mem:m1' })]);
  });

  it("suppresses the dot when an unpinned memory is its entity's only fact — the circle IS the memory", () => {
    const owner = entity('a', { factCount: 1 });
    const { memoryNodes, memoryEdges } = deriveMemoryElements([owner], [mem('m1', ['a'])]);
    expect(memoryNodes).toHaveLength(0);
    expect(memoryEdges).toHaveLength(0);
  });

  it("renders a pinned single-entity memory as the pin chip even on a one-fact entity", () => {
    const owner = entity('a', { factCount: 1 });
    const { memoryNodes } = deriveMemoryElements([owner], [mem('m1', ['a'], true)]);
    expect(memoryNodes).toEqual([expect.objectContaining({ kind: 'dot', size: MEMORY_PIN_SIZE })]);
  });

  it('renders a two-entity memory as the connecting line — the memory IS the edge', () => {
    const { memoryNodes, memoryEdges } = deriveMemoryElements(
      [entity('a'), entity('b')],
      [mem('m1', ['a', 'b'])],
    );
    expect(memoryNodes).toHaveLength(0);
    expect(memoryEdges).toEqual([expect.objectContaining({ id: 'mem:m1', source: 'a', target: 'b' })]);
  });

  it('renders a PINNED two-entity memory as a midpoint junction so the chip is collision-protected', () => {
    const { memoryNodes, memoryEdges } = deriveMemoryElements(
      [entity('a'), entity('b')],
      [mem('m1', ['a', 'b'], true)],
    );
    expect(memoryNodes).toEqual([expect.objectContaining({ kind: 'junction', size: MEMORY_PIN_SIZE })]);
    expect(memoryEdges.map(edge => [edge.source, edge.target])).toEqual([
      ['a', 'mem:m1'],
      ['b', 'mem:m1'],
    ]);
  });

  it('renders a 3+-entity memory as a junction splitting to each entity', () => {
    const { memoryNodes, memoryEdges } = deriveMemoryElements(
      [entity('a'), entity('b'), entity('c')],
      [mem('m1', ['a', 'b', 'c'])],
    );
    expect(memoryNodes).toEqual([
      expect.objectContaining({ id: 'mem:m1', kind: 'junction', size: MEMORY_JUNCTION_SIZE }),
    ]);
    expect(memoryEdges).toHaveLength(3);
  });

  it('drops memories touching entities outside the visible set (filter/ego safety)', () => {
    const { memoryNodes, memoryEdges } = deriveMemoryElements([entity('a')], [mem('m1', ['a', 'ghost'])]);
    expect(memoryNodes).toHaveLength(0);
    expect(memoryEdges).toHaveLength(0);
  });

  it('memoryPairEdges emits per-fact owner→target pairs carrying the pin flag', () => {
    const pairs = memoryPairEdges([mem('m1', ['a', 'b', 'c'], true), mem('m2', ['a'])]);
    expect(pairs.map(pair => [pair.source, pair.target, pair.pinned])).toEqual([
      ['a', 'b', true],
      ['a', 'c', true],
    ]);
  });
});

describe('egoGraph (Amendment A5)', () => {
  it('keeps only the focused node and its direct neighbors', () => {
    const nodes = [entity('a'), entity('b'), entity('c'), entity('d')];
    const edges = [edge('a', 'b'), edge('c', 'b'), edge('c', 'd')];
    const result = egoGraph(nodes, edges, 'b');
    expect(result.nodes.map(node => node.id).sort()).toEqual(['a', 'b', 'c']);
    expect(result.edges.map(e => e.id).sort()).toEqual(['wikilink:a:b', 'wikilink:c:b']);
  });

  it('keeps the full entity set of a junction memory touching the focus', () => {
    // A 3+-entity memory is one neighborhood: dropping any of its entities
    // makes deriveMemoryElements discard the memory, stranding a neighbor
    // with no visible connection (the far-left orphan bug).
    const nodes = [entity('a'), entity('b'), entity('c'), entity('d'), entity('e')];
    const memories = [{ id: 'm1', entityIds: ['b', 'a', 'c', 'd'], pinned: false, text: 'memory m1' }];
    const edges = memoryPairEdges(memories);
    const result = egoGraph(nodes, edges, 'a', memories);
    expect(result.nodes.map(node => node.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('toFlowGraph', () => {
  it('maps entities to sized flow nodes and typed edges', () => {
    const { nodes, edges } = toFlowGraph(
      [entity('a'), entity('b')],
      [edge('a', 'b'), edge('b', 'a')],
    );
    expect(nodes[0]).toMatchObject({ id: 'a', type: 'knowledgeEntity' });
    expect(nodes[0]!.data.size).toBeGreaterThanOrEqual(NODE_SIZE_MIN);
    expect(edges.map(e => e.data?.linkType)).toEqual(['wikilink', 'wikilink']);
    expect(edges.every(e => e.type === 'knowledgeLink')).toBe(true);
  });

  it('converts layout centers to top-left React Flow positions', () => {
    const positions = new Map([['a', { x: 10, y: 20 }]]);
    const { nodes } = toFlowGraph([entity('a')], [], positions);
    // 'a' is an unreferenced dot (size 26): top-left = center - 13.
    expect(nodes[0]!.data.size).toBe(NODE_SIZE_DOT);
    expect(nodes[0]!.position).toEqual({ x: 10 - 13, y: 20 - 13 });
  });

  it('forces the focused node to max size and labels it even with zero incoming', () => {
    const { nodes } = toFlowGraph([entity('a'), entity('b')], [edge('a', 'b')], undefined, 'a');
    const focused = nodes.find(node => node.id === 'a')!;
    expect(focused.data.size).toBe(NODE_SIZE_MAX);
    expect(focused.data.focused).toBe(true); // 'a' has 0 incoming — focus labels it anyway
    expect(nodes.find(node => node.id === 'b')!.data.focused).toBe(false);
  });
});

describe('runLayout', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(id => ({ id, size: 44 }));
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  it('is deterministic for identical input', () => {
    const first = runLayout(nodes, edges);
    const second = runLayout(nodes, edges);
    expect(Object.fromEntries(first)).toEqual(Object.fromEntries(second));
  });

  it('is insensitive to node insertion order', () => {
    const shuffled = [...nodes].reverse();
    expect(Object.fromEntries(runLayout(shuffled, edges))).toEqual(Object.fromEntries(runLayout(nodes, edges)));
  });

  it('separates nodes (no overlap after settling)', () => {
    const mixed = [
      { id: 'hub', size: 176 },
      { id: 'a', size: 52 },
      { id: 'b', size: 96 },
      { id: 'c', size: 26 },
      { id: 'd', size: 26 },
    ];
    const dense = [
      { source: 'hub', target: 'a' },
      { source: 'hub', target: 'b' },
      { source: 'hub', target: 'c' },
      { source: 'a', target: 'b' },
    ];
    const positions = runLayout(mixed, dense);
    for (let i = 0; i < mixed.length; i++) {
      for (let j = i + 1; j < mixed.length; j++) {
        const p1 = positions.get(mixed[i]!.id)!;
        const p2 = positions.get(mixed[j]!.id)!;
        const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        // Every pair clears the sum of radii — no node sits inside another.
        expect(distance).toBeGreaterThan(mixed[i]!.size / 2 + mixed[j]!.size / 2);
      }
    }
  });

  it('respects pinned (dragged) positions', () => {
    const pinned = [{ id: 'a', size: 44, fixed: { x: 500, y: -500 } }, ...nodes.slice(1)];
    const positions = runLayout(pinned, edges);
    expect(positions.get('a')).toEqual({ x: 500, y: -500 });
  });

  it('position capture: a fully-fixed node set comes back exactly where it settled', () => {
    // Re-running the layout with every node fixed at its settled position
    // must be a no-op — polls and filter toggles on unchanged data never
    // rearrange the graph.
    const settled = runLayout(nodes, edges);
    const fixedNodes = nodes.map(node => ({ ...node, fixed: settled.get(node.id) }));
    const rerun = runLayout(fixedNodes, edges);
    for (const node of nodes) expect(rerun.get(node.id)).toEqual(settled.get(node.id));
  });
});
