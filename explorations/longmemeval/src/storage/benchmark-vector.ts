import { MastraVector } from '@mastra/core/vector';
import type {
  QueryVectorParams,
  QueryResult,
  UpsertVectorParams,
  CreateIndexParams,
  IndexStats,
  UpdateVectorParams,
  DeleteVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
} from '@mastra/core/vector';
import { VectorDB, type Document } from 'imvectordb';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

type DBMode = 'read' | 'read-write';

export class BenchmarkVectorStore extends MastraVector {
  private indexes: Map<string, VectorDB> = new Map();
  private indexConfigs: Map<string, { dimension: number; metric?: 'cosine' | 'euclidean' | 'dotproduct' }> = new Map();
  private documentsStore: Map<string, Map<string, Document>> = new Map();
  private mode: DBMode;

  constructor(mode: DBMode = 'read-write') {
    super();
    this.mode = mode;
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    if (this.mode === 'read') return;
    if (this.indexes.has(indexName)) {
      await this.validateExistingIndex(indexName, dimension, metric);
      return;
    }

    this.indexes.set(indexName, new VectorDB());
    this.indexConfigs.set(indexName, { dimension, metric });
    this.documentsStore.set(indexName, new Map());
  }

  async query({ indexName, queryVector, topK = 10 }: QueryVectorParams): Promise<QueryResult[]> {
    const db = this.indexes.get(indexName);
    if (!db) {
      throw new Error(`Index ${indexName} not found`);
    }

    const results = await db.query(queryVector, topK);
    return results.map((r: any) => ({
      id: r.document.id,
      score: r.similarity,
      metadata: r.document.metadata,
    }));
  }

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    if (this.mode === 'read') return [];
    const db = this.indexes.get(indexName);
    const docsStore = this.documentsStore.get(indexName);

    if (!db || !docsStore) {
      throw new Error(`Index ${indexName} not found`);
    }

    const vectorIds = ids || vectors.map(() => crypto.randomUUID());

    for (let i = 0; i < vectors.length; i++) {
      const doc: Document = {
        id: vectorIds[i],
        embedding: vectors[i],
        metadata: metadata?.[i] || {},
      };

      // Store in VectorDB
      db.add(doc);
      // Also store in our documents map for persistence
      docsStore.set(doc.id, doc);
    }

    return vectorIds;
  }

  async listIndexes(): Promise<string[]> {
    return Array.from(this.indexes.keys());
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const db = this.indexes.get(indexName);
    const config = this.indexConfigs.get(indexName);

    if (!db || !config) {
      throw new Error(`Index ${indexName} not found`);
    }

    // Get count from the database
    const count = db.size();

    return {
      dimension: config.dimension,
      count: count,
      metric: config.metric,
    };
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    if (this.mode === 'read') return;
    const db = this.indexes.get(indexName);
    if (db) {
      await db.terminate();
    }
    this.indexes.delete(indexName);
    this.indexConfigs.delete(indexName);
    this.documentsStore.delete(indexName);
  }

  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    if (this.mode === 'read') return;
    const db = this.indexes.get(indexName);
    const docsStore = this.documentsStore.get(indexName);

    if (!db || !docsStore) {
      throw new Error(`Index ${indexName} not found`);
    }

    // Get the existing document
    const doc = db.get(id);
    if (!doc) {
      throw new Error(`Vector with id ${id} not found in index ${indexName}`);
    }

    // Remove old version
    db.del(doc);
    docsStore.delete(id);

    // Create updated document
    const updatedDoc: Document = {
      id,
      embedding: update.vector || doc.embedding,
      metadata: update.metadata || doc.metadata,
    };

    // Add updated version
    db.add(updatedDoc);
    docsStore.set(id, updatedDoc);
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    if (this.mode === 'read') return;
    const db = this.indexes.get(indexName);
    const docsStore = this.documentsStore.get(indexName);

    if (!db || !docsStore) {
      throw new Error(`Index ${indexName} not found`);
    }

    const doc = db.get(id);
    if (doc) {
      db.del(doc);
      docsStore.delete(id);
    }
  }

  /**
   * Persist the current vector store state to a JSON file
   */
  async persist(filePath: string): Promise<void> {
    if (this.mode === 'read') return;
    const data: Record<string, any> = {};

    for (const [indexName, docsStore] of this.documentsStore) {
      const config = this.indexConfigs.get(indexName);
      const documents = Array.from(docsStore.values());

      data[indexName] = {
        config,
        documents,
      };
    }

    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Hydrate vector store state from a JSON file
   */
  async hydrate(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Vector store file not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Clear existing data
    for (const db of this.indexes.values()) {
      await db.terminate();
    }
    this.indexes.clear();
    this.indexConfigs.clear();
    this.documentsStore.clear();

    // Restore data
    for (const [indexName, indexData] of Object.entries(data)) {
      const { config, documents } = indexData as any;

      // Create new index
      const db = new VectorDB();
      this.indexes.set(indexName, db);
      this.indexConfigs.set(indexName, config);

      const docsStore = new Map<string, Document>();
      this.documentsStore.set(indexName, docsStore);

      // Restore documents
      for (const doc of documents) {
        db.add(doc);
        docsStore.set(doc.id, doc);
      }
    }
  }

  /**
   * Clear all data and start fresh
   */
  async clear(): Promise<void> {
    if (this.mode === 'read') return;
    for (const db of this.indexes.values()) {
      await db.terminate();
    }
    this.indexes.clear();
    this.indexConfigs.clear();
    this.documentsStore.clear();
  }
}
