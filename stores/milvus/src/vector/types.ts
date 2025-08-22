import type { IndexType } from '@zilliz/milvus2-sdk-node';

interface IVFConfig {
  lists?: number;
}

interface HNSWConfig {
  m?: number;
  efConstruction?: number;
}

export interface IndexConfig {
  type?: IndexType;
  ivf?: IVFConfig;
  hnsw?: HNSWConfig;
}
