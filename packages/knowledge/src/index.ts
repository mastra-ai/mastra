export { Knowledge } from './knowledge';

// Re-export types from core for convenience
export type {
  NodeID,
  EdgeID,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeData,
  KnowledgeMetadata,
  KnowledgeSchema,
  KnowledgeNodeTypeDef,
  KnowledgeEdgeTypeDef,
  KnowledgeOptions,
  SupportedEdgeType,
  GraphChunk,
  RankedNode,
  AddNodesFromChunksEdgeOptions,
  QueryOptions,
  KnowledgeBaseConfig,
} from '@mastra/core/knowledge';
