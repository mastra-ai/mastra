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
}
