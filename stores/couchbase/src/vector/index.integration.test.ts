// Integration tests for CouchbaseVector
// IMPORTANT: These tests require Docker Engine to be running.
// The tests will automatically start and configure the required Couchbase container.

import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import axios from 'axios';
import type { Cluster, Bucket, Scope, Collection } from 'couchbase';
import { connect } from 'couchbase';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { CouchbaseVector, DISTANCE_MAPPING } from './index';

const containerName = 'mastra_couchbase_testing';

const connectionString = 'couchbase://localhost';
const username = 'Administrator';
const password = 'password';

const dimension = 3;
const test_bucketName = 'test-bucket';
const test_scopeName = 'test-scope';
const test_collectionName = 'test-collection';
const test_indexName = 'test-index';

async function setupCluster() {
  try {
    // Initialize the cluster
    execSync(
      `docker exec -i ${containerName} couchbase-cli cluster-init --cluster "${connectionString}" \
      --cluster-username "${username}" --cluster-password "${password}" --cluster-ramsize 512 \
      --cluster-index-ramsize 512 --cluster-fts-ramsize 512 --services data,index,query,fts`,
      { stdio: 'inherit' },
    );
  } catch (error) {
    console.error('Error initializing Couchbase cluster:', error.message);
    // Decide if you want to re-throw or handle specific errors here
  }

  try {
    // Create the bucket
    execSync(
      `docker exec -i ${containerName} couchbase-cli bucket-create -c "${connectionString}" \
      --username "${username}" --password "${password}" \
      --bucket "${test_bucketName}" --bucket-type couchbase --bucket-ramsize 200`,
      { stdio: 'inherit' },
    );
  } catch (error) {
    console.error('Error creating bucket:', error.message);
    // Decide if you want to re-throw or handle specific errors here
  }

  // Wait for cluster to be fully available after potential operations
  await new Promise(resolve => setTimeout(resolve, 10000));
}

async function checkBucketHealth(
  connectionString: string,
  username: string,
  password: string,
  bucketName: string,
): Promise<void> {
  const maxAttempts = 20;
  let attempt = 0;

  // Parse the connection string to get the host
  const parsedUrl = new URL(connectionString);
  const host = parsedUrl.hostname;
  const url = `http://${host}:8091/pools/default/buckets/${bucketName}`;

  while (attempt < maxAttempts) {
    try {
      const response = await axios.get(url, {
        auth: {
          username,
          password,
        },
        validateStatus: () => true, // Don't throw on any status code
      });

      const responseData = response.data;
      if (
        response.status === 200 &&
        responseData.nodes &&
        responseData.nodes.length > 0 &&
        responseData.nodes[0].status === 'healthy'
      ) {
        return;
      } else {
        console.log(`Attempt ${attempt + 1}/${maxAttempts}: Bucket '${bucketName}' health check failed`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        attempt++;
      }
    } catch (error) {
      console.log(
        `Attempt ${attempt + 1}/${maxAttempts}: Bucket '${bucketName}' health check failed with error: ${error.message}`,
      );
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      attempt++;
    }
  }

  throw new Error(`Bucket '${bucketName}' health check failed after ${maxAttempts} attempts.`);
}

describe('Integration Testing CouchbaseVector', async () => {
  // Use Couchbase Enterprise 7.6+ which supports vector search
  let couchbase_client: CouchbaseVector;
  let cluster: Cluster;
  let bucket: Bucket;
  let scope: Scope;
  let collection: Collection;

  beforeAll(
    async () => {
      try {
        // Initialize the cluster
        await setupCluster();

        // Check cluster health before trying to connect
        await checkBucketHealth(connectionString, username, password, test_bucketName);

        // Connect to the cluster
        cluster = await connect(connectionString, {
          username: username,
          password: password,
          configProfile: 'wanDevelopment',
        });

        // If bucket is not there, then create it
        const bucketmanager = cluster.buckets();
        try {
          await bucketmanager.getBucket(test_bucketName);
        } catch (e) {
          if (e.message.includes('not found')) {
            await bucketmanager.createBucket({
              name: test_bucketName,
              ramQuotaMB: 100,
              numReplicas: 0,
            });
          } else {
            throw e;
          }
        }
        bucket = cluster.bucket(test_bucketName);

        // If scope or collection are not there, then create it
        const all_scopes = await bucket.collections().getAllScopes();
        const scope_info = all_scopes.find(scope => scope.name === test_scopeName);
        if (!scope_info) {
          await bucket.collections().createScope(test_scopeName);
          scope = bucket.scope(test_scopeName);
          await bucket.collections().createCollection(test_collectionName, test_scopeName);
          collection = scope.collection(test_collectionName);
        } else {
          scope = bucket.scope(test_scopeName);
          if (!scope_info.collections.some(collection => collection.name === test_collectionName)) {
            await bucket.collections().createCollection(test_collectionName, test_scopeName);
          }
          collection = scope.collection(test_collectionName);
        }
      } catch (error) {
        console.error('Failed to start Couchbase container:', error);
      }
    },
    5 * 60 * 1000,
  ); // 5 minutes

  afterAll(async () => {
    if (cluster) {
      await cluster.close();
    }
  }, 50000);

  describe('Connection', () => {
    it('should connect to couchbase', async () => {
      couchbase_client = new CouchbaseVector({
        connectionString,
        username,
        password,
        bucketName: test_bucketName,
        scopeName: test_scopeName,
        collectionName: test_collectionName,
      });
      expect(couchbase_client).toBeDefined();
      const collection = await couchbase_client.getCollection();
      expect(collection).toBeDefined();
    }, 50000);
  });

  describe('Index Operations', () => {
    it('should create index', async () => {
      await couchbase_client.createIndex({ indexName: test_indexName, dimension, metric: 'euclidean' });
      await new Promise(resolve => setTimeout(resolve, 5000));

      const index_definition = await scope.searchIndexes().getIndex(test_indexName);
      expect(index_definition).toBeDefined();
      expect(index_definition.name).toBe(test_indexName);
      expect(
        index_definition.params.mapping?.types?.[`${test_scopeName}.${test_collectionName}`]?.properties?.embedding
          ?.fields?.[0]?.dims,
      ).toBe(dimension);
      expect(
        index_definition.params.mapping?.types?.[`${test_scopeName}.${test_collectionName}`]?.properties?.embedding
          ?.fields?.[0]?.similarity,
      ).toBe('l2_norm'); // similiarity(=="l2_norm") is mapped to euclidean in couchbase
    }, 50000);

    it('should list indexes', async () => {
      const indexes = await couchbase_client.listIndexes();
      expect(indexes).toContain(test_indexName);
    }, 50000);

    it('should describe index', async () => {
      const stats = await couchbase_client.describeIndex({ indexName: test_indexName });
      expect(stats.dimension).toBe(dimension);
      expect(stats.metric).toBe('euclidean'); // similiarity(=="l2_norm") is mapped to euclidean in couchbase
      expect(typeof stats.count).toBe('number');
    }, 50000);

    it('should delete index', async () => {
      await couchbase_client.deleteIndex({ indexName: test_indexName });
      await new Promise(resolve => setTimeout(resolve, 5000));
      await expect(scope.searchIndexes().getIndex(test_indexName)).rejects.toThrowError();
    }, 50000);
  });

  describe('Vector Operations', () => {
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

    beforeAll(async () => {
      await couchbase_client.createIndex({ indexName: test_indexName, dimension, metric: 'euclidean' });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }, 50000);

    afterAll(async () => {
      await couchbase_client.deleteIndex({ indexName: test_indexName });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }, 50000);

    it('should upsert vectors with metadata', async () => {
      // Use the couchbase_client to upsert vectors
      const vectorIds = await couchbase_client.upsert({
        indexName: test_indexName,
        vectors: testVectors,
        metadata: testMetadata,
        ids: testVectorIds,
      });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify vectors were stored correctly by retrieving them directly through the collection
      for (let i = 0; i < 3; i++) {
        const result = await collection.get(vectorIds[i]);
        expect(result.content).toHaveProperty('embedding');
        expect(result.content).toHaveProperty('metadata');
        expect(result.content.embedding).toEqual(testVectors[i]);
        expect(result.content.metadata).toEqual(testMetadata[i]);

        // Check if content field was added for text field
        if (testMetadata[i].text) {
          expect(result.content).toHaveProperty('content');
          expect(result.content.content).toEqual(testMetadata[i].text);
        }
      }

      expect(vectorIds).toHaveLength(3);
      expect(vectorIds[0]).toBeDefined();
      expect(vectorIds[1]).toBeDefined();
      expect(vectorIds[2]).toBeDefined();
    }, 50000);

    it('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const topK = 3;

      const results = await couchbase_client.query({
        indexName: test_indexName,
        queryVector,
        topK,
      });

      // Verify results
      expect(results).toHaveLength(topK);

      // Check each result has expected properties
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        // Find the index of this ID in the testVectorIds array
        const originalIndex = testVectorIds.indexOf(result.id);
        expect(originalIndex).not.toBe(-1); // Ensure we found the ID

        const expectedMetadata = testMetadata[originalIndex];
        const returnedMetadata = { ...result.metadata }; // Create a copy to avoid modifying the original

        // Check if 'content' field exists and matches if 'text' was in original metadata
        if (expectedMetadata.text) {
          expect(returnedMetadata).toHaveProperty('content');
          expect(returnedMetadata.content).toEqual(expectedMetadata.text);
        }

        // If the original metadata had a 'text' field, the returned metadata might include a 'content' field from the search index.
        // We only want to compare the original metadata fields, so remove 'content' if it's present in the returned data
        // and the original metadata had a 'text' field (which implies 'content' was likely added automatically).
        if (expectedMetadata.text && returnedMetadata.content) {
          delete returnedMetadata.content;
        }

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('metadata');
        expect(typeof result.score).toBe('number');
        expect(returnedMetadata).toEqual(expectedMetadata); // Compare potentially modified returned metadata
      }

      // The first result should be the most similar to the query vector
      // In this case, it should be the X-axis vector [1,0,0] since our query is [1.0,0.1,0.1]
      const firstResult = await collection.get(results[0].id);
      expect(firstResult.content.embedding[0]).toBeCloseTo(1.0, 1);
    }, 50000);

    it('should update the vector by id', async () => {
      // Use specific IDs for upsert
      const new_vectors = [
        [2, 1, 3],
        [34, 1, 12],
        [22, 23, 1],
      ];
      const vectorIds = await couchbase_client.upsert({
        indexName: test_indexName,
        vectors: new_vectors,
        metadata: testMetadata,
        ids: testVectorIds,
      });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify the IDs match what we requested
      expect(vectorIds).toEqual(testVectorIds);

      // Verify each document was stored with the right data
      for (let i = 0; i < testVectorIds.length; i++) {
        const result = await collection.get(testVectorIds[i]);
        expect(result.content.embedding).toEqual(new_vectors[i]);
        expect(result.content.metadata).toEqual(testMetadata[i]);
      }

      // Delete the vectors form the collection for further tests to run smoothly
      for (let i = 0; i < testVectorIds.length; i++) {
        await collection.remove(testVectorIds[i]);
      }
    }, 50000);

    it('should throw error for invalid vector dimension', async () => {
      await expect(
        couchbase_client.upsert({
          indexName: test_indexName,
          vectors: [[1, 2, 3, 4]], // 4 dimensions instead of 3
          metadata: [{ test: 'initial' }],
        }),
      ).rejects.toThrow();
    }, 50000);

    it('should throw error when includeVector is true in query', async () => {
      await expect(
        couchbase_client.query({
          indexName: test_indexName,
          queryVector: [1.0, 2.0, 3.0],
          includeVector: true,
        }),
      ).rejects.toThrow('Including vectors in search results is not yet supported by the Couchbase vector store');
    }, 50000);

    it('should upsert vectors with generated ids', async () => {
      const ids = await couchbase_client.upsert({ indexName: test_indexName, vectors: testVectors });
      expect(ids).toHaveLength(testVectors.length);
      ids.forEach(id => expect(typeof id).toBe('string'));

      // Count is not supported by Couchbase
      const stats = await couchbase_client.describeIndex({ indexName: test_indexName });
      expect(stats.count).toBe(-1);
    });

    it('should update existing vectors', async () => {
      // Initial upsert
      await couchbase_client.upsert({
        indexName: test_indexName,
        vectors: testVectors,
        metadata: testMetadata,
        ids: testVectorIds,
      });

      // Update first vector
      const updatedVector = [[0.5, 0.5, 0.0]];
      const updatedMetadata = [{ label: 'updated-x-axis' }];
      await couchbase_client.upsert({
        indexName: test_indexName,
        vectors: updatedVector,
        metadata: updatedMetadata,
        ids: [testVectorIds?.[0]!],
      });

      // Verify update
      const result = await collection.get(testVectorIds?.[0]!);
      expect(result.content.embedding).toEqual(updatedVector[0]);
      expect(result.content.metadata).toEqual(updatedMetadata[0]);
    });

    it('should update the vector by id', async () => {
      const ids = await couchbase_client.upsert({ indexName: test_indexName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        vector: newVector,
        metadata: newMetaData,
      };

      await couchbase_client.updateVector({ indexName: test_indexName, id: idToBeUpdated, update });

      const result = await collection.get(idToBeUpdated);
      expect(result.content.embedding).toEqual(newVector);
      expect(result.content.metadata).toEqual(newMetaData);
    });

    it('should only update the metadata by id', async () => {
      const ids = await couchbase_client.upsert({ indexName: test_indexName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        metadata: newMetaData,
      };

      await couchbase_client.updateVector({ indexName: test_indexName, id: idToBeUpdated, update });

      const result = await collection.get(idToBeUpdated);
      expect(result.content.embedding).toEqual(testVectors[0]);
      expect(result.content.metadata).toEqual(newMetaData);
    });

    it('should only update vector embeddings by id', async () => {
      const ids = await couchbase_client.upsert({ indexName: test_indexName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3];

      const update = {
        vector: newVector,
      };

      await couchbase_client.updateVector({ indexName: test_indexName, id: idToBeUpdated, update });

      const result = await collection.get(idToBeUpdated);
      expect(result.content.embedding).toEqual(newVector);
    });

    it('should throw exception when no updates are given', async () => {
      await expect(couchbase_client.updateVector({ indexName: test_indexName, id: 'id', update: {} })).rejects.toThrow(
        'No updates provided',
      );
    });

    it('should delete the vector by id', async () => {
      const ids = await couchbase_client.upsert({ indexName: test_indexName, vectors: testVectors });
      expect(ids).toHaveLength(3);
      const idToBeDeleted = ids[0];

      await couchbase_client.deleteVector({ indexName: test_indexName, id: idToBeDeleted });

      try {
        await collection.get(idToBeDeleted);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Error Cases and Edge Cases', () => {
    it('should throw error for negative dimension in createIndex', async () => {
      await expect(
        couchbase_client.createIndex({
          indexName: `${test_indexName}_neg`,
          dimension: -1,
        }),
      ).rejects.toThrow('Dimension must be a positive integer');
    }, 50000);

    it('should throw error for zero dimension in createIndex', async () => {
      await expect(
        couchbase_client.createIndex({
          indexName: `${test_indexName}_zero`,
          dimension: 0,
        }),
      ).rejects.toThrow('Dimension must be a positive integer');
    }, 50000);

    it('should throw error when describing a non-existent index', async () => {
      const nonExistentIndex = 'non_existent_index';

      // Verify the index doesn't exist using cluster API
      const allIndexes = await scope.searchIndexes().getAllIndexes();
      expect(allIndexes.find(idx => idx.name === nonExistentIndex)).toBeUndefined();

      // Now test the couchbase_client method
      await expect(couchbase_client.describeIndex({ indexName: nonExistentIndex })).rejects.toThrow();
    }, 50000);

    it('should throw error when deleting a non-existent index', async () => {
      const nonExistentIndex = 'non_existent_index';

      // Verify the index doesn't exist using cluster API
      const allIndexes = await scope.searchIndexes().getAllIndexes();
      expect(allIndexes.find(idx => idx.name === nonExistentIndex)).toBeUndefined();

      // Now test the couchbase_client method
      await expect(couchbase_client.deleteIndex({ indexName: nonExistentIndex })).rejects.toThrow();
    }, 50000);

    it('should throw error for empty vectors array in upsert', async () => {
      await expect(
        couchbase_client.upsert({
          indexName: test_indexName,
          vectors: [],
          metadata: [],
        }),
      ).rejects.toThrow('No vectors provided');
    }, 50000);

    it('should handle non-existent index queries', async () => {
      await expect(
        couchbase_client.query({ indexName: 'non-existent-index', queryVector: [1, 2, 3] }),
      ).rejects.toThrow();
    }, 50000);

    it('should handle duplicate index creation gracefully', async () => {
      const duplicateIndexName = `duplicate-test-${randomUUID()}`;
      const dimension = 768;
      const infoSpy = vi.spyOn(couchbase_client['logger'], 'info');
      const warnSpy = vi.spyOn(couchbase_client['logger'], 'warn');

      try {
        // Create index first time
        await couchbase_client.createIndex({
          indexName: duplicateIndexName,
          dimension,
          metric: 'cosine',
        });

        // Try to create with same dimensions - should not throw
        await expect(
          couchbase_client.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'cosine',
          }),
        ).resolves.not.toThrow();

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('already exists with'));

        // Try to create with same dimensions and different metric - should not throw
        await expect(
          couchbase_client.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'euclidean',
          }),
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Attempted to create index with metric'));

        // Try to create with different dimensions - should throw
        await expect(
          couchbase_client.createIndex({
            indexName: duplicateIndexName,
            dimension: dimension + 1,
            metric: 'cosine',
          }),
        ).rejects.toThrow(
          `Index "${duplicateIndexName}" already exists with ${dimension} dimensions, but ${dimension + 1} dimensions were requested`,
        );
      } finally {
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        // Cleanup
        await couchbase_client.deleteIndex({ indexName: duplicateIndexName });
      }
    }, 50000);
  });

  describe('Vector Dimension Tracking', () => {
    beforeAll(async () => {
      const indexes = await couchbase_client.listIndexes();
      if (indexes.length > 0) {
        for (const index of indexes) {
          await couchbase_client.deleteIndex({ indexName: index });
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }, 50000);

    const testIndexName = `${test_indexName}_dim_tracking`;
    const testDimension = 5;

    it('should track vector dimension after creating an index', async () => {
      // Initial vector_dimension should be null
      expect((couchbase_client as any).vector_dimension).toBeNull();

      // After creating index, vector_dimension should be set
      await couchbase_client.createIndex({
        indexName: testIndexName,
        dimension: testDimension,
      });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check internal property
      expect((couchbase_client as any).vector_dimension).toBe(testDimension);

      // Also verify through index description
      const indexDef = await scope.searchIndexes().getIndex(testIndexName);
      expect(
        indexDef.params.mapping?.types?.[`${test_scopeName}.${test_collectionName}`]?.properties?.embedding?.fields?.[0]
          ?.dims,
      ).toBe(testDimension);
    }, 50000);

    it('should validate vector dimensions against tracked dimension during upsert', async () => {
      // Should succeed with correct dimensions
      const vectorIds = await couchbase_client.upsert({
        indexName: testIndexName,
        vectors: [
          [1, 2, 3, 4, 5],
          [4, 5, 6, 7, 8],
        ],
        metadata: [{}, {}],
      });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify vectors were inserted with correct dimensions
      for (const id of vectorIds) {
        const result = await collection.get(id);
        expect(result.content.embedding.length).toBe(testDimension);
      }

      // Should fail with incorrect dimensions
      await expect(
        couchbase_client.upsert({
          indexName: testIndexName,
          vectors: [[1, 2, 3, 4]], // 4 dimensions instead of 5
          metadata: [{}],
        }),
      ).rejects.toThrow('Vector dimension mismatch');
    }, 50000);

    it('should reset vector_dimension when deleting an index', async () => {
      expect((couchbase_client as any).vector_dimension).toBe(testDimension);

      // Delete the index
      await couchbase_client.deleteIndex({ indexName: testIndexName });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify dimension is reset
      expect((couchbase_client as any).vector_dimension).toBeNull();

      // Also verify the index is gone using cluster directly
      await expect(scope.searchIndexes().getIndex(testIndexName)).rejects.toThrow();
    }, 50000);
  });

  describe('Implementation Details', () => {
    beforeAll(async () => {
      const indexes = await couchbase_client.listIndexes();
      if (indexes.length > 0) {
        for (const index of indexes) {
          await couchbase_client.deleteIndex({ indexName: index });
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }, 50000);

    it('should handle metric mapping correctly', async () => {
      // Test each possible metric mapping from the imported DISTANCE_MAPPING constant
      const metricsToTest = Object.keys(DISTANCE_MAPPING) as Array<keyof typeof DISTANCE_MAPPING>;

      for (const mastraMetric of metricsToTest) {
        const couchbaseMetric = DISTANCE_MAPPING[mastraMetric];
        const testIndexName = `${test_indexName}_${mastraMetric}`;

        // Create index with this metric
        await couchbase_client.createIndex({
          indexName: testIndexName,
          dimension: dimension,
          metric: mastraMetric,
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Verify through the Couchbase API
        const indexDef = await scope.searchIndexes().getIndex(testIndexName);
        const similarityParam =
          indexDef.params.mapping?.types?.[`${test_scopeName}.${test_collectionName}`]?.properties?.embedding
            ?.fields?.[0]?.similarity;
        expect(similarityParam).toBe(couchbaseMetric);

        // Verify through our API
        const stats = await couchbase_client.describeIndex({ indexName: testIndexName });
        expect(stats.metric).toBe(mastraMetric);

        // Clean up
        await couchbase_client.deleteIndex({ indexName: testIndexName });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }, 50000);
  });
});
