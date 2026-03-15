/**
 * VoyageAI Embeddings - Type Definitions
 */

// ============================================================================
// Model Types
// ============================================================================

/**
 * VoyageAI text embedding models
 */
export type VoyageTextModel =
  | 'voyage-4-large'
  | 'voyage-4'
  | 'voyage-4-lite'
  | 'voyage-3-large'
  | 'voyage-3.5'
  | 'voyage-3.5-lite'
  | 'voyage-code-3'
  | 'voyage-finance-2'
  | 'voyage-law-2';

/**
 * VoyageAI multimodal embedding models
 */
export type VoyageMultimodalModel = 'voyage-multimodal-3' | 'voyage-multimodal-3.5';

/**
 * VoyageAI contextualized chunk embedding models
 */
export type VoyageContextModel = 'voyage-context-3';

/**
 * All VoyageAI embedding models
 */
export type VoyageModel = VoyageTextModel | VoyageMultimodalModel | VoyageContextModel;

// ============================================================================
// Options Types
// ============================================================================

/**
 * Input type for retrieval optimization
 * - 'query': For search queries - Voyage prepends a query-specific prompt
 * - 'document': For documents being indexed - Voyage prepends a document-specific prompt
 * - null/undefined: No prompt prepended
 */
export type VoyageInputType = 'query' | 'document' | null;

/**
 * Output data type options for embeddings
 */
export type VoyageOutputDtype = 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';

/**
 * Supported output dimensions for flexible dimensionality models
 */
export type VoyageOutputDimension = 256 | 512 | 1024 | 2048;

// ============================================================================
// Text Embedding Types
// ============================================================================

/**
 * Configuration for VoyageAI text embedding models
 */
export interface VoyageTextEmbeddingConfig {
  /** The model to use for embeddings */
  model: VoyageTextModel;
  /** API key (defaults to VOYAGE_API_KEY env var) */
  apiKey?: string;
  /** Input type for retrieval optimization */
  inputType?: VoyageInputType;
  /** Output embedding dimension (model-dependent, default 1024) */
  outputDimension?: VoyageOutputDimension;
  /** Output data type (default 'float') */
  outputDtype?: VoyageOutputDtype;
  /** Whether to truncate inputs that exceed context length (default true) */
  truncation?: boolean;
}

// ============================================================================
// Multimodal Embedding Types
// ============================================================================

/**
 * Text content for multimodal embeddings
 */
export interface VoyageTextContent {
  type: 'text';
  text: string;
}

/**
 * Image URL content for multimodal embeddings
 */
export interface VoyageImageUrlContent {
  type: 'image_url';
  image_url: string;
}

/**
 * Base64-encoded image content for multimodal embeddings
 */
export interface VoyageImageBase64Content {
  type: 'image_base64';
  image_base64: string;
}

/**
 * Video URL content for multimodal embeddings (voyage-multimodal-3.5 only)
 */
export interface VoyageVideoUrlContent {
  type: 'video_url';
  video_url: string;
}

/**
 * All multimodal content types
 */
export type VoyageMultimodalContent =
  | VoyageTextContent
  | VoyageImageUrlContent
  | VoyageImageBase64Content
  | VoyageVideoUrlContent;

/**
 * Single multimodal input - an array of interleaved content
 */
export interface VoyageMultimodalInput {
  content: VoyageMultimodalContent[];
}

/**
 * Configuration for VoyageAI multimodal embedding models
 */
export interface VoyageMultimodalEmbeddingConfig {
  /** The model to use (voyage-multimodal-3 or voyage-multimodal-3.5) */
  model: VoyageMultimodalModel;
  /** API key (defaults to VOYAGE_API_KEY env var) */
  apiKey?: string;
  /** Input type for retrieval optimization */
  inputType?: VoyageInputType;
  /** Whether to truncate inputs that exceed context length (default true) */
  truncation?: boolean;
}

// ============================================================================
// Contextualized Embedding Types
// ============================================================================

/**
 * Configuration for VoyageAI contextualized chunk embedding models
 */
export interface VoyageContextualizedEmbeddingConfig {
  /** The model to use (voyage-context-3) */
  model: VoyageContextModel;
  /** API key (defaults to VOYAGE_API_KEY env var) */
  apiKey?: string;
  /** Input type for retrieval optimization */
  inputType?: VoyageInputType;
  /** Output embedding dimension (default 1024) */
  outputDimension?: VoyageOutputDimension;
  /** Output data type (default 'float') */
  outputDtype?: VoyageOutputDtype;
}

// ============================================================================
// Provider Options (for Mastra integration)
// ============================================================================

/**
 * VoyageAI-specific provider options for runtime configuration
 * Used with Mastra's providerOptions to override embedding config at call time
 */
export interface VoyageProviderOptions {
  voyage?: {
    /** Input type for retrieval optimization */
    inputType?: VoyageInputType;
    /** Output embedding dimension */
    outputDimension?: VoyageOutputDimension;
    /** Output data type */
    outputDtype?: VoyageOutputDtype;
    /** Whether to truncate inputs */
    truncation?: boolean;
  };
}

// ============================================================================
// Model Metadata
// ============================================================================

/**
 * Metadata for VoyageAI embedding models
 */
export interface VoyageModelInfo {
  id: VoyageModel;
  maxInputTokens: number;
  defaultDimension: number;
  supportedDimensions?: VoyageOutputDimension[];
  isMultimodal: boolean;
  isContextualized: boolean;
}

/**
 * Model metadata for all VoyageAI text embedding models
 */
export const TEXT_MODEL_INFO: Record<VoyageTextModel, Omit<VoyageModelInfo, 'id'>> = {
  'voyage-4-large': {
    maxInputTokens: 120000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-4': {
    maxInputTokens: 320000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-4-lite': {
    maxInputTokens: 1000000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-3-large': {
    maxInputTokens: 120000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-3.5': {
    maxInputTokens: 320000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-3.5-lite': {
    maxInputTokens: 1000000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-code-3': {
    maxInputTokens: 32000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-finance-2': {
    maxInputTokens: 32000,
    defaultDimension: 1024,
    isMultimodal: false,
    isContextualized: false,
  },
  'voyage-law-2': {
    maxInputTokens: 32000,
    defaultDimension: 1024,
    isMultimodal: false,
    isContextualized: false,
  },
};

/**
 * Model metadata for VoyageAI multimodal embedding models
 */
export const MULTIMODAL_MODEL_INFO: Record<VoyageMultimodalModel, Omit<VoyageModelInfo, 'id'>> = {
  'voyage-multimodal-3': {
    maxInputTokens: 32000,
    defaultDimension: 1024,
    isMultimodal: true,
    isContextualized: false,
  },
  'voyage-multimodal-3.5': {
    maxInputTokens: 32000,
    defaultDimension: 1024,
    isMultimodal: true,
    isContextualized: false,
  },
};

/**
 * Model metadata for VoyageAI contextualized embedding models
 */
export const CONTEXTUALIZED_MODEL_INFO: Record<VoyageContextModel, Omit<VoyageModelInfo, 'id'>> = {
  'voyage-context-3': {
    maxInputTokens: 32000,
    defaultDimension: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
    isMultimodal: false,
    isContextualized: true,
  },
};

// ============================================================================
// API Response Types
// ============================================================================

/**
 * VoyageAI embedding response
 */
export interface VoyageEmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

/**
 * Single chunk embedding from contextualized embeddings API
 */
export interface VoyageContextualizedChunkEmbedding {
  /** The object type, which is always "embedding" */
  object?: string;
  /** The embedding vector for this chunk */
  embedding?: number[];
  /** The index of this chunk within the document */
  index?: number;
}

/**
 * Single document result from contextualized embeddings API
 */
export interface VoyageContextualizedDocumentResult {
  /** The object type, which is always "list" */
  object?: string;
  /** Array of chunk embeddings for this document */
  data?: VoyageContextualizedChunkEmbedding[];
  /** The index of this document within the input list */
  index?: number;
}

/**
 * VoyageAI contextualized embedding response
 * Structure: response.data[docIndex].data[chunkIndex].embedding
 */
export interface VoyageContextualizedEmbeddingResponse {
  object: 'list';
  /** Array of document results, each containing chunk embeddings */
  data: VoyageContextualizedDocumentResult[];
  model: string;
  usage: {
    total_tokens: number;
  };
}

// ============================================================================
// Reranker Types
// ============================================================================

/**
 * VoyageAI reranking models
 */
export type VoyageRerankerModel =
  | 'rerank-2.5'
  | 'rerank-2.5-lite'
  | 'rerank-2'
  | 'rerank-2-lite'
  | 'rerank-1'
  | 'rerank-lite-1';

/**
 * Configuration for VoyageAI reranker
 */
export interface VoyageRerankerConfig {
  /** The reranker model to use */
  model: VoyageRerankerModel;
  /** API key (defaults to VOYAGE_API_KEY env var) */
  apiKey?: string;
  /** Whether to truncate inputs that exceed context length (default true) */
  truncation?: boolean;
}

/**
 * Single reranking result from VoyageAI
 */
export interface VoyageRerankResult {
  /** Index of the document in the original input array */
  index: number;
  /** The original document text */
  document: string;
  /** Relevance score (higher = more relevant) */
  relevance_score: number;
}

/**
 * VoyageAI reranking API response
 */
export interface VoyageRerankResponse {
  object: 'list';
  data: VoyageRerankResult[];
  model: string;
  usage: {
    total_tokens: number;
  };
}

/**
 * Model metadata for VoyageAI reranker models
 */
export const RERANKER_MODEL_INFO: Record<
  VoyageRerankerModel,
  { contextLength: number; description: string }
> = {
  'rerank-2.5': {
    contextLength: 32000,
    description: 'Best quality with instruction-following support',
  },
  'rerank-2.5-lite': {
    contextLength: 32000,
    description: 'Optimized for latency and quality',
  },
  'rerank-2': {
    contextLength: 16000,
    description: 'Second-generation with multilingual support',
  },
  'rerank-2-lite': {
    contextLength: 8000,
    description: 'Second-generation, latency-optimized',
  },
  'rerank-1': {
    contextLength: 8000,
    description: 'First-generation, quality-focused',
  },
  'rerank-lite-1': {
    contextLength: 4000,
    description: 'First-generation, latency-optimized',
  },
};
