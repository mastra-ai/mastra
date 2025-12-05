/**
 * Storage types for the Knowledge domain.
 * These use snake_case for database compatibility.
 */

/**
 * Node type definition for schema validation.
 */
export interface StorageKnowledgeNodeTypeDef {
  type: string;
  requiredFields?: string[];
}

/**
 * Edge type definition for schema validation.
 */
export interface StorageKnowledgeEdgeTypeDef {
  type: string;
  requiredFields?: string[];
  sourceTypes?: string[];
  targetTypes?: string[];
}

/**
 * Schema for validating knowledge graph structure.
 */
export interface StorageKnowledgeSchema {
  nodeTypes?: StorageKnowledgeNodeTypeDef[];
  edgeTypes?: StorageKnowledgeEdgeTypeDef[];
}

/**
 * Options for knowledge graph behavior.
 */
export interface StorageKnowledgeOptions {
  requireEmbedding?: boolean;
  embeddingDimension?: number;
  defaultDirected?: boolean;
}

/**
 * Storage representation of a Knowledge Graph.
 */
export interface StorageKnowledgeGraph {
  id: string;
  name: string;
  description?: string;
  metadata: Record<string, unknown>;
  schema?: StorageKnowledgeSchema;
  options?: StorageKnowledgeOptions;
  created_at: Date;
  updated_at: Date;
}

/**
 * Storage representation of a Knowledge Node.
 */
export interface StorageKnowledgeNode {
  id: string;
  graph_id: string;
  type: string;
  labels?: string[];
  properties?: Record<string, unknown>;
  /** Reference to vector store for embeddings */
  vector_id?: string;
  status?: string;
  version?: number;
  parent_id?: string;
  child_ids?: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Storage representation of a Knowledge Edge.
 */
export interface StorageKnowledgeEdge {
  id: string;
  graph_id: string;
  source_id: string;
  target_id: string;
  type: string;
  supported_edge_type?: string;
  labels?: string[];
  properties?: Record<string, unknown>;
  weight?: number;
  directed: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Options for listing nodes.
 */
export interface ListNodesOptions {
  type?: string;
  labels?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Options for listing edges.
 */
export interface ListEdgesOptions {
  type?: string;
  sourceId?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Neighbor information returned from graph traversal.
 */
export interface NeighborInfo {
  nodeId: string;
  edgeId: string;
  weight: number;
}
