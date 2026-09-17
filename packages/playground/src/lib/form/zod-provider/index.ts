import type { FieldConfig, ParsedField, ParsedSchema, SchemaProvider, SchemaValidation } from '@autoform/core';
import { isPlainObject } from '../utils';
import {
  getDef,
  getBaseSchema,
  getEnumValues,
  getShape,
  getArrayElement,
  getLiteralValues,
  getUnionOptions,
  getIntersection,
  getRecordValueSchema,
  isOptional,
} from './compat';
import { getDefaultValues, getDefaultValueInZodStack } from './default-values';
import { inferFieldType } from './field-type-inference';

type AnySchema = any;

/**
 * Version-agnostic field config extraction.
 * For generated schemas (from jsonSchemaToZod), there's no @autoform/zod fieldConfig() wrapper,
 * so this returns undefined. If a schema happens to carry field config, it will be found here.
 */
function getFieldConfigInZodStack(schema: AnySchema): FieldConfig | undefined {
  const def = getDef(schema);
  if (!def) return undefined;

  // v3: field config stored via Symbol on refinement function
  if (def.typeName === 'ZodEffects' && def.effect?.type === 'refinement') {
    const fn = def.effect?.refinement;
    if (fn) {
      const symbols = Object.getOwnPropertySymbols(fn);
      for (const sym of symbols) {
        const val = (fn as any)[sym];
        if (val && typeof val === 'object') return val as FieldConfig;
      }
    }
  }

  // Recurse into wrappers
  if ('innerType' in def) return getFieldConfigInZodStack(def.innerType);
  if ('schema' in def) return getFieldConfigInZodStack(def.schema);

  return undefined;
}

function parseField(key: string, schema: AnySchema): ParsedField {
  const baseSchema = getBaseSchema(schema);
  const fieldConfig = getFieldConfigInZodStack(schema);
  let type = inferFieldType(baseSchema, fieldConfig);
  const defaultValue = getDefaultValueInZodStack(schema);

  // Enums
  const options = getEnumValues(baseSchema);
  let optionValues: [string, string][] = [];
  if (options) {
    if (!Array.isArray(options)) {
      optionValues = Object.entries(options);
    } else {
      optionValues = options.map(value => [value, value]);
    }
  }

  // Arrays and objects
  let subSchema: ParsedField[] = [];

  const shape = getShape(baseSchema);
  if (shape && !getIntersection(baseSchema)) {
    // ZodObject
    subSchema = Object.entries(shape).map(([k, field]) => parseField(k, field as AnySchema));
  }

  const unionOptions = getUnionOptions(baseSchema);
  const constructorName = baseSchema?.constructor?.name?.slice(1);
  const baseDef = getDef(baseSchema);
  const v4Type =
    typeof baseDef?.type === 'string'
      ? `Zod${baseDef.type.charAt(0).toUpperCase()}${baseDef.type.slice(1)}`
      : undefined;
  const baseTypeName = baseDef?.typeName ?? v4Type ?? constructorName;

  if ((baseTypeName === 'ZodUnion' || baseTypeName === 'ZodDiscriminatedUnion') && unionOptions) {
    subSchema = Object.entries(unionOptions).map(([k, field]: [string, AnySchema]) => {
      return parseField(k, field);
    });
  }

  const intersection = getIntersection(baseSchema);
  if (intersection) {
    const { left: leftSchema, right: rightSchema } = intersection;
    let subSchemaLeft: ParsedField[] = [];
    let subSchemaRight: ParsedField[] = [];

    const leftShape = getShape(leftSchema);
    if (leftShape) {
      subSchemaLeft = Object.entries(leftShape).map(([k, field]) => parseField(k, field as AnySchema));
    } else {
      const leftChild = parseField(key, leftSchema);
      subSchemaLeft = leftChild.schema ?? [leftChild];
      type = leftChild.type;
    }

    const rightShape = getShape(rightSchema);
    if (rightShape) {
      subSchemaRight = Object.entries(rightShape).map(([k, field]) => parseField(k, field as AnySchema));
    } else {
      const rightChild = parseField(key, rightSchema);
      subSchemaRight = rightChild.schema ?? [rightChild];
      type = rightChild.type;
    }

    subSchema = [...subSchemaLeft, ...subSchemaRight];
  }

  if (baseTypeName === 'ZodArray') {
    const element = getArrayElement(baseSchema);
    if (element) {
      subSchema = [parseField('0', element)];
    }
  }

  const isLiteral = baseTypeName === 'ZodLiteral';
  const literalValues = isLiteral ? getLiteralValues(baseSchema) : undefined;

  return {
    key,
    type,
    required: !isOptional(schema),
    default: defaultValue,
    description: baseSchema.description,
    fieldConfig:
      isLiteral || Object.keys(fieldConfig ?? {})?.length > 0
        ? {
            ...fieldConfig,
            customData: {
              ...(fieldConfig?.customData ?? {}),
              ...(isLiteral ? { isLiteral, literalValues } : {}),
            },
          }
        : undefined,
    options: optionValues,
    schema: subSchema,
  };
}

export function parseSchema(schema: AnySchema): ParsedSchema {
  const shape = getShape(schema);
  if (!shape) return { fields: [] };

  const fields: ParsedField[] = Object.entries(shape).map(([key, field]) => parseField(key, field as AnySchema));

  return { fields };
}

function getMemberSchemas(baseSchema: AnySchema): AnySchema[] | undefined {
  const intersection = getIntersection(baseSchema);
  return intersection ? [intersection.left, intersection.right] : getUnionOptions(baseSchema);
}

function normalizeEntries(value: Record<string, unknown>, schemaOf: (key: string) => AnySchema | undefined) {
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const schema = schemaOf(key);
    const childValue = schema ? normalizeFormValues(child, schema) : child;
    if (childValue !== undefined) normalized[key] = childValue;
  }
  return normalized;
}

function omitsBlankGroup(schema: AnySchema, group: Record<string, unknown>) {
  const isBlankGroup = Object.values(group).every(child => child === '' || child === undefined);
  if (!isBlankGroup || schema.safeParse(group).success) return false;
  const omitted = schema.safeParse(undefined);
  return omitted.success && omitted.data === undefined;
}

function normalizeFormValues(value: unknown, schema: AnySchema): unknown {
  const baseSchema = getBaseSchema(schema);
  const members = getMemberSchemas(baseSchema);
  if (members) {
    // Union options and intersection sides all render at one path, so each member normalizes its own keys.
    const group = members.reduce<unknown>((current, member) => normalizeFormValues(current, member), value);
    return isPlainObject(group) && omitsBlankGroup(schema, group) ? undefined : group;
  }

  const shape = getShape(baseSchema);
  if (shape && isPlainObject(value)) {
    const group = normalizeEntries(value, key => shape[key]);
    return omitsBlankGroup(schema, group) ? undefined : group;
  }

  const recordValueSchema = getRecordValueSchema(baseSchema);
  if (recordValueSchema && isPlainObject(value)) return normalizeEntries(value, () => recordValueSchema);

  if (Array.isArray(value)) {
    const element = getArrayElement(baseSchema);
    return element && typeof element === 'object' ? value.map(item => normalizeFormValues(item, element)) : value;
  }

  const blankControl = value === '' || (value === null && !schema.safeParse(null).success);
  if (blankControl && getDefaultValueInZodStack(schema) === undefined) return undefined;

  return value;
}

export class CustomZodProvider<T extends AnySchema> implements SchemaProvider {
  private _schema: T;
  constructor(schema: T) {
    if (!schema) {
      throw new Error('CustomZodProvider: schema is required');
    }
    this._schema = schema;
  }

  getDefaultValues(): Record<string, any> {
    return getDefaultValues(this._schema);
  }

  validateSchema(values: any): SchemaValidation {
    const cleanedValues = normalizeFormValues(values, this._schema);
    const schema: AnySchema = this._schema;
    const validationResult = schema.safeParse(cleanedValues);
    if (validationResult.success) {
      return { success: true, data: validationResult.data } as const;
    }

    const error = validationResult.error;
    // v3: error.errors, v4: error.issues
    const issues = error.issues ?? error.errors ?? [];
    return {
      success: false,
      errors: issues.map((err: any) => ({
        path: err.path as string[],
        message: err.message,
      })),
    } as const;
  }

  parseSchema(): ParsedSchema {
    return parseSchema(this._schema);
  }
}
