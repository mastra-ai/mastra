// Unified Knowledge Graph + GraphRAG initial implementation
import type {
  KGNode,
  KGEdge,
  KGGraph,
  KGGraphMetadata,
  KGSchema,
  SupportedEdgeType,
  KGRagOptions,
  GraphChunk,
  GraphEmbedding,
  RankedNode,
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
    if (this.schema) this.validateNode(node);
    if (this.options.requireEmbedding) {
      if (!node.embedding) {
        throw new Error(`Node '${node.id}' must have an embedding.`);
      }
      if (this.options.embeddingDimension !== undefined && node.embedding.length !== this.options.embeddingDimension) {
        throw new Error(`Node '${node.id}' embedding dimension must be ${this.options.embeddingDimension}.`);
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

  addEdge(edge: KGEdge) {
    if (this.schema) this.validateEdge(edge);
    // Source/target existence check
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error(
        `Edge '${edge.id}': both source ('${edge.source}') and target ('${edge.target}') nodes must exist.`,
      );
    }
    this.edges.set(edge.id, edge);
    // Optional bidirectional edge
    const isDirected = edge.directed ?? this.options.defaultDirected ?? false;
    if (!isDirected) {
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

  batchAddNodes(nodes: KGNode[]) {
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

  batchAddEdges(edges: KGEdge[]) {
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  // --- Advanced GraphRAG Logic ---

  /**
   * Compute cosine similarity between two vectors.
   */
  static cosineSimilarity(vec1: number[], vec2: number[]): number {
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
  createGraph(
    chunks: GraphChunk[],
    embeddings: GraphEmbedding[],
    options: { threshold?: number; edgeType?: SupportedEdgeType; nodeType?: string } = {},
  ): KGRag {
    const threshold = options.threshold ?? 0.7;
    const edgeType = options.edgeType ?? 'semantic';
    const nodeType = options.nodeType ?? 'Document';
    const now = new Date().toISOString();
    const graph = new KGRag({ metadata: { name: 'GraphRAG', createdAt: now } });
    // Add nodes
    chunks.forEach((chunk, index) => {
      const node: KGNode = {
        id: index.toString(),
        type: nodeType,
        labels: [],
        properties: { text: chunk.text, ...chunk.metadata },
        embedding: embeddings[index]?.vector,
        createdAt: now,
      };
      graph.addNode(node);
    });
    // Add edges based on cosine similarity
    for (let i = 0; i < chunks.length; i++) {
      const firstEmbedding = embeddings[i]?.vector as number[];
      for (let j = i + 1; j < chunks.length; j++) {
        const secondEmbedding = embeddings[j]?.vector as number[];
        const similarity = KGRag.cosineSimilarity(firstEmbedding, secondEmbedding);
        if (similarity > threshold) {
          graph.addEdge({
            id: `${i}__${j}__${edgeType}`,
            source: i.toString(),
            target: j.toString(),
            type: edgeType,
            supportedEdgeType: edgeType,
            weight: similarity,
            createdAt: now,
          });
        }
      }
    }
    return graph;
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
      throw new Error('topK must be greater than 0');
    }
    if (randomWalkSteps < 1) {
      throw new Error('randomWalkSteps must be greater than 0');
    }
    if (restartProb <= 0 || restartProb >= 1) {
      throw new Error('restartProb must be between 0 and 1');
    }
    // Compute similarities
    const similarities = Array.from(this.nodes.values())
      .filter(node => node.embedding)
      .map(node => ({
        node,
        similarity: KGRag.cosineSimilarity(query, node.embedding!),
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

  getMetadata(): KGGraphMetadata {
    return this.metadata;
  }

  // --- Serialization/Deserialization ---
  serialize(): string {
    const graph: KGGraph = {
      nodes: this.getNodes(),
      edges: this.getEdges(),
      metadata: this.metadata,
    };
    return JSON.stringify(graph);
  }

  static deserialize(json: string, schema?: KGSchema): KGRag {
    const obj = JSON.parse(json) as KGGraph;
    const kg = new KGRag({ metadata: obj.metadata || { name: '', createdAt: new Date().toISOString() }, schema });
    kg.batchAddNodes(obj.nodes || []);
    kg.batchAddEdges(obj.edges || []);
    return kg;
  }

  // --- Schema Validation ---
  private validateNode(node: KGNode) {
    if (!this.schema) return;
    const typeDef = this.schema.nodeTypes.find(t => t.type === node.type);
    if (!typeDef) throw new Error(`Node type '${node.type}' not allowed by schema.`);
    if (typeDef.requiredProperties) {
      for (const prop of typeDef.requiredProperties) {
        if (!(node.properties && prop in node.properties)) {
          throw new Error(`Node '${node.id}' of type '${node.type}' missing required property '${prop}'.`);
        }
      }
    }
  }

  private validateEdge(edge: KGEdge) {
    if (!this.schema) return;
    const typeDef = this.schema.edgeTypes.find(t => t.type === edge.type);
    if (!typeDef) throw new Error(`Edge type '${edge.type}' not allowed by schema.`);
    if (typeDef.requiredProperties) {
      for (const prop of typeDef.requiredProperties) {
        if (!(edge.properties && prop in edge.properties)) {
          throw new Error(`Edge '${edge.id}' of type '${edge.type}' missing required property '${prop}'.`);
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
}
