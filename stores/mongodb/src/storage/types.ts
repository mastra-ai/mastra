import type { MongoClientOptions } from 'mongodb';
import type { ConnectorHandler } from './connectors/base';

export type MongoDBConfig =
  | DatabaseConfig
  | {
      id: string;
      connectorHandler: ConnectorHandler;
    };

export type DatabaseConfig = {
  id: string;
  url: string;
  dbName: string;
  options?: MongoClientOptions;
};
