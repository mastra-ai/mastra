export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeEnum(values: unknown[]): string {
  return values.map(value => JSON.stringify(value)).join(' | ');
}

function describeUnion(variants: unknown[]): string {
  return variants.map(describeSchemaType).join(' | ');
}

/** A short, human-readable type for one JSON Schema node, e.g. `string`, `number[]`, `"a" | "b"`. */
export function describeSchemaType(schema: unknown): string {
  if (!isRecord(schema)) return 'unknown';
  if (Array.isArray(schema.enum)) return describeEnum(schema.enum);
  if ('const' in schema) return JSON.stringify(schema.const);
  if (Array.isArray(schema.anyOf)) return describeUnion(schema.anyOf);
  if (Array.isArray(schema.oneOf)) return describeUnion(schema.oneOf);
  if (Array.isArray(schema.type)) return schema.type.join(' | ');
  if (schema.type === 'array') return `${describeSchemaType(schema.items)}[]`;
  if (typeof schema.type === 'string') return schema.type;
  return 'unknown';
}

function toField(name: string, schema: unknown, requiredNames: Set<string>): SchemaField {
  const node = isRecord(schema) ? schema : {};
  // Zod lists defaulted fields as required, but a caller can leave them out.
  const hasDefault = 'default' in node;
  return {
    name,
    type: describeSchemaType(node),
    required: requiredNames.has(name) && !hasDefault,
    description: typeof node.description === 'string' ? node.description : undefined,
    defaultValue: hasDefault ? JSON.stringify(node.default) : undefined,
  };
}

/** The top-level properties of an object JSON Schema, in declaration order. */
export function getSchemaFields(schema: unknown): SchemaField[] {
  if (!isRecord(schema) || !isRecord(schema.properties)) return [];
  const requiredNames = new Set(
    Array.isArray(schema.required) ? schema.required.filter(name => typeof name === 'string') : [],
  );
  return Object.entries(schema.properties).map(([name, property]) => toField(name, property, requiredNames));
}

/** True when the schema describes an object, so its shape reads as a list of fields. */
export function isObjectSchema(schema: unknown): boolean {
  return isRecord(schema) && (schema.type === 'object' || isRecord(schema.properties));
}

const TYPE_KEYWORDS = ['type', 'properties', 'items', 'enum', 'const', 'anyOf', 'oneOf', 'allOf', '$ref'];

/** True when the schema says nothing about the value's shape, e.g. `{ "$schema": "..." }` for a tool without one. */
export function isEmptySchema(schema: unknown): boolean {
  return !isRecord(schema) || !TYPE_KEYWORDS.some(keyword => keyword in schema);
}
