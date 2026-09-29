import type { RequestContext } from '@mastra/core/request-context';
import type { PathParams, RouteResponse } from '../route-types.generated.js';
import type {
  CreateIndexParams,
  GetVectorIndexResponse,
  QueryVectorParams,
  QueryVectorResponse,
  ClientOptions,
  UpsertVectorParams,
} from '../types';
import { requestContextQueryString } from '../utils';

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
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing vector index details
   */
  details(
    indexName: PathParams<'GET /vector/:vectorName/indexes/:indexName'>['indexName'],
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<GetVectorIndexResponse> {
    return this.request(
      `/vector/${encodeURIComponent(this.vectorName)}/indexes/${encodeURIComponent(indexName)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Deletes a vector index
   * @param indexName - Name of the index to delete
   * @returns Promise indicating deletion success
   */
  delete(
    indexName: PathParams<'DELETE /vector/:vectorName/indexes/:indexName'>['indexName'],
  ): Promise<RouteResponse<'DELETE /vector/:vectorName/indexes/:indexName'>> {
    return this.request(`/vector/${encodeURIComponent(this.vectorName)}/indexes/${encodeURIComponent(indexName)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Retrieves a list of all available indexes
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing array of index names
   */
  getIndexes(requestContext?: RequestContext | Record<string, any>): Promise<string[]> {
    return this.request(
      `/vector/${encodeURIComponent(this.vectorName)}/indexes${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Creates a new vector index
   * @param params - Parameters for index creation including dimension and metric
   * @returns Promise indicating creation success
   */
  createIndex(params: CreateIndexParams): Promise<RouteResponse<'POST /vector/:vectorName/create-index'>> {
    return this.request(`/vector/${encodeURIComponent(this.vectorName)}/create-index`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Upserts vectors into an index
   * @param params - Parameters containing vectors, metadata, and optional IDs
   * @returns Promise containing the inserted vector IDs
   */
  upsert(params: UpsertVectorParams): Promise<RouteResponse<'POST /vector/:vectorName/upsert'>> {
    return this.request(`/vector/${encodeURIComponent(this.vectorName)}/upsert`, {
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
    return this.request(`/vector/${encodeURIComponent(this.vectorName)}/query`, {
      method: 'POST',
      body: params,
    });
  }
}
