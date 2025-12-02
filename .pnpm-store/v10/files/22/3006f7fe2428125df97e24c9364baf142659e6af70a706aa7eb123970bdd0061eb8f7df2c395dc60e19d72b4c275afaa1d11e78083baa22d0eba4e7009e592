import { StorageVectorsError } from './errors';
/**
 * Configuration for encryption at rest
 * @property kmsKeyArn - ARN of the KMS key used for encryption
 * @property sseType - Server-side encryption type (e.g., 'KMS')
 */
export interface EncryptionConfiguration {
    kmsKeyArn?: string;
    sseType?: string;
}
/**
 * Vector bucket metadata
 * @property vectorBucketName - Unique name of the vector bucket
 * @property creationTime - Unix timestamp of when the bucket was created
 * @property encryptionConfiguration - Optional encryption settings
 */
export interface VectorBucket {
    vectorBucketName: string;
    creationTime?: number;
    encryptionConfiguration?: EncryptionConfiguration;
}
/**
 * Metadata configuration for vector index
 * Defines which metadata keys should not be indexed for filtering
 * @property nonFilterableMetadataKeys - Array of metadata keys that cannot be used in filters
 */
export interface MetadataConfiguration {
    nonFilterableMetadataKeys?: string[];
}
/**
 * Supported data types for vectors
 * Currently only float32 is supported
 */
export type VectorDataType = 'float32';
/**
 * Distance metrics for vector similarity search
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dotproduct';
/**
 * Vector index configuration and metadata
 * @property indexName - Unique name of the index within the bucket
 * @property vectorBucketName - Name of the parent vector bucket
 * @property dataType - Data type of vector components (currently only 'float32')
 * @property dimension - Dimensionality of vectors (e.g., 384, 768, 1536)
 * @property distanceMetric - Similarity metric used for queries
 * @property metadataConfiguration - Configuration for metadata filtering
 * @property creationTime - Unix timestamp of when the index was created
 */
export interface VectorIndex {
    indexName: string;
    vectorBucketName: string;
    dataType: VectorDataType;
    dimension: number;
    distanceMetric: DistanceMetric;
    metadataConfiguration?: MetadataConfiguration;
    creationTime?: number;
}
/**
 * Vector data representation
 * Vectors must be float32 arrays with dimensions matching the index
 * @property float32 - Array of 32-bit floating point numbers
 */
export interface VectorData {
    float32: number[];
}
/**
 * Arbitrary JSON metadata attached to vectors
 * Keys configured as non-filterable in the index can be stored but not queried
 */
export type VectorMetadata = Record<string, any>;
/**
 * Single vector object for insertion/update
 * @property key - Unique identifier for the vector
 * @property data - Vector embedding data
 * @property metadata - Optional arbitrary metadata
 */
export interface VectorObject {
    key: string;
    data: VectorData;
    metadata?: VectorMetadata;
}
/**
 * Vector object returned from queries with optional distance
 * @property key - Unique identifier for the vector
 * @property data - Vector embedding data (if requested)
 * @property metadata - Arbitrary metadata (if requested)
 * @property distance - Similarity distance from query vector (if requested)
 */
export interface VectorMatch {
    key: string;
    data?: VectorData;
    metadata?: VectorMetadata;
    distance?: number;
}
/**
 * Options for fetching vector buckets
 * @property prefix - Filter buckets by name prefix
 * @property maxResults - Maximum number of results to return (default: 100)
 * @property nextToken - Token for pagination from previous response
 */
export interface ListVectorBucketsOptions {
    prefix?: string;
    maxResults?: number;
    nextToken?: string;
}
/**
 * Response from listing vector buckets
 * @property vectorBuckets - Array of bucket names
 * @property nextToken - Token for fetching next page (if more results exist)
 */
export interface ListVectorBucketsResponse {
    vectorBuckets: {
        vectorBucketName: string;
    }[];
    nextToken?: string;
}
/**
 * Options for listing indexes within a bucket
 * @property vectorBucketName - Name of the parent vector bucket
 * @property prefix - Filter indexes by name prefix
 * @property maxResults - Maximum number of results to return (default: 100)
 * @property nextToken - Token for pagination from previous response
 */
export interface ListIndexesOptions {
    vectorBucketName: string;
    prefix?: string;
    maxResults?: number;
    nextToken?: string;
}
/**
 * Response from listing indexes
 * @property indexes - Array of index names
 * @property nextToken - Token for fetching next page (if more results exist)
 */
export interface ListIndexesResponse {
    indexes: {
        indexName: string;
    }[];
    nextToken?: string;
}
/**
 * Options for batch reading vectors
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property keys - Array of vector keys to retrieve
 * @property returnData - Whether to include vector data in response
 * @property returnMetadata - Whether to include metadata in response
 */
export interface GetVectorsOptions {
    vectorBucketName: string;
    indexName: string;
    keys: string[];
    returnData?: boolean;
    returnMetadata?: boolean;
}
/**
 * Response from getting vectors
 * @property vectors - Array of retrieved vector objects
 */
export interface GetVectorsResponse {
    vectors: VectorMatch[];
}
/**
 * Options for batch inserting/updating vectors
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property vectors - Array of vectors to insert/upsert (1-500 items)
 */
export interface PutVectorsOptions {
    vectorBucketName: string;
    indexName: string;
    vectors: VectorObject[];
}
/**
 * Options for batch deleting vectors
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property keys - Array of vector keys to delete (1-500 items)
 */
export interface DeleteVectorsOptions {
    vectorBucketName: string;
    indexName: string;
    keys: string[];
}
/**
 * Options for listing/scanning vectors in an index
 * Supports parallel scanning via segment configuration
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property maxResults - Maximum number of results to return (default: 500, max: 1000)
 * @property nextToken - Token for pagination from previous response
 * @property returnData - Whether to include vector data in response
 * @property returnMetadata - Whether to include metadata in response
 * @property segmentCount - Total number of parallel segments (1-16)
 * @property segmentIndex - Zero-based index of this segment (0 to segmentCount-1)
 */
export interface ListVectorsOptions {
    vectorBucketName: string;
    indexName: string;
    maxResults?: number;
    nextToken?: string;
    returnData?: boolean;
    returnMetadata?: boolean;
    segmentCount?: number;
    segmentIndex?: number;
}
/**
 * Response from listing vectors
 * @property vectors - Array of vector objects
 * @property nextToken - Token for fetching next page (if more results exist)
 */
export interface ListVectorsResponse {
    vectors: VectorMatch[];
    nextToken?: string;
}
/**
 * JSON filter expression for metadata filtering
 * Format and syntax depend on the S3 Vectors service implementation
 */
export type VectorFilter = Record<string, any>;
/**
 * Options for querying similar vectors (ANN search)
 * @property vectorBucketName - Name of the vector bucket
 * @property indexName - Name of the index
 * @property queryVector - Query vector to find similar vectors
 * @property topK - Number of nearest neighbors to return (default: 10)
 * @property filter - Optional JSON filter for metadata
 * @property returnDistance - Whether to include distance scores
 * @property returnMetadata - Whether to include metadata in results
 */
export interface QueryVectorsOptions {
    vectorBucketName: string;
    indexName: string;
    queryVector: VectorData;
    topK?: number;
    filter?: VectorFilter;
    returnDistance?: boolean;
    returnMetadata?: boolean;
}
/**
 * Response from vector similarity query
 * @property matches - Array of similar vectors ordered by distance
 */
export interface QueryVectorsResponse {
    matches: VectorMatch[];
}
/**
 * Fetch-specific parameters like abort signals
 * @property signal - AbortSignal for cancelling requests
 */
export interface VectorFetchParameters {
    signal?: AbortSignal;
}
/**
 * Standard response wrapper for successful operations
 * @property data - Response data of type T
 * @property error - Null on success
 */
export interface SuccessResponse<T> {
    data: T;
    error: null;
}
/**
 * Standard response wrapper for failed operations
 * @property data - Null on error
 * @property error - StorageVectorsError with details
 */
export interface ErrorResponse {
    data: null;
    error: StorageVectorsError;
}
/**
 * Union type for all API responses
 * Follows the pattern: { data: T, error: null } | { data: null, error: Error }
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
//# sourceMappingURL=types.d.ts.map