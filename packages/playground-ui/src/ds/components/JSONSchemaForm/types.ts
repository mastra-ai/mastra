import type { JsonSchemaProperty, JsonSchemaOutput } from '@/lib/json-schema';

// Re-export with original naming convention for backward compatibility
export type { JsonSchemaProperty as JSONSchemaProperty, JsonSchemaOutput as JSONSchemaOutput };

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
