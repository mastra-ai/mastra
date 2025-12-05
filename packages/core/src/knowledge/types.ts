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
