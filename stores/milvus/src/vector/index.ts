import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

import { MilvusFilterTranslator } from './filter';

/**
 * Milvus vector store
 */
export class MilvusStore extends MastraVector {
  private client: MilvusClient;
  private filterTranslator: MilvusFilterTranslator;

  constructor(
    address: string = 'localhost:19530',
    username?: string,
    password?: string,
    ssl: boolean = false,
    private consistencyLevel: 'Strong' | 'Session' | 'Bounded' | 'Eventually' = 'Strong',
  ) {
    super();

    // Initialize Milvus client
    this.client = new MilvusClient({
      address: address,
      username,
      password,
      ssl: ssl,
    });

    // Initialize filter translator
    this.filterTranslator = new MilvusFilterTranslator();
  }

  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);
    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }

    try {
      // Check if collection exists
      const hasCollection = await this.client.hasCollection({
        collection_name: indexName,
      });

      // If collection doesn't exist, create it
      if (!hasCollection.value) {
        // Define schema fields
        const fields = [
          {
            name: 'id',
            description: 'ID field',
            data_type: DataType.VarChar,
            is_primary_key: true,
            max_length: 100,
          },
          {
            name: 'vector',
            description: 'Vector field',
            data_type: DataType.FloatVector,
            dim: dimension,
          },
        ];

        // Create collection with schema and enable dynamic field
        await this.client.createCollection({
          collection_name: indexName,
          fields: fields,
          enable_dynamic_field: true,
          consistency_level: this.consistencyLevel,
        });

        // Create index on vector field
        await this.client.createIndex({
          collection_name: indexName,
          field_name: 'vector',
          index_name: 'vector_index',
          index_type: 'HNSW',
          metric_type: metric.toUpperCase() as 'L2' | 'IP' | 'COSINE',
          params: { M: 8, efConstruction: 200 },
        });

        // Load collection to memory
        await this.client.loadCollectionSync({
          collection_name: indexName,
        });
      }
    } catch (error) {
      throw new Error(`Failed to create Milvus collection: ${error}`);
    }
  }

  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);
    const { indexName, vectors, metadata, ids } = params;

    // Generate IDs if not provided
    const vectorIds = ids || vectors.map(() => crypto.randomUUID());

    // Prepare data for insertion
    const fields_data = vectors.map((vector, i) => ({
      id: vectorIds[i]!,
      vector: vector,
      ...(metadata?.[i] && { ...metadata[i] }),
    }));

    try {
      // Insert data into collection
      await this.client.insert({
        collection_name: indexName,
        fields_data,
      });

      return vectorIds;
    } catch (error) {
      throw new Error(`Failed to insert vectors into Milvus: ${error}`);
    }
  }

  transformFilter(filter?: VectorFilter) {
    return this.filterTranslator.translate(filter);
  }

  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);
    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    try {
      // Transform filter to Milvus expression
      const expr = this.transformFilter(filter);

      // Perform vector search
      const searchResults = await this.client.search({
        collection_name: indexName,
        vector: queryVector,
        limit: topK,
        filter: expr,
        output_fields: ['*'],
        ...(includeVector && { include_vector: true }),
      });

      // Format search results to show only first few numbers of vectors
      const formattedResults = {
        ...searchResults,
        results: searchResults.results.map(result => ({
          ...result,
          vector: result.vector ? `[${result.vector.slice(0, 3).join(', ')}, ...]` : undefined,
        })),
      };

      // Transform results to QueryResult format
      return searchResults.results.map(result => ({
        id: result.id,
        score: result.score,
        metadata: result.$meta || {},
        ...(includeVector && { vector: result.vector || [] }),
      }));
    } catch (error) {
      throw new Error(`Failed to query vectors from Milvus: ${error}`);
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const response = await this.client.listCollections();
      // Extract collection names from the response
      return (response.data || []).map(collection => collection.name);
    } catch (error) {
      throw new Error(`Failed to list Milvus collections: ${error}`);
    }
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    try {
      // Get collection info
      const collectionInfo = await this.client.describeCollection({
        collection_name: indexName,
      });

      // Get collection statistics
      const collectionStats = await this.client.getCollectionStatistics({
        collection_name: indexName,
      });

      // Get the metric type from the collection description or default to cosine
      let metricType = 'cosine';
      if (collectionInfo.schema.description) {
        const desc = collectionInfo.schema.description.toLowerCase();
        if (desc.includes('l2') || desc.includes('euclidean')) {
          metricType = 'euclidean';
        } else if (desc.includes('ip') || desc.includes('dotproduct')) {
          metricType = 'dotproduct';
        }
      }

      // Parse row count as number
      const rowCount =
        typeof collectionStats.data.row_count === 'string'
          ? parseInt(collectionStats.data.row_count, 10)
          : (collectionStats.data.row_count as number) || 0;

      // Get dimension from the vector field
      // We know the vector field is named 'vector' and has a dim property
      const vectorField = collectionInfo.schema.fields.find(f => f.name === 'vector');
      const dimension =
        vectorField && 'dim' in vectorField
          ? typeof vectorField.dim === 'string'
            ? parseInt(vectorField.dim, 10)
            : (vectorField.dim as number)
          : 0;

      return {
        dimension,
        count: rowCount,
        metric: metricType as 'cosine' | 'euclidean' | 'dotproduct',
      };
    } catch (error) {
      throw new Error(`Failed to describe Milvus collection: ${error}`);
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.client.dropCollection({
        collection_name: indexName,
      });
    } catch (error) {
      throw new Error(`Failed to delete Milvus collection: ${error}`);
    }
  }

  async updateVector(
    indexName: string,
    id: string,
    update: {
      vector?: number[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

      // For Milvus, we need to use upsert to update both vector and metadata
      const fields_data = [
        {
          id: id,
          ...(update.vector && { vector: update.vector }),
          ...(update.metadata && { ...update.metadata }),
        },
      ];

      await this.client.upsert({
        collection_name: indexName,
        fields_data,
      });
    } catch (error: any) {
      throw new Error(`Failed to update vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }

  async deleteVector(indexName: string, id: string): Promise<void> {
    try {
      await this.client.delete({
        collection_name: indexName,
        ids: [id],
      });
    } catch (error: any) {
      throw new Error(`Failed to delete vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }
}
