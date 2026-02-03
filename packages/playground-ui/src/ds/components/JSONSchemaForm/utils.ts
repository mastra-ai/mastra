import type { JsonSchema, JsonSchemaProperty } from '@/lib/json-schema';
import type { SchemaField, FieldType } from './types';
import { createField } from './types';

function fieldTypeToJSONSchemaType(type: FieldType): string {
  switch (type) {
    case 'text':
      return 'string';
    default:
      return type;
  }
}

function fieldToJSONSchemaProperty(field: SchemaField): JsonSchemaProperty {
  const baseType = fieldTypeToJSONSchemaType(field.type);
  const type = field.nullable ? [baseType, 'null'] : baseType;

  const property: JsonSchemaProperty = { type };

  if (field.description) {
    property.description = field.description;
  }

  if (field.type === 'object' && field.properties && field.properties.length > 0) {
    const { properties, required } = fieldsToPropertiesAndRequired(field.properties);
    property.properties = properties;
    if (required.length > 0) {
      property.required = required;
    }
  }

  if (field.type === 'array' && field.items) {
    property.items = fieldToJSONSchemaProperty(field.items);
  }

  return property;
}

function fieldsToPropertiesAndRequired(fields: SchemaField[]): {
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
} {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const field of fields) {
    if (!field.name.trim()) continue;

    properties[field.name] = fieldToJSONSchemaProperty(field);

    if (!field.optional) {
      required.push(field.name);
    }
  }

  return { properties, required };
}

export function fieldsToJSONSchema(fields: SchemaField[]): JsonSchema {
  const { properties, required } = fieldsToPropertiesAndRequired(fields);

  const schema: JsonSchema = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

// --- Hydration: Convert JsonSchema back to SchemaField[] ---

function parsePropertyType(type: string | string[] | undefined): { type: string; nullable: boolean } {
  if (Array.isArray(type)) {
    const nullable = type.includes('null');
    const baseType = type.find(t => t !== 'null') || 'string';
    return { type: baseType, nullable };
  }
  return { type: type || 'string', nullable: false };
}

function jsonSchemaTypeToFieldType(type: string): FieldType {
  if (['string', 'number', 'boolean', 'object', 'array'].includes(type)) {
    return type as FieldType;
  }
  return 'string';
}

function propertyToField(prop: JsonSchemaProperty): SchemaField {
  const { type, nullable } = parsePropertyType(prop.type);
  return createField({
    name: '',
    type: jsonSchemaTypeToFieldType(type),
    description: prop.description,
    nullable,
    optional: false,
    properties: prop.properties ? jsonSchemaToFields({ properties: prop.properties, required: prop.required }) : undefined,
    items: prop.items ? propertyToField(prop.items) : undefined,
  });
}

export function jsonSchemaToFields(schema: JsonSchema | undefined): SchemaField[] {
  if (!schema?.properties) return [];
  const requiredSet = new Set(schema.required || []);

  return Object.entries(schema.properties).map(([name, prop]) => {
    const { type, nullable } = parsePropertyType(prop.type);
    return createField({
      name,
      type: jsonSchemaTypeToFieldType(type),
      description: prop.description,
      nullable,
      optional: !requiredSet.has(name),
      properties: prop.properties ? jsonSchemaToFields({ properties: prop.properties, required: prop.required }) : undefined,
      items: prop.items ? propertyToField(prop.items) : undefined,
    });
  });
}

export function getFieldsAtPath(fields: SchemaField[], path: string[]): SchemaField[] {
  if (path.length === 0) {
    return fields;
  }

  const [currentId, ...restPath] = path;
  const currentField = fields.find(f => f.id === currentId);

  if (!currentField) {
    return [];
  }

  if (currentField.type === 'object') {
    return getFieldsAtPath(currentField.properties || [], restPath);
  }

  if (currentField.type === 'array' && currentField.items) {
    return getFieldsAtPath(currentField.items.properties || [], restPath);
  }

  return [];
}

export function updateFieldAtPath(
  fields: SchemaField[],
  path: string[],
  fieldId: string,
  updates: Partial<SchemaField>,
): SchemaField[] {
  if (path.length === 0) {
    return fields.map(f => (f.id === fieldId ? { ...f, ...updates } : f));
  }

  const [currentId, ...restPath] = path;

  return fields.map(f => {
    if (f.id !== currentId) {
      return f;
    }

    if (f.type === 'object') {
      return {
        ...f,
        properties: updateFieldAtPath(f.properties || [], restPath, fieldId, updates),
      };
    }

    if (f.type === 'array' && f.items) {
      return {
        ...f,
        items: {
          ...f.items,
          properties: updateFieldAtPath(f.items.properties || [], restPath, fieldId, updates),
        },
      };
    }

    return f;
  });
}

export function addFieldAtPath(fields: SchemaField[], path: string[], newField: SchemaField): SchemaField[] {
  if (path.length === 0) {
    return [...fields, newField];
  }

  const [currentId, ...restPath] = path;

  return fields.map(f => {
    if (f.id !== currentId) {
      return f;
    }

    if (f.type === 'object') {
      return {
        ...f,
        properties: addFieldAtPath(f.properties || [], restPath, newField),
      };
    }

    if (f.type === 'array' && f.items) {
      return {
        ...f,
        items: {
          ...f.items,
          properties: addFieldAtPath(f.items.properties || [], restPath, newField),
        },
      };
    }

    return f;
  });
}

export function removeFieldAtPath(fields: SchemaField[], path: string[], fieldId: string): SchemaField[] {
  if (path.length === 0) {
    return fields.filter(f => f.id !== fieldId);
  }

  const [currentId, ...restPath] = path;

  return fields.map(f => {
    if (f.id !== currentId) {
      return f;
    }

    if (f.type === 'object') {
      return {
        ...f,
        properties: removeFieldAtPath(f.properties || [], restPath, fieldId),
      };
    }

    if (f.type === 'array' && f.items) {
      return {
        ...f,
        items: {
          ...f.items,
          properties: removeFieldAtPath(f.items.properties || [], restPath, fieldId),
        },
      };
    }

    return f;
  });
}
