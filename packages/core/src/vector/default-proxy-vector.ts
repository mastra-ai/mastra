import type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  IndexStats,
  ParamsToArgs,
  QueryResult,
  CreateIndexArgs,
  UpsertVectorArgs,
  QueryVectorArgs,
} from './types';
import { MastraVector } from './vector';

type VectorConfig = {
  connectionUrl: string;
  authToken?: string;
  syncUrl?: string;
  syncInterval?: number;
};
/**
 * A proxy for the DefaultVector (LibSQLStore) to allow for dynamically loading the vectorDB in a constructor
 * If the vectorDB is in-memory, it will use the InMemoryVector.
 */
export class DefaultProxyVector extends MastraVector {
  private vectorDB: MastraVector | null = null;
  private vectorConfig: VectorConfig;
  private isInitializingPromise: Promise<MastraVector> | null = null;

  constructor(config: VectorConfig) {
    super();
    this.vectorConfig = config;
  }

  private setupVector() {
    if (!this.isInitializingPromise) {
      this.isInitializingPromise = new Promise<MastraVector>((resolve, reject) => {
        import('./libsql')
          .then(({ DefaultVectorDB }) => {
            this.vectorDB = new DefaultVectorDB(this.vectorConfig);
            resolve(this.vectorDB);
          })
          .catch(reject);
      });
    }

    return this.isInitializingPromise;
  }

  async query<E extends QueryVectorArgs = QueryVectorArgs>(
    ...args: ParamsToArgs<QueryVectorParams> | E
  ): Promise<QueryResult[]> {
    const vectorDB = await this.setupVector();
    return vectorDB.query(...args);
  }
  // Adds type checks for positional arguments if used
  async upsert<E extends UpsertVectorArgs = UpsertVectorArgs>(
    ...args: ParamsToArgs<UpsertVectorParams> | E
  ): Promise<string[]> {
    const vectorDB = await this.setupVector();
    return vectorDB.upsert(...args);
  }
  // Adds type checks for positional arguments if used
  async createIndex<E extends CreateIndexArgs = CreateIndexArgs>(
    ...args: ParamsToArgs<CreateIndexParams> | E
  ): Promise<void> {
    const vectorDB = await this.setupVector();
    return vectorDB.createIndex(...args);
  }

  async listIndexes(): Promise<string[]> {
    const vectorDB = await this.setupVector();
    return vectorDB.listIndexes();
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    const vectorDB = await this.setupVector();
    return vectorDB.describeIndex(indexName);
  }

  async deleteIndex(indexName: string): Promise<void> {
    const vectorDB = await this.setupVector();
    return vectorDB.deleteIndex(indexName);
  }
}
