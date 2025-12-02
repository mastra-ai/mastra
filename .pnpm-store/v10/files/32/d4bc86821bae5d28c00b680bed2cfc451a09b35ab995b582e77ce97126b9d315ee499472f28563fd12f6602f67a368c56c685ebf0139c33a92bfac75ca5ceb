// Main client
export { StorageVectorsClient, VectorBucketScope, VectorIndexScope } from './StorageVectorsClient'
export type { StorageVectorsClientOptions } from './StorageVectorsClient'

// API classes (for advanced usage)
export { default as VectorBucketApi } from './VectorBucketApi'
export { default as VectorIndexApi } from './VectorIndexApi'
export { default as VectorDataApi } from './VectorDataApi'
export type { CreateIndexOptions } from './VectorIndexApi'

// Types
export type {
  // Core types
  VectorBucket,
  VectorIndex,
  VectorData,
  VectorMetadata,
  VectorObject,
  VectorMatch,
  EncryptionConfiguration,
  MetadataConfiguration,
  VectorDataType,
  DistanceMetric,
  VectorFilter,

  // Request/Response types
  ListVectorBucketsOptions,
  ListVectorBucketsResponse,
  ListIndexesOptions,
  ListIndexesResponse,
  PutVectorsOptions,
  GetVectorsOptions,
  GetVectorsResponse,
  DeleteVectorsOptions,
  ListVectorsOptions,
  ListVectorsResponse,
  QueryVectorsOptions,
  QueryVectorsResponse,

  // Response wrappers
  ApiResponse,
  SuccessResponse,
  ErrorResponse,
  VectorFetchParameters,
} from './types'

// Errors
export {
  StorageVectorsError,
  StorageVectorsApiError,
  StorageVectorsUnknownError,
  StorageVectorsErrorCode,
  isStorageVectorsError,
} from './errors'

// Fetch utilities (for custom implementations)
export type { Fetch, FetchOptions, RequestMethodType } from './fetch'

// Helper utilities
export {
  resolveFetch,
  resolveResponse,
  isPlainObject,
  normalizeToFloat32,
  validateVectorDimension,
} from './helpers'
