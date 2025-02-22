export type IndexType = 'ivfflat' | 'hnsw' | 'flat';

interface IVFConfig {
  lists?: number;
  dynamic?: boolean;
}

interface HNSWConfig {
  m?: number; // Max number of connections (default: 16)
  efConstruction?: number; // Build-time complexity (default: 64)
}

export interface IndexConfig {
  type: IndexType;
  ivf?: IVFConfig;
  hnsw?: HNSWConfig;
}
