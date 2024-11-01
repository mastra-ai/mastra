export interface VectorIndex {
  name: string;
  host: string;
  metric: string;
  dimension: number;
}
export interface RagMetadata extends VectorEntityData {
  integration: string;
  index: string;
}
export type VectorIndexWithMetadata = VectorIndex & { id: string } & { metadata: RagMetadata };

export type VectorEntityData = {
  name: string;
  fields: string[];
  syncEvent: string;
  syncParams?: string;
};

export type VectorEntity = { integration: string; data: VectorEntityData[] };

export type VectorEntityDataWithIntegration = VectorEntityData & { integration: string };
