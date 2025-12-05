import { MastraBase } from '../../../base';

import type {
  StorageKnowledgeGraph,
  StorageKnowledgeNode,
  StorageKnowledgeEdge,
  ListNodesOptions,
  ListEdgesOptions,
  NeighborInfo,
} from './types';

/**
 * Abstract base class for Knowledge storage implementations.
 *
 * Provides the interface for persisting knowledge graphs, nodes, and edges
 * to various storage backends (PostgreSQL, in-memory, etc.).
 */
export abstract class KnowledgeStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'KNOWLEDGE',
    });
  }

  // --- Graph Operations ---

  /**
   * Get a knowledge graph by ID.
   */
  abstract getGraph(graphId: string): Promise<StorageKnowledgeGraph | null>;

  /**
   * Save a new knowledge graph.
   */
  abstract saveGraph(graph: StorageKnowledgeGraph): Promise<StorageKnowledgeGraph>;

  /**
   * Update an existing knowledge graph.
   */
  abstract updateGraph(
    graphId: string,
    updates: Partial<Omit<StorageKnowledgeGraph, 'id' | 'created_at'>>,
  ): Promise<StorageKnowledgeGraph>;

  /**
   * Delete a knowledge graph and all its nodes and edges.
   */
  abstract deleteGraph(graphId: string): Promise<void>;

  /**
   * List all knowledge graphs.
   */
  abstract listGraphs(): Promise<StorageKnowledgeGraph[]>;

  // --- Node Operations ---

  /**
   * Get a node by ID within a graph.
   */
  abstract getNode(graphId: string, nodeId: string): Promise<StorageKnowledgeNode | null>;

  /**
   * Save a new node to a graph.
   */
  abstract saveNode(graphId: string, node: StorageKnowledgeNode): Promise<StorageKnowledgeNode>;

  /**
   * Save multiple nodes to a graph in a batch.
   */
  abstract saveNodes(graphId: string, nodes: StorageKnowledgeNode[]): Promise<StorageKnowledgeNode[]>;

  /**
   * Update an existing node.
   */
  abstract updateNode(
    graphId: string,
    nodeId: string,
    updates: Partial<Omit<StorageKnowledgeNode, 'id' | 'graph_id' | 'created_at'>>,
  ): Promise<StorageKnowledgeNode>;

  /**
   * Delete a node from a graph.
   * This should also delete any edges connected to the node.
   */
  abstract deleteNode(graphId: string, nodeId: string): Promise<void>;

  /**
   * List nodes in a graph with optional filtering.
   */
  abstract listNodes(graphId: string, options?: ListNodesOptions): Promise<StorageKnowledgeNode[]>;

  // --- Edge Operations ---

  /**
   * Get an edge by ID within a graph.
   */
  abstract getEdge(graphId: string, edgeId: string): Promise<StorageKnowledgeEdge | null>;

  /**
   * Save a new edge to a graph.
   */
  abstract saveEdge(graphId: string, edge: StorageKnowledgeEdge): Promise<StorageKnowledgeEdge>;

  /**
   * Save multiple edges to a graph in a batch.
   */
  abstract saveEdges(graphId: string, edges: StorageKnowledgeEdge[]): Promise<StorageKnowledgeEdge[]>;

  /**
   * Update an existing edge.
   */
  abstract updateEdge(
    graphId: string,
    edgeId: string,
    updates: Partial<Omit<StorageKnowledgeEdge, 'id' | 'graph_id' | 'created_at'>>,
  ): Promise<StorageKnowledgeEdge>;

  /**
   * Delete an edge from a graph.
   */
  abstract deleteEdge(graphId: string, edgeId: string): Promise<void>;

  /**
   * List edges in a graph with optional filtering.
   */
  abstract listEdges(graphId: string, options?: ListEdgesOptions): Promise<StorageKnowledgeEdge[]>;

  // --- Traversal Operations ---

  /**
   * Get all neighbors of a node (nodes connected by edges).
   * Returns neighbor node IDs along with the connecting edge info.
   */
  abstract getNeighbors(graphId: string, nodeId: string): Promise<NeighborInfo[]>;

  // --- Bulk Operations ---

  /**
   * Clear all nodes and edges from a graph (but keep the graph itself).
   */
  abstract clearGraph(graphId: string): Promise<void>;
}
