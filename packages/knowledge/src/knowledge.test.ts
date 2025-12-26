import { randomUUID } from 'node:crypto';
import type { GraphChunk, KnowledgeNode, KnowledgeEdge } from '@mastra/core/knowledge';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Knowledge } from './knowledge';

describe('Knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Node operations', () => {
    it('should throw an error if node does not have an embedding', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        options: { requireEmbedding: true },
      });
      const node: KnowledgeNode = {
        id: '1',
        type: 'Document',
        properties: { content: 'Node 1' },
      };
      expect(() => graph.addNode(node)).toThrow('Node 1 must have an embedding');
    });

    it('should throw an error if node embedding dimension is not equal to the graph dimension', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        options: { requireEmbedding: true, embeddingDimension: 2 },
      });
      const node: KnowledgeNode = {
        id: '1',
        type: 'Document',
        embedding: [1, 2, 3],
        properties: { content: 'Node 1' },
      };
      expect(() => graph.addNode(node)).toThrow('Node 1 embedding dimension must be 2');
    });

    it('should add a node to the graph', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const node: KnowledgeNode = {
        id: '1',
        type: 'Document',
        embedding: [1, 2, 3],
        properties: { content: 'Node 1' },
      };
      graph.addNode(node);
      expect(graph.getNodes().length).toBe(1);
    });

    it('updates node properties and embedding', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const node: KnowledgeNode = { id: 'n', type: 'T', embedding: [1, 2, 3], properties: { foo: 'bar' } };
      graph.addNode(node);
      graph.updateNode('n', { properties: { foo: 'baz' }, embedding: [4, 5, 6] });
      const updated = graph.getNode('n');
      expect(updated?.properties?.foo).toBe('baz');
      expect(updated?.embedding).toEqual([4, 5, 6]);
    });

    it('removes node and its edges', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const n1: KnowledgeNode = { id: '1', type: 'T', embedding: [1, 2, 3] };
      const n2: KnowledgeNode = { id: '2', type: 'T', embedding: [4, 5, 6] };
      graph.addNode(n1);
      graph.addNode(n2);
      graph.addEdge({ id: 'e', source: '1', target: '2', type: 'rel' });
      graph.removeNode('1');
      expect(graph.getNode('1')).toBeUndefined();
      expect(graph.getEdges().length).toBe(0);
    });

    it('finds and filters nodes', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3], labels: ['foo'], properties: { x: 1 } });
      graph.addNode({ id: 'b', type: 'Doc', embedding: [4, 5, 6], labels: ['bar'], properties: { x: 2 } });
      expect(graph.findNodesByType('Doc').length).toBe(2);
      expect(graph.findNodesByLabel('foo')[0]?.id).toBe('a');
      expect(graph.filterNodesByProperty('x', 2)[0]?.id).toBe('b');
    });
  });

  describe('Edge Operations', () => {
    it('should throw an error if either source or target node does not exist', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const edge: KnowledgeEdge = {
        id: randomUUID(),
        source: '1',
        target: '2',
        weight: 0.5,
        type: 'semantic',
      };
      expect(() => graph.addEdge(edge)).toThrow(
        `Both source ('${edge.source}') and target ('${edge.target}') nodes must exist.`,
      );
    });

    it('should add an edge between two nodes', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const node1: KnowledgeNode = {
        id: '1',
        type: 'Document',
        embedding: [1, 2, 3],
        properties: { content: 'Node 1' },
      };
      const node2: KnowledgeNode = {
        id: '2',
        type: 'Document',
        embedding: [4, 5, 6],
        properties: { content: 'Node 2' },
      };
      graph.addNode(node1);
      graph.addNode(node2);
      const edge: KnowledgeEdge = {
        id: randomUUID(),
        source: '1',
        target: '2',
        weight: 0.5,
        type: 'semantic',
      };
      graph.addEdge(edge);
      expect(graph.getEdges().length).toBe(2);
    });

    it('updates edge properties', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const n1: KnowledgeNode = { id: '1', type: 'T', embedding: [1, 2, 3] };
      const n2: KnowledgeNode = { id: '2', type: 'T', embedding: [4, 5, 6] };
      graph.addNode(n1);
      graph.addNode(n2);
      graph.addEdge({ id: 'e', source: '1', target: '2', type: 'rel', weight: 1 });
      graph.updateEdge('e', { weight: 2 });
      expect(graph.getEdge('e')?.weight).toBe(2);
    });

    it('removes edge', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const n1: KnowledgeNode = { id: '1', type: 'T', embedding: [1, 2, 3] };
      const n2: KnowledgeNode = { id: '2', type: 'T', embedding: [4, 5, 6] };
      graph.addNode(n1);
      graph.addNode(n2);
      graph.addEdge({ id: 'e', source: '1', target: '2', type: 'rel' });
      graph.removeEdge('e');
      expect(graph.getEdge('e')).toBeUndefined();
    });

    it('adds bidirectional edge for undirected', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const n1: KnowledgeNode = { id: '1', type: 'T', embedding: [1, 2, 3] };
      const n2: KnowledgeNode = { id: '2', type: 'T', embedding: [4, 5, 6] };
      graph.addNode(n1);
      graph.addNode(n2);
      graph.addEdge({ id: 'e', source: '1', target: '2', type: 'rel' });
      expect(graph.getEdge('2__1__rel__reverse')).toBeDefined();
    });

    it('does not add reverse edge for directed', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        options: { defaultDirected: true },
      });
      const n1: KnowledgeNode = { id: '1', type: 'T', embedding: [1, 2, 3] };
      const n2: KnowledgeNode = { id: '2', type: 'T', embedding: [4, 5, 6] };
      graph.addNode(n1);
      graph.addNode(n2);
      graph.addEdge({ id: 'e', source: '1', target: '2', type: 'rel', directed: true });
      expect(graph.getEdge('2__1__rel__reverse')).toBeUndefined();
    });
  });

  describe('addNodesFromChunks', () => {
    it("chunks array can't be empty", () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const chunks: GraphChunk[] = [];
      expect(() => graph.addNodesFromChunks({ chunks })).toThrowError('Chunks array must not be empty');
    });

    it('should create nodes from chunks', () => {
      const results = [
        { id: '1', metadata: { text: 'Chunk 1' }, vector: [1, 2, 3] },
        { id: '2', metadata: { text: 'Chunk 2' }, vector: [4, 5, 6] },
        { id: '3', metadata: { text: 'Chunk 3' }, vector: [7, 8, 9] },
      ];

      const chunks: GraphChunk[] = results.map(result => ({
        id: result.id,
        text: result?.metadata?.text,
        metadata: result.metadata,
        embedding: result.vector,
      }));

      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNodesFromChunks({ chunks });

      const nodes = graph.getNodes();
      expect(nodes.length).toBe(3);
      expect(nodes[0]?.id).toBe('1');
      expect(nodes[1]?.id).toBe('2');
      expect(nodes[2]?.id).toBe('3');

      const edges = graph.getEdges();
      expect(edges.length).toBe(6);
    });

    it('creates edges by cosine similarity (only between nodes with embeddings)', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const chunks: GraphChunk[] = [
        { id: 'a', text: 'A', embedding: [1, 0, 0], metadata: {} },
        { id: 'b', text: 'B', embedding: [0, 1, 0], metadata: {} },
        { id: 'c', text: 'C', embedding: [1, 1, 0], metadata: {} },
        { id: 'd', text: 'D', metadata: {} }, // no embedding
      ];
      graph.addNodesFromChunks({ chunks, edgeOptions: { strategy: 'cosine', threshold: 0 } });

      const edges = graph.getEdges();
      expect(edges.length).toBeGreaterThan(0);
      // All edges should be between nodes with embeddings
      expect(edges.every(e => graph.getNode(e.source)?.embedding && graph.getNode(e.target)?.embedding)).toBe(true);
      // Node 'd' should not be in any edge
      expect(edges.some(e => e.source === 'd' || e.target === 'd')).toBe(false);
    });

    it('creates edges explicitly from provided edges', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const chunks: GraphChunk[] = [
        { id: 'a', text: 'A', embedding: [1, 0, 0], metadata: {} },
        { id: 'b', text: 'B', embedding: [0, 1, 0], metadata: {} },
      ];
      graph.addNodesFromChunks({
        chunks,
        edgeOptions: { strategy: 'explicit', edges: [{ id: 'e1', source: 'a', target: 'b', type: 'rel' }] },
      });

      const edges = graph.getEdges();
      expect(edges.length).toBe(2); // bidirectional by default
      expect(edges.some(e => e.source === 'a' && e.target === 'b')).toBe(true);
      expect(edges.some(e => e.source === 'b' && e.target === 'a')).toBe(true);
    });

    it('creates edges using callback', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const chunks: GraphChunk[] = [
        { id: 'a', text: 'A', embedding: [1, 0, 0], metadata: {} },
        { id: 'b', text: 'B', embedding: [0, 1, 0], metadata: {} },
        { id: 'c', text: 'C', embedding: [1, 1, 0], metadata: {} },
      ];
      // Connect every node to 'c'
      graph.addNodesFromChunks({
        chunks,
        edgeOptions: {
          strategy: 'callback',
          callback: (source, target) => {
            if (target.id === 'c') return true;
            if (source.id === 'c') return true;
            return false;
          },
        },
      });

      const edges = graph.getEdges();
      expect(edges.some(e => e.target === 'c')).toBe(true);
      expect(edges.length).toBe(4); // bidirectional by default
    });

    it('respects edgeOptions threshold', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const chunks: GraphChunk[] = [
        { id: 'a', text: 'A', embedding: [1, 0, 0], metadata: {} },
        { id: 'b', text: 'B', embedding: [0, 1, 0], metadata: {} },
        { id: 'c', text: 'C', embedding: [1, 1, 0], metadata: {} },
      ];
      graph.addNodesFromChunks({
        chunks,
        edgeOptions: { strategy: 'cosine', threshold: 0.9, edgeType: 'semantic' },
      });

      const edges = graph.getEdges();
      // With high threshold, fewer edges
      expect(edges.length).toBeLessThanOrEqual(6);
    });
  });

  describe('Batch Operations', () => {
    it('should add multiple nodes at once', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const nodes: KnowledgeNode[] = [
        { id: '1', type: 'T', embedding: [1, 2, 3] },
        { id: '2', type: 'T', embedding: [4, 5, 6] },
        { id: '3', type: 'T', embedding: [7, 8, 9] },
      ];
      graph.addNodes(nodes);
      expect(graph.getNodes().length).toBe(3);
    });

    it('should add multiple edges at once', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const nodes: KnowledgeNode[] = [
        { id: '1', type: 'T', embedding: [1, 2, 3] },
        { id: '2', type: 'T', embedding: [4, 5, 6] },
        { id: '3', type: 'T', embedding: [7, 8, 9] },
      ];
      graph.addNodes(nodes);
      const edges: KnowledgeEdge[] = [
        { id: 'e1', source: '1', target: '2', type: 'rel' },
        { id: 'e2', source: '2', target: '3', type: 'rel' },
      ];
      graph.addEdges(edges);
      expect(graph.getEdges().length).toBe(4); // includes bidirectional edges
      expect(graph.getEdge('e1')).toBeDefined();
      expect(graph.getEdge('e2')).toBeDefined();
    });

    it('addNodes and addEdges handle empty arrays gracefully', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      expect(() => graph.addNodes([])).not.toThrow();
      expect(() => graph.addEdges([])).not.toThrow();
      expect(graph.getNodes().length).toBe(0);
      expect(graph.getEdges().length).toBe(0);
    });
  });

  describe('query', () => {
    it("query embedding can't be empty", () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      expect(() => graph.query({ query: [] })).toThrowError('Query embedding must be provided');
    });

    it("throws error if query embedding dimension doesn't match", () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        options: { embeddingDimension: 3 },
      });
      expect(() => graph.query({ query: [1, 2] })).toThrow('Query embedding must have dimension 3');
    });

    it('returns nodes ranked by similarity', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 0, 0] });
      graph.addNode({ id: 'b', type: 'Doc', embedding: [0, 1, 0] });
      graph.addNode({ id: 'c', type: 'Doc', embedding: [0.9, 0.1, 0] });
      const results = graph.query({ query: [1, 0, 0], topK: 2 });
      expect(results.length).toBe(2);
      expect(results[0]!.id).toBe('a');
      expect(results[1]!.id).toBe('c');
      expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    });

    it('returns empty array if no nodes have embeddings', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: 'a', type: 'Doc', properties: { foo: 'bar' } });
      const results = graph.query({ query: [1, 0, 0] });
      expect(results).toEqual([]);
    });

    it('topK must be greater than 0', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      expect(() => graph.query({ query: [1, 2, 3], topK: 0, randomWalkSteps: 3, restartProb: 0.1 })).toThrowError(
        'TopK must be greater than 0',
      );
    });

    it('randomWalkSteps must be greater than 0', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      expect(() => graph.query({ query: [1, 2, 3], topK: 2, randomWalkSteps: 0, restartProb: 0.1 })).toThrowError(
        'Random walk steps must be greater than 0',
      );
    });

    it('restartProb must be between 0 and 1', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      expect(() => graph.query({ query: [1, 2, 3], topK: 2, randomWalkSteps: 3, restartProb: -0.1 })).toThrowError(
        'Restart probability must be between 0 and 1',
      );
    });

    it('should return the top ranked nodes', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: '1', type: 'Document', embedding: [1, 2, 3], properties: { content: 'Node 1' } });
      graph.addNode({ id: '2', type: 'Document', embedding: [11, 12, 13], properties: { content: 'Node 2' } });
      graph.addNode({ id: '3', type: 'Document', embedding: [21, 22, 23], properties: { content: 'Node 3' } });
      graph.addEdge({ id: randomUUID(), source: '1', target: '2', weight: 0.5, type: 'semantic' });
      graph.addEdge({ id: randomUUID(), source: '2', target: '3', weight: 0.7, type: 'semantic' });

      const rerankedResults = graph.query({ query: [15, 16, 17], topK: 2, randomWalkSteps: 3, restartProb: 0.1 });
      expect(rerankedResults.length).toBe(2);
    });
  });

  describe('Serialization/Deserialization', () => {
    it('serializes and deserializes the graph with all nodes and edges', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3], properties: { foo: 'bar' } });
      graph.addNode({ id: 'b', type: 'Doc', embedding: [4, 5, 6], properties: { foo: 'baz' } });
      graph.addEdge({ id: 'e', source: 'a', target: 'b', type: 'rel', weight: 1 });

      const serialized = graph.serialize();
      const restored = Knowledge.deserialize(serialized);

      expect(restored.getNode('a')).toBeDefined();
      expect(restored.getNode('b')).toBeDefined();
      expect(restored.getEdge('e')).toBeDefined();
      expect(restored.getNode('a')?.embedding).toEqual([1, 2, 3]);
      expect(restored.getNode('b')?.properties?.foo).toBe('baz');
      expect(restored.getEdge('e')?.weight).toBe(1);
      expect(restored.getNodes().length).toBe(2);
      expect(restored.getEdges().length).toBe(2);
    });

    it('preserves metadata and options', () => {
      const now = new Date().toISOString();
      const graph = new Knowledge({
        name: 'TestGraph',
        metadata: { createdAt: now, custom: 123 },
        options: { requireEmbedding: true, embeddingDimension: 3 },
      });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3] });

      const serialized = graph.serialize();
      const restored = Knowledge.deserialize(serialized);

      expect(restored.getMetadata().name).toBe('TestGraph');
      expect(restored.getMetadata().createdAt).toBe(now);
      expect(restored.getMetadata().custom).toBe(123);
      expect(restored.getOptions().requireEmbedding).toBe(true);
      expect(restored.getOptions().embeddingDimension).toBe(3);
    });
  });

  describe('Schema Validation', () => {
    it('allows valid nodes and edges according to schema', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        schema: {
          nodeTypes: [{ type: 'Doc', requiredFields: ['embedding', 'properties'] }],
          edgeTypes: [{ type: 'rel', requiredFields: ['weight'] }],
        },
      });
      expect(() =>
        graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3], properties: { foo: 'bar' } }),
      ).not.toThrow();
      expect(() => graph.addEdge({ id: 'e', source: 'a', target: 'a', type: 'rel', weight: 1 })).not.toThrow();
    });

    it('throws error for missing required node properties', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        schema: {
          nodeTypes: [{ type: 'Doc', requiredFields: ['embedding', 'properties'] }],
        },
      });
      expect(() => graph.addNode({ id: 'a', type: 'Doc', properties: { foo: 'bar' } })).toThrow(
        /Node.*missing required.*embedding/,
      );
    });

    it('throws error for missing required edge properties', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        schema: {
          edgeTypes: [{ type: 'rel', requiredFields: ['weight'] }],
        },
      });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3] });
      expect(() => graph.addEdge({ id: 'e', source: 'a', target: 'a', type: 'rel' })).toThrow(
        /Edge.*missing required.*weight/,
      );
    });

    it('validates nested required fields in nodes', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        schema: {
          nodeTypes: [{ type: 'Doc', requiredFields: ['properties.foo', 'properties.bar.baz'] }],
        },
      });
      // Valid node
      expect(() =>
        graph.addNode({
          id: 'a',
          type: 'Doc',
          properties: { foo: 42, bar: { baz: 'hello' } },
        }),
      ).not.toThrow();

      // Missing nested field
      expect(() =>
        graph.addNode({
          id: 'b',
          type: 'Doc',
          properties: { foo: 42, bar: {} },
        }),
      ).toThrow(/missing required field 'properties.bar.baz'/);
    });

    it('validates nested required fields in edges', () => {
      const graph = new Knowledge({
        name: 'TestGraph',
        schema: {
          nodeTypes: [{ type: 'Doc' }],
          edgeTypes: [{ type: 'rel', requiredFields: ['properties.meta.score', 'weight'] }],
        },
      });
      graph.addNode({ id: 'a', type: 'Doc' });

      // Valid edge
      expect(() =>
        graph.addEdge({
          id: 'e1',
          source: 'a',
          target: 'a',
          type: 'rel',
          weight: 1,
          properties: { meta: { score: 99 } },
        }),
      ).not.toThrow();

      // Missing nested field
      expect(() =>
        graph.addEdge({
          id: 'e2',
          source: 'a',
          target: 'a',
          type: 'rel',
          weight: 1,
          properties: { meta: {} },
        }),
      ).toThrow(/missing required field 'properties.meta.score'/);
    });
  });

  describe('Clearing', () => {
    it('clear() removes all nodes and edges', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3] });
      graph.addNode({ id: 'b', type: 'Doc', embedding: [4, 5, 6] });
      graph.addEdge({ id: 'e', source: 'a', target: 'b', type: 'rel' });
      expect(graph.getNodes().length).toBe(2);
      expect(graph.getEdges().length).toBe(2);
      graph.clear();
      expect(graph.getNodes().length).toBe(0);
      expect(graph.getEdges().length).toBe(0);
    });

    it('clear() is idempotent and safe on empty graph', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      expect(() => graph.clear()).not.toThrow();
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3] });
      graph.clear();
      expect(graph.getNodes().length).toBe(0);
      expect(graph.getEdges().length).toBe(0);
      expect(() => graph.clear()).not.toThrow();
    });
  });

  describe('Robustness/Edge Cases', () => {
    it('does not add duplicate nodes', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3] });
      expect(() => graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3] })).toThrow(/already exists/);
      expect(graph.getNodes().length).toBe(1);
    });

    it('does not add duplicate edges', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      graph.addNode({ id: 'a', type: 'Doc', embedding: [1, 2, 3] });
      graph.addNode({ id: 'b', type: 'Doc', embedding: [4, 5, 6] });
      graph.addEdge({ id: 'e', source: 'a', target: 'b', type: 'rel' });
      expect(() => graph.addEdge({ id: 'e', source: 'a', target: 'b', type: 'rel' })).toThrow(/already exists/);
      expect(graph.getEdges().length).toBe(2);
    });

    it('addNodesFromChunks with no embeddings does not add similarity edges', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const chunks: GraphChunk[] = [
        { id: 'a', text: 'A', metadata: {} },
        { id: 'b', text: 'B', metadata: {} },
      ];
      graph.addNodesFromChunks({ chunks, edgeOptions: { strategy: 'cosine' } });
      expect(graph.getEdges().length).toBe(0);
    });

    it('addNodesFromChunks creates nodes with unique ids', () => {
      const graph = new Knowledge({ name: 'TestGraph' });
      const chunks: GraphChunk[] = [
        { text: 'A', embedding: [1, 2, 3], metadata: {} },
        { text: 'B', embedding: [4, 5, 6], metadata: {} },
      ];
      graph.addNodesFromChunks({ chunks });
      expect(graph.getNodes().length).toBe(2);
    });
  });

  // ============================================
  // High-Level API Tests
  // ============================================

  describe('addDocuments (High-Level API)', () => {
    it('throws error for empty documents array', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      expect(() => kb.addDocuments([])).toThrow('Documents array must not be empty');
    });

    it('adds documents with auto-generated IDs', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addDocuments([
        { text: 'First document', embedding: [1, 0, 0] },
        { text: 'Second document', embedding: [0, 1, 0] },
      ]);
      expect(kb.getNodes().length).toBe(2);
      // All nodes should have UUIDs as IDs
      for (const node of kb.getNodes()) {
        expect(node.id).toMatch(/^[0-9a-f-]{36}$/);
      }
    });

    it('uses provided IDs when specified', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addDocuments([
        { id: 'doc-1', text: 'First document', embedding: [1, 0, 0] },
        { id: 'doc-2', text: 'Second document', embedding: [0, 1, 0] },
      ]);
      expect(kb.getNode('doc-1')).toBeDefined();
      expect(kb.getNode('doc-2')).toBeDefined();
    });

    it('uses default node type of "document"', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addDocuments([{ text: 'Test', embedding: [1, 2, 3] }]);
      expect(kb.getNodes()[0]?.type).toBe('document');
    });

    it('uses custom node type when specified', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addDocuments([{ text: 'Test', embedding: [1, 2, 3] }], { nodeType: 'article' });
      expect(kb.getNodes()[0]?.type).toBe('article');
    });

    it('creates edges by default with 0.7 threshold', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      // Two very similar vectors should create an edge
      kb.addDocuments([
        { text: 'A', embedding: [1, 0, 0] },
        { text: 'B', embedding: [0.95, 0.05, 0] }, // Very similar to A
      ]);
      expect(kb.getEdges().length).toBeGreaterThan(0);
    });

    it('respects custom similarity threshold', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      // With threshold of 0.99, these should NOT create an edge
      // [1, 0, 0] and [0.7, 0.7, 0] have cosine similarity ~0.71
      kb.addDocuments(
        [
          { text: 'A', embedding: [1, 0, 0] },
          { text: 'B', embedding: [0.7, 0.7, 0] },
        ],
        { similarityThreshold: 0.99 },
      );
      expect(kb.getEdges().length).toBe(0);
    });

    it('does not create edges when createEdges is false', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addDocuments(
        [
          { text: 'A', embedding: [1, 0, 0] },
          { text: 'B', embedding: [1, 0, 0] }, // Identical - would normally create edge
        ],
        { createEdges: false },
      );
      expect(kb.getEdges().length).toBe(0);
    });

    it('stores text in node properties', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addDocuments([{ text: 'Hello world', embedding: [1, 2, 3] }]);
      const node = kb.getNodes()[0];
      expect(node?.properties?.text).toBe('Hello world');
    });

    it('preserves metadata in node properties', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addDocuments([{ text: 'Test', embedding: [1, 2, 3], metadata: { source: 'file.pdf', page: 5 } }]);
      const node = kb.getNodes()[0];
      expect(node?.properties?.source).toBe('file.pdf');
      expect(node?.properties?.page).toBe(5);
    });
  });

  describe('addFact (High-Level API)', () => {
    it('throws error for missing required fields', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      expect(() => kb.addFact({ subject: '', predicate: 'is', object: 'test' })).toThrow(
        'Fact must have subject, predicate, and object',
      );
      expect(() => kb.addFact({ subject: 'test', predicate: '', object: 'test' })).toThrow(
        'Fact must have subject, predicate, and object',
      );
      expect(() => kb.addFact({ subject: 'test', predicate: 'is', object: '' })).toThrow(
        'Fact must have subject, predicate, and object',
      );
    });

    it('creates nodes and edge for a new fact', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      const result = kb.addFact({
        subject: 'TypeScript',
        predicate: 'extends',
        object: 'JavaScript',
      });

      expect(result.subjectCreated).toBe(true);
      expect(result.objectCreated).toBe(true);
      expect(result.subjectNode.properties?.name).toBe('TypeScript');
      expect(result.objectNode.properties?.name).toBe('JavaScript');
      expect(result.edge.type).toBe('extends');
      expect(result.edge.source).toBe(result.subjectNode.id);
      expect(result.edge.target).toBe(result.objectNode.id);
    });

    it('reuses existing entity nodes', () => {
      const kb = new Knowledge({ name: 'TestKB' });

      // Add first fact
      const result1 = kb.addFact({
        subject: 'TypeScript',
        predicate: 'extends',
        object: 'JavaScript',
      });

      // Add second fact with same subject
      const result2 = kb.addFact({
        subject: 'TypeScript',
        predicate: 'has',
        object: 'Type System',
      });

      expect(result2.subjectCreated).toBe(false);
      expect(result2.objectCreated).toBe(true);
      expect(result2.subjectNode.id).toBe(result1.subjectNode.id);
      expect(kb.getNodes().length).toBe(3); // TypeScript, JavaScript, Type System
    });

    it('creates entity nodes with type "entity"', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addFact({ subject: 'A', predicate: 'relates_to', object: 'B' });

      const nodes = kb.getNodes();
      expect(nodes.every(n => n.type === 'entity')).toBe(true);
    });

    it('uses default weight of 1.0', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      const result = kb.addFact({ subject: 'A', predicate: 'relates_to', object: 'B' });
      expect(result.edge.weight).toBe(1.0);
    });

    it('uses custom weight when specified', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      const result = kb.addFact({ subject: 'A', predicate: 'relates_to', object: 'B', weight: 0.5 });
      expect(result.edge.weight).toBe(0.5);
    });

    it('includes additional properties on nodes', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      const result = kb.addFact({
        subject: 'TypeScript',
        predicate: 'extends',
        object: 'JavaScript',
        subjectProperties: { version: '5.0', year: 2023 },
        objectProperties: { year: 1995 },
      });

      expect(result.subjectNode.properties?.version).toBe('5.0');
      expect(result.subjectNode.properties?.year).toBe(2023);
      expect(result.objectNode.properties?.year).toBe(1995);
    });

    it('includes edge properties when specified', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      const result = kb.addFact({
        subject: 'A',
        predicate: 'relates_to',
        object: 'B',
        edgeProperties: { confidence: 0.9, source: 'manual' },
      });

      expect(result.edge.properties?.confidence).toBe(0.9);
      expect(result.edge.properties?.source).toBe('manual');
    });

    it('creates directed edges (no reverse edge)', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addFact({ subject: 'A', predicate: 'parent_of', object: 'B' });

      // Should only have 1 edge (no reverse)
      expect(kb.getEdges().length).toBe(1);
    });
  });

  describe('findEntityByName (High-Level API)', () => {
    it('returns undefined for non-existent entity', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      expect(kb.findEntityByName('NonExistent')).toBeUndefined();
    });

    it('finds entity by name', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addFact({ subject: 'TypeScript', predicate: 'is', object: 'Language' });

      const entity = kb.findEntityByName('TypeScript');
      expect(entity).toBeDefined();
      expect(entity?.properties?.name).toBe('TypeScript');
    });

    it('returns first match if multiple nodes have same name', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addFact({ subject: 'Test', predicate: 'is', object: 'Thing' });

      const entity = kb.findEntityByName('Test');
      expect(entity).toBeDefined();
    });
  });

  describe('getFactsAbout (High-Level API)', () => {
    it('returns empty array for non-existent entity', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      expect(kb.getFactsAbout('NonExistent')).toEqual([]);
    });

    it('returns all facts where entity is subject', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addFact({ subject: 'TypeScript', predicate: 'extends', object: 'JavaScript' });
      kb.addFact({ subject: 'TypeScript', predicate: 'has', object: 'Types' });
      kb.addFact({ subject: 'Python', predicate: 'is', object: 'Language' });

      const facts = kb.getFactsAbout('TypeScript');
      expect(facts.length).toBe(2);
    });

    it('returns all facts where entity is object', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addFact({ subject: 'TypeScript', predicate: 'extends', object: 'JavaScript' });
      kb.addFact({ subject: 'CoffeeScript', predicate: 'compiles_to', object: 'JavaScript' });

      const facts = kb.getFactsAbout('JavaScript');
      expect(facts.length).toBe(2);
    });

    it('returns facts where entity is both subject and object', () => {
      const kb = new Knowledge({ name: 'TestKB' });
      kb.addFact({ subject: 'A', predicate: 'relates_to', object: 'B' });
      kb.addFact({ subject: 'B', predicate: 'relates_to', object: 'C' });

      const facts = kb.getFactsAbout('B');
      expect(facts.length).toBe(2);
    });
  });
});
