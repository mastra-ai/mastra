import { randomUUID } from 'node:crypto';

import { MastraKnowledge } from '@mastra/core/knowledge';
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeData,
  KnowledgeSchema,
  SupportedEdgeType,
  GraphChunk,
  RankedNode,
  AddNodesFromChunksEdgeOptions,
  QueryOptions,
  KnowledgeBaseConfig,
  DocumentChunk,
  AddDocumentsOptions,
  Fact,
  AddFactResult,
} from '@mastra/core/knowledge';

/**
 * In-memory implementation of MastraKnowledge.
 *
 * Provides a complete knowledge graph with:
 * - Node and edge management
 * - Graph traversal
 * - Similarity-based queries with random walk reranking
 * - Serialization/deserialization
 */
export class Knowledge extends MastraKnowledge {
  private nodes: Map<string, KnowledgeNode>;
  private edges: Map<string, KnowledgeEdge>;

  constructor(config: KnowledgeBaseConfig) {
    super(config);
    this.nodes = new Map();
    this.edges = new Map();
  }

  // --- Node Operations ---

  addNode(node: KnowledgeNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with id '${node.id}' already exists`);
    }
    if (this._schema) this.validateNode(node);
    if (this._options.requireEmbedding) {
      if (!node.embedding) {
        throw new Error(`Node ${node.id} must have an embedding.`);
      }
      if (
        this._options.embeddingDimension !== undefined &&
        node.embedding.length !== this._options.embeddingDimension
      ) {
        throw new Error(`Node ${node.id} embedding dimension must be ${this._options.embeddingDimension}.`);
      }
    }
    this.nodes.set(node.id, node);
  }

  addNodes(nodes: KnowledgeNode[]): void {
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  updateNode(id: string, updates: Partial<KnowledgeNode>): void {
    const node = this.nodes.get(id);
    if (node) {
      const updated = { ...node, ...updates };
      if (this._schema) this.validateNode(updated);
      this.nodes.set(id, updated);
    }
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    for (const [eid, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(eid);
      }
    }
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  getNodes(): KnowledgeNode[] {
    return Array.from(this.nodes.values());
  }

  findNodesByType(type: string): KnowledgeNode[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  findNodesByLabel(label: string): KnowledgeNode[] {
    return Array.from(this.nodes.values()).filter(node => node.labels?.includes(label));
  }

  filterNodesByProperty(key: string, value: unknown): KnowledgeNode[] {
    return Array.from(this.nodes.values()).filter(node => node.properties?.[key] === value);
  }

  // --- Edge Operations ---

  private shouldCreateReverseEdge(edge: KnowledgeEdge): boolean {
    if (this._options.defaultDirected) return false;
    return edge.directed === undefined || !edge.directed;
  }

  addEdge(edge: KnowledgeEdge, { skipReverse = false } = {}): void {
    if (this.edges.has(edge.id)) {
      throw new Error(`Edge with id '${edge.id}' already exists`);
    }
    if (this._schema) this.validateEdge(edge);
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error(`Both source ('${edge.source}') and target ('${edge.target}') nodes must exist.`);
    }
    this.edges.set(edge.id, edge);
    if (!skipReverse && this.shouldCreateReverseEdge(edge)) {
      const reverseId = `${edge.target}__${edge.source}__${edge.type}__reverse`;
      if (!this.edges.has(reverseId)) {
        const reverseEdge: KnowledgeEdge = {
          ...edge,
          id: reverseId,
          source: edge.target,
          target: edge.source,
        };
        this.edges.set(reverseId, reverseEdge);
      }
    }
  }

  addEdges(edges: KnowledgeEdge[], { skipReverse = false } = {}): void {
    for (const edge of edges) {
      this.addEdge(edge, { skipReverse });
    }
  }

  updateEdge(id: string, updates: Partial<KnowledgeEdge>): void {
    const edge = this.edges.get(id);
    if (edge) {
      const updated = { ...edge, ...updates };
      if (this._schema) this.validateEdge(updated);
      this.edges.set(id, updated);
    }
  }

  removeEdge(id: string): void {
    this.edges.delete(id);
  }

  getEdge(id: string): KnowledgeEdge | undefined {
    return this.edges.get(id);
  }

  getEdges(): KnowledgeEdge[] {
    return Array.from(this.edges.values());
  }

  getEdgesByType(type: string): KnowledgeEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.type === type);
  }

  // --- Traversal ---

  getNeighbors(nodeId: string): KnowledgeNode[] {
    const neighbors = new Set<string>();
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId) neighbors.add(edge.target);
      if (edge.target === nodeId) neighbors.add(edge.source);
    }
    return Array.from(neighbors)
      .map(id => this.nodes.get(id))
      .filter(Boolean) as KnowledgeNode[];
  }

  getNeighborInfo(nodeId: string, edgeType?: string): { id: string; weight: number }[] {
    return Array.from(this.edges.values())
      .filter(edge => edge.source === nodeId && (!edgeType || edge.type === edgeType))
      .map(edge => ({ id: edge.target, weight: edge.weight ?? 1 }));
  }

  // --- Graph Management ---

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }

  // --- Build Graph from Chunks ---

  addNodesFromChunks({
    chunks,
    edgeOptions = { strategy: 'cosine' },
    nodeType = 'Document',
  }: {
    chunks: GraphChunk[];
    edgeOptions?: AddNodesFromChunksEdgeOptions;
    nodeType?: string;
  }): void {
    if (!chunks?.length) {
      throw new Error('Chunks array must not be empty');
    }

    const newNodes: KnowledgeNode[] = [];
    for (const chunk of chunks) {
      const node: KnowledgeNode = {
        id: chunk.id ?? randomUUID(),
        type: nodeType,
        labels: [],
        properties: chunk.metadata,
        embedding: chunk.embedding,
        vectorId: chunk.vectorId,
        createdAt: new Date().toISOString(),
      };
      newNodes.push(node);
    }
    this.addNodes(newNodes);

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
    }
  }

  private hasValidEmbedding(node: KnowledgeNode): boolean {
    return Array.isArray(node.embedding) && node.embedding.every(e => typeof e === 'number');
  }

  private addEdgesByCosineSimilarity(
    nodes: KnowledgeNode[],
    threshold: number = 0.7,
    edgeType: SupportedEdgeType = 'semantic',
  ): void {
    const embeddingNodes = nodes.filter(n => this.hasValidEmbedding(n));
    if (embeddingNodes.length < 2) return;

    const newEdges: KnowledgeEdge[] = [];
    const seen = new Set<string>();

    for (const firstNode of embeddingNodes) {
      seen.add(firstNode.id);
      for (const secondNode of embeddingNodes) {
        if (firstNode.id === secondNode.id || seen.has(secondNode.id)) continue;
        const sim = this.cosineSimilarity(firstNode.embedding!, secondNode.embedding!);
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

  private addEdgesByCallback(
    nodes: KnowledgeNode[],
    callback: (a: KnowledgeNode, b: KnowledgeNode) => boolean | Partial<KnowledgeEdge> | undefined,
  ): void {
    const newEdges: KnowledgeEdge[] = [];
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

  // --- Query ---

  query({ query, topK = 10, randomWalkSteps = 100, restartProb = 0.15 }: QueryOptions): RankedNode[] {
    if (!query || query.length === 0) {
      throw new Error('Query embedding must be provided');
    }
    if (this._options.embeddingDimension !== undefined && query.length !== this._options.embeddingDimension) {
      throw new Error(`Query embedding must have dimension ${this._options.embeddingDimension}`);
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

    const similarities = Array.from(this.nodes.values())
      .filter(node => Array.isArray(node.embedding) && node.embedding.length === query.length)
      .map(node => ({
        node,
        similarity: this.cosineSimilarity(query, node.embedding!),
      }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topNodes = similarities.slice(0, topK);

    const rerankedNodes = new Map<string, { node: KnowledgeNode; score: number }>();

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

    return Array.from(rerankedNodes.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({ ...item.node, score: item.score }));
  }

  // --- Similarity ---

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

  // --- Random Walk ---

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

  // --- Serialization ---

  serialize(): string {
    const graph: KnowledgeData = {
      nodes: this.getNodes(),
      edges: this.getEdges(),
      metadata: this._metadata,
      options: this._options,
      schema: this._schema,
    };
    return JSON.stringify(graph);
  }

  static deserialize(json: string, schema?: KnowledgeSchema): Knowledge {
    const obj = JSON.parse(json) as KnowledgeData;
    const kg = new Knowledge({
      name: obj.metadata?.name || '',
      metadata: obj.metadata,
      schema: schema ?? obj.schema,
      options: obj.options,
    });
    kg.addNodes(obj.nodes || []);
    kg.addEdges(obj.edges || [], { skipReverse: true });
    return kg;
  }

  // --- Schema Validation ---

  private validateNode(node: KnowledgeNode): void {
    if (!this._schema || !this._schema.nodeTypes) return;
    const typeDef = this._schema.nodeTypes.find(t => t.type === node.type);
    if (!typeDef) throw new Error(`Node type '${node.type}' not allowed by schema.`);
    if (typeDef.requiredFields) {
      for (const field of typeDef.requiredFields) {
        if (!this.hasField(node, field)) {
          throw new Error(`Node '${node.id}' of type '${node.type}' missing required field '${field}'.`);
        }
      }
    }
  }

  private validateEdge(edge: KnowledgeEdge): void {
    if (!this._schema || !this._schema.edgeTypes) return;
    const typeDef = this._schema.edgeTypes.find(t => t.type === edge.type);
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

  private hasField(obj: object, path: string): boolean {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (!current || typeof current !== 'object' || !(part in current)) return false;
      current = (current as Record<string, unknown>)[part];
    }
    return true;
  }

  // ============================================
  // High-Level API
  // ============================================

  /**
   * Add documents to the knowledge base with automatic node and edge creation.
   *
   * This is the primary high-level method for ingesting document chunks.
   * It delegates to the low-level addNodesFromChunks method with sensible defaults.
   */
  addDocuments(chunks: DocumentChunk[], options?: AddDocumentsOptions): void {
    if (!chunks || chunks.length === 0) {
      throw new Error('Documents array must not be empty');
    }

    const nodeType = options?.nodeType ?? 'document';
    const similarityThreshold = options?.similarityThreshold ?? 0.7;
    const createEdges = options?.createEdges ?? true;

    // Convert DocumentChunk to GraphChunk format
    const graphChunks: GraphChunk[] = chunks.map(chunk => ({
      id: chunk.id ?? randomUUID(),
      text: chunk.text,
      embedding: chunk.embedding,
      metadata: {
        text: chunk.text,
        ...chunk.metadata,
      },
    }));

    // Delegate to the low-level method
    this.addNodesFromChunks({
      chunks: graphChunks,
      nodeType,
      edgeOptions: createEdges
        ? { strategy: 'cosine', threshold: similarityThreshold, edgeType: 'semantic' }
        : { strategy: 'explicit', edges: [] },
    });
  }

  /**
   * Add a fact (subject-predicate-object triple) to the knowledge base.
   *
   * This method creates or finds entity nodes and creates an edge between them.
   */
  addFact(fact: Fact): AddFactResult {
    if (!fact.subject || !fact.predicate || !fact.object) {
      throw new Error('Fact must have subject, predicate, and object');
    }

    let subjectCreated = false;
    let objectCreated = false;

    // Find or create subject node
    let subjectNode = this.findEntityByName(fact.subject);
    if (!subjectNode) {
      subjectNode = {
        id: randomUUID(),
        type: 'entity',
        properties: {
          name: fact.subject,
          ...fact.subjectProperties,
        },
        createdAt: new Date().toISOString(),
      };
      this.addNode(subjectNode);
      subjectCreated = true;
    }

    // Find or create object node
    let objectNode = this.findEntityByName(fact.object);
    if (!objectNode) {
      objectNode = {
        id: randomUUID(),
        type: 'entity',
        properties: {
          name: fact.object,
          ...fact.objectProperties,
        },
        createdAt: new Date().toISOString(),
      };
      this.addNode(objectNode);
      objectCreated = true;
    }

    // Create edge for the predicate
    const edge: KnowledgeEdge = {
      id: randomUUID(),
      source: subjectNode.id,
      target: objectNode.id,
      type: fact.predicate,
      weight: fact.weight ?? 1.0,
      properties: fact.edgeProperties,
      directed: true, // Facts are directional by nature
      createdAt: new Date().toISOString(),
    };
    this.addEdge(edge);

    return {
      subjectNode,
      objectNode,
      edge,
      subjectCreated,
      objectCreated,
    };
  }

  /**
   * Find an entity node by its name property.
   */
  findEntityByName(name: string): KnowledgeNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.properties?.name === name) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Get all facts (edges) related to a specific entity.
   */
  getFactsAbout(entityName: string): KnowledgeEdge[] {
    const entity = this.findEntityByName(entityName);
    if (!entity) {
      return [];
    }

    return Array.from(this.edges.values()).filter(edge => edge.source === entity.id || edge.target === entity.id);
  }
}
