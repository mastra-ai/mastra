export interface Integration {
  name: string;
  id: string;
  icon: string;
  displayConfig: DisplayConfig;
}

export interface DisplayConfig {
  gridView: GridView;
}

export interface GridView {
  fields: Field[];
}

export interface Field {
  id: string;
  name: string;
  displayName: string;
  type: string;
  order: number;
}
