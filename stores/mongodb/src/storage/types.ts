import type { MongoClientOptions } from 'mongodb';
import type { ConnectorHandler } from './ConnectorHandler';

export type MongoDBConfig =
  | DatabaseConfig
  | {
      connectorHandler: ConnectorHandler;
    };

export type DatabaseConfig = {
  url: string;
  dbName: string;
  options?: MongoClientOptions;
};
