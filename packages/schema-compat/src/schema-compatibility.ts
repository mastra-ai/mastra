import type { StandardJSONSchemaV1 } from '@standard-schema/spec';
import traverse from 'json-schema-traverse';
import type { z as zV3 } from 'zod/v3';
import type { z as zV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { JSONSchema7, Schema } from './json-schema';
import * as jsonSchemaUtils from './json-schema/utils';
import type { PublicSchema, StandardSchemaWithJSON } from './schema';
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

  public preProcessJSONNode(_schema: JSONSchema7, _parentSchema?: JSONSchema7): void {}
  public postProcessJSONNode(_schema: JSONSchema7, _parentSchema?: JSONSchema7): void {}

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

  isIntersection(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodIntersection<any, any> | zV4.ZodIntersection<any, any> {
    if ('_zod' in v) {
      return this.v4Layer.isIntersection(v as any);
    } else {
      return this.v3Layer.isIntersection(v as any);
    }
  }

  abstract shouldApply(): boolean;
  abstract getSchemaTarget(): Targets | undefined;
  abstract processZodType(value: ZodType): ZodType;

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
      // Add defensive checks for nested property access
      const innerType = value._zod?.def?.innerType;
      const v4Type = innerType?._zod?.def?.type as string | undefined;
      if (!v4Type) {
        // If nested properties are missing, return the value unchanged
        return value;
      }
      // Convert to v3-style name for comparison (e.g., "string" -> "ZodString")
      innerTypeName = 'Zod' + v4Type.charAt(0).toUpperCase() + v4Type.slice(1);
    } else {
      innerTypeName = value._def.innerType._def.typeName;
    }

    if (handleTypes.includes(innerTypeName)) {
      if ('_zod' in value) {
        const innerType = value._zod?.def?.innerType;
        if (!innerType) {
          return value;
        }
        return this.processZodType(innerType).optional();
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

  public defaultZodIntersectionHandler(
    value: zV3.ZodIntersection<any, any> | zV4.ZodIntersection<any, any>,
  ): zV3.ZodType | zV4.ZodType {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodIntersectionHandler(value as any);
    } else {
      return this.v3Layer.defaultZodIntersectionHandler(value as any);
    }
  }

  /**
   * @deprecated please use processToCompatSchema to usse StandardSchemaWithJSON
   * @param zodSchema
   * @returns
   */
  public processToAISDKSchema(zodSchema: zV3.ZodSchema | zV4.ZodType): Schema {
    const processedSchema = this.processZodType(zodSchema);

    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }

  /**
   * @param schema
   * @returns
   */
  public processToJSONSchema(schema: PublicSchema<any>, io: 'input' | 'output' = 'input'): JSONSchema7 {
    const standardSchema = toStandardSchema(schema);

    const jsonSchema = standardSchemaToJSONSchema(standardSchema, {
      target: 'draft-07',
      io, // Use input mode so fields with defaults are optional
    });

    traverse(jsonSchema, {
      cb: {
        pre: schema => {
          this.preProcessJSONNode(schema);
        },
        post: schema => {
          this.postProcessJSONNode(schema);
        },
      },
    });

    return jsonSchema;
  }

  public processToCompatSchema<T>(schema: PublicSchema<T>): StandardSchemaWithJSON<T> {
    return {
      '~standard': {
        version: 1,
        vendor: 'mastra',
        validate: (value: unknown) => toStandardSchema(schema)['~standard'].validate(value),
        jsonSchema: {
          input: () => {
            return this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          },
          output: () => {
            return this.processToJSONSchema(schema, 'output') as Record<string, unknown>;
          },
        },
      },
    };
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

    if (!Object.keys(schema.properties ?? {}).length) {
      schema.required = [];
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

    switch (schema.format) {
      case 'email':
      case 'emoji':
      case 'uri':
      case 'uuid':
      case 'date-time':
      case 'date':
      case 'time': {
        constraints.push(`a valid ${schema.format}`);

        delete schema.pattern;
        delete schema.format;
        break;
      }
    }

    if (constraints.length === 0 && schema.pattern !== undefined) {
      constraints.push(`input must match this regex ${schema.pattern}`);
      delete schema.pattern;
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
    // if (Array.isArray(schema.type)) {
    //   schema.anyOf = schema.type.map(type => {
    //     const result = { type };

    //     return result;
    //   });

    //   delete schema.type;
    // }

    if (Array.isArray(schema.anyOf)) {
      // const hasNull = schema.anyOf.some(subSchema => typeof subSchema === 'object' && subSchema.type === 'null');
      // const hasString = schema.anyOf.some(subSchema => typeof subSchema === 'object' && subSchema.type === 'string');

      schema.anyOf = schema.anyOf
        .map(subSchema => {
          if (typeof subSchema !== 'object' || subSchema === null) {
            return false;
          }

          // if (subSchema.type === 'string' && hasNull) {
          //   // @ts-expect-error - nullable is a valid property for JSON Schema
          //   subSchema.nullable = true;
          // } else if (subSchema.type === 'array') {
          //   subSchema.items = [];
          // } else if (subSchema.type === 'null' && hasString) {
          //   return false;
          // }

          this.preProcessJSONNode(subSchema);
          this.postProcessJSONNode(subSchema);

          // if (hasNull && subSchema.type && subSchema.type !== 'null') {
          //   subSchema.type = [].concat(subSchema.type, 'null');
          // }

          return subSchema;
        })
        .filter(Boolean);

      if (schema.anyOf.length === 1) {
        schema = schema.anyOf[0] as unknown as JSONSchema7;
      }
    }

    return schema;
  }

  /**
   * Default handler for JSON Schema allOf (intersection) types.
   * Flattens allOf sub-schemas by merging properties and required arrays into a single object schema.
   */
  protected defaultAllOfHandler(schema: JSONSchema7): JSONSchema7 {
    if (!schema.allOf || !Array.isArray(schema.allOf)) return schema;

    const mergedProperties: Record<string, JSONSchema7> = {};
    const mergedRequired: string[] = [];

    for (const subSchema of schema.allOf as JSONSchema7[]) {
      if (subSchema.properties) {
        Object.assign(mergedProperties, subSchema.properties);
      }
      if (Array.isArray(subSchema.required)) {
        mergedRequired.push(...subSchema.required);
      }
    }

    delete schema.allOf;
    schema.type = 'object';
    schema.properties = mergedProperties;
    if (mergedRequired.length > 0) {
      schema.required = [...new Set(mergedRequired)];
    }
    schema.additionalProperties = false;

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

  protected isAllOfSchema(schema: JSONSchema7): schema is JSONSchema7 & { allOf: JSONSchema7[] } {
    return jsonSchemaUtils.isAllOfSchema(schema);
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
   * @deprecated please use processToCompatSchema
   */
  public toJSONSchema(zodSchema: ZodType): JSONSchema7 {
    const SCHEMA_TARGET_TO_STANDARD: Record<string, StandardJSONSchemaV1.Target> = {
      jsonSchema7: 'draft-07',
      'jsonSchema2019-09': 'draft-2020-12',
      openApi3: 'openapi-3.0',
    };
    const schemaTarget = this.getSchemaTarget();
    const target = (schemaTarget && SCHEMA_TARGET_TO_STANDARD[schemaTarget]) ?? schemaTarget;
    const standardSchema = toStandardSchema(zodSchema);
    const jsonSchema = standardSchemaToJSONSchema(standardSchema, {
      target,
      io: 'input', // Use input mode so fields with defaults are optional
    });

    traverse(jsonSchema, {
      cb: {
        pre: schema => {
          this.preProcessJSONNode(schema);
        },
        post: schema => {
          this.postProcessJSONNode(schema);
        },
      },
    });

    return jsonSchema;
  }
}
