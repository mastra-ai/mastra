import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  ParamsToArgs,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
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

  /**
   * @deprecated Passing parameters as positional arguments is deprecated.
   * Use the object parameter instead. This signature will be removed on May 20th, 2025.
   */
  constructor(
    connectionString: string,
    username: string,
    password: string,
    bucketName: string,
    scopeName: string,
    collectionName: string,
  );
  constructor(params: CouchbaseVectorParams);
  constructor(
    paramsOrConnectionString: CouchbaseVectorParams | string,
    username?: string,
    password?: string,
    bucketName?: string,
    scopeName?: string,
    collectionName?: string,
  ) {
    let connectionString_: string,
      username_: string,
      password_: string,
      bucketName_: string,
      scopeName_: string,
      collectionName_: string;

    if (
      typeof paramsOrConnectionString === 'object' &&
      paramsOrConnectionString !== null &&
      'connectionString' in paramsOrConnectionString
    ) {
      // Object params (preferred)
      connectionString_ = paramsOrConnectionString.connectionString as string;
      username_ = paramsOrConnectionString.username;
      password_ = paramsOrConnectionString.password;
      bucketName_ = paramsOrConnectionString.bucketName;
      scopeName_ = paramsOrConnectionString.scopeName;
      collectionName_ = paramsOrConnectionString.collectionName;
    } else {
      // Positional args (deprecated)
      if (arguments.length > 1) {
        console.warn(
          'Deprecation Warning: CouchbaseVector constructor positional arguments are deprecated. Please use a single object parameter instead. This signature will be removed on May 20th, 2025.',
        );
      }
      connectionString_ = paramsOrConnectionString as string;
      username_ = username!;
      password_ = password!;
      bucketName_ = bucketName!;
      scopeName_ = scopeName!;
      collectionName_ = collectionName!;
    }

    super();

    const baseClusterPromise = connect(connectionString_, {
      username: username_,
      password: password_,
      configProfile: 'wanDevelopment',
    });

    const telemetry = this.__getTelemetry();
    this.clusterPromise =
      telemetry?.traceClass(baseClusterPromise, {
        spanNamePrefix: 'couchbase-vector',
        attributes: {
          'vector.type': 'couchbase',
        },
      }) ?? baseClusterPromise;
    this.cluster = null as unknown as Cluster;
    this.bucketName = bucketName_;
    this.collectionName = collectionName_;
    this.scopeName = scopeName_;
    this.collection = null as unknown as Collection;
    this.bucket = null as unknown as Bucket;
    this.scope = null as unknown as Scope;
    this.vector_dimension = null as unknown as number;
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

  async createIndex(params: CreateIndexParams): Promise<void> {
    const { indexName, dimension, metric = 'dotproduct' as MastraMetric } = params;
    await this.getCollection();

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }

    try {
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
      throw error;
    }
  }

  async upsert(params: UpsertVectorParams): Promise<string[]> {
    const { vectors, metadata, ids } = params;
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
  }

  async query(params: QueryVectorParams): Promise<QueryResult[]> {
    const { indexName, queryVector, topK = 10, includeVector = false } = params;

    await this.getCollection();

    const index_stats = await this.describeIndex(indexName);
    if (queryVector.length !== index_stats.dimension) {
      throw new Error(`Query vector dimension mismatch. Expected ${index_stats.dimension}, got ${queryVector.length}`);
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
  }

  async listIndexes(): Promise<string[]> {
    await this.getCollection();
    const indexes = await this.scope.searchIndexes().getAllIndexes();
    return indexes?.map(index => index.name) || [];
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param params - The parameters for describing an index
   * @param params.indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex(...args: ParamsToArgs<DescribeIndexParams>): Promise<IndexStats> {
    const params = this.normalizeArgs<DescribeIndexParams>('describeIndex', args);
    const { indexName } = params;
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
  }

  async deleteIndex(...args: ParamsToArgs<DeleteIndexParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteIndexParams>('deleteIndex', args);
    const { indexName } = params;
    await this.getCollection();
    if (!(await this.listIndexes()).includes(indexName)) {
      throw new Error(`Index ${indexName} does not exist`);
    }
    await this.scope.searchIndexes().dropIndex(indexName);
    this.vector_dimension = null as unknown as number;
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
  async updateVector(...args: ParamsToArgs<UpdateVectorParams>): Promise<void> {
    const params = this.normalizeArgs<UpdateVectorParams>('updateVector', args);
    const { id, update } = params;
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
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector(...args: ParamsToArgs<DeleteVectorParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteVectorParams>('deleteVector', args);

    const { id } = params;
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
  }
}
