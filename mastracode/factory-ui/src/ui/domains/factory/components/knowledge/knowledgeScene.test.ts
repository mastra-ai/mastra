import { describe, expect, it } from 'vitest';
import type { KnowledgeGraphNode, KnowledgeGraphPayload } from '../../services/knowledge';
import { NO_FILTERS } from './graphModel';
import { isKnowledgeNode } from './knowledgeStyles';
import { createKnowledgeScene, getVisibleKnowledgeIds, getKnowledgeArrivalScene } from './knowledgeScene';

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
  it('derives a focused neighborhood without changing the domain payload', () => {
    const before = structuredClone(payload);
    expect(getVisibleKnowledgeIds(payload, NO_FILTERS, 'a')).toEqual(new Set(['a', 'b', 'record:ab']));
    expect(payload).toEqual(before);
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

  it('keeps node and edge data references stable through arrival presentation', () => {
    const scene = createKnowledgeScene(payload);
    const arrived = getKnowledgeArrivalScene(scene, { nodes: new Set(['a']), edges: new Set() });
    const repeated = getKnowledgeArrivalScene(arrived, { nodes: new Set(['a']), edges: new Set() });
    expect(repeated.nodes.every((node, index) => node === arrived.nodes[index])).toBe(true);
    expect(repeated.edges.every((edge, index) => edge === scene.edges[index])).toBe(true);
    expect(arrived.nodes.every((node, index) => node.data === scene.nodes[index]!.data)).toBe(true);
    expect(arrived.nodes.every((node, index) => node.position === scene.nodes[index]!.position)).toBe(true);
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
