// Unified Knowledge Graph + GraphRAG initial implementation
import { randomUUID } from 'crypto';
import type {
  KGNode,
  KGEdge,
  KGGraph,
  KGGraphMetadata,
  KGSchema,
  SupportedEdgeType,
  KGRagOptions,
  GraphChunk,
  RankedNode,
  AddNodesFromChunksEdgeOptions,
} from './types';

export class KGRag {
  private nodes: Map<string, KGNode>;
  private edges: Map<string, KGEdge>;
  private metadata: KGGraphMetadata;
  private schema?: KGSchema;
  private options: KGRagOptions;

  constructor({
    metadata,
    schema,
    options = {},
  }: {
    metadata: KGGraphMetadata;
    schema?: KGSchema;
    options?: KGRagOptions;
  }) {
    this.nodes = new Map();
    this.edges = new Map();
    this.metadata = metadata;
    this.schema = schema;
    this.options = options;
  }

  addNode(node: KGNode) {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with id '${node.id}' already exists`);
    }
    if (this.schema) this.validateNode(node);
    if (this.options.requireEmbedding) {
      if (!node.embedding) {
        throw new Error(`Node ${node.id} must have an embedding.`);
      }
      if (this.options.embeddingDimension !== undefined && node.embedding.length !== this.options.embeddingDimension) {
        throw new Error(`Node ${node.id} embedding dimension must be ${this.options.embeddingDimension}.`);
      }
    }
    this.nodes.set(node.id, node);
  }

  updateNode(id: string, updates: Partial<KGNode>) {
    const node = this.nodes.get(id);
    if (node) {
      const updated = { ...node, ...updates };
      if (this.schema) this.validateNode(updated);
      this.nodes.set(id, updated);
    }
  }

  removeNode(id: string) {
    this.nodes.delete(id);
    // Remove all edges connected to this node
    for (const [eid, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(eid);
      }
    }
  }

  private shouldCreateReverseEdge(edge: KGEdge): boolean {
    if (this.options.defaultDirected) return false;
    return edge.directed === undefined || !edge.directed;
  }

  addEdge(edge: KGEdge, { skipReverse = false } = {}) {
    if (this.edges.has(edge.id)) {
      throw new Error(`Edge with id '${edge.id}' already exists`);
    }
    if (this.schema) this.validateEdge(edge);
    // Source/target existence check
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error(`Both source ('${edge.source}') and target ('${edge.target}') nodes must exist.`);
    }
    this.edges.set(edge.id, edge);
    // Optional bidirectional edge
    if (!skipReverse && this.shouldCreateReverseEdge(edge)) {
      // Only add reverse edge if it doesn't already exist
      const reverseId = `${edge.target}__${edge.source}__${edge.type}__reverse`;
      if (!this.edges.has(reverseId)) {
        const reverseEdge: KGEdge = {
          ...edge,
          id: reverseId,
          source: edge.target,
          target: edge.source,
          // Keep type, supportedEdgeType, etc.
        };
        this.edges.set(reverseId, reverseEdge);
      }
    }
  }

  updateEdge(id: string, updates: Partial<KGEdge>) {
    const edge = this.edges.get(id);
    if (edge) {
      const updated = { ...edge, ...updates };
      if (this.schema) this.validateEdge(updated);
      this.edges.set(id, updated);
    }
  }

  removeEdge(id: string) {
    this.edges.delete(id);
  }

  getNode(id: string): KGNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): KGEdge | undefined {
    return this.edges.get(id);
  }

  getNodes(): KGNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): KGEdge[] {
    return Array.from(this.edges.values());
  }

  getEdgesByType(type: string): KGEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.type === type);
  }

  // Traversal and lookup methods
  getNeighbors(nodeId: string): KGNode[] {
    const neighbors = new Set<string>();
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId) neighbors.add(edge.target);
      if (edge.target === nodeId) neighbors.add(edge.source);
    }
    return Array.from(neighbors)
      .map(id => this.nodes.get(id))
      .filter(Boolean) as KGNode[];
  }

  findNodesByType(type: string): KGNode[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  findNodesByLabel(label: string): KGNode[] {
    return Array.from(this.nodes.values()).filter(node => node.labels?.includes(label));
  }

  filterNodesByProperty(key: string, value: any): KGNode[] {
    return Array.from(this.nodes.values()).filter(node => node.properties?.[key] === value);
  }

  addNodes(nodes: KGNode[]) {
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  /**
   * Removes all nodes and edges from the graph.
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }

  /**
   * Returns neighbor node IDs and weights for a given node, optionally filtered by edge type.
   * Matches the return shape of graph-rag's getNeighbors.
   */
  getNeighborInfo(nodeId: string, edgeType?: string): { id: string; weight: number }[] {
    return Array.from(this.edges.values())
      .filter(edge => edge.source === nodeId && (!edgeType || edge.type === edgeType))
      .map(edge => ({ id: edge.target, weight: edge.weight ?? 1 }));
  }

  addEdges(edges: KGEdge[], { skipReverse = false } = {}) {
    for (const edge of edges) {
      this.addEdge(edge, { skipReverse });
    }
  }

  // --- Advanced GraphRAG Logic ---

  /**
   * Compute cosine similarity between two vectors.
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2) {
      throw new Error('Vectors must not be null or undefined');
    }
    if (vec1.length !== vec2.length) {
      throw new Error(`Vector dimensions must match: vec1(${vec1.length}) !== vec2(${vec2.length})`);
    }
    let dotProduct = 0;
    let normVec1 = 0;
    let normVec2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      const a = vec1[i]!;
      const b = vec2[i]!;
      dotProduct += a * b;
      normVec1 += a * a;
      normVec2 += b * b;
    }
    const magnitudeProduct = Math.sqrt(normVec1 * normVec2);
    if (magnitudeProduct === 0) return 0;
    return Math.max(-1, Math.min(1, dotProduct / magnitudeProduct));
  }

  /**
   * Utility to build a graph from text chunks and embeddings.
   */
  addNodesFromChunks({
    chunks,
    edgeOptions = {
      strategy: 'cosine',
    },
    nodeType = 'Document',
  }: {
    chunks: GraphChunk[];
    edgeOptions?: AddNodesFromChunksEdgeOptions;
    nodeType?: string;
  }) {
    if (!chunks?.length) {
      throw new Error('Chunks array must not be empty');
    }

    let newNodes: KGNode[] = [];
    // Add nodes
    chunks.forEach(chunk => {
      const node: KGNode = {
        id: chunk.id ?? randomUUID(),
        type: nodeType,
        labels: [],
        properties: { text: chunk.text, ...chunk.metadata },
        embedding: chunk.embedding,
        createdAt: new Date().toISOString(),
      };
      newNodes.push(node);
    });
    this.addNodes(newNodes);

    // Add edges based on strategy
    switch (edgeOptions.strategy) {
      case 'cosine':
        this.addEdgesByCosineSimilarity(newNodes, edgeOptions.threshold ?? 0.7, edgeOptions.edgeType ?? 'semantic');
        break;
      case 'explicit':
        this.addEdges(edgeOptions.edges ?? []);
        break;
      case 'callback':
        this.addEdgesByCallback(newNodes, edgeOptions.callback);
        break;
      default:
        // No edges by default
        break;
    }
  }

  private hasValidEmbedding(node: KGNode): node is KGNode {
    return Array.isArray(node.embedding) && node.embedding.every(e => typeof e === 'number');
  }

  addEdgesByCosineSimilarity(nodes: KGNode[], threshold: number = 0.7, edgeType: SupportedEdgeType = 'semantic') {
    const embeddingNodes = nodes.filter(this.hasValidEmbedding);
    if (embeddingNodes.length < 2) return;
    let newEdges: KGEdge[] = [];
    const seen = new Set<string>();
    for (const firstNode of embeddingNodes) {
      seen.add(firstNode.id);
      for (const secondNode of embeddingNodes) {
        if (firstNode.id === secondNode.id || seen.has(secondNode.id)) continue;
        const sim = this.cosineSimilarity(firstNode.embedding as number[], secondNode.embedding as number[]);
        if (sim > threshold) {
          newEdges.push({
            id: `${firstNode.id}__${secondNode.id}__${edgeType}`,
            source: firstNode.id,
            target: secondNode.id,
            type: edgeType,
            supportedEdgeType: edgeType,
            weight: sim,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    this.addEdges(newEdges);
  }

  addEdgesByCallback(nodes: KGNode[], callback: (a: KGNode, b: KGNode) => boolean | Partial<KGEdge> | undefined) {
    let newEdges: KGEdge[] = [];
    const seen = new Set<string>();
    for (const firstNode of nodes) {
      seen.add(firstNode.id);
      for (const secondNode of nodes) {
        if (firstNode.id === secondNode.id || seen.has(secondNode.id)) continue;
        const result = callback(firstNode, secondNode);
        if (result === true) {
          newEdges.push({
            id: `${firstNode.id}__${secondNode.id}`,
            source: firstNode.id,
            target: secondNode.id,
            type: 'custom',
            createdAt: new Date().toISOString(),
          });
        } else if (typeof result === 'object' && result !== undefined) {
          newEdges.push({
            id: result.id ?? `${firstNode.id}__${secondNode.id}`,
            source: firstNode.id,
            target: secondNode.id,
            type: result.type ?? 'custom',
            ...result,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    this.addEdges(newEdges);
  }

  /**
   * Select a neighbor by weighted random selection.
   */
  private selectWeightedNeighbor(neighbors: Array<{ id: string; weight: number }>): string {
    const totalWeight = neighbors.reduce((sum, n) => sum + (n.weight ?? 0), 0);
    let remainingWeight = Math.random() * totalWeight;
    for (const neighbor of neighbors) {
      remainingWeight -= neighbor.weight ?? 0;
      if (remainingWeight <= 0) {
        return neighbor.id;
      }
    }
    return neighbors[neighbors.length - 1]?.id as string;
  }

  /**
   * Perform random walk with restart from a node.
   */
  private randomWalkWithRestart(startNodeId: string, steps: number, restartProb: number): Map<string, number> {
    const visits = new Map<string, number>();
    let currentNodeId = startNodeId;
    for (let step = 0; step < steps; step++) {
      visits.set(currentNodeId, (visits.get(currentNodeId) || 0) + 1);
      if (Math.random() < restartProb) {
        currentNodeId = startNodeId;
        continue;
      }
      const neighbors = this.getNeighborInfo(currentNodeId);
      if (neighbors.length === 0) {
        currentNodeId = startNodeId;
        continue;
      }
      currentNodeId = this.selectWeightedNeighbor(neighbors);
    }
    const totalVisits = Array.from(visits.values()).reduce((a, b) => a + b, 0);
    const normalizedVisits = new Map<string, number>();
    for (const [nodeId, count] of visits) {
      normalizedVisits.set(nodeId, count / totalVisits);
    }
    return normalizedVisits;
  }

  /**
   * Hybrid query: dense retrieval + random walk rerank.
   */
  query({
    query,
    topK = 10,
    randomWalkSteps = 100,
    restartProb = 0.15,
  }: {
    query: number[];
    topK?: number;
    randomWalkSteps?: number;
    restartProb?: number;
  }): RankedNode[] {
    if (!query || query.length === 0) {
      throw new Error('Query embedding must be provided');
    }
    // Use config or default dimension if present
    if (this.options.embeddingDimension !== undefined && query.length !== this.options.embeddingDimension) {
      throw new Error(`Query embedding must have dimension ${this.options.embeddingDimension}`);
    }
    if (topK < 1) {
      throw new Error('TopK must be greater than 0');
    }
    if (randomWalkSteps < 1) {
      throw new Error('Random walk steps must be greater than 0');
    }
    if (restartProb <= 0 || restartProb >= 1) {
      throw new Error('Restart probability must be between 0 and 1');
    }
    // Compute similarities
    const similarities = Array.from(this.nodes.values())
      .filter(node => Array.isArray(node.embedding) && node.embedding.length === query.length)
      .map(node => ({
        node,
        similarity: this.cosineSimilarity(query, node.embedding!),
      }));
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topNodes = similarities.slice(0, topK);
    // Re-rank with random walk
    const rerankedNodes = new Map<string, { node: KGNode; score: number }>();
    for (const { node, similarity } of topNodes) {
      const walkScores = this.randomWalkWithRestart(node.id, randomWalkSteps, restartProb);
      for (const [nodeId, walkScore] of walkScores) {
        const nodeObj = this.nodes.get(nodeId);
        if (!nodeObj) continue;
        const existingScore = rerankedNodes.get(nodeId)?.score || 0;
        rerankedNodes.set(nodeId, {
          node: nodeObj,
          score: existingScore + similarity * walkScore,
        });
      }
    }
    // Sort and return top K
    return Array.from(rerankedNodes.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({ ...item.node, score: item.score }));
  }

  getOptions(): KGRagOptions {
    return this.options;
  }
  getSchema(): KGSchema | undefined {
    return this.schema;
  }

  getMetadata(): KGGraphMetadata {
    return this.metadata;
  }

  // --- Serialization/Deserialization ---
  serialize(): string {
    const graph: KGGraph = {
      nodes: this.getNodes(),
      edges: this.getEdges(),
      metadata: this.metadata,
      options: this.options,
      schema: this.schema,
    };
    return JSON.stringify(graph);
  }

  static deserialize(json: string, schema?: KGSchema): KGRag {
    const obj = JSON.parse(json) as KGGraph;
    const kg = new KGRag({
      metadata: obj.metadata || { name: '', createdAt: new Date().toISOString() },
      schema: schema ?? obj.schema,
      options: obj.options,
    });
    kg.addNodes(obj.nodes || []);
    kg.addEdges(obj.edges || [], { skipReverse: true });
    return kg;
  }

  // --- Schema Validation ---
  private validateNode(node: KGNode) {
    if (!this.schema || !this.schema.nodeTypes) return;
    const typeDef = this.schema.nodeTypes.find(t => t.type === node.type);
    if (!typeDef) throw new Error(`Node type '${node.type}' not allowed by schema.`);
    if (typeDef.requiredFields) {
      for (const field of typeDef.requiredFields) {
        if (!this.hasField(node, field)) {
          throw new Error(`Node '${node.id}' of type '${node.type}' missing required field '${field}'.`);
        }
      }
    }
  }

  private validateEdge(edge: KGEdge) {
    if (!this.schema || !this.schema.edgeTypes) return;
    const typeDef = this.schema.edgeTypes.find(t => t.type === edge.type);
    if (!typeDef) throw new Error(`Edge type '${edge.type}' not allowed by schema.`);
    if (typeDef.requiredFields) {
      for (const field of typeDef.requiredFields) {
        if (!this.hasField(edge, field)) {
          throw new Error(`Edge '${edge.id}' of type '${edge.type}' missing required field '${field}'.`);
        }
      }
    }
    if (typeDef.sourceTypes && !typeDef.sourceTypes.includes(this.nodes.get(edge.source)?.type || '')) {
      throw new Error(`Edge '${edge.id}' source node type not allowed for edge type '${edge.type}'.`);
    }
    if (typeDef.targetTypes && !typeDef.targetTypes.includes(this.nodes.get(edge.target)?.type || '')) {
      throw new Error(`Edge '${edge.id}' target node type not allowed for edge type '${edge.type}'.`);
    }
  }

  private hasField(obj: any, path: string): boolean {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (!current || !(part in current)) return false;
      current = current[part];
    }
    return true;
  }
}
