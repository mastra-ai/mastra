import {
  MastraStorage,
} from '@mastra/core/storage';

export type MongoDBConfig =
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean;
    }
  | {
      connectionString: string;
    };

export class MongoDBStore extends MastraStorage {
  

  constructor(config: MongoDBConfig) {
    super({ name: 'MongoDBStore' });
  }
}