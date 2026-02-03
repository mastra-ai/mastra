import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { GraphChunk, GraphEdge, GraphEmbedding, GraphNode } from './';
import { GraphRAG } from './';

describe('GraphRAG', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clear any mock state before each test
  });

  describe('addNode', () => {
    it('should throw an error if node does not have an embedding', () => {
      const graph = new GraphRAG();
      const node = {
        id: '1',
        content: 'Node 1',
      };
      expect(() => graph.addNode(node)).toThrow('Node must have an embedding');
    });

    it('should throw an error if node embedding dimension is not equal to the graph dimension', () => {
      const graph = new GraphRAG(2);
      const node: GraphNode = {
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
      };
      expect(() => graph.addNode(node)).toThrow('Embedding dimension must be 2');
    });

    it('should add a node to the graph', () => {
      const graph = new GraphRAG(3);
      const node = {
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
      };
      graph.addNode(node);
      expect(graph['nodes'].size).toBe(1);
    });
  });

  describe('addEdge', () => {
    it('should throw an error if either source or target node does not exist', () => {
      const graph = new GraphRAG();
      const edge: GraphEdge = {
        source: '1',
        target: '2',
        weight: 0.5,
        type: 'semantic',
      };
      expect(() => graph.addEdge(edge)).toThrow('Both source and target nodes must exist');
    });

    it('should add an edge between two nodes', () => {
      const graph = new GraphRAG(3);
      const node1: GraphNode = {
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
      };
      const node2: GraphNode = {
        id: '2',
        content: 'Node 2',
        embedding: [4, 5, 6],
      };
      graph.addNode(node1);
      graph.addNode(node2);
      const edge: GraphEdge = {
        source: '1',
        target: '2',
        weight: 0.5,
        type: 'semantic',
      };
      graph.addEdge(edge);
      expect(graph['edges'].length).toBe(2);
    });
  });

  describe('createGraph', () => {
    it("chunks and embeddings can't be empty", () => {
      const graph = new GraphRAG(3);
      const chunks: GraphChunk[] = [];
      const embeddings: GraphEmbedding[] = [];
      expect(() => graph.createGraph(chunks, embeddings)).toThrowError(
        'Chunks and embeddings arrays must not be empty',
      );
    });
    it('chunks and embeddings must have the same length', () => {
      const graph = new GraphRAG(3);
      const chunks: GraphChunk[] = [
        {
          text: 'Chunk 1',
          metadata: {},
        },
        {
          text: 'Chunk 2',
          metadata: {},
        },
      ];
      const embeddings: GraphEmbedding[] = [
        {
          vector: [1, 2, 3],
        },
      ];
      expect(() => graph.createGraph(chunks, embeddings)).toThrowError(
        'Chunks and embeddings must have the same length',
      );
    });
    it('should return the top ranked nodes', () => {
      const results = [
        {
          metadata: {
            text: 'Chunk 1',
          },
          vector: [1, 2, 3],
        },
        {
          metadata: {
            text: 'Chunk 2',
          },
          vector: [4, 5, 6],
        },
        {
          metadata: {
            text: 'Chunk 3',
          },
          vector: [7, 8, 9],
        },
      ];

      const chunks = results.map(result => ({
        text: result?.metadata?.text,
        metadata: result.metadata,
      }));
      const embeddings = results.map(result => ({
        vector: result.vector,
      }));

      const graph = new GraphRAG(3);
      graph.createGraph(chunks, embeddings);

      const nodes = graph.getNodes();
      expect(nodes.length).toBe(3);
      expect(nodes[0]?.id).toBe('0');
      expect(nodes[1]?.id).toBe('1');
      expect(nodes[2]?.id).toBe('2');

      const edges = graph.getEdges();
      expect(edges.length).toBe(6);
    });
  });

  describe('query', () => {
    it("query embedding can't be empty", () => {
      const graph = new GraphRAG(3);
      const queryEmbedding: number[] = [];
      expect(() => graph.query({ query: queryEmbedding, topK: 2, randomWalkSteps: 3, restartProb: 0.1 })).toThrowError(
        `Query embedding must have dimension ${3}`,
      );
    });

    it('topK must be greater than 0', () => {
      const graph = new GraphRAG(3);
      const queryEmbedding = [1, 2, 3];
      const topK = 0;
      expect(() => graph.query({ query: queryEmbedding, topK, randomWalkSteps: 3, restartProb: 0.1 })).toThrowError(
        'TopK must be greater than 0',
      );
    });

    it('randomWalkSteps must be greater than 0', () => {
      const graph = new GraphRAG(3);
      const queryEmbedding = [1, 2, 3];
      const topK = 2;
      const randomWalkSteps = 0;
      expect(() => graph.query({ query: queryEmbedding, topK, randomWalkSteps, restartProb: 0.1 })).toThrowError(
        'Random walk steps must be greater than 0',
      );
    });

    it('restartProb must be between 0 and 1', () => {
      const graph = new GraphRAG(3);
      const queryEmbedding = [1, 2, 3];
      const topK = 2;
      const randomWalkSteps = 3;
      const restartProb = -0.1;
      expect(() => graph.query({ query: queryEmbedding, topK, randomWalkSteps, restartProb })).toThrowError(
        'Restart probability must be between 0 and 1',
      );
    });

    it('should apply metadata filters correctly', () => {
      const graph = new GraphRAG(3);

      graph.addNode({
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
        metadata: { type: 'a' },
      });
      graph.addNode({
        id: '2',
        content: 'Node 2',
        embedding: [4, 5, 6],
        metadata: { type: 'b' },
      });

      const results = graph.query({
        query: [1, 2, 3],
        topK: 10,
        randomWalkSteps: 5,
        restartProb: 0.2,
        filter: { type: 'a' },
      });

      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('1');
    });

    it('should return empty array when no nodes match the filter', () => {
      const graph = new GraphRAG(3);

      graph.addNode({
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
        metadata: { type: 'a' },
      });

      const results = graph.query({
        query: [1, 2, 3],
        topK: 10,
        randomWalkSteps: 5,
        restartProb: 0.2,
        filter: { type: 'nonexistent' },
      });

      expect(results.length).toBe(0);
    });

    it('should apply multiple metadata filter keys correctly', () => {
      const graph = new GraphRAG(3);

      graph.addNode({
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
        metadata: { type: 'a', source: 'x' },
      });

      graph.addNode({
        id: '2',
        content: 'Node 2',
        embedding: [4, 5, 6],
        metadata: { type: 'a', source: 'y' },
      });

      const results = graph.query({
        query: [1, 2, 3],
        topK: 10,
        randomWalkSteps: 5,
        restartProb: 0.2,
        filter: { type: 'a', source: 'x' },
      });

      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('1');
    });

    it('should return all nodes when filter is an empty object', () => {
      const graph = new GraphRAG(3);

      graph.addNode({
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
        metadata: { type: 'a' },
      });

      graph.addNode({
        id: '2',
        content: 'Node 2',
        embedding: [4, 5, 6],
        metadata: { type: 'b' },
      });

      const results = graph.query({
        query: [1, 2, 3],
        topK: 10,
        randomWalkSteps: 5,
        restartProb: 0.2,
        filter: {}, // no filters → return all
      });

      expect(results.length).toBe(2);
    });
    it('should not include unfiltered neighbors in the final results', () => {
      const graph = new GraphRAG(3);

      graph.addNode({
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
        metadata: { type: 'a' },
      });

      graph.addNode({
        id: '2',
        content: 'Node 2',
        embedding: [4, 5, 6],
        metadata: { type: 'b' },
      });

      graph.addEdge({
        source: '1',
        target: '2',
        weight: 1,
        type: 'semantic',
      });

      const results = graph.query({
        query: [1, 2, 3],
        topK: 10,
        randomWalkSteps: 10,
        restartProb: 0.1,
        filter: { type: 'a' },
      });

      expect(results.some(n => n.id === '2')).toBe(false);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('1');
    });

    it('should return the top ranked nodes', () => {
      const graph = new GraphRAG(3);
      const node1: GraphNode = {
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
      };
      const node2: GraphNode = {
        id: '2',
        content: 'Node 2',
        embedding: [11, 12, 13],
      };
      const node3: GraphNode = {
        id: '3',
        content: 'Node 3',
        embedding: [21, 22, 23],
      };
      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);
      graph.addEdge({
        source: '1',
        target: '2',
        weight: 0.5,
        type: 'semantic',
      });
      graph.addEdge({
        source: '2',
        target: '3',
        weight: 0.7,
        type: 'semantic',
      });

      const queryEmbedding = [15, 16, 17];
      const topK = 2;
      const randomWalkSteps = 3;
      const restartProb = 0.1;
      const rerankedResults = graph.query({ query: queryEmbedding, topK, randomWalkSteps, restartProb });

      expect(rerankedResults.length).toBe(2);
    });
  });

  describe('persistence', () => {
    function buildGraph(): GraphRAG {
      const graph = new GraphRAG(3);
      graph.addNode({ id: '1', content: 'Node 1', embedding: [1, 2, 3], metadata: { type: 'a' } });
      graph.addNode({ id: '2', content: 'Node 2', embedding: [4, 5, 6], metadata: { type: 'b' } });
      graph.addNode({ id: '3', content: 'Node 3', embedding: [7, 8, 9], metadata: { type: 'a' } });
      graph.addEdge({ source: '1', target: '2', weight: 0.8, type: 'semantic' });
      graph.addEdge({ source: '2', target: '3', weight: 0.9, type: 'semantic' });
      return graph;
    }

    it('should serialize graph state to a JSON-compatible object', () => {
      const graph = buildGraph();
      const serialized = graph.serialize();

      expect(serialized).toBeDefined();
      expect(serialized.nodes).toBeInstanceOf(Array);
      expect(serialized.edges).toBeInstanceOf(Array);
      expect(serialized.dimension).toBe(3);
      expect(serialized.threshold).toBe(0.7);
      // Nodes include embeddings and metadata
      expect(serialized.nodes).toHaveLength(3);
      expect(serialized.nodes[0]).toMatchObject({
        id: '1',
        content: 'Node 1',
        embedding: [1, 2, 3],
        metadata: { type: 'a' },
      });
      // Edges: 2 original + 2 reverse = 4
      expect(serialized.edges).toHaveLength(4);
    });

    it('should produce JSON-stringifiable output from serialize', () => {
      const graph = buildGraph();
      const serialized = graph.serialize();
      const json = JSON.stringify(serialized);

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.nodes).toHaveLength(3);
      expect(parsed.edges).toHaveLength(4);
      expect(parsed.dimension).toBe(3);
    });

    it('should deserialize a saved graph and restore all nodes', () => {
      const original = buildGraph();
      const serialized = original.serialize();

      const restored = GraphRAG.deserialize(serialized);

      expect(restored.getNodes()).toHaveLength(3);
      expect(
        restored
          .getNodes()
          .map(n => n.id)
          .sort(),
      ).toEqual(['1', '2', '3']);
    });

    it('should deserialize a saved graph and restore all edges', () => {
      const original = buildGraph();
      const serialized = original.serialize();

      const restored = GraphRAG.deserialize(serialized);

      // Edges should be identical to original (including reverse edges)
      expect(restored.getEdges()).toHaveLength(original.getEdges().length);
    });

    it('should restore node embeddings correctly', () => {
      const original = buildGraph();
      const serialized = original.serialize();

      const restored = GraphRAG.deserialize(serialized);

      const restoredNodes = restored.getNodes();
      const node1 = restoredNodes.find(n => n.id === '1');
      expect(node1?.embedding).toEqual([1, 2, 3]);
      const node2 = restoredNodes.find(n => n.id === '2');
      expect(node2?.embedding).toEqual([4, 5, 6]);
    });

    it('should restore node metadata correctly', () => {
      const original = buildGraph();
      const serialized = original.serialize();

      const restored = GraphRAG.deserialize(serialized);

      const node1 = restored.getNodes().find(n => n.id === '1');
      expect(node1?.metadata).toEqual({ type: 'a' });
    });

    it('should produce query results identical to original after round-trip', () => {
      const original = buildGraph();
      const serialized = original.serialize();
      const restored = GraphRAG.deserialize(serialized);

      const queryParams = { query: [2, 3, 4], topK: 2, randomWalkSteps: 50, restartProb: 0.15 };

      // Mock random for deterministic comparison
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const originalResults = original.query(queryParams);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const restoredResults = restored.query(queryParams);

      expect(restoredResults).toEqual(originalResults);
    });

    it('should survive JSON round-trip (serialize -> stringify -> parse -> deserialize)', () => {
      const original = buildGraph();
      const serialized = original.serialize();
      const json = JSON.stringify(serialized);
      const parsed = JSON.parse(json);
      const restored = GraphRAG.deserialize(parsed);

      expect(restored.getNodes()).toHaveLength(3);
      expect(restored.getEdges()).toHaveLength(original.getEdges().length);
    });

    it('should allow adding new nodes to a deserialized graph', () => {
      const original = buildGraph();
      const serialized = original.serialize();
      const restored = GraphRAG.deserialize(serialized);

      restored.addNode({ id: '4', content: 'Node 4', embedding: [10, 11, 12] });

      expect(restored.getNodes()).toHaveLength(4);
    });

    it('should restore dimension and threshold so validation still works', () => {
      const original = new GraphRAG(3, 0.5);
      original.addNode({ id: '1', content: 'test', embedding: [1, 2, 3] });

      const serialized = original.serialize();
      const restored = GraphRAG.deserialize(serialized);

      // Wrong dimension should throw
      expect(() => restored.addNode({ id: '2', content: 'bad', embedding: [1, 2] })).toThrow(
        'Embedding dimension must be 3',
      );
    });
  });
});
