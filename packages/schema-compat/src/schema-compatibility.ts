import type { Schema, LanguageModelV1 } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodOptional, ZodObject, ZodArray, ZodUnion, ZodString, ZodNumber, ZodDate } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import {SchemaCompatLayer as SchemaCompatLayerV3, ALL_STRING_CHECKS, ALL_NUMBER_CHECKS, ALL_ARRAY_CHECKS, UNSUPPORTED_ZOD_TYPES, SUPPORTED_ZOD_TYPES} from './schema-compatibility-v3'
import {SchemaCompatLayer as SchemaCompatLayerV4 } from './schema-compatibility-v4'
import { convertZodSchemaToAISDKSchema } from './utils';
import type { ZodNull, ZodType } from 'zod/v4';

export abstract class SchemaCompatLayer {
  private model: LanguageModelV1;
  private v3Layer: SchemaCompatLayerV3;
  private v4Layer: SchemaCompatLayerV4;

  /**
   * Creates a new schema compatibility instance.
   *
   * @param model - The language model this compatibility layer applies to
   */
  constructor(model: LanguageModelV1) {
    this.model = model;
    this.v3Layer = new SchemaCompatLayerV3(model, this);
    this.v4Layer = new SchemaCompatLayerV4(model,  this);
  }

  /**
   * Gets the language model associated with this compatibility layer.
   *
   * @returns The language model instance
   */
  getModel(): LanguageModelV1 {
    return this.model;
  }

   /**
   * Type guard for optional Zod types
   */
   isOptional(v: ZodType): v is ZodOptional<any> {
    if ("_zod" in v) {
      return this.v4Layer.isOptional(v);
    } else {
      return this.v3Layer.isOptional(v);
    }
  }

  /**
   * Type guard for object Zod types
   */
  isObj(v: ZodType): v is ZodObject<any, any> {
    if ("_zod" in v) {
      return this.v4Layer.isObj(v);
    } else {
      return this.v3Layer.isObj(v);
    }
  }

  /**
   * Type guard for null Zod types
   */
  isNull(v: ZodType): v is ZodNull {
    if ("_zod" in v) {
      return this.v4Layer.isNull(v);
    } else {
      return this.v3Layer.isNull(v);
    }
  }

  /**
   * Type guard for array Zod types
   */
  isArr(v: ZodType): v is ZodArray<any> {
    if ("_zod" in v) {
      return this.v4Layer.isArr(v);
    } else {
      return this.v3Layer.isArr(v);
    }
  }

  /**
   * Type guard for union Zod types
   */
  isUnion(v: ZodType): v is ZodUnion<[ZodType, ...ZodType[]]> {
    if ("_zod" in v) {
      return this.v4Layer.isUnion(v);
    } else {
      return this.v3Layer.isUnion(v);
    }
  }

  /**
   * Type guard for string Zod types
   */
  isString(v: ZodType): v is ZodString {
    if ("_zod" in v) {
      return this.v4Layer.isString(v);
    } else {
      return this.v3Layer.isString(v);
    }
  }

  /**
   * Type guard for number Zod types
   */
  isNumber(v: ZodType): v is ZodNumber {
    if ("_zod" in v) {
      return this.v4Layer.isNumber(v);
    } else {
      return this.v3Layer.isNumber(v);
    }
  }

  /**
   * Type guard for date Zod types
   */
  isDate(v: ZodType): v is ZodDate {
    if ("_zod" in v) {
      return this.v4Layer.isDate(v);
    } else {
      return this.v3Layer.isDate(v);
    }
  }

  /**
   * Type guard for default Zod types
   */
  isDefault(v: ZodType): v is ZodDefault<any> {
    if ("_zod" in v) {
      return this.v4Layer.isDefault(v);
    } else {
      return this.v3Layer.isDefault(v);
    }
  }

  /**
   * Determines whether this compatibility layer should be applied for the current model.
   *
   * @returns True if this compatibility layer should be used, false otherwise
   * @abstract
   */
  abstract shouldApply(): boolean;

  /**
   * Returns the JSON Schema target format for this provider.
   *
   * @returns The schema target format, or undefined to use the default 'jsonSchema7'
   * @abstract
   */
  abstract getSchemaTarget(): Targets | undefined;

  /**
   * Processes a specific Zod type according to the provider's requirements.
   *
   * @param value - The Zod type to process
   * @returns The processed Zod type
   * @abstract
   */
  abstract processZodType(value: ZodType): ZodType;

  /**
   * Default handler for Zod object types. Recursively processes all properties in the object.
   *
   * @param value - The Zod object to process
   * @returns The processed Zod object
   */
  public defaultZodObjectHandler(
    value: ZodObject<any, any, any>,
    options: { passthrough?: boolean } = { passthrough: true },
  ): ZodObject<any, any, any> {

     if ("_zod" in value) {
        return this.v4Layer.defaultZodObjectHandler(value, options);
      } else {
        return this.v3Layer.defaultZodObjectHandler(value, options);
      }
  }

  /**
   * Merges validation constraints into a parameter description.
   *
   * This helper method converts validation constraints that may not be supported
   * by a provider into human-readable descriptions.
   *
   * @param description - The existing parameter description
   * @param constraints - The validation constraints to merge
   * @returns The updated description with constraints, or undefined if no constraints
   */
  public mergeParameterDescription(
    description: string | undefined,
    constraints:
      | NumberConstraints
      | StringConstraints
      | ArrayConstraints
      | DateConstraints
      | { defaultValue?: unknown },
  ): string | undefined {
    // This method doesn't depend on Zod version, so we can use either layer
    return this.v3Layer.mergeParameterDescription(description, constraints);
  }

  /**
   * Default handler for unsupported Zod types. Throws an error for specified unsupported types.
   *
   * @param value - The Zod type to check
   * @param throwOnTypes - Array of type names to throw errors for
   * @returns The original value if not in the throw list
   * @throws Error if the type is in the unsupported list
   */
  public defaultUnsupportedZodTypeHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    throwOnTypes: readonly UnsupportedZodType[] = UNSUPPORTED_ZOD_TYPES,
  ): ShapeValue<T> {
    if ("_zod" in value) {
      return this.v4Layer.defaultUnsupportedZodTypeHandler(value, throwOnTypes);
    } else {
      return this.v3Layer.defaultUnsupportedZodTypeHandler(value, throwOnTypes);
    }
  }

  /**
   * Default handler for Zod array types. Processes array constraints according to provider support.
   *
   * @param value - The Zod array to process
   * @param handleChecks - Array constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod array
   */
  public defaultZodArrayHandler(
    value: ZodArray<any, any>,
    handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
  ): ZodArray<any, any> {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodArrayHandler(value, handleChecks);
    } else {
      return this.v3Layer.defaultZodArrayHandler(value, handleChecks);
    }
  }

  /**
   * Default handler for Zod union types. Processes all union options.
   *
   * @param value - The Zod union to process
   * @returns The processed Zod union
   * @throws Error if union has fewer than 2 options
   */
  public defaultZodUnionHandler(value: ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>): ZodTypeAny {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodUnionHandler(value);
    } else {
      return this.v3Layer.defaultZodUnionHandler(value);
    }
  }

  /**
   * Default handler for Zod string types. Processes string validation constraints.
   *
   * @param value - The Zod string to process
   * @param handleChecks - String constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod string
   */
  public defaultZodStringHandler(
    value: ZodString,
    handleChecks: readonly StringCheckType[] = ALL_STRING_CHECKS,
  ): ZodString {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodStringHandler(value);
    } else {
      return this.v3Layer.defaultZodStringHandler(value, handleChecks);
    }
  }

  /**
   * Default handler for Zod number types. Processes number validation constraints.
   *
   * @param value - The Zod number to process
   * @param handleChecks - Number constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod number
   */
  public defaultZodNumberHandler(
    value: ZodNumber,
    handleChecks: readonly NumberCheckType[] = ALL_NUMBER_CHECKS,
  ): ZodNumber {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodNumberHandler(value);
    } else {
      return this.v3Layer.defaultZodNumberHandler(value, handleChecks);
    }
  }

  /**
   * Default handler for Zod date types. Converts dates to ISO strings with constraint descriptions.
   *
   * @param value - The Zod date to process
   * @returns A Zod string schema representing the date in ISO format
   */
  public defaultZodDateHandler(value: ZodDate): ZodString {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodDateHandler(value);
    } else {
      return this.v3Layer.defaultZodDateHandler(value);
    }
  }

  /**
   * Default handler for Zod optional types. Processes the inner type and maintains optionality.
   *
   * @param value - The Zod optional to process
   * @param handleTypes - Types that should be processed vs passed through
   * @returns The processed Zod optional
   */
  public defaultZodOptionalHandler(
    value: ZodOptional<any>,
    handleTypes: readonly AllZodType[] = SUPPORTED_ZOD_TYPES,
  ): ZodTypeAny {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodOptionalHandler(value, handleTypes);
    } else {
      return this.v3Layer.defaultZodOptionalHandler(value, handleTypes);
    }
  }

  /**
   * Processes a Zod object schema and converts it to an AI SDK Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns An AI SDK Schema with provider-specific compatibility applied
   */
  public processToAISDKSchema(zodSchema: z.ZodSchema): Schema {
    const processedSchema = this.processZodType(zodSchema);

    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }

  /**
   * Processes a Zod object schema and converts it to a JSON Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns A JSONSchema7 object with provider-specific compatibility applied
   */
  public processToJSONSchema(zodSchema: z.ZodSchema): JSONSchema7 {
    return this.processToAISDKSchema(zodSchema).jsonSchema;
  }
}
