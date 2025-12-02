import VectorIndexApi, { CreateIndexOptions } from './VectorIndexApi';
import VectorDataApi from './VectorDataApi';
import { Fetch } from './fetch';
import VectorBucketApi from './VectorBucketApi';
import { DeleteVectorsOptions, GetVectorsOptions, ListIndexesOptions, ListVectorsOptions, PutVectorsOptions, QueryVectorsOptions } from './types';
/**
 * Configuration options for the Storage Vectors client
 */
export interface StorageVectorsClientOptions {
    /**
     * Custom headers to include in all requests
     */
    headers?: {
        [key: string]: string;
    };
    /**
     * Custom fetch implementation (optional)
     * Useful for testing or custom request handling
     */
    fetch?: Fetch;
}
/**
 * Main client for interacting with S3 Vectors API
 * Provides access to bucket, index, and vector data operations
 *
 * **Usage Patterns:**
 *
 * 1. **Via StorageClient (recommended for most use cases):**
 * ```typescript
 * import { StorageClient } from '@supabase/storage-js'
 *
 * const storageClient = new StorageClient(url, headers)
 * const vectors = storageClient.vectors
 *
 * // Use vector operations
 * await vectors.createBucket('embeddings-prod')
 * const bucket = vectors.from('embeddings-prod')
 * await bucket.createIndex({ ... })
 * ```
 *
 * 2. **Standalone (for vector-only applications):**
 * ```typescript
 * import { StorageVectorsClient } from '@supabase/storage-js'
 *
 * const vectorsClient = new StorageVectorsClient('https://api.example.com', {
 *   headers: { 'Authorization': 'Bearer token' }
 * })
 *
 * // Access bucket operations
 * await vectorsClient.createBucket('embeddings-prod')
 *
 * // Access index operations via buckets
 * const bucket = vectorsClient.from('embeddings-prod')
 * await bucket.createIndex({
 *   indexName: 'documents',
 *   dataType: 'float32',
 *   dimension: 1536,
 *   distanceMetric: 'cosine'
 * })
 *
 * // Access vector operations via index
 * const index = bucket.index('documents')
 * await index.putVectors({
 *   vectors: [
 *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
 *   ]
 * })
 *
 * // Query similar vectors
 * const { data } = await index.queryVectors({
 *   queryVector: { float32: [...] },
 *   topK: 5,
 *   returnDistance: true
 * })
 * ```
 */
export declare class StorageVectorsClient extends VectorBucketApi {
    constructor(url: string, options?: StorageVectorsClientOptions);
    /**
     * Access operations for a specific vector bucket
     * Returns a scoped client for index and vector operations within the bucket
     *
     * @param vectorBucketName - Name of the vector bucket
     * @returns Bucket-scoped client with index and vector operations
     *
     * @example
     * ```typescript
     * const bucket = client.bucket('embeddings-prod')
     *
     * // Create an index in this bucket
     * await bucket.createIndex({
     *   indexName: 'documents-openai',
     *   dataType: 'float32',
     *   dimension: 1536,
     *   distanceMetric: 'cosine'
     * })
     *
     * // List indexes in this bucket
     * const { data } = await bucket.listIndexes()
     * ```
     */
    from(vectorBucketName: string): VectorBucketScope;
}
/**
 * Scoped client for operations within a specific vector bucket
 * Provides index management and access to vector operations
 */
export declare class VectorBucketScope extends VectorIndexApi {
    private vectorBucketName;
    constructor(url: string, headers: {
        [key: string]: string;
    }, vectorBucketName: string, fetch?: Fetch);
    /**
     * Creates a new vector index in this bucket
     * Convenience method that automatically includes the bucket name
     *
     * @param options - Index configuration (vectorBucketName is automatically set)
     * @returns Promise with empty response on success or error
     *
     * @example
     * ```typescript
     * const bucket = client.bucket('embeddings-prod')
     * await bucket.createIndex({
     *   indexName: 'documents-openai',
     *   dataType: 'float32',
     *   dimension: 1536,
     *   distanceMetric: 'cosine',
     *   metadataConfiguration: {
     *     nonFilterableMetadataKeys: ['raw_text']
     *   }
     * })
     * ```
     */
    createIndex(options: Omit<CreateIndexOptions, 'vectorBucketName'>): Promise<import("./types").ApiResponse<undefined>>;
    /**
     * Lists indexes in this bucket
     * Convenience method that automatically includes the bucket name
     *
     * @param options - Listing options (vectorBucketName is automatically set)
     * @returns Promise with list of indexes or error
     *
     * @example
     * ```typescript
     * const bucket = client.bucket('embeddings-prod')
     * const { data } = await bucket.listIndexes({ prefix: 'documents-' })
     * ```
     */
    listIndexes(options?: Omit<ListIndexesOptions, 'vectorBucketName'>): Promise<import("./types").ApiResponse<import("./types").ListIndexesResponse>>;
    /**
     * Retrieves metadata for a specific index in this bucket
     * Convenience method that automatically includes the bucket name
     *
     * @param indexName - Name of the index to retrieve
     * @returns Promise with index metadata or error
     *
     * @example
     * ```typescript
     * const bucket = client.bucket('embeddings-prod')
     * const { data } = await bucket.getIndex('documents-openai')
     * console.log('Dimension:', data?.index.dimension)
     * ```
     */
    getIndex(indexName: string): Promise<import("./types").ApiResponse<{
        index: import("./types").VectorIndex;
    }>>;
    /**
     * Deletes an index from this bucket
     * Convenience method that automatically includes the bucket name
     *
     * @param indexName - Name of the index to delete
     * @returns Promise with empty response on success or error
     *
     * @example
     * ```typescript
     * const bucket = client.bucket('embeddings-prod')
     * await bucket.deleteIndex('old-index')
     * ```
     */
    deleteIndex(indexName: string): Promise<import("./types").ApiResponse<undefined>>;
    /**
     * Access operations for a specific index within this bucket
     * Returns a scoped client for vector data operations
     *
     * @param indexName - Name of the index
     * @returns Index-scoped client with vector data operations
     *
     * @example
     * ```typescript
     * const index = client.bucket('embeddings-prod').index('documents-openai')
     *
     * // Insert vectors
     * await index.putVectors({
     *   vectors: [
     *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
     *   ]
     * })
     *
     * // Query similar vectors
     * const { data } = await index.queryVectors({
     *   queryVector: { float32: [...] },
     *   topK: 5
     * })
     * ```
     */
    index(indexName: string): VectorIndexScope;
}
/**
 * Scoped client for operations within a specific vector index
 * Provides vector data operations (put, get, list, query, delete)
 */
export declare class VectorIndexScope extends VectorDataApi {
    private vectorBucketName;
    private indexName;
    constructor(url: string, headers: {
        [key: string]: string;
    }, vectorBucketName: string, indexName: string, fetch?: Fetch);
    /**
     * Inserts or updates vectors in this index
     * Convenience method that automatically includes bucket and index names
     *
     * @param options - Vector insertion options (bucket and index names automatically set)
     * @returns Promise with empty response on success or error
     *
     * @example
     * ```typescript
     * const index = client.bucket('embeddings-prod').index('documents-openai')
     * await index.putVectors({
     *   vectors: [
     *     {
     *       key: 'doc-1',
     *       data: { float32: [0.1, 0.2, ...] },
     *       metadata: { title: 'Introduction', page: 1 }
     *     }
     *   ]
     * })
     * ```
     */
    putVectors(options: Omit<PutVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<import("./types").ApiResponse<undefined>>;
    /**
     * Retrieves vectors by keys from this index
     * Convenience method that automatically includes bucket and index names
     *
     * @param options - Vector retrieval options (bucket and index names automatically set)
     * @returns Promise with array of vectors or error
     *
     * @example
     * ```typescript
     * const index = client.bucket('embeddings-prod').index('documents-openai')
     * const { data } = await index.getVectors({
     *   keys: ['doc-1', 'doc-2'],
     *   returnMetadata: true
     * })
     * ```
     */
    getVectors(options: Omit<GetVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<import("./types").ApiResponse<import("./types").GetVectorsResponse>>;
    /**
     * Lists vectors in this index with pagination
     * Convenience method that automatically includes bucket and index names
     *
     * @param options - Listing options (bucket and index names automatically set)
     * @returns Promise with array of vectors and pagination token
     *
     * @example
     * ```typescript
     * const index = client.bucket('embeddings-prod').index('documents-openai')
     * const { data } = await index.listVectors({
     *   maxResults: 500,
     *   returnMetadata: true
     * })
     * ```
     */
    listVectors(options?: Omit<ListVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<import("./types").ApiResponse<import("./types").ListVectorsResponse>>;
    /**
     * Queries for similar vectors in this index
     * Convenience method that automatically includes bucket and index names
     *
     * @param options - Query options (bucket and index names automatically set)
     * @returns Promise with array of similar vectors ordered by distance
     *
     * @example
     * ```typescript
     * const index = client.bucket('embeddings-prod').index('documents-openai')
     * const { data } = await index.queryVectors({
     *   queryVector: { float32: [0.1, 0.2, ...] },
     *   topK: 5,
     *   filter: { category: 'technical' },
     *   returnDistance: true,
     *   returnMetadata: true
     * })
     * ```
     */
    queryVectors(options: Omit<QueryVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<import("./types").ApiResponse<import("./types").QueryVectorsResponse>>;
    /**
     * Deletes vectors by keys from this index
     * Convenience method that automatically includes bucket and index names
     *
     * @param options - Deletion options (bucket and index names automatically set)
     * @returns Promise with empty response on success or error
     *
     * @example
     * ```typescript
     * const index = client.bucket('embeddings-prod').index('documents-openai')
     * await index.deleteVectors({
     *   keys: ['doc-1', 'doc-2', 'doc-3']
     * })
     * ```
     */
    deleteVectors(options: Omit<DeleteVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<import("./types").ApiResponse<undefined>>;
}
//# sourceMappingURL=StorageVectorsClient.d.ts.map