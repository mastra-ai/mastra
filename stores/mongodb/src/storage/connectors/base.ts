import type { Collection } from 'mongodb';

export interface ConnectorHandler {
  getCollection(collectionName: string): Promise<Collection>;

  close(): Promise<void>;
}
