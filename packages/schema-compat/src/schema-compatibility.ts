import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z as zV3 } from 'zod/v3';
import type { z as zV4, ZodType } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import {
  SchemaCompatLayer as SchemaCompatLayerV3,
  ALL_STRING_CHECKS,
  ALL_NUMBER_CHECKS,
  ALL_ARRAY_CHECKS,
  UNSUPPORTED_ZOD_TYPES as UNSUPPORTED_ZOD_TYPES_V3,
  SUPPORTED_ZOD_TYPES as SUPPORTED_ZOD_TYPES_V3,
} from './schema-compatibility-v3';
import type {
  UnsupportedZodType as UnsupportedZodTypeV3,
  ShapeValue as ShapeValueV3,
  StringCheckType,
  NumberCheckType,
  ArrayCheckType,
  AllZodType as AllZodTypeV3,
} from './schema-compatibility-v3';
import {
  SchemaCompatLayer as SchemaCompatLayerV4,
  UNSUPPORTED_ZOD_TYPES as UNSUPPORTED_ZOD_TYPES_V4,
  SUPPORTED_ZOD_TYPES as SUPPORTED_ZOD_TYPES_V4,
} from './schema-compatibility-v4';
import type {
  UnsupportedZodType as UnsupportedZodTypeV4,
  ShapeValue as ShapeValueV4,
  AllZodType as AllZodTypeV4,
} from './schema-compatibility-v4';

// Define constraint types locally since they're not exported from v3/v4 files
type StringConstraints = {
  minLength?: number;
  maxLength?: number;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  cuid?: boolean;
  emoji?: boolean;
  regex?: { pattern: string; flags?: string };
};

type NumberConstraints = {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  multipleOf?: number;
};

type ArrayConstraints = {
  minLength?: number;
  maxLength?: number;
  exactLength?: number;
};

type DateConstraints = {
  minDate?: string;
  maxDate?: string;
  dateFormat?: string;
};
import type { ModelInformation } from './types';
import { convertZodSchemaToAISDKSchema } from './utils';

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

  getUnsupportedZodTypes(v: ZodType): readonly string[] {
    if ('_zod' in v) {
      return this.v4Layer.getUnsupportedZodTypes();
    } else {
      return this.v3Layer.getUnsupportedZodTypes();
    }
  }

  /**
   * Type guard for optional Zod types
   */
  isOptional(v: zV4.ZodType): v is zV4.ZodOptional<any>;
  isOptional(v: zV3.ZodType): v is zV3.ZodOptional<any>;
  isOptional(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isOptional(v);
    } else {
      return this.v3Layer.isOptional(v);
    }
  }

  /**
   * Type guard for object Zod types
   */
  isObj(v: zV4.ZodType): v is zV4.ZodObject<any, any>;
  isObj(v: zV3.ZodType): v is zV3.ZodObject<any, any, any, any, any>;
  isObj(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isObj(v);
    } else {
      return this.v3Layer.isObj(v);
    }
  }

  /**
   * Type guard for null Zod types
   */
  isNull(v: zV4.ZodType): v is zV4.ZodNull;
  isNull(v: zV3.ZodType): v is zV3.ZodNull;
  isNull(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isNull(v);
    } else {
      return this.v3Layer.isNull(v);
    }
  }

  /**
   * Type guard for array Zod types
   */
  isArr(v: zV4.ZodType): v is zV4.ZodArray<any>;
  isArr(v: zV3.ZodType): v is zV3.ZodArray<any, any>;
  isArr(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isArr(v);
    } else {
      return this.v3Layer.isArr(v);
    }
  }

  /**
   * Type guard for union Zod types
   */
  isUnion(v: zV4.ZodType): v is zV4.ZodUnion<[zV4.ZodType, ...zV4.ZodType[]]>;
  isUnion(v: zV3.ZodType): v is zV3.ZodUnion<[zV3.ZodType, ...zV3.ZodType[]]>;
  isUnion(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isUnion(v);
    } else {
      return this.v3Layer.isUnion(v);
    }
  }

  /**
   * Type guard for string Zod types
   */
  isString(v: zV4.ZodType): v is zV4.ZodString;
  isString(v: zV3.ZodType): v is zV3.ZodString;
  isString(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isString(v);
    } else {
      return this.v3Layer.isString(v);
    }
  }

  /**
   * Type guard for number Zod types
   */
  isNumber(v: zV4.ZodType): v is zV4.ZodNumber;
  isNumber(v: zV3.ZodType): v is zV3.ZodNumber;
  isNumber(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isNumber(v);
    } else {
      return this.v3Layer.isNumber(v);
    }
  }

  /**
   * Type guard for date Zod types
   */
  isDate(v: zV4.ZodType): v is zV4.ZodDate;
  isDate(v: zV3.ZodType): v is zV3.ZodDate;
  isDate(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
      return this.v4Layer.isDate(v);
    } else {
      return this.v3Layer.isDate(v);
    }
  }

  /**
   * Type guard for default Zod types
   */
  isDefault(v: zV4.ZodType): v is zV4.ZodDefault<any>;
  isDefault(v: zV3.ZodType): v is zV3.ZodDefault<any>;
  isDefault(v: zV3.ZodType | zV4.ZodType) {
    if ('_zod' in v) {
      // @ts-expect-error - fix later
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
  abstract processZodType(value: zV4.ZodType): zV4.ZodType;
  abstract processZodType(value: zV3.ZodType): zV3.ZodType;
  abstract processZodType(value: zV4.ZodType | zV3.ZodType): zV4.ZodType | zV3.ZodType;

  /**
   * Default handler for Zod object types. Recursively processes all properties in the object.
   *
   * @param value - The Zod object to process
   * @returns The processed Zod object
   */
  public defaultZodObjectHandler(
    value: zV4.ZodObject<any, any>,
    options?: { passthrough?: boolean },
  ): zV4.ZodObject<any, any>;
  public defaultZodObjectHandler(
    value: zV3.ZodObject<any, any>,
    options?: { passthrough?: boolean },
  ): zV3.ZodObject<any, any>;
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
  public defaultUnsupportedZodTypeHandler<T extends zV4.ZodObject | zV3.AnyZodObject>(
    value: T,
    throwOnTypes?: T extends zV4.ZodObject
      ? UnsupportedZodTypeV4[]
      : T extends zV3.AnyZodObject
        ? UnsupportedZodTypeV3[]
        : never,
  ): T extends zV4.ZodObject ? ShapeValueV4<T> : T extends zV3.AnyZodObject ? ShapeValueV3<T> : never {
    if ('_zod' in value) {
      return this.v4Layer.defaultUnsupportedZodTypeHandler(
        // @ts-expect-error - fix later
        value,
        (throwOnTypes ?? UNSUPPORTED_ZOD_TYPES_V4) as typeof UNSUPPORTED_ZOD_TYPES_V4,
      );
    } else {
      return this.v3Layer.defaultUnsupportedZodTypeHandler(
        value,
        (throwOnTypes ?? UNSUPPORTED_ZOD_TYPES_V3) as typeof UNSUPPORTED_ZOD_TYPES_V3,
      );
    }
  }

  /**
   * Default handler for Zod array types. Processes array constraints according to provider support.
   *
   * @param value - The Zod array to process
   * @param handleChecks - Array constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod array
   */
  public defaultZodArrayHandler(value: zV4.ZodArray<any>, handleChecks?: readonly ArrayCheckType[]): zV4.ZodArray<any>;
  public defaultZodArrayHandler(
    value: zV3.ZodArray<any, any>,
    handleChecks?: readonly ArrayCheckType[],
  ): zV3.ZodArray<any, any>;
  public defaultZodArrayHandler(
    value: zV4.ZodArray<any> | zV3.ZodArray<any, any>,
    handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
  ): zV4.ZodArray<any> | zV3.ZodArray<any, any> {
    if ('_zod' in value) {
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
  public defaultZodUnionHandler(value: zV4.ZodUnion<[zV4.ZodType, ...zV4.ZodType[]]>): zV4.ZodType;
  public defaultZodUnionHandler(value: zV3.ZodUnion<[zV3.ZodType, ...zV3.ZodType[]]>): zV3.ZodType;
  public defaultZodUnionHandler(
    value: zV4.ZodUnion<[zV4.ZodType, ...zV4.ZodType[]]> | zV3.ZodUnion<[zV3.ZodType, ...zV3.ZodType[]]>,
  ): zV4.ZodType | zV3.ZodType {
    if ('_zod' in value) {
      // @ts-expect-error - fix later
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
  public defaultZodStringHandler(value: zV4.ZodString, handleChecks?: readonly StringCheckType[]): zV4.ZodString;
  public defaultZodStringHandler(value: zV3.ZodString, handleChecks?: readonly StringCheckType[]): zV3.ZodString;
  public defaultZodStringHandler(
    value: zV4.ZodString | zV3.ZodString,
    handleChecks: readonly StringCheckType[] = ALL_STRING_CHECKS,
  ): zV4.ZodString | zV3.ZodString {
    if ('_zod' in value) {
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
  public defaultZodNumberHandler(value: zV4.ZodNumber, handleChecks?: readonly NumberCheckType[]): zV4.ZodNumber;
  public defaultZodNumberHandler(value: zV3.ZodNumber, handleChecks?: readonly NumberCheckType[]): zV3.ZodNumber;
  public defaultZodNumberHandler(
    value: zV4.ZodNumber | zV3.ZodNumber,
    handleChecks: readonly NumberCheckType[] = ALL_NUMBER_CHECKS,
  ): zV4.ZodNumber | zV3.ZodNumber {
    if ('_zod' in value) {
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
  public defaultZodDateHandler(value: zV4.ZodDate): zV4.ZodString;
  public defaultZodDateHandler(value: zV3.ZodDate): zV3.ZodString;
  public defaultZodDateHandler(value: zV4.ZodDate | zV3.ZodDate): zV4.ZodString | zV3.ZodString {
    if ('_zod' in value) {
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
  public defaultZodOptionalHandler(value: zV4.ZodOptional<any>, handleTypes?: readonly AllZodTypeV4[]): zV4.ZodType;
  public defaultZodOptionalHandler(value: zV3.ZodOptional<any>, handleTypes?: readonly AllZodTypeV3[]): zV3.ZodType;
  public defaultZodOptionalHandler(
    value: zV4.ZodOptional<any> | zV3.ZodOptional<any>,
    handleTypes?: readonly AllZodTypeV3[] | readonly AllZodTypeV4[],
  ): zV4.ZodType | zV3.ZodType {
    if ('_zod' in value) {
      return this.v4Layer.defaultZodOptionalHandler(value, handleTypes ?? SUPPORTED_ZOD_TYPES_V4);
    } else {
      return this.v3Layer.defaultZodOptionalHandler(value, handleTypes ?? SUPPORTED_ZOD_TYPES_V3);
    }
  }

  /**
   * Processes a Zod object schema and converts it to an AI SDK Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns An AI SDK Schema with provider-specific compatibility applied
   */
  public processToAISDKSchema(zodSchema: zV3.ZodSchema | zV4.ZodType): Schema {
    const processedSchema = this.processZodType(zodSchema);

    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }

  /**
   * Processes a Zod object schema and converts it to a JSON Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns A JSONSchema7 object with provider-specific compatibility applied
   */
  public processToJSONSchema(zodSchema: zV3.ZodSchema | zV4.ZodType): JSONSchema7 {
    return this.processToAISDKSchema(zodSchema).jsonSchema;
  }
}
