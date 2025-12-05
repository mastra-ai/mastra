import { KnowledgeStorage } from './base';
import type {
  StorageKnowledgeGraph,
  StorageKnowledgeNode,
  StorageKnowledgeEdge,
  ListNodesOptions,
  ListEdgesOptions,
  NeighborInfo,
} from './types';

export type InMemoryKnowledgeGraphs = Map<string, StorageKnowledgeGraph>;
export type InMemoryKnowledgeNodes = Map<string, StorageKnowledgeNode>;
export type InMemoryKnowledgeEdges = Map<string, StorageKnowledgeEdge>;

/**
 * In-memory implementation of KnowledgeStorage.
 * Useful for testing and development.
 */
export class InMemoryKnowledge extends KnowledgeStorage {
  private collection: {
    graphs: InMemoryKnowledgeGraphs;
    nodes: InMemoryKnowledgeNodes;
    edges: InMemoryKnowledgeEdges;
  };

  constructor(collection?: {
    graphs: InMemoryKnowledgeGraphs;
    nodes: InMemoryKnowledgeNodes;
    edges: InMemoryKnowledgeEdges;
  }) {
    super();
    this.collection = collection ?? {
      graphs: new Map(),
      nodes: new Map(),
      edges: new Map(),
    };
  }

  // --- Graph Operations ---

  async getGraph(graphId: string): Promise<StorageKnowledgeGraph | null> {
    this.logger.debug(`InMemoryKnowledge: getGraph called for ${graphId}`);
    const graph = this.collection.graphs.get(graphId);
    return graph ? { ...graph, metadata: { ...graph.metadata } } : null;
  }

  async saveGraph(graph: StorageKnowledgeGraph): Promise<StorageKnowledgeGraph> {
    this.logger.debug(`InMemoryKnowledge: saveGraph called for ${graph.id}`);
    this.collection.graphs.set(graph.id, { ...graph });
    return graph;
  }

  async updateGraph(
    graphId: string,
    updates: Partial<Omit<StorageKnowledgeGraph, 'id' | 'created_at'>>,
  ): Promise<StorageKnowledgeGraph> {
    this.logger.debug(`InMemoryKnowledge: updateGraph called for ${graphId}`);
    const graph = this.collection.graphs.get(graphId);

    if (!graph) {
      throw new Error(`Graph with id ${graphId} not found`);
    }

    const updatedGraph: StorageKnowledgeGraph = {
      ...graph,
      ...updates,
      metadata: { ...graph.metadata, ...updates.metadata },
      updated_at: new Date(),
    };

    this.collection.graphs.set(graphId, updatedGraph);
    return updatedGraph;
  }

  async deleteGraph(graphId: string): Promise<void> {
    this.logger.debug(`InMemoryKnowledge: deleteGraph called for ${graphId}`);

    // Delete all nodes in this graph
    for (const [nodeId, node] of this.collection.nodes) {
      if (node.graph_id === graphId) {
        this.collection.nodes.delete(nodeId);
      }
    }

    // Delete all edges in this graph
    for (const [edgeId, edge] of this.collection.edges) {
      if (edge.graph_id === graphId) {
        this.collection.edges.delete(edgeId);
      }
    }

    // Delete the graph itself
    this.collection.graphs.delete(graphId);
  }

  async listGraphs(): Promise<StorageKnowledgeGraph[]> {
    this.logger.debug(`InMemoryKnowledge: listGraphs called`);
    return Array.from(this.collection.graphs.values()).map(g => ({
      ...g,
      metadata: { ...g.metadata },
    }));
  }

  // --- Node Operations ---

  async getNode(graphId: string, nodeId: string): Promise<StorageKnowledgeNode | null> {
    this.logger.debug(`InMemoryKnowledge: getNode called for ${nodeId} in graph ${graphId}`);
    const node = this.collection.nodes.get(nodeId);
    if (node && node.graph_id === graphId) {
      return { ...node, properties: { ...node.properties } };
    }
    return null;
  }

  async saveNode(graphId: string, node: StorageKnowledgeNode): Promise<StorageKnowledgeNode> {
    this.logger.debug(`InMemoryKnowledge: saveNode called for ${node.id} in graph ${graphId}`);
    const nodeToSave = { ...node, graph_id: graphId };
    this.collection.nodes.set(node.id, nodeToSave);
    return nodeToSave;
  }

  async saveNodes(graphId: string, nodes: StorageKnowledgeNode[]): Promise<StorageKnowledgeNode[]> {
    this.logger.debug(`InMemoryKnowledge: saveNodes called with ${nodes.length} nodes in graph ${graphId}`);
    const savedNodes: StorageKnowledgeNode[] = [];
    for (const node of nodes) {
      const nodeToSave = { ...node, graph_id: graphId };
      this.collection.nodes.set(node.id, nodeToSave);
      savedNodes.push(nodeToSave);
    }
    return savedNodes;
  }

  async updateNode(
    graphId: string,
    nodeId: string,
    updates: Partial<Omit<StorageKnowledgeNode, 'id' | 'graph_id' | 'created_at'>>,
  ): Promise<StorageKnowledgeNode> {
    this.logger.debug(`InMemoryKnowledge: updateNode called for ${nodeId} in graph ${graphId}`);
    const node = this.collection.nodes.get(nodeId);

    if (!node || node.graph_id !== graphId) {
      throw new Error(`Node with id ${nodeId} not found in graph ${graphId}`);
    }

    const updatedNode: StorageKnowledgeNode = {
      ...node,
      ...updates,
      properties: { ...node.properties, ...updates.properties },
      updated_at: new Date(),
    };

    this.collection.nodes.set(nodeId, updatedNode);
    return updatedNode;
  }

  async deleteNode(graphId: string, nodeId: string): Promise<void> {
    this.logger.debug(`InMemoryKnowledge: deleteNode called for ${nodeId} in graph ${graphId}`);
    const node = this.collection.nodes.get(nodeId);

    if (!node || node.graph_id !== graphId) {
      return; // Node doesn't exist or belongs to different graph
    }

    // Delete all edges connected to this node
    for (const [edgeId, edge] of this.collection.edges) {
      if (edge.graph_id === graphId && (edge.source_id === nodeId || edge.target_id === nodeId)) {
        this.collection.edges.delete(edgeId);
      }
    }

    // Delete the node
    this.collection.nodes.delete(nodeId);
  }

  async listNodes(graphId: string, options?: ListNodesOptions): Promise<StorageKnowledgeNode[]> {
    this.logger.debug(`InMemoryKnowledge: listNodes called for graph ${graphId}`);

    let nodes = Array.from(this.collection.nodes.values()).filter(node => node.graph_id === graphId);

    // Apply filters
    if (options?.type) {
      nodes = nodes.filter(node => node.type === options.type);
    }

    if (options?.labels && options.labels.length > 0) {
      nodes = nodes.filter(node => options.labels!.some(label => node.labels?.includes(label)));
    }

    // Apply pagination
    if (options?.offset) {
      nodes = nodes.slice(options.offset);
    }

    if (options?.limit) {
      nodes = nodes.slice(0, options.limit);
    }

    return nodes.map(n => ({ ...n, properties: { ...n.properties } }));
  }

  // --- Edge Operations ---

  async getEdge(graphId: string, edgeId: string): Promise<StorageKnowledgeEdge | null> {
    this.logger.debug(`InMemoryKnowledge: getEdge called for ${edgeId} in graph ${graphId}`);
    const edge = this.collection.edges.get(edgeId);
    if (edge && edge.graph_id === graphId) {
      return { ...edge, properties: { ...edge.properties } };
    }
    return null;
  }

  async saveEdge(graphId: string, edge: StorageKnowledgeEdge): Promise<StorageKnowledgeEdge> {
    this.logger.debug(`InMemoryKnowledge: saveEdge called for ${edge.id} in graph ${graphId}`);
    const edgeToSave = { ...edge, graph_id: graphId };
    this.collection.edges.set(edge.id, edgeToSave);
    return edgeToSave;
  }

  async saveEdges(graphId: string, edges: StorageKnowledgeEdge[]): Promise<StorageKnowledgeEdge[]> {
    this.logger.debug(`InMemoryKnowledge: saveEdges called with ${edges.length} edges in graph ${graphId}`);
    const savedEdges: StorageKnowledgeEdge[] = [];
    for (const edge of edges) {
      const edgeToSave = { ...edge, graph_id: graphId };
      this.collection.edges.set(edge.id, edgeToSave);
      savedEdges.push(edgeToSave);
    }
    return savedEdges;
  }

  async updateEdge(
    graphId: string,
    edgeId: string,
    updates: Partial<Omit<StorageKnowledgeEdge, 'id' | 'graph_id' | 'created_at'>>,
  ): Promise<StorageKnowledgeEdge> {
    this.logger.debug(`InMemoryKnowledge: updateEdge called for ${edgeId} in graph ${graphId}`);
    const edge = this.collection.edges.get(edgeId);

    if (!edge || edge.graph_id !== graphId) {
      throw new Error(`Edge with id ${edgeId} not found in graph ${graphId}`);
    }

    const updatedEdge: StorageKnowledgeEdge = {
      ...edge,
      ...updates,
      properties: { ...edge.properties, ...updates.properties },
      updated_at: new Date(),
    };

    this.collection.edges.set(edgeId, updatedEdge);
    return updatedEdge;
  }

  async deleteEdge(graphId: string, edgeId: string): Promise<void> {
    this.logger.debug(`InMemoryKnowledge: deleteEdge called for ${edgeId} in graph ${graphId}`);
    const edge = this.collection.edges.get(edgeId);

    if (!edge || edge.graph_id !== graphId) {
      return; // Edge doesn't exist or belongs to different graph
    }

    this.collection.edges.delete(edgeId);
  }

  async listEdges(graphId: string, options?: ListEdgesOptions): Promise<StorageKnowledgeEdge[]> {
    this.logger.debug(`InMemoryKnowledge: listEdges called for graph ${graphId}`);

    let edges = Array.from(this.collection.edges.values()).filter(edge => edge.graph_id === graphId);

    // Apply filters
    if (options?.type) {
      edges = edges.filter(edge => edge.type === options.type);
    }

    if (options?.sourceId) {
      edges = edges.filter(edge => edge.source_id === options.sourceId);
    }

    if (options?.targetId) {
      edges = edges.filter(edge => edge.target_id === options.targetId);
    }

    // Apply pagination
    if (options?.offset) {
      edges = edges.slice(options.offset);
    }

    if (options?.limit) {
      edges = edges.slice(0, options.limit);
    }

    return edges.map(e => ({ ...e, properties: { ...e.properties } }));
  }

  // --- Traversal Operations ---

  async getNeighbors(graphId: string, nodeId: string): Promise<NeighborInfo[]> {
    this.logger.debug(`InMemoryKnowledge: getNeighbors called for ${nodeId} in graph ${graphId}`);

    const neighbors: NeighborInfo[] = [];

    for (const edge of this.collection.edges.values()) {
      if (edge.graph_id !== graphId) continue;

      if (edge.source_id === nodeId) {
        neighbors.push({
          nodeId: edge.target_id,
          edgeId: edge.id,
          weight: edge.weight ?? 1.0,
        });
      }

      // For undirected edges, also check if this node is the target
      if (!edge.directed && edge.target_id === nodeId) {
        neighbors.push({
          nodeId: edge.source_id,
          edgeId: edge.id,
          weight: edge.weight ?? 1.0,
        });
      }
    }

    return neighbors;
  }

  // --- Bulk Operations ---

  async clearGraph(graphId: string): Promise<void> {
    this.logger.debug(`InMemoryKnowledge: clearGraph called for ${graphId}`);

    // Delete all nodes in this graph
    for (const [nodeId, node] of this.collection.nodes) {
      if (node.graph_id === graphId) {
        this.collection.nodes.delete(nodeId);
      }
    }

    // Delete all edges in this graph
    for (const [edgeId, edge] of this.collection.edges) {
      if (edge.graph_id === graphId) {
        this.collection.edges.delete(edgeId);
      }
    }
  }
}
