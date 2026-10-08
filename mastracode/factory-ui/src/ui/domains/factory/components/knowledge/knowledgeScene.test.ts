import { describe, expect, it } from 'vitest';
import type { KnowledgeGraphNode, KnowledgeGraphPayload } from '../../services/knowledge';
import { NO_FILTERS } from './graphModel';
import { isKnowledgeNode } from './knowledgeStyles';
import {
  createKnowledgeScene,
  getVisibleKnowledgeIds,
  presentKnowledgeEdges,
  presentKnowledgeNodes,
} from './knowledgeScene';

function node(id: string): KnowledgeGraphNode {
  return {
    id,
    name: id,
    kind: 'service',
    scope: ['resource:project'],
    rung: 'resource',
    pinned: false,
    recordCount: 2,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

const payload: KnowledgeGraphPayload = {
  view: 'project',
  nodes: [node('a'), node('b'), node('c')],
  edges: [],
  records: [{ id: 'ab', nodeIds: ['a', 'b'], text: 'related', pinned: true }],
  truncated: false,
  outOfWindow: [],
  unresolvedCapped: { count: 0, names: [] },
  pinCensus: { resource: 1, thread: null },
  version: 'v1',
};

describe('knowledge scene interactions', () => {
  it('focuses a neighborhood without removing nodes, moving them or changing their sizes', () => {
    const scene = createKnowledgeScene(payload);
    const visibleIds = getVisibleKnowledgeIds(payload, NO_FILTERS, 'a');
    const focused = presentKnowledgeNodes(scene.nodes, visibleIds, { nodeId: 'a' });
    expect(focused.map(node => node.id)).toEqual(scene.nodes.map(node => node.id));
    for (const node of focused) {
      const before = scene.nodes.find(before => before.id === node.id)!;
      expect(node.position).toBe(before.position);
      expect(node.data.size).toBe(before.data.size);
    }
    expect(focused.find(node => node.id === 'c')?.focusable).toBe(false);
    expect(focused.find(node => node.id === 'a')?.selected).toBe(true);
    expect(focused.find(node => node.id === 'record:ab')?.focusable).toBe(true);
    const restored = presentKnowledgeNodes(focused, getVisibleKnowledgeIds(payload, NO_FILTERS), {});
    expect(restored.every(node => node.focusable)).toBe(true);
    expect(restored.every(node => !node.selected)).toBe(true);
  });

  it('keeps a dragged position through updated data and new arrivals', () => {
    const scene = createKnowledgeScene(payload);
    const dragged = scene.nodes.map(node => (node.id === 'a' ? { ...node, position: { x: 800, y: 500 } } : node));
    const updated = createKnowledgeScene({ ...payload, nodes: [...payload.nodes, node('d')] }, dragged);
    for (const node of dragged) {
      expect(updated.nodes.find(next => next.id === node.id)?.position).toEqual(node.position);
    }
    const arrival = updated.nodes.find(node => node.id === 'd')!;
    expect(Number.isFinite(arrival.position.x)).toBe(true);
    expect(Number.isFinite(arrival.position.y)).toBe(true);
  });

  it('preserves unchanged renderer references when presentation is already synchronized', () => {
    const scene = createKnowledgeScene(payload);
    const visibleIds = getVisibleKnowledgeIds(payload, NO_FILTERS);
    const presented = presentKnowledgeNodes(scene.nodes, visibleIds, {});
    const repeated = presentKnowledgeNodes(presented, visibleIds, {});
    expect(repeated.every((node, index) => node === presented[index])).toBe(true);
    const edges = presentKnowledgeEdges(scene.edges, visibleIds);
    expect(presentKnowledgeEdges(edges, visibleIds).every((edge, index) => edge === edges[index])).toBe(true);
  });

  it('falls back to the full filtered view for a stale focus and retains pinned relationship markers', () => {
    const filtered = { rungs: new Set(['resource'] as const), pinnedOnly: true };
    expect(getVisibleKnowledgeIds(payload, filtered, 'missing')).toEqual(new Set(['a', 'b', 'record:ab']));
  });

  it('refreshes domain data without overwriting current node positions', () => {
    const scene = createKnowledgeScene(payload);
    const updatedNode = { ...payload.nodes[0]!, name: 'Renamed service' };
    const updated = createKnowledgeScene({ ...payload, nodes: [updatedNode, ...payload.nodes.slice(1)] }, scene.nodes);
    const first = updated.nodes.find(node => node.id === 'a');
    expect(first && isKnowledgeNode(first) && first.data.node.name).toBe('Renamed service');
    expect(updated.nodes.map(node => node.position)).toEqual(scene.nodes.map(node => node.position));
  });
});
