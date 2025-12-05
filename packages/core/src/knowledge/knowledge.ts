import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';

import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeMetadata,
  KnowledgeSchema,
  KnowledgeOptions,
  GraphChunk,
  RankedNode,
  AddNodesFromChunksEdgeOptions,
  QueryOptions,
  KnowledgeBaseConfig,
  DocumentChunk,
  AddDocumentsOptions,
  Fact,
  AddFactResult,
} from './types';

/**
 * Abstract base class for knowledge graph implementations.
 *
 * Provides the interface for:
 * - Node and edge management
 * - Graph traversal
 * - Similarity-based queries
 * - Serialization/deserialization
 */
export abstract class MastraKnowledge extends MastraBase {
  protected _metadata: KnowledgeMetadata;
  protected _schema?: KnowledgeSchema;
  protected _options: KnowledgeOptions;

  constructor(config: KnowledgeBaseConfig) {
    super({ component: RegisteredLogger.KNOWLEDGE, name: config.name });

    this._metadata = {
      name: config.name,
      createdAt: new Date().toISOString(),
      ...config.metadata,
    };
    this._schema = config.schema;
    this._options = config.options ?? {};
  }

  // --- Node Operations ---

  abstract addNode(node: KnowledgeNode): void;
  abstract addNodes(nodes: KnowledgeNode[]): void;
  abstract updateNode(id: string, updates: Partial<KnowledgeNode>): void;
  abstract removeNode(id: string): void;
  abstract getNode(id: string): KnowledgeNode | undefined;
  abstract getNodes(): KnowledgeNode[];
  abstract findNodesByType(type: string): KnowledgeNode[];
  abstract findNodesByLabel(label: string): KnowledgeNode[];
  abstract filterNodesByProperty(key: string, value: unknown): KnowledgeNode[];

  // --- Edge Operations ---

  abstract addEdge(edge: KnowledgeEdge, options?: { skipReverse?: boolean }): void;
  abstract addEdges(edges: KnowledgeEdge[], options?: { skipReverse?: boolean }): void;
  abstract updateEdge(id: string, updates: Partial<KnowledgeEdge>): void;
  abstract removeEdge(id: string): void;
  abstract getEdge(id: string): KnowledgeEdge | undefined;
  abstract getEdges(): KnowledgeEdge[];
  abstract getEdgesByType(type: string): KnowledgeEdge[];

  // --- Traversal ---

  abstract getNeighbors(nodeId: string): KnowledgeNode[];
  abstract getNeighborInfo(nodeId: string, edgeType?: string): { id: string; weight: number }[];

  // --- Graph Management ---

  abstract clear(): void;

  getMetadata(): KnowledgeMetadata {
    return this._metadata;
  }

  getOptions(): KnowledgeOptions {
    return this._options;
  }

  getSchema(): KnowledgeSchema | undefined {
    return this._schema;
  }

  // --- Build Graph from Chunks ---

  abstract addNodesFromChunks(params: {
    chunks: GraphChunk[];
    edgeOptions?: AddNodesFromChunksEdgeOptions;
    nodeType?: string;
  }): void;

  // --- Query ---

  abstract query(options: QueryOptions): RankedNode[];

  // --- Similarity ---

  abstract cosineSimilarity(vec1: number[], vec2: number[]): number;

  // --- Serialization ---

  abstract serialize(): string;

  // ============================================
  // High-Level API
  // ============================================

  /**
   * Add documents to the knowledge base with automatic node and edge creation.
   *
   * This is the primary high-level method for ingesting document chunks.
   * It automatically:
   * - Creates nodes for each document chunk
   * - Generates unique IDs if not provided
   * - Creates edges between similar documents based on cosine similarity
   *
   * @param chunks - Array of document chunks to add
   * @param options - Optional configuration for document ingestion
   *
   * @example
   * ```typescript
   * await knowledge.addDocuments([
   *   { text: 'AI is transforming...', embedding: [...] },
   *   { text: 'Machine learning...', embedding: [...] }
   * ]);
   * ```
   */
  abstract addDocuments(chunks: DocumentChunk[], options?: AddDocumentsOptions): void;

  /**
   * Add a fact (subject-predicate-object triple) to the knowledge base.
   *
   * This method provides a semantic way to add structured knowledge.
   * It automatically:
   * - Creates or finds existing entity nodes for subject and object
   * - Creates an edge with the predicate as the relationship type
   * - Deduplicates entities by name
   *
   * @param fact - The fact to add (subject-predicate-object)
   * @returns Information about the created/updated entities
   *
   * @example
   * ```typescript
   * const result = knowledge.addFact({
   *   subject: 'TypeScript',
   *   predicate: 'extends',
   *   object: 'JavaScript'
   * });
   * ```
   */
  abstract addFact(fact: Fact): AddFactResult;

  /**
   * Find an entity node by its name.
   *
   * Useful for checking if an entity already exists before adding facts.
   *
   * @param name - The entity name to search for
   * @returns The matching node or undefined
   */
  abstract findEntityByName(name: string): KnowledgeNode | undefined;

  /**
   * Get all facts (edges) related to a specific entity.
   *
   * @param entityName - The name of the entity
   * @returns Array of edges where the entity is either source or target
   */
  abstract getFactsAbout(entityName: string): KnowledgeEdge[];
}
