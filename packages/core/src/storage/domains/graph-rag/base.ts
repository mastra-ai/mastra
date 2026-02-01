import { StorageDomain } from '../base';

export interface StorageGraphRAGEntry {
  graphId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class GraphRAGStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'GRAPH_RAG',
    });
  }

  abstract saveGraph(args: { graphId: string; data: Record<string, unknown> }): Promise<void>;

  abstract loadGraph(args: { graphId: string }): Promise<Record<string, unknown> | null>;

  abstract deleteGraph(args: { graphId: string }): Promise<void>;

  abstract listGraphs(): Promise<StorageGraphRAGEntry[]>;
}
