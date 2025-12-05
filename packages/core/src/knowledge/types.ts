// Knowledge Graph types

export type NodeID = string;
export type EdgeID = string;

export interface KnowledgeNode {
  id: NodeID;
  type: string;
  labels?: string[];
  properties?: Record<string, unknown>;
  embedding?: number[];
  vectorId?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'deprecated' | string;
  version?: number;
  parentId?: NodeID;
  childIds?: NodeID[];
}

export type SupportedEdgeType = 'semantic' | 'structural' | 'temporal' | 'causal';

export interface KnowledgeEdge {
  id: EdgeID;
  source: NodeID;
  target: NodeID;
  type: string;
  supportedEdgeType?: SupportedEdgeType;
  labels?: string[];
  properties?: Record<string, unknown>;
  weight?: number;
  createdAt?: string;
  updatedAt?: string;
  directed?: boolean;
}

export interface KnowledgeMetadata {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface KnowledgeData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  metadata?: KnowledgeMetadata;
  options?: KnowledgeOptions;
  schema?: KnowledgeSchema;
}

export interface KnowledgeNodeTypeDef {
  type: string;
  requiredFields?: string[];
}

export interface KnowledgeEdgeTypeDef {
  type: string;
  requiredFields?: string[];
  sourceTypes?: string[];
  targetTypes?: string[];
}

export interface KnowledgeSchema {
  nodeTypes?: KnowledgeNodeTypeDef[];
  edgeTypes?: KnowledgeEdgeTypeDef[];
}

export type GraphChunk = {
  id?: string;
  text?: string;
  embedding?: number[];
  vectorId?: string;
  metadata: Record<string, unknown>;
};

export interface RankedNode extends KnowledgeNode {
  score: number;
}

export interface KnowledgeOptions {
  requireEmbedding?: boolean;
  embeddingDimension?: number;
  defaultDirected?: boolean;
}

type CosineEdgeOptions = {
  strategy: 'cosine';
  threshold?: number;
  edgeType?: SupportedEdgeType;
};

type ExplicitEdgeOptions = {
  strategy: 'explicit';
  edges?: KnowledgeEdge[];
};

type CallbackEdgeOptions = {
  strategy: 'callback';
  callback: (a: KnowledgeNode, b: KnowledgeNode) => boolean | Partial<KnowledgeEdge> | undefined;
};

export type AddNodesFromChunksEdgeOptions = CosineEdgeOptions | ExplicitEdgeOptions | CallbackEdgeOptions;

export interface QueryOptions {
  query: number[];
  topK?: number;
  randomWalkSteps?: number;
  restartProb?: number;
}

export interface KnowledgeBaseConfig {
  name: string;
  metadata?: Omit<KnowledgeMetadata, 'name' | 'createdAt'>;
  schema?: KnowledgeSchema;
  options?: KnowledgeOptions;
}

// ============================================
// High-Level API Types
// ============================================

/**
 * A document chunk for the high-level addDocuments API.
 * Simpler than GraphChunk - focuses on what users typically have.
 */
export interface DocumentChunk {
  /** Optional ID - will be auto-generated if not provided */
  id?: string;
  /** The text content of the chunk */
  text: string;
  /** The embedding vector for similarity search */
  embedding: number[];
  /** Optional metadata about the chunk */
  metadata?: Record<string, unknown>;
}

/**
 * Options for adding documents via the high-level API.
 */
export interface AddDocumentsOptions {
  /** Node type to assign to document nodes (default: 'document') */
  nodeType?: string;
  /** Similarity threshold for automatic edge creation (default: 0.7) */
  similarityThreshold?: number;
  /** Whether to create edges between similar documents (default: true) */
  createEdges?: boolean;
}

/**
 * A fact represented as a subject-predicate-object triple.
 * This is the standard RDF-style knowledge representation.
 */
export interface Fact {
  /** The subject entity (e.g., "TypeScript") */
  subject: string;
  /** The relationship/predicate (e.g., "is_a", "extends", "has") */
  predicate: string;
  /** The object entity (e.g., "Programming Language") */
  object: string;
  /** Optional properties for the subject entity */
  subjectProperties?: Record<string, unknown>;
  /** Optional properties for the object entity */
  objectProperties?: Record<string, unknown>;
  /** Optional properties for the relationship edge */
  edgeProperties?: Record<string, unknown>;
  /** Optional weight for the relationship (default: 1.0) */
  weight?: number;
}

/**
 * Result from adding a fact, containing the created/updated entities.
 */
export interface AddFactResult {
  /** The subject node (created or existing) */
  subjectNode: KnowledgeNode;
  /** The object node (created or existing) */
  objectNode: KnowledgeNode;
  /** The edge representing the predicate */
  edge: KnowledgeEdge;
  /** Whether the subject node was newly created */
  subjectCreated: boolean;
  /** Whether the object node was newly created */
  objectCreated: boolean;
}
