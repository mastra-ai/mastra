export type FieldType = 'string' | 'number' | 'boolean' | 'text' | 'object' | 'array';

export interface SchemaField {
  id: string;
  name: string;
  description?: string;
  type: FieldType;
  nullable: boolean;
  optional: boolean;
  properties?: SchemaField[];
  items?: SchemaField;
}

let idCounter = 0;

export function createField(overrides: Partial<SchemaField> = {}): SchemaField {
  return {
    id: `field-${Date.now()}-${idCounter++}`,
    name: '',
    type: 'string',
    nullable: false,
    optional: false,
    ...overrides,
  };
}
