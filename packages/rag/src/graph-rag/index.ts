/**
 * TODO: GraphRAG Enhancements
 *  - Add support for more edge types (sequential, hierarchical, citation, etc)
 *  - Allow for custom edge types
 *  - Utilize metadata for richer connections
 *  - Improve graph traversal and querying using types
 */

type SupportedEdgeType = 'semantic';

// Types for graph nodes and edges
export interface GraphNode {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

interface RankedNode extends GraphNode {
  score: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: SupportedEdgeType;
}

export interface GraphChunk {
  text: string;
  metadata: Record<string, any>;
}

export interface GraphEmbedding {
  vector: number[];
}

export class GraphRAG {
  private nodes: Map<string, GraphNode>;
  private edges: GraphEdge[];
  private dimension: number;
  private threshold: number;

  constructor(dimension: number = 1536, threshold: number = 0.7) {
    this.nodes = new Map();
    this.edges = [];
    this.dimension = dimension;
    this.threshold = threshold;
  }

  // Add a node to the graph
  addNode(node: GraphNode): void {
    if (!node.embedding) {
      throw new Error('Node must have an embedding');
    }
    if (node.embedding.length !== this.dimension) {
      throw new Error(`Embedding dimension must be ${this.dimension}`);
    }
    this.nodes.set(node.id, node);
  }

  // Add an edge between two nodes
  addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error('Both source and target nodes must exist');
    }
    this.edges.push(edge);
    // Add reverse edge
    this.edges.push({
      source: edge.target,
      target: edge.source,
      weight: edge.weight,
      type: edge.type,
    });
  }

  // Helper method to get all nodes
  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  // Helper method to get all edges
  getEdges(): GraphEdge[] {
    return this.edges;
  }

  getEdgesByType(type: string): GraphEdge[] {
    return this.edges.filter(edge => edge.type === type);
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }

  updateNodeContent(id: string, newContent: string): void {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Node ${id} not found`);
    }
    node.content = newContent;
  }

  // Get neighbors of a node
  private getNeighbors(nodeId: string, edgeType?: string): { id: string; weight: number }[] {
    return this.edges
      .filter(edge => edge.source === nodeId && (!edgeType || edge.type === edgeType))
      .map(edge => ({
        id: edge.target,
        weight: edge.weight,
      }))
      .filter(node => node !== undefined);
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2) {
      throw new Error('Vectors must not be null or undefined');
    }
    const vectorLength = vec1.length;

    if (vectorLength !== vec2.length) {
      throw new Error(`Vector dimensions must match: vec1(${vec1.length}) !== vec2(${vec2.length})`);
    }

    let dotProduct = 0;
    let normVec1 = 0;
    let normVec2 = 0;

    for (let i = 0; i < vectorLength; i++) {
      const a = vec1[i]!; // Non-null assertion operator
      const b = vec2[i]!;

      dotProduct += a * b;
      normVec1 += a * a;
      normVec2 += b * b;
    }
    const magnitudeProduct = Math.sqrt(normVec1 * normVec2);

    if (magnitudeProduct === 0) {
      return 0;
    }

    const similarity = dotProduct / magnitudeProduct;
    return Math.max(-1, Math.min(1, similarity));
  }

  createGraph(chunks: GraphChunk[], embeddings: GraphEmbedding[]) {
    if (!chunks?.length || !embeddings?.length) {
      throw new Error('Chunks and embeddings arrays must not be empty');
    }
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings must have the same length');
    }
    // Create nodes from chunks
    chunks.forEach((chunk, index) => {
      const node: GraphNode = {
        id: index.toString(),
        content: chunk.text,
        embedding: embeddings[index]?.vector,
        metadata: { ...chunk.metadata },
      };
      this.addNode(node);
      this.nodes.set(node.id, node);
    });

    // Create edges based on cosine similarity
    for (let i = 0; i < chunks.length; i++) {
      const firstEmbedding = embeddings[i]?.vector as number[];
      for (let j = i + 1; j < chunks.length; j++) {
        const secondEmbedding = embeddings[j]?.vector as number[];
        const similarity = this.cosineSimilarity(firstEmbedding, secondEmbedding);

        // Only create edges if similarity is above threshold
        if (similarity > this.threshold) {
          this.addEdge({
            source: i.toString(),
            target: j.toString(),
            weight: similarity,
            type: 'semantic',
          });
        }
      }
    }
  }

  private selectWeightedNeighbor(neighbors: Array<{ id: string; weight: number }>): string {
    // Sum all weights to normalize probabilities
    const totalWeight = neighbors.reduce((sum, n) => sum + n.weight, 0);

    // Pick a random point in the total weight range
    let remainingWeight = Math.random() * totalWeight;

    // Subtract each weight from our random value until we go below 0
    // Higher weights will make us go below 0 more often, making them more likely to be selected
    for (const neighbor of neighbors) {
      remainingWeight -= neighbor.weight;
      if (remainingWeight <= 0) {
        return neighbor.id;
      }
    }

    return neighbors[neighbors.length - 1]?.id as string;
  }

  // Perform random walk with restart
  private randomWalkWithRestart(startNodeId: string, steps: number, restartProb: number): Map<string, number> {
    const visits = new Map<string, number>();
    let currentNodeId = startNodeId;

    for (let step = 0; step < steps; step++) {
      // Record visit
      visits.set(currentNodeId, (visits.get(currentNodeId) || 0) + 1);

      // Decide whether to restart
      if (Math.random() < restartProb) {
        currentNodeId = startNodeId;
        continue;
      }

      // Get neighbors
      const neighbors = this.getNeighbors(currentNodeId);
      if (neighbors.length === 0) {
        currentNodeId = startNodeId;
        continue;
      }

      // Select random weighted neighbor and set as current node
      currentNodeId = this.selectWeightedNeighbor(neighbors);
    }

    // Normalize visits
    const totalVisits = Array.from(visits.values()).reduce((a, b) => a + b, 0);
    const normalizedVisits = new Map<string, number>();
    for (const [nodeId, count] of visits) {
      normalizedVisits.set(nodeId, count / totalVisits);
    }

    return normalizedVisits;
  }

  // Retrieve relevant nodes using hybrid approach
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
    if (!query || query.length !== this.dimension) {
      throw new Error(`Query embedding must have dimension ${this.dimension}`);
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
    // Retrieve nodes and calculate similarity
    const similarities = Array.from(this.nodes.values()).map(node => ({
      node,
      similarity: this.cosineSimilarity(query, node.embedding!),
    }));

    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topNodes = similarities.slice(0, topK);

    // Re-ranks nodes using random walk with restart
    const rerankedNodes = new Map<string, { node: GraphNode; score: number }>();

    // For each top node, perform random walk
    for (const { node, similarity } of topNodes) {
      const walkScores = this.randomWalkWithRestart(node.id, randomWalkSteps, restartProb);

      // Combine dense retrieval score with graph score
      for (const [nodeId, walkScore] of walkScores) {
        const node = this.nodes.get(nodeId)!;
        const existingScore = rerankedNodes.get(nodeId)?.score || 0;
        rerankedNodes.set(nodeId, {
          node,
          score: existingScore + similarity * walkScore,
        });
      }
    }

    // Sort by final score and return top K nodes
    return Array.from(rerankedNodes.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({
        id: item.node.id,
        content: item.node.content,
        metadata: item.node.metadata,
        score: item.score,
      }));
  }
}
