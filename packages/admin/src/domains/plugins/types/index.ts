import { future } from '../../../../example.future.config';

export type Integration = ReturnType<typeof future.availablePlugins>[number];
export interface DisplayConfig {
  gridView: GridView;
}

export interface GridView {
  fields: Field[];
  data: any[];
}

export interface Field {
  id: number;
  name: string;
  displayName: string;
  type: string;
  order: number;
}
