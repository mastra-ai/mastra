import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryKnowledge } from './inmemory';
import type { StorageKnowledgeGraph, StorageKnowledgeNode, StorageKnowledgeEdge } from './types';

describe('InMemoryKnowledge', () => {
  let storage: InMemoryKnowledge;

  beforeEach(() => {
    storage = new InMemoryKnowledge();
  });

  describe('Graph Operations', () => {
    it('should save and retrieve a graph', async () => {
      const graph: StorageKnowledgeGraph = {
        id: 'graph-1',
        name: 'Test Graph',
        metadata: { description: 'A test graph' },
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveGraph(graph);
      const retrieved = await storage.getGraph('graph-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('graph-1');
      expect(retrieved?.name).toBe('Test Graph');
      expect(retrieved?.metadata.description).toBe('A test graph');
    });

    it('should return null for non-existent graph', async () => {
      const retrieved = await storage.getGraph('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should update a graph', async () => {
      const graph: StorageKnowledgeGraph = {
        id: 'graph-1',
        name: 'Original Name',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveGraph(graph);
      await storage.updateGraph('graph-1', { name: 'Updated Name' });

      const retrieved = await storage.getGraph('graph-1');
      expect(retrieved?.name).toBe('Updated Name');
    });

    it('should throw when updating non-existent graph', async () => {
      await expect(storage.updateGraph('non-existent', { name: 'Test' })).rejects.toThrow(
        'Graph with id non-existent not found',
      );
    });

    it('should delete a graph and its nodes/edges', async () => {
      const graph: StorageKnowledgeGraph = {
        id: 'graph-1',
        name: 'Test',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      const node: StorageKnowledgeNode = {
        id: 'node-1',
        graph_id: 'graph-1',
        type: 'test',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const edge: StorageKnowledgeEdge = {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'test',
        directed: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveGraph(graph);
      await storage.saveNode('graph-1', node);
      await storage.saveEdge('graph-1', edge);

      await storage.deleteGraph('graph-1');

      expect(await storage.getGraph('graph-1')).toBeNull();
      expect(await storage.getNode('graph-1', 'node-1')).toBeNull();
      expect(await storage.getEdge('graph-1', 'edge-1')).toBeNull();
    });

    it('should list all graphs', async () => {
      await storage.saveGraph({
        id: 'graph-1',
        name: 'Graph 1',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
      await storage.saveGraph({
        id: 'graph-2',
        name: 'Graph 2',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });

      const graphs = await storage.listGraphs();
      expect(graphs).toHaveLength(2);
    });
  });

  describe('Node Operations', () => {
    beforeEach(async () => {
      await storage.saveGraph({
        id: 'graph-1',
        name: 'Test',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should save and retrieve a node', async () => {
      const node: StorageKnowledgeNode = {
        id: 'node-1',
        graph_id: 'graph-1',
        type: 'concept',
        labels: ['test'],
        properties: { name: 'Test Node' },
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveNode('graph-1', node);
      const retrieved = await storage.getNode('graph-1', 'node-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('node-1');
      expect(retrieved?.type).toBe('concept');
      expect(retrieved?.properties?.name).toBe('Test Node');
    });

    it('should return null for node in wrong graph', async () => {
      const node: StorageKnowledgeNode = {
        id: 'node-1',
        graph_id: 'graph-1',
        type: 'test',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveNode('graph-1', node);
      const retrieved = await storage.getNode('other-graph', 'node-1');
      expect(retrieved).toBeNull();
    });

    it('should save multiple nodes in batch', async () => {
      const nodes: StorageKnowledgeNode[] = [
        { id: 'node-1', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-2', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-3', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
      ];

      const saved = await storage.saveNodes('graph-1', nodes);
      expect(saved).toHaveLength(3);

      const listed = await storage.listNodes('graph-1');
      expect(listed).toHaveLength(3);
    });

    it('should update a node', async () => {
      const node: StorageKnowledgeNode = {
        id: 'node-1',
        graph_id: 'graph-1',
        type: 'original',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveNode('graph-1', node);
      await storage.updateNode('graph-1', 'node-1', { type: 'updated' });

      const retrieved = await storage.getNode('graph-1', 'node-1');
      expect(retrieved?.type).toBe('updated');
    });

    it('should throw when updating non-existent node', async () => {
      await expect(storage.updateNode('graph-1', 'non-existent', { type: 'test' })).rejects.toThrow(
        'Node with id non-existent not found in graph graph-1',
      );
    });

    it('should delete a node and its connected edges', async () => {
      await storage.saveNode('graph-1', {
        id: 'node-1',
        graph_id: 'graph-1',
        type: 'test',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await storage.saveNode('graph-1', {
        id: 'node-2',
        graph_id: 'graph-1',
        type: 'test',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await storage.saveEdge('graph-1', {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'test',
        directed: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await storage.deleteNode('graph-1', 'node-1');

      expect(await storage.getNode('graph-1', 'node-1')).toBeNull();
      expect(await storage.getEdge('graph-1', 'edge-1')).toBeNull();
      expect(await storage.getNode('graph-1', 'node-2')).not.toBeNull();
    });

    it('should list nodes with type filter', async () => {
      await storage.saveNodes('graph-1', [
        { id: 'node-1', graph_id: 'graph-1', type: 'concept', created_at: new Date(), updated_at: new Date() },
        { id: 'node-2', graph_id: 'graph-1', type: 'entity', created_at: new Date(), updated_at: new Date() },
        { id: 'node-3', graph_id: 'graph-1', type: 'concept', created_at: new Date(), updated_at: new Date() },
      ]);

      const concepts = await storage.listNodes('graph-1', { type: 'concept' });
      expect(concepts).toHaveLength(2);
      expect(concepts.every(n => n.type === 'concept')).toBe(true);
    });

    it('should list nodes with label filter', async () => {
      await storage.saveNodes('graph-1', [
        {
          id: 'node-1',
          graph_id: 'graph-1',
          type: 'test',
          labels: ['a', 'b'],
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'node-2',
          graph_id: 'graph-1',
          type: 'test',
          labels: ['b', 'c'],
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'node-3',
          graph_id: 'graph-1',
          type: 'test',
          labels: ['c', 'd'],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const withLabelA = await storage.listNodes('graph-1', { labels: ['a'] });
      expect(withLabelA).toHaveLength(1);

      const withLabelB = await storage.listNodes('graph-1', { labels: ['b'] });
      expect(withLabelB).toHaveLength(2);
    });

    it('should list nodes with pagination', async () => {
      await storage.saveNodes('graph-1', [
        { id: 'node-1', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-2', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-3', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-4', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-5', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
      ]);

      const page1 = await storage.listNodes('graph-1', { limit: 2 });
      expect(page1).toHaveLength(2);

      const page2 = await storage.listNodes('graph-1', { limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
    });
  });

  describe('Edge Operations', () => {
    beforeEach(async () => {
      await storage.saveGraph({
        id: 'graph-1',
        name: 'Test',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
      await storage.saveNodes('graph-1', [
        { id: 'node-1', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-2', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-3', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
      ]);
    });

    it('should save and retrieve an edge', async () => {
      const edge: StorageKnowledgeEdge = {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'related_to',
        weight: 0.8,
        directed: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await storage.saveEdge('graph-1', edge);
      const retrieved = await storage.getEdge('graph-1', 'edge-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.source_id).toBe('node-1');
      expect(retrieved?.target_id).toBe('node-2');
      expect(retrieved?.weight).toBe(0.8);
    });

    it('should save multiple edges in batch', async () => {
      const edges: StorageKnowledgeEdge[] = [
        {
          id: 'edge-1',
          graph_id: 'graph-1',
          source_id: 'node-1',
          target_id: 'node-2',
          type: 'test',
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'edge-2',
          graph_id: 'graph-1',
          source_id: 'node-2',
          target_id: 'node-3',
          type: 'test',
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const saved = await storage.saveEdges('graph-1', edges);
      expect(saved).toHaveLength(2);

      const listed = await storage.listEdges('graph-1');
      expect(listed).toHaveLength(2);
    });

    it('should update an edge', async () => {
      await storage.saveEdge('graph-1', {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'original',
        directed: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await storage.updateEdge('graph-1', 'edge-1', { type: 'updated', weight: 0.5 });

      const retrieved = await storage.getEdge('graph-1', 'edge-1');
      expect(retrieved?.type).toBe('updated');
      expect(retrieved?.weight).toBe(0.5);
    });

    it('should delete an edge', async () => {
      await storage.saveEdge('graph-1', {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'test',
        directed: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await storage.deleteEdge('graph-1', 'edge-1');
      expect(await storage.getEdge('graph-1', 'edge-1')).toBeNull();
    });

    it('should list edges with type filter', async () => {
      await storage.saveEdges('graph-1', [
        {
          id: 'edge-1',
          graph_id: 'graph-1',
          source_id: 'node-1',
          target_id: 'node-2',
          type: 'related',
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'edge-2',
          graph_id: 'graph-1',
          source_id: 'node-2',
          target_id: 'node-3',
          type: 'similar',
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const relatedEdges = await storage.listEdges('graph-1', { type: 'related' });
      expect(relatedEdges).toHaveLength(1);
    });

    it('should list edges with source filter', async () => {
      await storage.saveEdges('graph-1', [
        {
          id: 'edge-1',
          graph_id: 'graph-1',
          source_id: 'node-1',
          target_id: 'node-2',
          type: 'test',
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'edge-2',
          graph_id: 'graph-1',
          source_id: 'node-1',
          target_id: 'node-3',
          type: 'test',
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'edge-3',
          graph_id: 'graph-1',
          source_id: 'node-2',
          target_id: 'node-3',
          type: 'test',
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const edgesFromNode1 = await storage.listEdges('graph-1', { sourceId: 'node-1' });
      expect(edgesFromNode1).toHaveLength(2);
    });
  });

  describe('Traversal Operations', () => {
    beforeEach(async () => {
      await storage.saveGraph({
        id: 'graph-1',
        name: 'Test',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
      await storage.saveNodes('graph-1', [
        { id: 'node-1', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-2', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-3', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
      ]);
    });

    it('should get neighbors for directed edges', async () => {
      await storage.saveEdges('graph-1', [
        {
          id: 'edge-1',
          graph_id: 'graph-1',
          source_id: 'node-1',
          target_id: 'node-2',
          type: 'test',
          weight: 0.8,
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'edge-2',
          graph_id: 'graph-1',
          source_id: 'node-1',
          target_id: 'node-3',
          type: 'test',
          weight: 0.5,
          directed: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const neighbors = await storage.getNeighbors('graph-1', 'node-1');
      expect(neighbors).toHaveLength(2);
      expect(neighbors.find(n => n.nodeId === 'node-2')?.weight).toBe(0.8);
      expect(neighbors.find(n => n.nodeId === 'node-3')?.weight).toBe(0.5);

      // For directed edges, node-2 should not have node-1 as neighbor
      const node2Neighbors = await storage.getNeighbors('graph-1', 'node-2');
      expect(node2Neighbors).toHaveLength(0);
    });

    it('should get neighbors for undirected edges', async () => {
      await storage.saveEdge('graph-1', {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'test',
        weight: 0.8,
        directed: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const node1Neighbors = await storage.getNeighbors('graph-1', 'node-1');
      expect(node1Neighbors).toHaveLength(1);
      expect(node1Neighbors[0].nodeId).toBe('node-2');

      // For undirected edges, node-2 should also have node-1 as neighbor
      const node2Neighbors = await storage.getNeighbors('graph-1', 'node-2');
      expect(node2Neighbors).toHaveLength(1);
      expect(node2Neighbors[0].nodeId).toBe('node-1');
    });

    it('should return default weight of 1.0 when not specified', async () => {
      await storage.saveEdge('graph-1', {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'test',
        directed: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const neighbors = await storage.getNeighbors('graph-1', 'node-1');
      expect(neighbors[0].weight).toBe(1.0);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      await storage.saveGraph({
        id: 'graph-1',
        name: 'Test',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should clear all nodes and edges but keep graph', async () => {
      await storage.saveNodes('graph-1', [
        { id: 'node-1', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
        { id: 'node-2', graph_id: 'graph-1', type: 'test', created_at: new Date(), updated_at: new Date() },
      ]);
      await storage.saveEdge('graph-1', {
        id: 'edge-1',
        graph_id: 'graph-1',
        source_id: 'node-1',
        target_id: 'node-2',
        type: 'test',
        directed: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await storage.clearGraph('graph-1');

      // Graph should still exist
      expect(await storage.getGraph('graph-1')).not.toBeNull();

      // Nodes and edges should be gone
      expect(await storage.listNodes('graph-1')).toHaveLength(0);
      expect(await storage.listEdges('graph-1')).toHaveLength(0);
    });
  });

  describe('Isolation between graphs', () => {
    beforeEach(async () => {
      await storage.saveGraph({
        id: 'graph-1',
        name: 'Graph 1',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
      await storage.saveGraph({
        id: 'graph-2',
        name: 'Graph 2',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should isolate nodes between graphs', async () => {
      await storage.saveNode('graph-1', {
        id: 'node-1',
        graph_id: 'graph-1',
        type: 'test',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await storage.saveNode('graph-2', {
        id: 'node-2',
        graph_id: 'graph-2',
        type: 'test',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const graph1Nodes = await storage.listNodes('graph-1');
      const graph2Nodes = await storage.listNodes('graph-2');

      expect(graph1Nodes).toHaveLength(1);
      expect(graph1Nodes[0].id).toBe('node-1');

      expect(graph2Nodes).toHaveLength(1);
      expect(graph2Nodes[0].id).toBe('node-2');
    });

    it('should not access nodes from other graph', async () => {
      await storage.saveNode('graph-1', {
        id: 'node-1',
        graph_id: 'graph-1',
        type: 'test',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Should not be able to get node-1 from graph-2
      const node = await storage.getNode('graph-2', 'node-1');
      expect(node).toBeNull();
    });
  });
});
