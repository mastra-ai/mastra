import { InMemoryVector } from './in-memory-vector';
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
  connectionUrl?: string;
  authToken?: string;
  syncUrl?: string;
  syncInterval?: number;
};
/**
 * A proxy for the DefaultVector (LibSQLStore) to allow for dynamically loading the vectorDB in a constructor
 * If the vectorDB is in-memory, it will use the InMemoryVector.
 */
export class DefaultProxyVector extends MastraVector {
  private vectorDB: Promise<MastraVector>;

  constructor(config: VectorConfig) {
    super();
    const connectionUrl = config.connectionUrl || process.env.MASTRA_DEFAULT_VECTOR_URL;
    if (!connectionUrl || connectionUrl === ':memory:') {
      this.vectorDB = Promise.resolve(new InMemoryVector());
    } else {
      this.vectorDB = new Promise((resolve, reject) => {
        try {
          import(['./', 'libsql'].join('')) // avoid automatic bundling
            .then(({ DefaultVectorDB }) => {
              this.vectorDB = new DefaultVectorDB({ ...config, connectionUrl });
              resolve(this.vectorDB!);
            })
            .catch(reject);
        } catch (error) {
          console.error(
            'To use DefaultProxyVector for a remote database, you need to install the @libsql/client package',
            error,
          );
          reject(error);
        }
      });
    }
  }

  async query<E extends QueryVectorArgs = QueryVectorArgs>(
    ...args: ParamsToArgs<QueryVectorParams> | E
  ): Promise<QueryResult[]> {
    return (await this.vectorDB).query(...args);
  }
  // Adds type checks for positional arguments if used
  async upsert<E extends UpsertVectorArgs = UpsertVectorArgs>(
    ...args: ParamsToArgs<UpsertVectorParams> | E
  ): Promise<string[]> {
    return (await this.vectorDB).upsert(...args);
  }
  // Adds type checks for positional arguments if used
  async createIndex<E extends CreateIndexArgs = CreateIndexArgs>(
    ...args: ParamsToArgs<CreateIndexParams> | E
  ): Promise<void> {
    return (await this.vectorDB).createIndex(...args);
  }

  async listIndexes(): Promise<string[]> {
    return (await this.vectorDB).listIndexes();
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    return (await this.vectorDB).describeIndex(indexName);
  }

  async deleteIndex(indexName: string): Promise<void> {
    return (await this.vectorDB).deleteIndex(indexName);
  }
}
