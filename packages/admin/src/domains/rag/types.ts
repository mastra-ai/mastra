export interface VectorIndex {
  name: string;
  host: string;
  metric: string;
  dimension: number;
}

export type VectorEntityData = {
  name: string;
  fields: string[];
  syncEvent: string;
  index: string;
};

export type VectorEntity = { integration: string; data: VectorEntityData[] };

export type VectorEntityDataWithIntegration = VectorEntityData & { integration: string };
