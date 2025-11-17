import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
  type VectorQuery,
  type VectorSearchOptions,
  type SemanticSearchOptions,
  type SearchRequestOptions,
  type VectorizedQuery,
  type VectorizableTextQuery,
  type SearchClientOptions,
} from '@azure/search-documents';
import type { TokenCredential } from '@azure/core-auth';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '@mastra/core/vector';
import { MastraVector } from '@mastra/core/vector';
import type { AzureAISearchVectorFilter } from './filter';
import { AzureAISearchFilterTranslator } from './filter';

/**
 * Configuration options for Azure AI Search vector store
 */
export interface AzureAISearchVectorOptions {
  /** The endpoint URL of your Azure AI Search service */
  endpoint: string;
  /** Authentication credential - either API key or Azure credential */
  credential: string | AzureKeyCredential | TokenCredential;
  /** API version (optional, defaults to latest) */
  apiVersion?: string;
  /**
   * Additional options for SearchClient (optional)
   * Use this to pass custom policies like AXET proxy, retry options, etc.
   *
   * @example
   * ```typescript
   * clientOptions: {
   *   additionalPolicies: [{
   *     position: 'perCall',
   *     policy: createAxetProxyPolicy({ ... })
   *   }]
   * }
   * ```
   */
  clientOptions?: Omit<SearchClientOptions, 'apiVersion'>;
}

/**
 * Azure AI Search document structure for vector storage
 */
interface AzureAISearchDocument {
  /** Unique identifier for the document */
  id: string;
  /** Vector embedding */
  vector: number[];
  /** Metadata associated with the document (stored as JSON string) */
  metadata: string;
  /** Optional content field */
  content?: string;
}

/**
 * Mapping of Mastra metrics to Azure AI Search vector similarity functions
 */
const METRIC_MAPPING = {
  cosine: 'cosine',
  euclidean: 'euclidean',
  dotproduct: 'dotProduct',
} as const;

// Type removed as it's not used

type AzureAISearchQueryVectorParams = QueryVectorParams<AzureAISearchVectorFilter>;

/**
 * Extended index creation parameters for Azure AI Search specific features
 */
export interface AzureAISearchCreateIndexParams extends CreateIndexParams {
  /** Name of the vector field (defaults to 'vector') */
  vectorField?: string;
  /** Additional fields to include in the index schema */
  additionalFields?: Array<{
    name: string;
    type: string;
    searchable?: boolean;
    filterable?: boolean;
    retrievable?: boolean;
    sortable?: boolean;
    facetable?: boolean;
    key?: boolean;
  }>;
  /** HNSW algorithm parameters */
  hnswParameters?: {
    m?: number;
    efConstruction?: number;
    efSearch?: number;
  };
  /** Semantic search configuration */
  semanticConfig?: {
    name?: string;
    prioritizedFields?: {
      /** Single title field for semantic ranking */
      titleField?: { fieldName: string };
      /** Content fields for semantic ranking (renamed from contentFields) */
      prioritizedContentFields?: Array<{ fieldName: string }>;
      /** Keywords fields for semantic ranking (renamed from keywordsFields) */
      prioritizedKeywordsFields?: Array<{ fieldName: string }>;
    };
  };
}

/**
 * Extended query parameters for Azure AI Search advanced features
 */
export interface AzureAISearchAdvancedQueryParams extends AzureAISearchQueryVectorParams {
  /** Enable semantic search capabilities */
  useSemanticSearch?: boolean;
  /** Semantic search configuration */
  semanticOptions?: {
    /** Name of semantic configuration in the index */
    configurationName?: string;
    /** Separate query for semantic reranking */
    semanticQuery?: string;
    /** Enable answer extraction from documents */
    answers?: boolean;
    /** Enable caption extraction from documents */
    captions?: boolean;
    /** Maximum wait time for semantic processing (ms) */
    maxWaitTime?: number;
  };
  /** Use exhaustive k-NN search for exact results */
  exhaustiveSearch?: boolean;
  /** Oversampling factor for compressed vectors */
  oversampling?: number;
  /** Relative weight for this vector query in hybrid scenarios */
  weight?: number;
  /** Query type: simple, full, or semantic */
  queryType?: 'simple' | 'full' | 'semantic';
  /** Enable automatic text vectorization */
  textVectorization?: {
    /** Text to vectorize and search */
    text: string;
    /** Vector fields to search against */
    fields?: string[];
  };
  /** Multiple vector queries for hybrid search */
  additionalVectorQueries?: Array<{
    vector: number[];
    fields?: string[];
    weight?: number;
    kNearestNeighborsCount?: number;
  }>;
  /** Vector filter mode: apply before or after vector search */
  filterMode?: 'preFilter' | 'postFilter';
}

/**
 * Azure AI Search vector store implementation for Mastra
 *
 * This implementation provides vector storage and similarity search capabilities
 * using Azure AI Search's vector search features.
 *
 * @example
 * ```typescript
 * const azureVector = new AzureAISearchVector({
 *   id: 'azure-search-vectors',
 *   endpoint: 'https://your-service.search.windows.net',
 *   credential: 'your-api-key'
 * });
 *
 * // Create an index
 * await azureVector.createIndex({
 *   indexName: 'products',
 *   dimension: 1536,
 *   metric: 'cosine'
 * });
 *
 * // Insert vectors
 * const ids = await azureVector.upsert({
 *   indexName: 'products',
 *   vectors: [[0.1, 0.2, ...], [0.3, 0.4, ...]],
 *   metadata: [{ category: 'electronics' }, { category: 'books' }]
 * });
 *
 * // Search vectors
 * const results = await azureVector.query({
 *   indexName: 'products',
 *   queryVector: [0.1, 0.2, ...],
 *   topK: 5,
 *   filter: { eq: { category: 'electronics' } }
 * });
 * ```
 */
export class AzureAISearchVector extends MastraVector<AzureAISearchVectorFilter> {
  private endpoint: string;
  private credential: string | AzureKeyCredential | TokenCredential;
  private apiVersion?: string;
  private clientOptions?: Omit<SearchClientOptions, 'apiVersion'>;
  private indexClient: SearchIndexClient;
  private searchClients: Map<string, SearchClient<AzureAISearchDocument>> = new Map();

  constructor({ id, endpoint, credential, apiVersion, clientOptions }: AzureAISearchVectorOptions & { id: string }) {
    super({ id });

    this.endpoint = endpoint;
    this.credential = credential;
    this.apiVersion = apiVersion;
    this.clientOptions = clientOptions;

    // Initialize the index client for managing indexes
    this.indexClient = new SearchIndexClient(
      endpoint,
      typeof credential === 'string' ? new AzureKeyCredential(credential) : credential,
      { apiVersion },
    );
  }

  /**
   * Static factory method for easier instantiation with connection string
   */
  static fromConnectionString(connectionString: string, options?: { id?: string; apiVersion?: string }) {
    const url = new URL(connectionString);
    const endpoint = url.origin;
    const apiKey = url.searchParams.get('api-key') || url.searchParams.get('key');

    if (!apiKey) {
      throw new Error('API key not found in connection string');
    }

    return new AzureAISearchVector({
      id: options?.id || 'azure-ai-search',
      endpoint,
      credential: apiKey,
      apiVersion: options?.apiVersion,
    });
  }

  /**
   * Gets or creates a search client for a specific index
   */
  private getSearchClient(indexName: string): SearchClient<AzureAISearchDocument> {
    if (!this.searchClients.has(indexName)) {
      const client = new SearchClient<AzureAISearchDocument>(
        this.endpoint,
        indexName,
        typeof this.credential === 'string' ? new AzureKeyCredential(this.credential) : this.credential,
        {
          apiVersion: this.apiVersion,
          ...this.clientOptions, // Merge custom client options
        },
      );
      this.searchClients.set(indexName, client);
    }
    return this.searchClients.get(indexName)!;
  }

  /**
   * Detects the vector field name in an existing index
   * Falls back to 'vector' for backward compatibility
   *
   * @param indexName - Name of the index
   * @returns The name of the vector field
   */
  private async getVectorFieldName(indexName: string): Promise<string> {
    try {
      const index = await this.indexClient.getIndex(indexName);
      const vectorField = index.fields?.find(
        (field: any) => field.type === 'Collection(Edm.Single)' && (field.dimensions || field.vectorSearchDimensions),
      );

      // Return the found vector field name, or default to 'vector' for backward compatibility
      return vectorField?.name || 'vector';
    } catch (error) {
      // If we can't determine the vector field name, fall back to 'vector' for backward compatibility
      return 'vector';
    }
  }

  /**
   * Creates a new vector search index with the specified configuration
   *
   * @param params - Index creation parameters (supports both basic Mastra interface and Azure AI Search extended options)
   * @throws {MastraError} When index creation fails or invalid parameters are provided
   */
  async createIndex(params: CreateIndexParams | AzureAISearchCreateIndexParams): Promise<void> {
    const {
      indexName,
      dimension,
      metric = 'cosine',
      vectorField = 'vector',
      additionalFields = [],
      hnswParameters = {},
      semanticConfig,
    } = params as AzureAISearchCreateIndexParams;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new MastraError({
        id: 'STORAGE_AZURE_AI_SEARCH_CREATE_INDEX_INVALID_DIMENSION',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Dimension must be a positive integer',
        details: { indexName, dimension },
      });
    }

    try {
      const similarityFunction = METRIC_MAPPING[metric as keyof typeof METRIC_MAPPING];

      // Vector field configuration (customizable name)
      const vectorFieldConfig = {
        name: vectorField,
        type: 'Collection(Edm.Single)',
        searchable: true,
        retrievable: true,
        vectorSearchDimensions: dimension,
        vectorSearchProfileName: 'vector-profile',
      };

      // Core default fields (aligned with other Mastra vector stores)
      const defaultFields = [
        {
          name: 'id',
          type: 'Edm.String',
          key: true,
          filterable: false,
          sortable: false,
          facetable: false,
          searchable: false,
        },
        vectorFieldConfig,
        {
          name: 'metadata',
          type: 'Edm.String',
          searchable: false,
          filterable: true,
          sortable: false,
          facetable: false,
        },
        {
          name: 'content',
          type: 'Edm.String',
          searchable: true,
          filterable: false,
          sortable: false,
          facetable: false,
        },
      ];

      // Merge default fields with additional fields (avoid duplicates)
      const existingFieldNames = new Set(defaultFields.map(f => f.name));
      const allFields = [...defaultFields, ...additionalFields.filter(field => !existingFieldNames.has(field.name))];

      // HNSW parameters with customizable values
      const hnswConfig = {
        metric: similarityFunction,
        m: hnswParameters.m ?? 4,
        efConstruction: hnswParameters.efConstruction ?? 400,
        efSearch: hnswParameters.efSearch ?? 500,
      };

      const indexDefinition: any = {
        name: indexName,
        fields: allFields,
        vectorSearch: {
          profiles: [
            {
              name: 'vector-profile',
              algorithmConfigurationName: 'vector-algorithm',
            },
          ],
          algorithms: [
            {
              name: 'vector-algorithm',
              kind: 'hnsw',
              hnswParameters: hnswConfig,
            },
          ],
        },
      };

      // Add semantic search configuration if provided
      if (semanticConfig) {
        indexDefinition.semantic = {
          configurations: [
            {
              name: semanticConfig.name ?? 'default-semantic-config',
              prioritizedFields: semanticConfig.prioritizedFields ?? {
                titleField: { fieldName: 'content' },
                prioritizedContentFields: [{ fieldName: 'content' }],
                prioritizedKeywordsFields: [{ fieldName: 'tags' }],
              },
            },
          ],
        };
      }

      await this.indexClient.createIndex(indexDefinition as any);

      // Index created successfully
    } catch (error: any) {
      // Check if index already exists
      if (error?.statusCode === 409 || error?.message?.includes('already exists')) {
        // Index already exists, that's fine
        // Index already exists, that's fine
        return;
      }

      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_CREATE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }
  }

  /**
   * Creates an advanced vector search index with full Azure AI Search capabilities
   *
   * @param params - Extended Azure AI Search index creation parameters
   * @throws {MastraError} When index creation fails or invalid parameters are provided
   */
  async createAdvancedIndex(params: AzureAISearchCreateIndexParams): Promise<void> {
    return this.createIndex(params);
  }

  /**
   * Lists all available indexes in the Azure AI Search service
   *
   * @returns Array of index names
   * @throws {MastraError} When listing indexes fails
   */
  async listIndexes(): Promise<string[]> {
    try {
      const indexes = [];
      const indexIterator = this.indexClient.listIndexes();

      for await (const index of indexIterator) {
        indexes.push(index.name);
      }

      return indexes;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_LIST_INDEXES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Retrieves statistics and configuration information about an index
   *
   * @param indexName - Name of the index to describe
   * @returns Index statistics including dimension, count, and metric
   * @throws {MastraError} When describing index fails
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      // Get index definition
      const index = await this.indexClient.getIndex(indexName);

      // Get document count
      const searchClient = this.getSearchClient(indexName);
      const countResult = await searchClient.getDocumentsCount();

      // Extract vector field information (find any vector field)
      const vectorField = index.fields?.find(
        (field: any) => field.type === 'Collection(Edm.Single)' && (field.dimensions || field.vectorSearchDimensions),
      ) as any;

      // For backward compatibility, if no vector field found or no dimensions,
      // try to find 'vector' field specifically or use default values
      if (!vectorField || (!vectorField.dimensions && !vectorField.vectorSearchDimensions)) {
        const defaultVectorField = index.fields?.find((field: any) => field.name === 'vector') as any;
        if (defaultVectorField && (defaultVectorField.dimensions || defaultVectorField.vectorSearchDimensions)) {
          // Use the default 'vector' field
          const dimension = defaultVectorField.dimensions || defaultVectorField.vectorSearchDimensions;
          return {
            dimension,
            count: countResult,
            metric: 'cosine', // Default metric for backward compatibility
          };
        }
        throw new Error('Vector field not found or missing dimensions');
      }

      // Extract metric from vector search configuration
      let metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine';
      if (index.vectorSearch?.algorithms) {
        const algorithm = index.vectorSearch.algorithms[0] as any;
        if (algorithm?.hnswParameters?.metric) {
          const azureMetric = algorithm.hnswParameters.metric;
          // Reverse lookup
          const metricEntry = Object.entries(METRIC_MAPPING).find(([_, value]) => value === azureMetric);
          if (metricEntry) {
            metric = metricEntry[0] as 'cosine' | 'euclidean' | 'dotproduct';
          }
        }
      }

      return {
        dimension: vectorField.dimensions || vectorField.vectorSearchDimensions,
        count: countResult,
        metric,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_DESCRIBE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Deletes an index and all its documents
   *
   * @param indexName - Name of the index to delete
   * @throws {MastraError} When deletion fails
   */
  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      await this.indexClient.deleteIndex(indexName);

      // Remove cached search client
      this.searchClients.delete(indexName);

      // Index deleted successfully
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_DELETE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Inserts or updates vectors in the specified index
   *
   * @param indexName - Name of the index to upsert into
   * @param vectors - Array of vectors to upsert
   * @param metadata - Array of metadata objects corresponding to each vector
   * @param ids - Array of IDs corresponding to each vector (auto-generated if not provided)
   * @returns Array of IDs of the upserted vectors
   * @throws {MastraError} When upsert operation fails
   */
  async upsert({ indexName, vectors, metadata = [], ids }: UpsertVectorParams): Promise<string[]> {
    try {
      // Get index info to validate vector dimensions and detect vector field
      const indexInfo = await this.describeIndex({ indexName });
      this.validateVectorDimensions(vectors, indexInfo.dimension);

      // Detect vector field name
      const vectorFieldName = await this.getVectorFieldName(indexName);

      // Generate IDs if not provided
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      // Prepare documents for upload using dynamic vector field
      const documents = vectors.map((vector: number[], i: number) => {
        const doc: any = {
          id: vectorIds[i],
          [vectorFieldName]: vector, // Dynamic vector field name
          metadata: JSON.stringify(metadata[i] || {}),
          content: metadata[i]?.content || '',
        };
        return doc;
      });

      // Upload documents
      const searchClient = this.getSearchClient(indexName);
      const uploadResult = await searchClient.uploadDocuments(documents);

      // Check for failures
      const failures = uploadResult.results.filter(result => !result.succeeded);
      if (failures.length > 0) {
        throw new MastraError(
          {
            id: 'STORAGE_AZURE_AI_SEARCH_UPSERT_PARTIAL_FAILURE',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: {
              indexName,
              totalDocuments: uploadResult.results.length,
              failedCount: failures.length,
              firstFailedKey: failures[0]?.key || 'unknown',
              firstFailedError: failures[0]?.errorMessage || 'No error message',
            },
          },
          new Error(`${failures.length} of ${uploadResult.results.length} documents failed to upload`),
        );
      }

      return vectorIds;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_UPSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors?.length || 0 },
        },
        error,
      );
    }
  }

  /**
   * Standard MastraVector query method - compatible with Memory integration
   *
   * @param params - Standard query parameters compatible with MastraVector interface
   * @returns Array of search results with scores and metadata
   * @throws {MastraError} When search operation fails
   */
  async query(params: QueryVectorParams<AzureAISearchVectorFilter>): Promise<QueryResult[]> {
    return this.advancedQuery(params);
  }

  /**
   * Advanced vector similarity search with full Azure AI Search capabilities
   *
   * @param indexName - Name of the index to search
   * @param queryVector - Vector to search with
   * @param topK - Maximum number of results to return
   * @param filter - Optional filter to apply to the search
   * @param includeVector - Whether to include vector data (Note: Always false for Azure AI Search due to platform limitations)
   * @param useSemanticSearch - Enable semantic search for better relevance
   * @param semanticOptions - Configuration for semantic search features
   * @param exhaustiveSearch - Use exhaustive k-NN search for exact results
   * @param oversampling - Oversampling factor for compressed vectors
   * @param weight - Relative weight for this vector query in hybrid scenarios
   * @param queryType - Query type: simple, full, or semantic
   * @param textVectorization - Enable automatic text vectorization
   * @param additionalVectorQueries - Multiple vector queries for hybrid search
   * @param filterMode - Apply filters before or after vector search
   * @returns Array of search results with scores and metadata
   * @throws {MastraError} When search operation fails
   *
   * Note: Vector fields are not retrievable in Azure AI Search, so vectors
   * are never included in query results regardless of includeVector parameter.
   */
  async advancedQuery({
    indexName,
    queryVector,
    filter,
    topK = 10,
    includeVector = false, // Kept for API compatibility but ignored due to Azure AI Search limitations
    useSemanticSearch = false,
    semanticOptions,
    exhaustiveSearch = false,
    oversampling,
    weight = 1.0,
    queryType = 'simple',
    textVectorization,
    additionalVectorQueries = [],
    filterMode = 'preFilter',
  }: AzureAISearchAdvancedQueryParams): Promise<QueryResult[]> {
    // Note: includeVector is ignored due to Azure AI Search limitations - vectors are not retrievable
    void includeVector;
    try {
      const searchClient = this.getSearchClient(indexName);

      // Detect vector field name
      const vectorFieldName = await this.getVectorFieldName(indexName);

      // Translate filter to OData syntax
      const odataFilter = this.transformFilter(filter);

      // Prepare primary vector query using dynamic field name
      const primaryVectorQuery: VectorizedQuery<any> = {
        kind: 'vector' as const,
        vector: queryVector,
        kNearestNeighborsCount: topK,
        fields: [vectorFieldName],
        exhaustive: exhaustiveSearch,
        weight: weight,
        ...(oversampling && { oversampling }),
      };

      // Prepare additional vector queries for hybrid search
      const allVectorQueries: VectorQuery<any>[] = [primaryVectorQuery];

      // Add text vectorization query if specified
      if (textVectorization) {
        const textQuery: VectorizableTextQuery<any> = {
          kind: 'text' as const,
          text: textVectorization.text,
          fields: textVectorization.fields || [vectorFieldName],
          kNearestNeighborsCount: topK,
          exhaustive: exhaustiveSearch,
          weight: weight,
        };
        allVectorQueries.push(textQuery);
      }

      // Add additional vector queries
      additionalVectorQueries.forEach(vq => {
        const vectorQuery: VectorizedQuery<any> = {
          kind: 'vector' as const,
          vector: vq.vector,
          kNearestNeighborsCount: vq.kNearestNeighborsCount || topK,
          fields: vq.fields || [vectorFieldName],
          weight: vq.weight || 1.0,
          exhaustive: exhaustiveSearch,
        };
        allVectorQueries.push(vectorQuery);
      });

      // Prepare vector search options
      const vectorSearchOptions: VectorSearchOptions<any> = {
        queries: allVectorQueries,
        filterMode: filterMode,
      };

      // Prepare field selection
      const selectFields = ['id', 'metadata', 'content'];

      // Build search options
      let searchOptions: SearchRequestOptions<any> = {
        vectorSearchOptions,
        filter: odataFilter,
        top: topK,
        select: selectFields,
      };

      // Add semantic search if enabled
      if (useSemanticSearch || queryType === 'semantic') {
        const semanticSearchOptions: SemanticSearchOptions = {
          configurationName: semanticOptions?.configurationName || 'default-semantic-config',
          ...(semanticOptions?.semanticQuery && { semanticQuery: semanticOptions.semanticQuery }),
          ...(semanticOptions?.answers && {
            answers: {
              answerType: 'extractive' as const,
              count: 3,
              threshold: 0.7,
            },
          }),
          ...(semanticOptions?.captions && {
            captions: {
              captionType: 'extractive' as const,
              highlight: true,
            },
          }),
          ...(semanticOptions?.maxWaitTime && { maxWaitInMilliseconds: semanticOptions.maxWaitTime }),
        };

        searchOptions = {
          ...searchOptions,
          queryType: 'semantic' as const,
          semanticSearchOptions,
        };
      } else {
        searchOptions = {
          ...searchOptions,
          queryType: queryType === 'full' ? ('full' as const) : ('simple' as const),
        };
      }

      // Perform search
      const searchResults = await searchClient.search('*', searchOptions as any);

      // Process results - Azure SDK returns PagedAsyncIterableIterator
      const results: QueryResult[] = [];
      for await (const result of searchResults as any) {
        if (result.document) {
          const queryResult: QueryResult = {
            id: result.document.id,
            score: result.score || 0,
            metadata: result.document.metadata ? JSON.parse(result.document.metadata) : {},
            document: result.document.content,
            // Note: Vector field is not retrievable in Azure AI Search, so it's not included
            // even when includeVector is true
          };

          // Add semantic-specific fields if available
          if (result.rerankerScore) {
            queryResult.metadata = queryResult.metadata || {};
            queryResult.metadata['@search.rerankerScore'] = result.rerankerScore;
          }
          if (result.captions && result.captions.length > 0) {
            queryResult.metadata = queryResult.metadata || {};
            queryResult.metadata['@search.captions'] = result.captions;
          }
          if (result.highlights) {
            queryResult.metadata = queryResult.metadata || {};
            queryResult.metadata['@search.highlights'] = result.highlights;
          }

          results.push(queryResult);
        }
      }

      return results;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_QUERY_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, topK },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector and/or its metadata by ID
   *
   * @param indexName - Name of the index containing the vector
   * @param id - ID of the vector to update
   * @param update - Object containing vector and/or metadata updates
   * @throws {MastraError} When update operation fails
   */
  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

      const searchClient = this.getSearchClient(indexName);

      // Get vector field name
      const vectorFieldName = await this.getVectorFieldName(indexName);

      // Get existing document
      const existingDoc = (await searchClient.getDocument(id)) as any;
      if (!existingDoc) {
        throw new Error(`Document with ID ${id} not found`);
      }

      // Validate vector dimension if updating vector
      if (update.vector) {
        const indexInfo = await this.describeIndex({ indexName });
        this.validateVectorDimensions([update.vector], indexInfo.dimension);
      }

      // Prepare updated document using dynamic vector field
      const updatedDoc: any = {
        id,
        [vectorFieldName]: update.vector || existingDoc[vectorFieldName],
        metadata: update.metadata ? JSON.stringify(update.metadata) : existingDoc.metadata,
        content: update.metadata?.content || existingDoc.content || '',
      };

      // Merge documents (update operation)
      await searchClient.mergeDocuments([updatedDoc]);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_UPDATE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }

  /**
   * Deletes a vector by its ID
   *
   * @param indexName - Name of the index containing the vector
   * @param id - ID of the vector to delete
   * @throws {MastraError} When deletion fails
   */
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      const searchClient = this.getSearchClient(indexName);
      await searchClient.deleteDocuments([{ id }] as any); // Type assertion for Azure SDK compatibility
    } catch (error: unknown) {
      // Don't throw error if document doesn't exist (404)
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return;
      }
      throw new MastraError(
        {
          id: 'STORAGE_AZURE_AI_SEARCH_DELETE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }

  /**
   * Validates that all vectors have the correct dimension
   */
  private validateVectorDimensions(vectors: number[][], dimension: number): void {
    for (let i = 0; i < vectors.length; i++) {
      if (vectors[i]?.length !== dimension) {
        throw new Error(
          `Vector at index ${i} has invalid dimension ${vectors[i]?.length}. Expected ${dimension} dimensions.`,
        );
      }
    }
  }

  /**
   * Transforms filter to Azure AI Search OData syntax
   */
  private transformFilter(filter?: AzureAISearchVectorFilter): string | undefined {
    const translator = new AzureAISearchFilterTranslator();
    return translator.translate(filter);
  }

  /**
   * Convenience method for semantic search
   *
   * @param params - Query parameters with semantic search enabled
   * @returns Array of search results with semantic enhancements
   */
  async semanticQuery(
    params: Omit<AzureAISearchAdvancedQueryParams, 'useSemanticSearch' | 'queryType'> & {
      semanticConfig?: string;
      semanticQuery?: string;
      enableAnswers?: boolean;
      enableCaptions?: boolean;
    },
  ): Promise<QueryResult[]> {
    return this.advancedQuery({
      ...params,
      useSemanticSearch: true,
      queryType: 'semantic',
      semanticOptions: {
        configurationName: params.semanticConfig,
        semanticQuery: params.semanticQuery,
        answers: params.enableAnswers,
        captions: params.enableCaptions,
      },
    });
  }

  /**
   * Convenience method for hybrid vector + text search
   *
   * @param params - Query parameters with text vectorization
   * @returns Array of search results from hybrid search
   */
  async hybridQuery(
    params: Omit<AzureAISearchAdvancedQueryParams, 'textVectorization'> & {
      textQuery: string;
      vectorFields?: string[];
    },
  ): Promise<QueryResult[]> {
    return this.advancedQuery({
      ...params,
      textVectorization: {
        text: params.textQuery,
        fields: params.vectorFields,
      },
    });
  }

  /**
   * Convenience method for multi-vector search
   *
   * @param params - Query parameters with multiple vectors
   * @returns Array of search results from multi-vector search
   */
  async multiVectorQuery(
    params: Omit<AzureAISearchAdvancedQueryParams, 'additionalVectorQueries'> & {
      vectors: Array<{
        vector: number[];
        weight?: number;
        fields?: string[];
      }>;
    },
  ): Promise<QueryResult[]> {
    return this.advancedQuery({
      ...params,
      additionalVectorQueries: params.vectors.map(v => ({
        vector: v.vector,
        weight: v.weight,
        fields: v.fields,
        kNearestNeighborsCount: params.topK,
      })),
    });
  }

  /**
   * Convenience method for exhaustive (exact) search
   *
   * @param params - Query parameters with exhaustive search enabled
   * @returns Array of search results from exhaustive search
   */
  async exactQuery(params: Omit<AzureAISearchAdvancedQueryParams, 'exhaustiveSearch'>): Promise<QueryResult[]> {
    return this.advancedQuery({
      ...params,
      exhaustiveSearch: true,
    });
  }
}
