import type {
  CreateIndexParams,
  GetVectorIndexResponse,
  QueryVectorParams,
  QueryVectorResponse,
  ClientOptions,
  UpsertVectorParams,
} from '../types';

import { BaseResource } from './base';

export class Vector extends BaseResource {
  constructor(
    options: ClientOptions,
    private vectorName: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about a specific vector index
   * @param indexName - Name of the index to get details for
   * @returns Promise containing vector index details
   */
  details(indexName: string): Promise<GetVectorIndexResponse> {
    return this.request(`/api/vector/${this.vectorName}/indexes/${indexName}`);
  }

  /**
   * Deletes a vector index
   * @param indexName - Name of the index to delete
   * @returns Promise indicating deletion success
   */
  delete(indexName: string): Promise<{ success: boolean }> {
    return this.request(`/api/vector/${this.vectorName}/indexes/${indexName}`, {
      method: 'DELETE',
    });
  }

  /**
   * Retrieves a list of all available indexes
   * @returns Promise containing array of index names
   */
  getIndexes(): Promise<{ indexes: string[] }> {
    return this.request(`/api/vector/${this.vectorName}/indexes`);
  }

  /**
   * Creates a new vector index
   * @param params - Parameters for index creation including dimension and metric
   * @returns Promise indicating creation success
   */
  createIndex(params: CreateIndexParams): Promise<{ success: boolean }> {
    return this.request(`/api/vector/${this.vectorName}/create-index`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Upserts vectors into an index
   * @param params - Parameters containing vectors, metadata, and optional IDs
   * @returns Promise containing array of vector IDs
   */
  upsert(params: UpsertVectorParams): Promise<string[]> {
    return this.request(`/api/vector/${this.vectorName}/upsert`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Queries vectors in an index
   * @param params - Query parameters including query vector and search options
   * @returns Promise containing query results
   */
  query(params: QueryVectorParams): Promise<QueryVectorResponse> {
    return this.request(`/api/vector/${this.vectorName}/query`, {
      method: 'POST',
      body: params,
    });
  }
}
