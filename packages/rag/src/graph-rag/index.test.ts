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
});
