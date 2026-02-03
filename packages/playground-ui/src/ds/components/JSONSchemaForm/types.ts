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

export interface JSONSchemaProperty {
  type: string | string[];
  description?: string;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: string[];
}

export interface JSONSchemaOutput {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
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
