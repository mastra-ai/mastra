import type { StandardJSONSchemaV1 } from '@standard-schema/spec';
import traverse from 'json-schema-traverse';
import type { z as zV3 } from 'zod/v3';
import type { z as zV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { JSONSchema7, Schema } from './json-schema';
import * as jsonSchemaUtils from './json-schema/utils';
import * as v3 from './schema-compatibility-v3';
import { SchemaCompatLayer as SchemaCompatLayerV3 } from './schema-compatibility-v3';
import * as v4 from './schema-compatibility-v4';
import { SchemaCompatLayer as SchemaCompatLayerV4 } from './schema-compatibility-v4';
import type { ZodType, ZodUnion } from './schema.types';
import { standardSchemaToJSONSchema, toStandardSchema } from './standard-schema/standard-schema';
import type { ModelInformation } from './types';
import { convertZodSchemaToAISDKSchema } from './utils';

// Re-export constants and types
export {
  ALL_STRING_CHECKS,
  ALL_NUMBER_CHECKS,
  ALL_ARRAY_CHECKS,
  UNSUPPORTED_ZOD_TYPES as UNSUPPORTED_ZOD_TYPES_V3,
  SUPPORTED_ZOD_TYPES as SUPPORTED_ZOD_TYPES_V3,
} from './schema-compatibility-v3';
export type {
  UnsupportedZodType as UnsupportedZodTypeV3,
  ShapeValue as ShapeValueV3,
  StringCheckType,
  NumberCheckType,
  ArrayCheckType,
  AllZodType as AllZodTypeV3,
} from './schema-compatibility-v3';
export {
  UNSUPPORTED_ZOD_TYPES as UNSUPPORTED_ZOD_TYPES_V4,
  SUPPORTED_ZOD_TYPES as SUPPORTED_ZOD_TYPES_V4,
} from './schema-compatibility-v4';
export type {
  UnsupportedZodType as UnsupportedZodTypeV4,
  ShapeValue as ShapeValueV4,
  AllZodType as AllZodTypeV4,
} from './schema-compatibility-v4';

type ConstraintHelperText = string[];

export abstract class SchemaCompatLayer {
  private model: ModelInformation;
  private v3Layer: SchemaCompatLayerV3;
  private v4Layer: SchemaCompatLayerV4;

  /**
   * Creates a new schema compatibility instance.
   *
   * @param model - The language model this compatibility layer applies to
   */
  constructor(model: ModelInformation) {
    this.model = model;
    this.v3Layer = new SchemaCompatLayerV3(model, this);
    this.v4Layer = new SchemaCompatLayerV4(model, this);
  }

  /**
   * Gets the language model associated with this compatibility layer.
   *
   * @returns The language model instance
   */
  getModel(): ModelInformation {
    return this.model;
  }

  getUnsupportedZodTypes(value: ZodType): readonly string[] {
    if ('_zod' in value) {
      return this.v4Layer.getUnsupportedZodTypes();
    } else {
      return this.v3Layer.getUnsupportedZodTypes();
    }
  }

  isOptional(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodOptional<any> | zV4.ZodOptional<any> {
    if ('_zod' in v) {
      return this.v4Layer.isOptional(v as any);
    } else {
      return this.v3Layer.isOptional(v as any);
    }
  }

  isObj(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodObject<any, any, any, any, any> | zV4.ZodObject<any, any> {
    if ('_zod' in v) {
      return this.v4Layer.isObj(v as any);
    } else {
      return this.v3Layer.isObj(v as any);
    }
  }

  isNull(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodNull | zV4.ZodNull {
    if ('_zod' in v) {
      return this.v4Layer.isNull(v as any);
    } else {
      return this.v3Layer.isNull(v as any);
    }
  }

  isNullable(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodNullable<any> | zV4.ZodNullable<any> {
    if ('_zod' in v) {
      return this.v4Layer.isNullable(v as any);
    } else {
      return this.v3Layer.isNullable(v as any);
    }
  }

  isArr(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodArray<any, any> | zV4.ZodArray<any> {
    if ('_zod' in v) {
      return this.v4Layer.isArr(v as any);
    } else {
      return this.v3Layer.isArr(v as any);
    }
  }

  isUnion(
    v: zV3.ZodType | zV4.ZodType,
  ): v is zV3.ZodUnion<[zV3.ZodType, ...zV3.ZodType[]]> | zV4.ZodUnion<[zV4.ZodType, ...zV4.ZodType[]]> {
    if ('_zod' in v) {
      return this.v4Layer.isUnion(v as any);
    } else {
      return this.v3Layer.isUnion(v as any);
    }
  }

  isString(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodString | zV4.ZodString {
    if ('_zod' in v) {
      return this.v4Layer.isString(v as any);
    } else {
      return this.v3Layer.isString(v as any);
    }
  }

  isNumber(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodNumber | zV4.ZodNumber {
    if ('_zod' in v) {
      return this.v4Layer.isNumber(v as any);
    } else {
      return this.v3Layer.isNumber(v as any);
    }
  }

  isDate(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodDate | zV4.ZodDate {
    if ('_zod' in v) {
      return this.v4Layer.isDate(v as any);
    } else {
      return this.v3Layer.isDate(v as any);
    }
  }

  isDefault(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodDefault<any> | zV4.ZodDefault<any> {
    if ('_zod' in v) {
      return this.v4Layer.isDefault(v as any);
    } else {
      return this.v3Layer.isDefault(v as any);
    }
  }

  abstract shouldApply(): boolean;
  abstract getSchemaTarget(): Targets | undefined;
  abstract processZodType(value: ZodType): ZodType;

  public preProcessJSONNode(_schema: JSONSchema7, _parentSchema?: JSONSchema7): void {}
  public postProcessJSONNode(_schema: JSONSchema7, _parentSchema?: JSONSchema7): void {}

  public defaultZodObjectHandler(
    value: zV3.ZodObject<any, any, any, any, any> | zV4.ZodObject<any, any>,
    options: { passthrough?: boolean } = { passthrough: true },
  ): zV3.ZodObject<any, any, any, any, any> | zV4.ZodObject<any, any> {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodObjectHandler(value, options);
    } else {
      return this.v3Layer.defaultZodObjectHandler(value, options);
    }
  }

  public mergeParameterDescription(
    description: string | undefined,
    constraints: ConstraintHelperText,
  ): string | undefined {
    return this.v3Layer.mergeParameterDescription(description, constraints);
  }

  public defaultUnsupportedZodTypeHandler(
    value: zV3.ZodType | zV4.ZodType,
    throwOnTypes?: readonly (v3.UnsupportedZodType | v4.UnsupportedZodType)[],
  ): zV3.ZodType | zV4.ZodType {
    if ('_zod' in value) {
      return this.v4Layer.defaultUnsupportedZodTypeHandler(
        value as any,
        (throwOnTypes ?? v4.UNSUPPORTED_ZOD_TYPES) as typeof v4.UNSUPPORTED_ZOD_TYPES,
      );
    } else {
      return this.v3Layer.defaultUnsupportedZodTypeHandler(
        value as any,
        (throwOnTypes ?? v3.UNSUPPORTED_ZOD_TYPES) as typeof v3.UNSUPPORTED_ZOD_TYPES,
      );
    }
  }

  public defaultZodArrayHandler(
    value: zV3.ZodArray<any, any> | zV4.ZodArray<any>,
    handleChecks: readonly v3.ArrayCheckType[] = v3.ALL_ARRAY_CHECKS,
  ): zV3.ZodArray<any, any> | zV4.ZodArray<any> {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodArrayHandler(value, handleChecks);
    } else {
      return this.v3Layer.defaultZodArrayHandler(value, handleChecks);
    }
  }

  public defaultZodUnionHandler(value: ZodUnion): zV3.ZodType | zV4.ZodType {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodUnionHandler(value as any);
    } else {
      return this.v3Layer.defaultZodUnionHandler(value as any);
    }
  }

  public defaultZodStringHandler(
    value: zV3.ZodString | zV4.ZodString,
    handleChecks: readonly v3.StringCheckType[] = v3.ALL_STRING_CHECKS,
  ): zV3.ZodString | zV4.ZodString {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodStringHandler(value);
    } else {
      return this.v3Layer.defaultZodStringHandler(value, handleChecks);
    }
  }

  public defaultZodNumberHandler(
    value: zV3.ZodNumber | zV4.ZodNumber,
    handleChecks: readonly v3.NumberCheckType[] = v3.ALL_NUMBER_CHECKS,
  ): zV3.ZodNumber | zV4.ZodNumber {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodNumberHandler(value);
    } else {
      return this.v3Layer.defaultZodNumberHandler(value, handleChecks);
    }
  }

  public defaultZodDateHandler(value: zV3.ZodDate | zV4.ZodDate): zV3.ZodString | zV4.ZodString {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodDateHandler(value);
    } else {
      return this.v3Layer.defaultZodDateHandler(value);
    }
  }

  public defaultZodOptionalHandler(
    value: zV3.ZodOptional<any> | zV4.ZodOptional<any>,
    handleTypes?: readonly string[],
  ): zV3.ZodType | zV4.ZodType {
    if (!handleTypes) {
      handleTypes = ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber'];
    }

    // Get the inner type name to check if it should be processed
    // Zod v3 uses typeName (e.g., "ZodString"), v4 uses type (e.g., "string")
    let innerTypeName: string;
    if ('_zod' in value) {
      // Zod v4: type is lowercase without "Zod" prefix (e.g., "string", "object", "array")
      const v4Type = value._zod.def.innerType._zod.def.type as string;
      // Convert to v3-style name for comparison (e.g., "string" -> "ZodString")
      innerTypeName = 'Zod' + v4Type.charAt(0).toUpperCase() + v4Type.slice(1);
    } else {
      innerTypeName = value._def.innerType._def.typeName;
    }

    if (handleTypes.includes(innerTypeName)) {
      if ('_zod' in value) {
        return this.processZodType(value._zod.def.innerType).optional();
      } else {
        return this.processZodType(value._def.innerType).optional();
      }
    } else {
      return value;
    }
  }

  public defaultZodNullableHandler(
    value: zV3.ZodNullable<any> | zV4.ZodNullable<any>,
    handleTypes?: readonly string[],
  ): zV3.ZodType | zV4.ZodType {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodNullableHandler(
        value,
        (handleTypes ?? v4.SUPPORTED_ZOD_TYPES) as typeof v4.SUPPORTED_ZOD_TYPES,
      );
    } else {
      return this.v3Layer.defaultZodNullableHandler(
        value as any,
        (handleTypes ?? v3.SUPPORTED_ZOD_TYPES) as typeof v3.SUPPORTED_ZOD_TYPES,
      );
    }
  }

  public processToAISDKSchema(zodSchema: zV3.ZodSchema | zV4.ZodType): Schema {
    const processedSchema = this.processZodType(zodSchema);

    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }

  public processToJSONSchema(zodSchema: ZodType, io: 'input' | 'output' = 'input'): JSONSchema7 {
    const standardSchema = toStandardSchema(zodSchema);

    return standardSchemaToJSONSchema(standardSchema, {
      target: 'draft-07',
      io, // Use input mode so fields with defaults are optional
    });
  }

  // ==========================================
  // JSON Schema Default Handlers
  // ==========================================

  /**
   * Default handler for JSON Schema objects.
   * Processes object schemas with properties and required fields.
   */
  protected defaultObjectHandler(schema: JSONSchema7): JSONSchema7 {
    // Ensure additionalProperties is set appropriately for strict mode
    if (schema.properties && schema.additionalProperties === undefined) {
      schema.additionalProperties = false;
    }
    return schema;
  }

  /**
   * Default handler for JSON Schema arrays.
   * Converts array constraints (minItems, maxItems) to description text.
   */
  protected defaultArrayHandler(schema: JSONSchema7): JSONSchema7 {
    let constraints: string[] = [];

    const minItems = schema.minItems;
    const maxItems = schema.maxItems;

    if (minItems !== undefined && maxItems !== undefined && minItems === maxItems) {
      constraints = [`exact length ${minItems}`];
      delete schema.minItems;
      delete schema.maxItems;
    } else {
      if (minItems !== undefined) {
        constraints.push(`minimum length ${minItems}`);
        delete schema.minItems;
      }
      if (maxItems !== undefined) {
        constraints.push(`maximum length ${maxItems}`);
        delete schema.maxItems;
      }
    }

    if (constraints.length) {
      schema.description = this.mergeParameterDescription(schema.description, constraints);
    }

    return schema;
  }

  /**
   * Default handler for JSON Schema strings.
   * Converts string constraints (minLength, maxLength, pattern, format) to description text.
   */
  protected defaultStringHandler(schema: JSONSchema7): JSONSchema7 {
    const constraints: string[] = [];

    if (schema.minLength !== undefined) {
      constraints.push(`minimum length ${schema.minLength}`);
      delete schema.minLength;
    }
    if (schema.maxLength !== undefined) {
      constraints.push(`maximum length ${schema.maxLength}`);
      delete schema.maxLength;
    }
    if (schema.pattern !== undefined) {
      // Don't add pattern to constraints - just remove it
      delete schema.pattern;
    }
    if (schema.format !== undefined) {
      // Convert format to human-readable constraint text
      const formatMap: Record<string, string> = {
        email: 'a valid email',
        uri: 'a valid url',
        url: 'a valid url',
        uuid: 'a valid uuid',
        'date-time': 'a valid date-time',
        date: 'a valid date',
        time: 'a valid time',
      };
      const formatText = formatMap[schema.format] || `format: ${schema.format}`;
      constraints.push(formatText);
      delete schema.format;
    }

    if (constraints.length) {
      schema.description = this.mergeParameterDescription(schema.description, constraints);
    }

    return schema;
  }

  /**
   * Default handler for JSON Schema numbers/integers.
   * Converts number constraints (minimum, maximum, multipleOf, exclusiveMinimum, exclusiveMaximum) to description text.
   */
  protected defaultNumberHandler(schema: JSONSchema7): JSONSchema7 {
    const constraints: string[] = [];
    if (schema.minimum !== undefined) {
      if (schema.minimum !== Number.MIN_SAFE_INTEGER) {
        constraints.push(`greater than or equal to ${schema.minimum}`);
      }

      delete schema.minimum;
    }
    if (schema.maximum !== undefined) {
      if (schema.maximum !== Number.MAX_SAFE_INTEGER) {
        constraints.push(`lower than or equal to ${schema.maximum}`);
      }

      delete schema.maximum;
    }
    if (schema.exclusiveMinimum !== undefined) {
      constraints.push(`greater than ${schema.exclusiveMinimum}`);
      delete schema.exclusiveMinimum;
    }
    if (schema.exclusiveMaximum !== undefined) {
      constraints.push(`lower than ${schema.exclusiveMaximum}`);
      delete schema.exclusiveMaximum;
    }
    if (schema.multipleOf !== undefined) {
      constraints.push(`multiple of ${schema.multipleOf}`);
      delete schema.multipleOf;
    }

    if (constraints.length) {
      schema.description = this.mergeParameterDescription(schema.description, constraints);
    }

    return schema;
  }

  /**
   * Default handler for JSON Schema unions (anyOf/oneOf).
   * Processes union schemas and can convert anyOf patterns to type arrays for simple primitives.
   */
  protected defaultUnionHandler(schema: JSONSchema7): JSONSchema7 {
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      // Check if all items in anyOf are simple primitive types (only have a 'type' property)
      const allSimplePrimitives = schema.anyOf.every((s: any) => {
        if (typeof s !== 'object' || s === null) return false;
        const keys = Object.keys(s);
        return keys.length === 1 && keys[0] === 'type' && typeof s.type === 'string';
      });

      if (allSimplePrimitives) {
        // Convert anyOf: [{type: "string"}, {type: "number"}] to type: ["string", "number"]
        const types = schema.anyOf.map((s: any) => s.type);
        delete schema.anyOf;
        schema.type = types as JSONSchema7['type'];
      }
    }

    return schema;
  }

  /**
   * Default handler for JSON Schema nullable types.
   * Ensures nullable types are represented correctly.
   */
  protected defaultNullableHandler(schema: JSONSchema7): JSONSchema7 {
    return this.defaultUnionHandler(schema);
  }

  /**
   * Default handler for JSON Schema dates (string with date/date-time format).
   * Converts date formats to string type with format constraint in description.
   */
  protected defaultDateHandler(schema: JSONSchema7): JSONSchema7 {
    if (schema.format === 'date' || schema.format === 'date-time') {
      const format = schema.format;
      delete schema.format;
      schema.description = this.mergeParameterDescription(schema.description, [`format: ${format}`]);
    }
    return schema;
  }

  /**
   * Default handler for empty JSON schemas.
   * Converts empty {} schemas to a union of primitive types.
   */
  protected defaultEmptySchemaHandler(schema: JSONSchema7): JSONSchema7 {
    if (Object.keys(schema).length === 0) {
      schema.type = ['string', 'number', 'boolean', 'null'] as JSONSchema7['type'];
    }
    return schema;
  }

  /**
   * Default handler for unsupported JSON Schema features.
   * Can be used to strip or convert unsupported keywords.
   */
  protected defaultUnsupportedHandler(schema: JSONSchema7, unsupportedKeywords: string[] = []): JSONSchema7 {
    for (const keyword of unsupportedKeywords) {
      if (keyword in schema) {
        delete (schema as Record<string, unknown>)[keyword];
      }
    }
    return schema;
  }

  // ==========================================
  // JSON Schema Type Checkers (delegating to json-schema/utils)
  // ==========================================

  protected isObjectSchema(schema: JSONSchema7): boolean {
    return jsonSchemaUtils.isObjectSchema(schema);
  }

  protected isArraySchema(schema: JSONSchema7): boolean {
    return jsonSchemaUtils.isArraySchema(schema);
  }

  protected isStringSchema(schema: JSONSchema7): boolean {
    return jsonSchemaUtils.isStringSchema(schema);
  }

  protected isNumberSchema(schema: JSONSchema7): boolean {
    return jsonSchemaUtils.isNumberSchema(schema);
  }

  protected isUnionSchema(schema: JSONSchema7): boolean {
    return jsonSchemaUtils.isUnionSchema(schema);
  }

  protected isNullableSchema(schema: JSONSchema7): boolean {
    return jsonSchemaUtils.isNullableSchema(schema);
  }

  protected isDateSchema(schema: JSONSchema7): boolean {
    return jsonSchemaUtils.isStringSchema(schema) && (schema.format === 'date' || schema.format === 'date-time');
  }

  protected isEmptySchema(schema: JSONSchema7): boolean {
    return Object.keys(schema).length === 0;
  }

  /**
   * Checks if a property is optional within a parent object schema.
   * A property is optional if it's not in the parent's `required` array.
   * @param propertyName - The name of the property to check
   * @param parentSchema - The parent object schema containing the property
   */
  protected isOptionalProperty(propertyName: string, parentSchema: JSONSchema7): boolean {
    return jsonSchemaUtils.isOptionalSchema(propertyName, parentSchema);
  }

  /**
   * Converts a Zod schema to JSON Schema using the standard-schema interface
   * and applies pre/post processing via traverse.
   *
   * Uses 'input' io mode so that fields with defaults are optional (appropriate for tool parameters).
   */
  public toJSONSchema(zodSchema: ZodType): JSONSchema7 {
    const target = 'draft-07' as StandardJSONSchemaV1.Target;
    const standardSchema = toStandardSchema(zodSchema);
    const jsonSchema = standardSchemaToJSONSchema(standardSchema, {
      target,
      io: 'input', // Use input mode so fields with defaults are optional
    });

    traverse(jsonSchema, {
      cb: {
        pre: (schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema) => {
          this.preProcessJSONNode(schema, parentSchema);
        },
        post: (schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema) => {
          this.postProcessJSONNode(schema, parentSchema);
        },
      },
    });

    return jsonSchema;
  }
}
