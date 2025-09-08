// Core imports
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
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
} from '@mastra/core/vector';
// External packages
import type { Bucket, Cluster, Collection, Scope } from 'couchbase';
import { MutateInSpec, connect } from 'couchbase';
// Local imports
import type { QV_CouchbaseVectorFilter } from './filters';
import { QV_CouchbaseFilterTranslator } from './filters';
// Local constants
import type { CouchbaseVectorParams } from './index';

// Local types
type MastraMetric = 'cosine' | 'euclidean' | 'dotproduct';
type CouchbaseQueryVectorIndexMetric = 'COSINE' | 'L2_SQUARED' | 'DOT';
export const QUERY_VECTOR_INDEX_DISTANCE_MAPPING: Record<MastraMetric, CouchbaseQueryVectorIndexMetric> = {
  cosine: 'COSINE',
  euclidean: 'L2_SQUARED',
  dotproduct: 'DOT',
};

type FieldsToIndex = {
  field_name: string;
  field_type: string | null;
};
type CouchbaseQueryVectorIndexStats = IndexStats & {
  index_metadata?: {
    description?: string;
    scan_nprobes?: number;
    num_replicas?: number;
    num_partitions?: number;
    retain_deleted_xattr?: boolean;
  };
  fields_to_index?: FieldsToIndex[];
};

export class CouchbaseQueryStore extends MastraVector<QV_CouchbaseVectorFilter> {
  private clusterPromise: Promise<Cluster>;
  private cluster: Cluster;
  private bucketName: string;
  private collectionName: string;
  private scopeName: string;
  private collection: Collection;
  private bucket: Bucket;
  private scope: Scope;
  private vector_dimension: number;

  constructor({ connectionString, username, password, bucketName, scopeName, collectionName }: CouchbaseVectorParams) {
    super();

    try {
      const baseClusterPromise = connect(connectionString, {
        username,
        password,
        configProfile: 'wanDevelopment',
      });

      const telemetry = this.__getTelemetry();
      this.clusterPromise =
        telemetry?.traceClass(baseClusterPromise, {
          spanNamePrefix: 'couchbase-query-vector',
          attributes: {
            'vector.type': 'couchbase_query_store',
          },
        }) ?? baseClusterPromise;
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
          id: 'COUCHBASE_QUERY_VECTOR_INITIALIZE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            connectionString,
            username,
            password,
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

  private parseIndexKeyString(index_key_string: string): { field_name: string; field_type: string | null } {
    // Regex to match the format: `anything` optional_space_and_text
    const regex = /^`(?<first>.*?)`(?:\s(?<second>.*))?$/;
    const match = index_key_string.match(regex);

    if (match && match.groups) {
      const { first, second } = match.groups;
      return {
        field_name: first || '',
        field_type: second || null, // `second` will be undefined if the group doesn't exist, so we convert it to null.
      };
    }

    // Handle cases where the string doesn't match the expected format
    return { field_name: '', field_type: null };
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count, metric, index_metadata and fields_to_index
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<CouchbaseQueryVectorIndexStats> {
    try {
      // Get the collection
      await this.getCollection();

      // Check if the index exists
      if (!(await this.listIndexes()).includes(indexName)) {
        throw new Error(`Index ${indexName} does not exist`);
      }

      // Initialize the index object
      let index: Record<string, any> = {};

      // Get the index definition
      const sqlpp_query = `SELECT idx.* FROM system:indexes AS idx WHERE idx.bucket_id = "${this.bucketName}" AND idx.scope_id = "${this.scopeName}" AND idx.keyspace_id = "${this.collectionName}" AND idx.name = "${indexName}";`;
      const results = await this.cluster.query(sqlpp_query);
      results.rows.forEach((row: any) => {
        if (row.name === indexName) {
          index = row;
        }
      });

      // Extract the index statistics
      const dimensions = index.with.dimension;
      const count = -1; // Not added support yet for adding a count of documents covered by an index
      const metric = index.with.similarity.toUpperCase() as CouchbaseQueryVectorIndexMetric;
      const description = index.with.description;
      const fields_to_index = index.index_key
        .map((field: string) => this.parseIndexKeyString(field)) // Extract the field name and type
        .filter((fieldName: { field_name: string; field_type: string | null }) => fieldName.field_name.trim() !== ''); // Filter out fields that are not strings
      const scan_nprobes = index.with.scan_nprobes;
      const num_replicas = index.with.num_replica;
      const num_partitions = index.with.num_partition;
      const retain_deleted_xattr = index.with.retain_deleted_xattr;

      // Return the index statistics
      return {
        dimension: dimensions,
        count: count,
        metric: Object.keys(QUERY_VECTOR_INDEX_DISTANCE_MAPPING).find(
          key => QUERY_VECTOR_INDEX_DISTANCE_MAPPING[key as MastraMetric] === metric,
        ) as MastraMetric,
        index_metadata: {
          description: description,
          scan_nprobes: scan_nprobes,
          num_replicas: num_replicas,
          num_partitions: num_partitions,
          retain_deleted_xattr: retain_deleted_xattr,
        },
        fields_to_index: fields_to_index,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'COUCHBASE_QUERY_VECTOR_DESCRIBE_INDEX_FAILED',
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

  async createIndex({
    indexName,
    dimension,
    metric = 'dotproduct' as MastraMetric,
    fields_to_index = [],
    gsi_vector_index_type = 'bhive',
    index_metadata = {},
  }: CreateIndexParams & {
    fields_to_index?: string[];
    gsi_vector_index_type?: 'bhive' | 'composite';
    index_metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Get the collection
      await this.getCollection();

      // Check if the dimension is a positive integer
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }

      // Set the vector dimension
      this.vector_dimension = dimension;

      // Initialize the default index metadata
      let default_index_metadata: Record<string, any> = {
        description: 'IVF,SQ8',
        dimension: dimension,
        similarity: QUERY_VECTOR_INDEX_DISTANCE_MAPPING[metric as MastraMetric],
      };

      // Initialize the fields clause
      const fields_clause: string =
        fields_to_index.length > 0 ? `${fields_to_index.map((field: string) => `metadata.${field}`).join(',')}` : '';
      let sqlpp_query: string = '';

      // Create the SQL++ query
      if (gsi_vector_index_type === 'bhive') {
        for (const key of Object.keys(index_metadata)) {
          if (Object.keys(default_index_metadata).includes(key)) {
            default_index_metadata[key] = index_metadata[key];
          }
        }
        let fields_string: string = fields_clause.length > 0 ? `INCLUDE (${fields_clause})` : '';
        sqlpp_query = `CREATE VECTOR INDEX \`${indexName}\` ON ${this.bucketName}.${this.scopeName}.${this.collectionName} (embedding VECTOR) ${fields_string} USING GSI WITH ${JSON.stringify(default_index_metadata)};`;
      } else if (gsi_vector_index_type === 'composite') {
        for (const key of Object.keys(index_metadata)) {
          if (Object.keys(default_index_metadata).includes(key)) {
            default_index_metadata[key] = index_metadata[key];
          }
        }
        let fields_string: string = fields_clause.length > 0 ? `${fields_clause},` : '';
        sqlpp_query = `CREATE INDEX \`${indexName}\` ON ${this.bucketName}.${this.scopeName}.${this.collectionName} (${fields_string}embedding VECTOR) USING GSI WITH ${JSON.stringify(default_index_metadata)};`;
      } else {
        throw new Error('GSI vector index type must be either "bhive" or "composite"');
      }

      // Execute the SQL++ query
      await this.scope.query(sqlpp_query);
    } catch (error: any) {
      // Check for 'already exists' error (Couchbase may throw a 400 or 409, or have a message)
      const message = error?.message || error?.toString();
      if (message && message.toLowerCase().includes('index exists')) {
        await this.validateExistingIndex(indexName, dimension, metric as MastraMetric);
        return;
      }
      throw new MastraError(
        {
          id: 'COUCHBASE_QUERY_VECTOR_CREATE_INDEX_FAILED',
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

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
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
      const records = vectors.map((vector: number[], i: number) => {
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
          id: 'COUCHBASE_QUERY_VECTOR_UPSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    includeVector = false,
    filter = {} as QV_CouchbaseVectorFilter,
  }: QueryVectorParams<QV_CouchbaseVectorFilter>): Promise<QueryResult[]> {
    try {
      // Get the collection
      await this.getCollection();

      // Checking if the query vector is the same dimension as the index
      const index_stats = await this.describeIndex({ indexName });

      // Check if the query vector is the same dimension as the index
      if (queryVector.length !== index_stats.dimension) {
        throw new Error(
          `Query vector dimension mismatch. Expected ${index_stats.dimension}, got ${queryVector.length}`,
        );
      }

      // Translating the filter
      const translator = new QV_CouchbaseFilterTranslator();
      const transformed_filter = translator.translate(filter);

      // Create the SQL++ query
      const sqlpp_query = `
            SELECT c.metadata as metadata ${includeVector ? ', c.embedding as vector' : ''}
            , META(c).id AS id
            , APPROX_VECTOR_DISTANCE(
                c.embedding, 
                [${queryVector}],
                "${QUERY_VECTOR_INDEX_DISTANCE_MAPPING[index_stats.metric as MastraMetric]}"
            ) AS score
            FROM ${this.bucketName}.${this.scopeName}.${this.collectionName} AS c
            ${transformed_filter.length > 0 ? `WHERE ${transformed_filter}` : ''}
            ORDER BY score ASC
            LIMIT ${topK};`;

      // Execute the query
      const results = await this.cluster.query(sqlpp_query);

      const output = [];
      for (const match of results.rows) {
        output.push(match);
      }
      return output;
    } catch (error) {
      throw new MastraError(
        {
          id: 'COUCHBASE_QUERY_VECTOR_QUERY_FAILED',
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
      const indexes = await this.cluster
        .queryIndexes()
        .getAllIndexes(this.bucketName, { scopeName: this.scopeName, collectionName: this.collectionName });
      return indexes?.map((index: any) => index.name) || [];
    } catch (error) {
      throw new MastraError(
        {
          id: 'COUCHBASE_QUERY_VECTOR_LIST_INDEXES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      await this.cluster.queryIndexes().dropIndex(this.bucketName, indexName, {
        scopeName: this.scopeName,
        collectionName: this.collectionName,
        ignoreIfNotExists: true,
      });
      this.vector_dimension = null as unknown as number;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'COUCHBASE_QUERY_VECTOR_DELETE_INDEX_FAILED',
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
          id: 'COUCHBASE_QUERY_VECTOR_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            id,
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
          id: 'COUCHBASE_QUERY_VECTOR_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            id,
          },
        },
        error,
      );
    }
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
          id: 'COUCHBASE_QUERY_VECTOR_DISCONNECT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
