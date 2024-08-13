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
  columns: Column[];
}

export interface Column {
  field: string;
  header: string;
  type: string;
}
