import type { Schema, LanguageModelV1 } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { convertZodSchemaToAISDKSchema } from './utils';

/**
 * All supported string validation check types that can be processed or converted to descriptions.
 * @constant
 */
export const ALL_STRING_CHECKS = ['regex', 'emoji', 'email', 'url', 'uuid', 'cuid', 'min', 'max'] as const;

/**
 * All supported number validation check types that can be processed or converted to descriptions.
 * @constant
 */
export const ALL_NUMBER_CHECKS = [
  'min', // gte internally
  'max', // lte internally
  'multipleOf',
] as const;

/**
 * All supported array validation check types that can be processed or converted to descriptions.
 * @constant
 */
export const ALL_ARRAY_CHECKS = ['min', 'max', 'length'] as const;

/**
 * Zod types that are not supported by most AI model providers and should be avoided.
 * @constant
 */
export const UNSUPPORTED_ZOD_TYPES = ['ZodIntersection', 'ZodNever', 'ZodNull', 'ZodTuple', 'ZodUndefined'] as const;

/**
 * Zod types that are generally supported by AI model providers.
 * @constant
 */
export const SUPPORTED_ZOD_TYPES = [
  'ZodObject',
  'ZodArray',
  'ZodUnion',
  'ZodString',
  'ZodNumber',
  'ZodDate',
  'ZodAny',
  'ZodDefault',
] as const;

/**
 * All Zod types (both supported and unsupported).
 * @constant
 */
export const ALL_ZOD_TYPES = [...SUPPORTED_ZOD_TYPES, ...UNSUPPORTED_ZOD_TYPES] as const;

/**
 * Type representing string validation checks.
 */
export type StringCheckType = (typeof ALL_STRING_CHECKS)[number];

/**
 * Type representing number validation checks.
 */
export type NumberCheckType = (typeof ALL_NUMBER_CHECKS)[number];

/**
 * Type representing array validation checks.
 */
export type ArrayCheckType = (typeof ALL_ARRAY_CHECKS)[number];

/**
 * Type representing unsupported Zod schema types.
 */
export type UnsupportedZodType = (typeof UNSUPPORTED_ZOD_TYPES)[number];

/**
 * Type representing supported Zod schema types.
 */
export type SupportedZodType = (typeof SUPPORTED_ZOD_TYPES)[number];

/**
 * Type representing all Zod schema types (supported and unsupported).
 */
export type AllZodType = (typeof ALL_ZOD_TYPES)[number];

/**
 * Utility type to extract the shape of a Zod object schema.
 */
export type ZodShape<T extends z.AnyZodObject> = T['shape'];

/**
 * Utility type to extract the keys from a Zod object shape.
 */
export type ShapeKey<T extends z.AnyZodObject> = keyof ZodShape<T>;

/**
 * Utility type to extract the value types from a Zod object shape.
 */
export type ShapeValue<T extends z.AnyZodObject> = ZodShape<T>[ShapeKey<T>];

// Add constraint types at the top

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

/**
 * Abstract base class for creating schema compatibility layers for different AI model providers.
 *
 * This class provides a framework for transforming Zod schemas to work with specific AI model
 * provider requirements and limitations. Each provider may have different support levels for
 * JSON Schema features, validation constraints, and data types.
 *
 * @abstract
 *
 * @example
 * ```typescript
 * import { SchemaCompatLayer } from '@mastra/schema-compat';
 * import type { LanguageModelV1 } from 'ai';
 *
 * class CustomProviderCompat extends SchemaCompatLayer {
 *   constructor(model: LanguageModelV1) {
 *     super(model);
 *   }
 *
 *   shouldApply(): boolean {
 *     return this.getModel().provider === 'custom-provider';
 *   }
 *
 *   getSchemaTarget() {
 *     return 'jsonSchema7';
 *   }
 *
 *   processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
 *     // Custom processing logic for this provider
 *     switch (value._def.typeName) {
 *       case 'ZodString':
 *         return this.defaultZodStringHandler(value, ['email', 'url']);
 *       default:
 *         return this.defaultUnsupportedZodTypeHandler(value);
 *     }
 *   }
 * }
 * ```
 */
export abstract class SchemaCompatLayer {
  private model: LanguageModelV1;

  /**
   * Creates a new schema compatibility instance.
   *
   * @param model - The language model this compatibility layer applies to
   */
  constructor(model: LanguageModelV1) {
    this.model = model;
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
  abstract processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T>;

  /**
   * Applies compatibility transformations to a Zod object schema.
   *
   * @param zodSchema - The Zod object schema to transform
   * @returns Object containing the transformed schema
   * @private
   */
  private applyZodSchemaCompatibility(zodSchema: z.AnyZodObject): {
    schema: z.AnyZodObject;
  } {
    const newSchema = z.object(
      Object.entries<z.ZodTypeAny>(zodSchema.shape || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: this.processZodType<any>(value),
        }),
        {},
      ),
    );

    return { schema: newSchema };
  }

  /**
   * Default handler for Zod object types. Recursively processes all properties in the object.
   *
   * @param value - The Zod object to process
   * @returns The processed Zod object
   */
  public defaultZodObjectHandler<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    const zodObject = value as z.ZodObject<any, any, any>;
    const processedShape = Object.entries(zodObject.shape || {}).reduce<Record<string, z.ZodTypeAny>>(
      (acc, [key, propValue]) => {
        const typedPropValue = propValue as z.ZodTypeAny;
        const processedValue = this.processZodType<T>(typedPropValue);
        acc[key] = processedValue;
        return acc;
      },
      {},
    );
    let result = z.object(processedShape);
    if (value.description) {
      result = result.describe(value.description);
    }
    return result as ShapeValue<T>;
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
    if (Object.keys(constraints).length > 0) {
      return (description ? description + '\n' : '') + JSON.stringify(constraints);
    } else {
      return description;
    }
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
    if (throwOnTypes.includes(value._def.typeName as UnsupportedZodType)) {
      throw new Error(`${this.model.modelId} does not support zod type: ${value._def.typeName}`);
    }
    return value as ShapeValue<T>;
  }

  /**
   * Default handler for Zod array types. Processes array constraints according to provider support.
   *
   * @param value - The Zod array to process
   * @param handleChecks - Array constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod array
   */
  public defaultZodArrayHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
  ): ShapeValue<T> {
    const zodArray = (value as z.ZodArray<any>)._def;
    const arrayType = zodArray.type;
    const constraints: ArrayConstraints = {};
    if (zodArray.minLength?.value !== undefined && handleChecks.includes('min')) {
      constraints.minLength = zodArray.minLength.value;
    }
    if (zodArray.maxLength?.value !== undefined && handleChecks.includes('max')) {
      constraints.maxLength = zodArray.maxLength.value;
    }
    if (zodArray.exactLength?.value !== undefined && handleChecks.includes('length')) {
      constraints.exactLength = zodArray.exactLength.value;
    }
    const processedType =
      arrayType._def.typeName === 'ZodObject' ? this.processZodType<T>(arrayType as z.ZodTypeAny) : arrayType;
    let result = z.array(processedType);
    if (zodArray.minLength?.value !== undefined && !handleChecks.includes('min')) {
      result = result.min(zodArray.minLength.value);
    }
    if (zodArray.maxLength?.value !== undefined && !handleChecks.includes('max')) {
      result = result.max(zodArray.maxLength.value);
    }
    if (zodArray.exactLength?.value !== undefined && !handleChecks.includes('length')) {
      result = result.length(zodArray.exactLength.value);
    }

    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  /**
   * Default handler for Zod union types. Processes all union options.
   *
   * @param value - The Zod union to process
   * @returns The processed Zod union
   * @throws Error if union has fewer than 2 options
   */
  public defaultZodUnionHandler<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    const zodUnion = value as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;
    const processedOptions = zodUnion._def.options.map((option: z.ZodTypeAny) => this.processZodType<T>(option));
    if (processedOptions.length < 2) throw new Error('Union must have at least 2 options');
    let result = z.union(processedOptions as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    if (value.description) {
      result = result.describe(value.description);
    }
    return result as ShapeValue<T>;
  }

  /**
   * Default handler for Zod string types. Processes string validation constraints.
   *
   * @param value - The Zod string to process
   * @param handleChecks - String constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod string
   */
  public defaultZodStringHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    handleChecks: readonly StringCheckType[] = ALL_STRING_CHECKS,
  ): ShapeValue<T> {
    const zodString = value as z.ZodString;
    const constraints: StringConstraints = {};
    const checks = zodString._def.checks || [];
    type ZodStringCheck = (typeof checks)[number];
    const newChecks: ZodStringCheck[] = [];
    for (const check of checks) {
      if ('kind' in check) {
        if (handleChecks.includes(check.kind as StringCheckType)) {
          switch (check.kind) {
            case 'regex': {
              constraints.regex = {
                pattern: check.regex.source,
                flags: check.regex.flags,
              };
              break;
            }
            case 'emoji': {
              constraints.emoji = true;
              break;
            }
            case 'email': {
              constraints.email = true;
              break;
            }
            case 'url': {
              constraints.url = true;
              break;
            }
            case 'uuid': {
              constraints.uuid = true;
              break;
            }
            case 'cuid': {
              constraints.cuid = true;
              break;
            }
            case 'min': {
              constraints.minLength = check.value;
              break;
            }
            case 'max': {
              constraints.maxLength = check.value;
              break;
            }
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = z.string();
    for (const check of newChecks) {
      result = result._addCheck(check);
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  /**
   * Default handler for Zod number types. Processes number validation constraints.
   *
   * @param value - The Zod number to process
   * @param handleChecks - Number constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod number
   */
  public defaultZodNumberHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    handleChecks: readonly NumberCheckType[] = ALL_NUMBER_CHECKS,
  ): ShapeValue<T> {
    const zodNumber = value as z.ZodNumber;
    const constraints: NumberConstraints = {};
    const checks = zodNumber._def.checks || [];
    type ZodNumberCheck = (typeof checks)[number];
    const newChecks: ZodNumberCheck[] = [];
    for (const check of checks) {
      if ('kind' in check) {
        if (handleChecks.includes(check.kind as NumberCheckType)) {
          switch (check.kind) {
            case 'min':
              if (check.inclusive) {
                constraints.gte = check.value;
              } else {
                constraints.gt = check.value;
              }
              break;
            case 'max':
              if (check.inclusive) {
                constraints.lte = check.value;
              } else {
                constraints.lt = check.value;
              }
              break;
            case 'multipleOf': {
              constraints.multipleOf = check.value;
              break;
            }
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = z.number();
    for (const check of newChecks) {
      switch (check.kind) {
        case 'int':
          result = result.int();
          break;
        case 'finite':
          result = result.finite();
          break;
        default:
          result = result._addCheck(check);
      }
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  /**
   * Default handler for Zod date types. Converts dates to ISO strings with constraint descriptions.
   *
   * @param value - The Zod date to process
   * @returns A Zod string schema representing the date in ISO format
   */
  public defaultZodDateHandler<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    const zodDate = value as z.ZodDate;
    const constraints: DateConstraints = {};
    const checks = zodDate._def.checks || [];
    type ZodDateCheck = (typeof checks)[number];
    const newChecks: ZodDateCheck[] = [];
    for (const check of checks) {
      if ('kind' in check) {
        switch (check.kind) {
          case 'min':
            const minDate = new Date(check.value);
            if (!isNaN(minDate.getTime())) {
              constraints.minDate = minDate.toISOString();
            }
            break;
          case 'max':
            const maxDate = new Date(check.value);
            if (!isNaN(maxDate.getTime())) {
              constraints.maxDate = maxDate.toISOString();
            }
            break;
          default:
            newChecks.push(check);
        }
      }
    }
    constraints.dateFormat = 'date-time';
    let result = z.string().describe('date-time');
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  /**
   * Default handler for Zod optional types. Processes the inner type and maintains optionality.
   *
   * @param value - The Zod optional to process
   * @param handleTypes - Types that should be processed vs passed through
   * @returns The processed Zod optional
   */
  public defaultZodOptionalHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    handleTypes: readonly AllZodType[] = SUPPORTED_ZOD_TYPES,
  ): ShapeValue<T> {
    if (handleTypes.includes(value._def.innerType._def.typeName as AllZodType)) {
      return this.processZodType(value._def.innerType).optional();
    } else {
      return value as ShapeValue<T>;
    }
  }

  /**
   * Processes a Zod object schema and converts it to an AI SDK Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns An AI SDK Schema with provider-specific compatibility applied
   */
  public processToAISDKSchema(zodSchema: z.AnyZodObject): Schema {
    const { schema } = this.applyZodSchemaCompatibility(zodSchema);

    return convertZodSchemaToAISDKSchema(schema, this.getSchemaTarget());
  }

  /**
   * Processes a Zod object schema and converts it to a JSON Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns A JSONSchema7 object with provider-specific compatibility applied
   */
  public processToJSONSchema(zodSchema: z.AnyZodObject): JSONSchema7 {
    return this.processToAISDKSchema(zodSchema).jsonSchema;
  }
}
