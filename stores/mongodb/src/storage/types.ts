import type { MongoClientOptions } from 'mongodb';
import type { ConnectorHandler } from './connectors/base';

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
