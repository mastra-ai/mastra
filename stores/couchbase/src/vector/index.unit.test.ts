import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { CouchbaseVector, DISTANCE_MAPPING } from './index';

const dimension = vi.hoisted(() => 3);
const test_bucketName = vi.hoisted(() => 'test-bucket');
const test_scopeName = vi.hoisted(() => 'test-scope');
const test_collectionName = vi.hoisted(() => 'test-collection');
const test_indexName = vi.hoisted(() => 'test-index');
const similarity = vi.hoisted(() => 'l2_norm');

const mockUpsertIndexFn = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockGetAllIndexesFn = vi.hoisted(() =>
  vi
    .fn()
    .mockResolvedValue([
      { name: `${test_indexName}` },
      { name: `${test_indexName}_1` },
      { name: `${test_indexName}_2` },
    ]),
);
const mockGetIndexFn = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    name: test_indexName,
    sourceName: test_bucketName,
    type: 'fulltext-index',
    params: {
      mapping: {
        types: {
          [`${test_scopeName}.${test_collectionName}`]: {
            properties: {
              embedding: {
                fields: [
                  {
                    dims: dimension,
                    similarity: similarity,
                  },
                ],
              },
            },
          },
        },
      },
    },
    sourceUuid: 'test-source-uuid',
    sourceParams: {},
    sourceType: 'test-source-type',
    planParams: {},
  }),
);
const mockDropIndexFn = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockScopeSearchIndexesFn = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    upsertIndex: mockUpsertIndexFn,
    getAllIndexes: mockGetAllIndexesFn,
    getIndex: mockGetIndexFn,
    dropIndex: mockDropIndexFn,
  }),
);
const mockScopeSearchFn = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    rows: [
      {
        id: 'test_restult_id_1',
        score: 0.5,
        fields: {
          label: 'test-label',
        },
      },
      {
        id: 'test_restult_id_2',
        score: 0.5,
        fields: {
          label: 'test-label',
        },
      },
      {
        id: 'test_restult_id_3',
        score: 0.5,
        fields: {
          label: 'test-label',
        },
      },
    ],
  }),
);

const mockCollectionUpsertFn = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const getMockCollection = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    collection_name: test_collectionName,
    upsert: mockCollectionUpsertFn,
  }),
);
const getMockScope = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    scope_name: test_scopeName,
    collection: getMockCollection,
    searchIndexes: mockScopeSearchIndexesFn,
    search: mockScopeSearchFn,
  }),
);
const getMockBucket = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    bucket_name: test_bucketName,
    scope: getMockScope,
  }),
);
const mockCluster = vi.hoisted(() => ({
  bucket: getMockBucket,
}));

const mockCouchbaseConnectFn = vi.hoisted(() => vi.fn().mockResolvedValue(mockCluster));
const mockSearchRequestCreateFn = vi.hoisted(() => vi.fn().mockReturnValue('mockRequest'));
const mockVectorSearchFn = vi.hoisted(() => vi.fn().mockReturnValue('mockVectorSearch'));
const mockNumCandidatesFn = vi.hoisted(() => vi.fn().mockReturnValue('mockVectorQuery'));
const mockVectorQueryCreateFn = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    numCandidates: mockNumCandidatesFn,
  }),
);

vi.mock('couchbase', () => {
  return {
    connect: mockCouchbaseConnectFn,
    SearchRequest: {
      create: mockSearchRequestCreateFn,
    },
    VectorSearch: {
      fromVectorQuery: mockVectorSearchFn,
    },
    VectorQuery: {
      create: mockVectorQueryCreateFn,
    },
  };
});

function clearAllMocks() {
  mockCollectionUpsertFn.mockClear();
  getMockCollection.mockClear();
  getMockScope.mockClear();
  getMockBucket.mockClear();
  mockUpsertIndexFn.mockClear();
  mockGetAllIndexesFn.mockClear();
  mockGetIndexFn.mockClear();
  mockDropIndexFn.mockClear();
  mockScopeSearchIndexesFn.mockClear();
  mockScopeSearchFn.mockClear();
  mockCouchbaseConnectFn.mockClear();
  mockSearchRequestCreateFn.mockClear();
  mockVectorSearchFn.mockClear();
  mockVectorQueryCreateFn.mockClear();
  mockNumCandidatesFn.mockClear();
}

describe('Unit Testing CouchbaseVector', () => {
  let couchbase_client: CouchbaseVector;

  describe('Connection', () => {
    beforeAll(async () => {
      clearAllMocks();
    });

    afterAll(async () => {
      clearAllMocks();
    });

    it('should connect to couchbase', async () => {
      couchbase_client = new CouchbaseVector({
        connectionString: 'COUCHBASE_CONNECTION_STRING',
        username: 'COUCHBASE_USERNAME',
        password: 'COUCHBASE_PASSWORD',
        bucketName: test_bucketName,
        scopeName: test_scopeName,
        collectionName: test_collectionName,
      });
      expect(mockCouchbaseConnectFn).toHaveBeenCalledTimes(1);
      expect(mockCouchbaseConnectFn).toHaveBeenCalledWith('COUCHBASE_CONNECTION_STRING', {
        username: 'COUCHBASE_USERNAME',
        password: 'COUCHBASE_PASSWORD',
        configProfile: 'wanDevelopment',
      });
    }, 50000);

    it('should get collection', async () => {
      await couchbase_client.getCollection();

      expect(mockCouchbaseConnectFn).toHaveResolved();

      expect(getMockBucket).toHaveBeenCalledTimes(1);
      expect(getMockBucket).toHaveBeenCalledWith(test_bucketName);

      expect(getMockScope).toHaveBeenCalledTimes(1);
      expect(getMockScope).toHaveBeenCalledWith(test_scopeName);

      expect(getMockCollection).toHaveBeenCalledTimes(1);
      expect(getMockCollection).toHaveBeenCalledWith(test_collectionName);
    }, 50000);
  });

  describe('Index Operations', () => {
    beforeAll(async () => {
      clearAllMocks();
      couchbase_client = new CouchbaseVector({
        connectionString: 'COUCHBASE_CONNECTION_STRING',
        username: 'COUCHBASE_USERNAME',
        password: 'COUCHBASE_PASSWORD',
        bucketName: test_bucketName,
        scopeName: test_scopeName,
        collectionName: test_collectionName,
      });
      await couchbase_client.getCollection();
    });

    afterEach(async () => {
      clearAllMocks();
    });

    afterAll(async () => {
      clearAllMocks();
    });

    it('should create index', async () => {
      await couchbase_client.createIndex({ indexName: test_indexName, dimension });

      expect(mockScopeSearchIndexesFn).toHaveBeenCalledTimes(1);
      expect(mockUpsertIndexFn).toHaveBeenCalledTimes(1);
      expect(mockUpsertIndexFn).toHaveBeenCalledWith({
        name: test_indexName,
        sourceName: test_bucketName,
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
            docvalues_dynamic: true,
            index_dynamic: true,
            store_dynamic: true,
            type_field: '_type',
            types: {
              [`${test_scopeName}.${test_collectionName}`]: {
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
                        similarity: 'dot_product',
                        type: 'vector',
                        vector_index_optimized_for: 'recall',
                        store: true,
                        docvalues: true,
                        include_term_vectors: true,
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
      expect(mockUpsertIndexFn).toHaveResolved();
    }, 50000);

    it('should list indexes', async () => {
      const indexes = await couchbase_client.listIndexes();

      expect(mockScopeSearchIndexesFn).toHaveBeenCalledTimes(1);
      expect(mockGetAllIndexesFn).toHaveBeenCalledTimes(1);
      expect(mockGetAllIndexesFn).toHaveResolved();
      expect(indexes).toEqual([`${test_indexName}`, `${test_indexName}_1`, `${test_indexName}_2`]);
    }, 50000);

    it('should describe index', async () => {
      const stats = await couchbase_client.describeIndex({ indexName: test_indexName });

      expect(mockScopeSearchIndexesFn).toHaveBeenCalledTimes(2);

      expect(mockGetAllIndexesFn).toHaveBeenCalledTimes(1);
      expect(mockGetAllIndexesFn).toHaveResolved();

      expect(mockGetIndexFn).toHaveBeenCalledTimes(1);
      expect(mockGetIndexFn).toHaveBeenCalledWith(test_indexName);
      expect(mockGetIndexFn).toHaveResolved();

      expect(stats.dimension).toBe(dimension);
      expect(stats.metric).toBe('euclidean'); // similiarity(=="l2_norm") is mapped to euclidean in couchbase
      expect(typeof stats.count).toBe('number');
    }, 50000);

    it('should delete index', async () => {
      await couchbase_client.deleteIndex({ indexName: test_indexName });

      expect(mockScopeSearchIndexesFn).toHaveBeenCalledTimes(2);

      expect(mockGetAllIndexesFn).toHaveBeenCalledTimes(1);
      expect(mockGetAllIndexesFn).toHaveResolved();

      expect(mockDropIndexFn).toHaveBeenCalledTimes(1);
      expect(mockDropIndexFn).toHaveBeenCalledWith(test_indexName);
      expect(mockDropIndexFn).toHaveResolved();
    }, 50000);
  });

  describe('Vector Operations', () => {
    beforeAll(async () => {
      couchbase_client = new CouchbaseVector({
        connectionString: 'COUCHBASE_CONNECTION_STRING',
        username: 'COUCHBASE_USERNAME',
        password: 'COUCHBASE_PASSWORD',
        bucketName: test_bucketName,
        scopeName: test_scopeName,
        collectionName: test_collectionName,
      });

      await couchbase_client.getCollection();
    });

    afterEach(async () => {
      clearAllMocks();
    });

    afterAll(async () => {
      clearAllMocks();
    });

    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [
      { label: 'x-axis' },
      {
        label: 'y-axis',
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      },
      { label: 'z-axis' },
    ];
    let testVectorIds: string[] = ['test_id_1', 'test_id_2', 'test_id_3'];

    it('should upsert vectors with metadata', async () => {
      const vectorIds = await couchbase_client.upsert({
        indexName: test_indexName,
        vectors: testVectors,
        metadata: testMetadata,
      });

      expect(mockCollectionUpsertFn).toHaveBeenCalledTimes(3);
      expect(mockCollectionUpsertFn).toHaveBeenNthCalledWith(1, vectorIds[0], {
        embedding: [1.0, 0.0, 0.0],
        metadata: { label: 'x-axis' },
      });
      expect(mockCollectionUpsertFn).toHaveBeenNthCalledWith(2, vectorIds[1], {
        embedding: [0.0, 1.0, 0.0],
        metadata: {
          label: 'y-axis',
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        },
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      });
      expect(mockCollectionUpsertFn).toHaveBeenNthCalledWith(3, vectorIds[2], {
        embedding: [0.0, 0.0, 1.0],
        metadata: { label: 'z-axis' },
      });
      expect(mockCollectionUpsertFn).toHaveResolvedTimes(3);
      expect(vectorIds).toHaveLength(3);
      expect(vectorIds[0]).toBeDefined();
      expect(vectorIds[1]).toBeDefined();
      expect(vectorIds[2]).toBeDefined();
    }, 50000);

    it('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const topK = 3;
      const results = await couchbase_client.query({ indexName: test_indexName, queryVector, topK });

      expect(mockScopeSearchIndexesFn).toHaveBeenCalledTimes(2);

      expect(mockGetAllIndexesFn).toHaveBeenCalledTimes(1);
      expect(mockGetAllIndexesFn).toHaveResolved();

      expect(mockGetIndexFn).toHaveBeenCalledTimes(1);
      expect(mockGetIndexFn).toHaveBeenCalledWith(test_indexName);
      expect(mockGetIndexFn).toHaveResolved();

      expect(mockSearchRequestCreateFn).toHaveBeenCalledTimes(1);
      expect(mockSearchRequestCreateFn).toHaveBeenCalledWith('mockVectorSearch');

      expect(mockVectorSearchFn).toHaveBeenCalledTimes(1);
      expect(mockVectorSearchFn).toHaveBeenCalledWith('mockVectorQuery');

      expect(mockVectorQueryCreateFn).toHaveBeenCalledTimes(1);
      expect(mockVectorQueryCreateFn).toHaveBeenCalledWith('embedding', queryVector);

      expect(mockNumCandidatesFn).toHaveBeenCalledTimes(1);
      expect(mockNumCandidatesFn).toHaveBeenCalledWith(topK);

      expect(mockScopeSearchFn).toHaveBeenCalledTimes(1);
      expect(mockScopeSearchFn).toHaveBeenCalledWith(test_indexName, 'mockRequest', {
        fields: ['*'],
      });
      expect(mockScopeSearchFn).toHaveResolved();

      expect(results).toHaveLength(3);
      expect(results).toEqual([
        {
          id: 'test_restult_id_1',
          score: 0.5,
          metadata: { label: 'test-label' },
        },
        {
          id: 'test_restult_id_2',
          score: 0.5,
          metadata: { label: 'test-label' },
        },
        {
          id: 'test_restult_id_3',
          score: 0.5,
          metadata: { label: 'test-label' },
        },
      ]);
    }, 50000);

    it('should update the vector by id', async () => {
      const vectorIds = await couchbase_client.upsert({
        indexName: test_indexName,
        vectors: testVectors,
        metadata: testMetadata,
        ids: testVectorIds,
      });

      expect(mockCollectionUpsertFn).toHaveBeenCalledTimes(3);
      expect(mockCollectionUpsertFn).toHaveBeenNthCalledWith(1, testVectorIds[0], {
        embedding: [1.0, 0.0, 0.0],
        metadata: { label: 'x-axis' },
      });
      expect(mockCollectionUpsertFn).toHaveBeenNthCalledWith(2, testVectorIds[1], {
        embedding: [0.0, 1.0, 0.0],
        metadata: {
          label: 'y-axis',
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        },
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      });
      expect(mockCollectionUpsertFn).toHaveBeenNthCalledWith(3, testVectorIds[2], {
        embedding: [0.0, 0.0, 1.0],
        metadata: { label: 'z-axis' },
      });
      expect(mockCollectionUpsertFn).toHaveResolvedTimes(3);
      expect(vectorIds).toHaveLength(3);
      expect(vectorIds).toEqual(testVectorIds);
    });

    it('should throw error for invalid vector dimension', async () => {
      await couchbase_client.createIndex({ indexName: test_indexName, dimension: 4 });
      clearAllMocks();

      await expect(
        couchbase_client.upsert({
          indexName: test_indexName,
          vectors: [[1, 2, 3]],
          metadata: [{ test: 'initial' }],
        }),
      ).rejects.toThrow();
    });
  });

  describe('Error Cases and Edge Cases', () => {
    beforeAll(async () => {
      clearAllMocks();
      couchbase_client = new CouchbaseVector({
        connectionString: 'COUCHBASE_CONNECTION_STRING',
        username: 'COUCHBASE_USERNAME',
        password: 'COUCHBASE_PASSWORD',
        bucketName: test_bucketName,
        scopeName: test_scopeName,
        collectionName: test_collectionName,
      });
      await couchbase_client.getCollection();
    });

    afterEach(async () => {
      clearAllMocks();
    });

    afterAll(async () => {
      clearAllMocks();
    });

    it('should throw error for negative dimension in createIndex', async () => {
      await expect(couchbase_client.createIndex({ indexName: test_indexName, dimension: -1 })).rejects.toThrow(
        'Dimension must be a positive integer',
      );
    });

    it('should throw error for zero dimension in createIndex', async () => {
      await expect(couchbase_client.createIndex({ indexName: test_indexName, dimension: 0 })).rejects.toThrow(
        'Dimension must be a positive integer',
      );
    });

    it('should throw error when describing a non-existent index', async () => {
      await expect(couchbase_client.describeIndex({ indexName: 'non_existent_index' })).rejects.toThrow(
        `Index non_existent_index does not exist`,
      );
    });

    it('should throw error when deleting a non-existent index', async () => {
      await expect(couchbase_client.deleteIndex({ indexName: 'non_existent_index' })).rejects.toThrow(
        `Index non_existent_index does not exist`,
      );
    });

    it('should throw error when includeVector is true in query', async () => {
      await expect(
        couchbase_client.query({
          indexName: test_indexName,
          queryVector: [1.0, 2.0, 3.0],
          includeVector: true,
        }),
      ).rejects.toThrow('Including vectors in search results is not yet supported by the Couchbase vector store');
    });

    it('should throw error for empty vectors array in upsert', async () => {
      await expect(
        couchbase_client.upsert({
          indexName: test_indexName,
          vectors: [],
          metadata: [],
        }),
      ).rejects.toThrow('No vectors provided');
    });
  });

  describe('Vector Dimension Tracking', () => {
    beforeEach(async () => {
      clearAllMocks();
      couchbase_client = new CouchbaseVector({
        connectionString: 'COUCHBASE_CONNECTION_STRING',
        username: 'COUCHBASE_USERNAME',
        password: 'COUCHBASE_PASSWORD',
        bucketName: test_bucketName,
        scopeName: test_scopeName,
        collectionName: test_collectionName,
      });
      await couchbase_client.getCollection();
    });

    afterEach(async () => {
      clearAllMocks();
    });

    afterAll(async () => {
      clearAllMocks();
    });

    it('should track vector dimension after creating an index', async () => {
      // Initial vector_dimension should be null
      expect((couchbase_client as any).vector_dimension).toBeNull();

      // After creating index, vector_dimension should be set
      await couchbase_client.createIndex({ indexName: test_indexName, dimension: 5 });
      expect((couchbase_client as any).vector_dimension).toBe(5);
    });

    it('should validate vector dimensions against tracked dimension during upsert', async () => {
      // Set up dimension tracking
      await couchbase_client.createIndex({ indexName: test_indexName, dimension: 3 });
      clearAllMocks();

      // Should succeed with correct dimensions
      await couchbase_client.upsert({
        indexName: test_indexName,
        vectors: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        metadata: [{}, {}],
      });

      // Should fail with incorrect dimensions
      await expect(
        couchbase_client.upsert({
          indexName: test_indexName,
          vectors: [[1, 2, 3, 4]], // 4 dimensions instead of 3
          metadata: [{}],
        }),
      ).rejects.toThrow('Vector dimension mismatch');
    });

    it('should reset vector_dimension when deleting an index', async () => {
      // Setup - create index and set dimension
      await couchbase_client.createIndex({ indexName: test_indexName, dimension: 3 });
      expect((couchbase_client as any).vector_dimension).toBe(3);
      clearAllMocks();

      // Delete the index
      await couchbase_client.deleteIndex({ indexName: test_indexName });

      // Verify dimension is reset
      expect((couchbase_client as any).vector_dimension).toBeNull();
    });
  });

  describe('Implementation Details', () => {
    beforeEach(async () => {
      clearAllMocks();
      couchbase_client = new CouchbaseVector({
        connectionString: 'COUCHBASE_CONNECTION_STRING',
        username: 'COUCHBASE_USERNAME',
        password: 'COUCHBASE_PASSWORD',
        bucketName: test_bucketName,
        scopeName: test_scopeName,
        collectionName: test_collectionName,
      });
      await couchbase_client.getCollection();
    });

    afterEach(async () => {
      clearAllMocks();
    });

    afterAll(async () => {
      clearAllMocks();
    });

    it('should handle metric mapping correctly', async () => {
      // Test each possible metric mapping from the imported DISTANCE_MAPPING constant
      const metricsToTest = Object.keys(DISTANCE_MAPPING) as Array<keyof typeof DISTANCE_MAPPING>;

      for (const mastraMetric of metricsToTest) {
        clearAllMocks();
        const couchbaseMetric = DISTANCE_MAPPING[mastraMetric];

        // Test createIndex maps Mastra metric to Couchbase metric
        await couchbase_client.createIndex({
          indexName: test_indexName,
          dimension: 3,
          metric: mastraMetric,
        });

        // Verify the upsertIndex was called with the correct Couchbase metric
        expect(mockUpsertIndexFn).toHaveBeenCalledTimes(1);
        const callArgs = mockUpsertIndexFn.mock.calls[0][0];
        expect(callArgs.name).toBe(test_indexName);

        // Extract the similarity parameter from the deeply nested params
        const similarityParam =
          callArgs.params.mapping.types[`${test_scopeName}.${test_collectionName}`].properties.embedding.fields[0]
            .similarity;
        expect(similarityParam).toBe(couchbaseMetric);

        mockGetIndexFn.mockResolvedValueOnce({
          params: {
            mapping: {
              types: {
                [`${test_scopeName}.${test_collectionName}`]: {
                  properties: {
                    embedding: {
                      fields: [
                        {
                          dims: dimension,
                          similarity: couchbaseMetric,
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        });

        const stats = await couchbase_client.describeIndex({ indexName: test_indexName });
        expect(stats.metric).toBe(mastraMetric);
      }
    });

    it('should cache collection object for multiple operations', async () => {
      // First call should get the collection
      await couchbase_client.getCollection();
      expect(getMockBucket).toHaveBeenCalledTimes(1);
      expect(getMockScope).toHaveBeenCalledTimes(1);
      expect(getMockCollection).toHaveBeenCalledTimes(1);

      clearAllMocks();

      // Second call should not get the collection again
      await couchbase_client.getCollection();
      expect(getMockBucket).not.toHaveBeenCalled();
      expect(getMockScope).not.toHaveBeenCalled();
      expect(getMockCollection).not.toHaveBeenCalled();
    });
  });
});
