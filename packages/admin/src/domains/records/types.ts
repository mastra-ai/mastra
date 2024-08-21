export interface SortField {
  type: string;
  name: string;
  displayName: string;
  config?: Record<string, any>;
  compositeFields?: any[];
}

export interface SortLogic {
  field: SortField;
  mode: 'ascending' | 'descending';
}
