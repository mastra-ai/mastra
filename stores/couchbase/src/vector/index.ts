import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
  DeleteVectorsParams,
} from '@mastra/core/vector';
import type { Bucket, Cluster, Collection, Scope } from 'couchbase';
import { MutateInSpec, connect, SearchRequest, VectorQuery, VectorSearch } from 'couchbase';

type MastraMetric = 'cosine' | 'euclidean' | 'dotproduct';
type CouchbaseMetric = 'cosine' | 'l2_norm' | 'dot_product';
export const DISTANCE_MAPPING: Record<MastraMetric, CouchbaseMetric> = {
  cosine: 'cosine',
  euclidean: 'l2_norm',
  dotproduct: 'dot_product',
};

export type CouchbaseVectorParams = {
  connectionString: string;
  username: string;
  password: string;
  bucketName: string;
  scopeName: string;
  collectionName: string;
};

export class CouchbaseVector extends MastraVector {
  private clusterPromise: Promise<Cluster>;
  private cluster: Cluster;
  private bucketName: string;
  private collectionName: string;
  private scopeName: string;
  private collection: Collection;
  private bucket: Bucket;
  private scope: Scope;
  private vector_dimension: number;

  constructor({
    id,
    connectionString,
    username,
    password,
    bucketName,
    scopeName,
    collectionName,
  }: CouchbaseVectorParams & { id: string }) {
    super({ id });

    try {
      this.clusterPromise = connect(connectionString, {
        username,
        password,
        configProfile: 'wanDevelopment',
      });
      this.cluster = null as unknown as Cluster;
      this.bucketName = bucketName;
      this.collectionName = collectionName;
      this.scopeName = scopeName;
      this.collection = null as unknown as Collection;
      this.bucket = null as unknown as Bucket;
      this.scope = null as unknown as Scope;
      this.vector_dimension = null as unknown as number;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'INITIALIZE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            connectionString,
            username,
            bucketName,
            scopeName,
            collectionName,
          },
        },
        error,
      );
    }
  }

  async getCollection() {
    if (!this.cluster) {
      this.cluster = await this.clusterPromise;
    }

    if (!this.collection) {
      this.bucket = this.cluster.bucket(this.bucketName);
      this.scope = this.bucket.scope(this.scopeName);
      this.collection = this.scope.collection(this.collectionName);
    }

    return this.collection;
  }

  async createIndex({ indexName, dimension, metric = 'dotproduct' as MastraMetric }: CreateIndexParams): Promise<void> {
    try {
      await this.getCollection();

      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }

      await this.scope.searchIndexes().upsertIndex({
        name: indexName,
        sourceName: this.bucketName,
        type: 'fulltext-index',
        params: {
          doc_config: {
            docid_prefix_delim: '',
            docid_regexp: '',
            mode: 'scope.collection.type_field',
            type_field: 'type',
          },
          mapping: {
            default_analyzer: 'standard',
            default_datetime_parser: 'dateTimeOptional',
            default_field: '_all',
            default_mapping: {
              dynamic: true,
              enabled: false,
            },
            default_type: '_default',
            docvalues_dynamic: true, // [Doc](https://docs.couchbase.com/server/current/search/search-index-params.html#params) mentions this attribute is required for vector search to return the indexed field
            index_dynamic: true,
            store_dynamic: true, // [Doc](https://docs.couchbase.com/server/current/search/search-index-params.html#params) mentions this attribute is required for vector search to return the indexed field
            type_field: '_type',
            types: {
              [`${this.scopeName}.${this.collectionName}`]: {
                dynamic: true,
                enabled: true,
                properties: {
                  embedding: {
                    enabled: true,
                    fields: [
                      {
                        dims: dimension,
                        index: true,
                        name: 'embedding',
                        similarity: DISTANCE_MAPPING[metric],
                        type: 'vector',
                        vector_index_optimized_for: 'recall',
                        store: true, // CHANGED due to https://docs.couchbase.com/server/current/search/search-index-params.html#fields
                        docvalues: true, // CHANGED due to https://docs.couchbase.com/server/current/search/search-index-params.html#fields
                        include_term_vectors: true, // CHANGED due to https://docs.couchbase.com/server/current/search/search-index-params.html#fields
                      },
                    ],
                  },
                  content: {
                    enabled: true,
                    fields: [
                      {
                        index: true,
                        name: 'content',
                        store: true,
                        type: 'text',
                      },
                    ],
                  },
                },
              },
            },
          },
          store: {
            indexType: 'scorch',
            segmentVersion: 16,
          },
        },
        sourceUuid: '',
        sourceParams: {},
        sourceType: 'gocbcore',
        planParams: {
          maxPartitionsPerPIndex: 64,
          indexPartitions: 16,
          numReplicas: 0,
        },
      });
      this.vector_dimension = dimension;
    } catch (error: any) {
      // Check for 'already exists' error (Couchbase may throw a 400 or 409, or have a message)
      const message = error?.message || error?.toString();
      if (message && message.toLowerCase().includes('index exists')) {
        // Fetch index info and check dimension
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            dimension,
            metric,
          },
        },
        error,
      );
    }
  }

  async upsert({ vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    try {
      await this.getCollection();

      if (!vectors || vectors.length === 0) {
        throw new Error('No vectors provided');
      }
      if (this.vector_dimension) {
        for (const vector of vectors) {
          if (!vector || this.vector_dimension !== vector.length) {
            throw new Error('Vector dimension mismatch');
          }
        }
      }

      const pointIds = ids || vectors.map(() => crypto.randomUUID());
      const records = vectors.map((vector, i) => {
        const metadataObj = metadata?.[i] || {};
        const record: Record<string, any> = {
          embedding: vector,
          metadata: metadataObj,
        };
        // If metadata has a text field, save it as content
        if (metadataObj.text) {
          record.content = metadataObj.text;
        }
        return record;
      });

      const allPromises = [];
      for (let i = 0; i < records.length; i++) {
        allPromises.push(this.collection.upsert(pointIds[i]!, records[i]));
      }
      await Promise.all(allPromises);

      return pointIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async query({ indexName, queryVector, topK = 10, includeVector = false }: QueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('COUCHBASE', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Couchbase queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      await this.getCollection();

      const index_stats = await this.describeIndex({ indexName });
      if (queryVector.length !== index_stats.dimension) {
        throw new Error(
          `Query vector dimension mismatch. Expected ${index_stats.dimension}, got ${queryVector.length}`,
        );
      }

      let request = SearchRequest.create(
        VectorSearch.fromVectorQuery(VectorQuery.create('embedding', queryVector).numCandidates(topK)),
      );
      const results = await this.scope.search(indexName, request, {
        fields: ['*'],
      });

      if (includeVector) {
        throw new Error('Including vectors in search results is not yet supported by the Couchbase vector store');
      }
      const output = [];
      for (const match of results.rows) {
        const cleanedMetadata: Record<string, any> = {};
        const fields = (match.fields as Record<string, any>) || {}; // Ensure fields is an object
        for (const key in fields) {
          if (Object.prototype.hasOwnProperty.call(fields, key)) {
            const newKey = key.startsWith('metadata.') ? key.substring('metadata.'.length) : key;
            cleanedMetadata[newKey] = fields[key];
          }
        }
        output.push({
          id: match.id as string,
          score: (match.score as number) || 0,
          metadata: cleanedMetadata, // Use the cleaned metadata object
        });
      }
      return output;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            topK,
          },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      await this.getCollection();
      const indexes = await this.scope.searchIndexes().getAllIndexes();
      return indexes?.map(index => index.name) || [];
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      await this.getCollection();
      if (!(await this.listIndexes()).includes(indexName)) {
        throw new Error(`Index ${indexName} does not exist`);
      }
      const index = await this.scope.searchIndexes().getIndex(indexName);
      const dimensions =
        index.params.mapping?.types?.[`${this.scopeName}.${this.collectionName}`]?.properties?.embedding?.fields?.[0]
          ?.dims;

      const count = -1; // Not added support yet for adding a count of documents covered by an index

      const metric = index.params.mapping?.types?.[`${this.scopeName}.${this.collectionName}`]?.properties?.embedding
        ?.fields?.[0]?.similarity as CouchbaseMetric;
      return {
        dimension: dimensions,
        count: count,
        metric: Object.keys(DISTANCE_MAPPING).find(
          key => DISTANCE_MAPPING[key as MastraMetric] === metric,
        ) as MastraMetric,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      await this.getCollection();
      if (!(await this.listIndexes()).includes(indexName)) {
        throw new Error(`Index ${indexName} does not exist`);
      }
      await this.scope.searchIndexes().dropIndex(indexName);
      this.vector_dimension = null as unknown as number;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ id, update }: UpdateVectorParams): Promise<void> {
    if (!id) {
      throw new MastraError({
        id: createVectorErrorId('COUCHBASE', 'UPDATE_VECTOR', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id is required for Couchbase updateVector',
        details: {},
      });
    }

    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }
      if (update.vector && this.vector_dimension && update.vector.length !== this.vector_dimension) {
        throw new Error('Vector dimension mismatch');
      }
      const collection = await this.getCollection();

      // Check if document exists
      try {
        await collection.get(id);
      } catch (err: any) {
        if (err.code === 13 || err.message?.includes('document not found')) {
          throw new Error(`Vector with id ${id} does not exist`);
        }
        throw err;
      }

      const specs: MutateInSpec[] = [];
      if (update.vector) specs.push(MutateInSpec.replace('embedding', update.vector));
      if (update.metadata) specs.push(MutateInSpec.replace('metadata', update.metadata));

      await collection.mutateIn(id, specs);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(id && { id }),
            hasVectorUpdate: !!update.vector,
            hasMetadataUpdate: !!update.metadata,
          },
        },
        error,
      );
    }
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ id }: DeleteVectorParams): Promise<void> {
    try {
      const collection = await this.getCollection();

      // Check if document exists
      try {
        await collection.get(id);
      } catch (err: any) {
        if (err.code === 13 || err.message?.includes('document not found')) {
          throw new Error(`Vector with id ${id} does not exist`);
        }
        throw err;
      }

      await collection.remove(id);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(id && { id }),
          },
        },
        error,
      );
    }
  }

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams): Promise<void> {
    throw new MastraError({
      id: createVectorErrorId('COUCHBASE', 'DELETE_VECTORS', 'NOT_SUPPORTED'),
      text: 'deleteVectors is not yet implemented for Couchbase vector store',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: {
        indexName,
        ...(filter && { filter: JSON.stringify(filter) }),
        ...(ids && { idsCount: ids.length }),
      },
    });
  }

  async disconnect() {
    try {
      if (!this.cluster) {
        return;
      }
      await this.cluster.close();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('COUCHBASE', 'DISCONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
