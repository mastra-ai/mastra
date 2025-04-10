
import { MongoDBVector } from '@mastra/mongodb'
import type {MongoDBQueryVectorParams, MongoDBUpsertVectorParams} from '@mastra/mongodb'
import type {
    CreateIndexParams,
  } from '@mastra/core/vector';
  

// Demonstration (demo.ts)  
async function main() {  
  const mongoUri = 'mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000';  
  const dbName = 'mastra_vector_db';  
  const indexName = 'my_index';  
  
  const mongoVector = new MongoDBVector({ uri: mongoUri, dbName });  
  
  try {  
    await mongoVector.connect();  
    console.log('Connected to MongoDB');  
  
    // Create Index  
    const createIndexParams: CreateIndexParams = {  
      indexName: indexName,  
      dimension: 3,  
      metric: 'cosine',  
    };  
    await mongoVector.createIndex(createIndexParams);  
    console.log(`Index "${indexName}" created`);  
  
    // Wait for index to be ready  
    console.log(`Waiting for index "${indexName}" to be ready...`);  
    await mongoVector.waitForIndexReady(indexName);  
    console.log(`Index "${indexName}" is ready`);  
  
    // Upsert Vectors  
    const vectorsToUpsert: MongoDBUpsertVectorParams = {  
      indexName: indexName,  
      vectors: [  
        [0.1, 0.2, 0.3],  
        [0.4, 0.5, 0.6],  
        [0.7, 0.8, 0.9],  
      ],  
      metadata: [  
        { id: 'vec1', type: 'example' },  
        { id: 'vec2', type: 'sample' },  
        { id: 'vec3', type: 'test' },  
      ],  
      ids: ['id1', 'id2', 'id3'],  
      documents: ['doc1 content', 'doc2 content', 'doc3 content'],  
    };  
    const upsertedIds = await mongoVector.upsert(vectorsToUpsert);  
    console.log('Upserted IDs:', upsertedIds);  
  
    // Wait for data to be indexed  
    console.log('Waiting for data to be indexed...');  
    await new Promise((resolve) => setTimeout(resolve, 10000)); // wait for 10 seconds  
  
    // Query Vector  
    const queryVectorParams: MongoDBQueryVectorParams = {  
      indexName: indexName,  
      queryVector: [0.15, 0.25, 0.35],  
      topK: 2,  
      includeVector: true,  
      // filter: { type: 'example' },  
    };  
    const queryResults = await mongoVector.query(queryVectorParams);  
    console.log('Query Results:', queryResults);  
  
    // List Indexes  
    const indexes = await mongoVector.listIndexes();  
    console.log('List of Indexes:', indexes);  
  
    // Describe Index  
    const indexStats = await mongoVector.describeIndex(indexName);  
    console.log('Index Stats:', indexStats);  
  
    // Update Index By Id  
    await mongoVector.updateIndexById(indexName, 'id2', { metadata: { updated: true } });  
    console.log('Updated index by ID "id2"');  
  
    // Wait for data to be indexed  
    console.log('Waiting for data to be re-indexed...');  
    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds  
  
    // Query again after update  
    const queryResultsAfterUpdate = await mongoVector.query(queryVectorParams);  
    console.log('Query Results After Update:', queryResultsAfterUpdate);  
  
    // Delete Index By Id  
    await mongoVector.deleteIndexById(indexName, 'id3');  
    console.log('Deleted index by ID "id3"');  
  
    // Wait for data to be updated  
    console.log('Waiting for data to reflect deletion...');  
    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds  
  
    // Query after delete by id  
    const queryResultsAfterDelete = await mongoVector.query({ ...queryVectorParams, topK: 3 });  
    console.log('Query Results After Delete by ID:', queryResultsAfterDelete);  
  
    // Delete Index  
    // await mongoVector.deleteIndex(indexName);  
    // console.log(`Index "${indexName}" deleted`);  
  } catch (error) {  
    console.error('Error during demo:', error);  
  } finally {  
    await mongoVector.close();  
    console.log('Disconnected from MongoDB');  
  }  
}  
  
// Run the main function  
main().catch((error) => {  
  console.error('Error in main:', error);  
});  