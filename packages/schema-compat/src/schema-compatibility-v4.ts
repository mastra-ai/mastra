import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import {
  z,
  ZodOptional,
  ZodObject,
  ZodArray,
  ZodUnion,
  ZodString,
  ZodNumber,
  ZodDate,
  ZodDefault,
  ZodNull,
} from 'zod/v4';
import type { ZodAny, ZodType } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { SchemaCompatLayer as ParentSchemaCompatLayer } from './schema-compatibility';
import type { ModelInformation } from './types';
import { convertZodSchemaToAISDKSchema } from './utils';

/**
 * All supported string validation check types that can be processed or converted to descriptions.
 * @constant
 */
export const ALL_STRING_CHECKS = [
  'regex',
  'emoji',
  'email',
  'url',
  'uuid',
  'cuid',
  'min_length',
  'max_length',
  'string_format',
] as const;

/**
 * All supported number validation check types that can be processed or converted to descriptions.
 * @constant
 */
export const ALL_NUMBER_CHECKS = ['greater_than', 'less_than', 'multiple_of'] as const;

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
export type ZodShape<T extends z.ZodObject<any, any>> = T['shape'];

/**
 * Utility type to extract the keys from a Zod object shape.
 */
export type ShapeKey<T extends z.ZodObject<any, any>> = keyof ZodShape<T>;

/**
 * Utility type to extract the value types from a Zod object shape.
 */
export type ShapeValue<T extends z.ZodObject<any, any>> = ZodShape<T>[ShapeKey<T>];

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
 *   processZodType<T extends z.AnyZodObject>(value: z.ZodAny): ShapeValue<T> {
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
export class SchemaCompatLayer {
  private model: ModelInformation;
  private parent: ParentSchemaCompatLayer;

  /**
   * Creates a new schema compatibility instance.
   *
   * @param model - The language model this compatibility layer applies to
   */
  constructor(model: ModelInformation, parent: ParentSchemaCompatLayer) {
    this.model = model;
    this.parent = parent;
  }

  /**
   * Gets the language model associated with this compatibility layer.
   *
   * @returns The language model instance
   */
  getModel(): ModelInformation {
    return this.model;
  }

  getUnsupportedZodTypes(): readonly string[] {
    return UNSUPPORTED_ZOD_TYPES;
  }

  /**
   * Type guard for optional Zod types
   */
  isOptional(v: ZodAny | ZodOptional<any>): v is ZodOptional<any> {
    return v instanceof ZodOptional;
  }

  /**
   * Type guard for object Zod types
   */
  isObj(v: ZodAny | ZodObject<any, any>): v is ZodObject<any, any> {
    return v instanceof ZodObject;
  }

  /**
   * Type guard for null Zod types
   */
  isNull(v: ZodAny | ZodNull): v is ZodNull {
    return v instanceof ZodNull;
  }

  /**
   * Type guard for array Zod types
   */
  isArr(v: ZodAny | ZodArray<any>): v is ZodArray<any> {
    return v instanceof ZodArray;
  }

  /**
   * Type guard for union Zod types
   */
  isUnion(v: ZodAny | ZodUnion<[ZodAny, ...ZodAny[]]>): v is ZodUnion<[ZodAny, ...ZodAny[]]> {
    return v instanceof ZodUnion;
  }

  /**
   * Type guard for string Zod types
   */
  isString(v: ZodAny | ZodString): v is ZodString {
    return v instanceof ZodString;
  }

  /**
   * Type guard for number Zod types
   */
  isNumber(v: ZodAny | ZodNumber): v is ZodNumber {
    return v instanceof ZodNumber;
  }

  /**
   * Type guard for date Zod types
   */
  isDate(v: ZodAny | ZodDate): v is ZodDate {
    return v instanceof ZodDate;
  }

  /**
   * Type guard for default Zod types
   */
  isDefault(v: ZodAny | ZodDefault<any>): v is ZodDefault<any> {
    return v instanceof ZodDefault;
  }

  /**
   * Determines whether this compatibility layer should be applied for the current model.
   *
   * @returns True if this compatibility layer should be used, false otherwise
   * @abstract
   */
  shouldApply(): boolean {
    return this.parent.shouldApply();
  }

  /**
   * Returns the JSON Schema target format for this provider.
   *
   * @returns The schema target format, or undefined to use the default 'jsonSchema7'
   * @abstract
   */
  getSchemaTarget(): Targets | undefined {
    return this.parent.getSchemaTarget();
  }

  /**
   * Processes a specific Zod type according to the provider's requirements.
   *
   * @param value - The Zod type to process
   * @returns The processed Zod type
   * @abstract
   */
  processZodType(value: ZodType): ZodType {
    return this.parent.processZodType(value);
  }

  /**
   * Default handler for Zod object types. Recursively processes all properties in the object.
   *
   * @param value - The Zod object to process
   * @returns The processed Zod object
   */
  public defaultZodObjectHandler(
    value: ZodObject<any, any>,
    options: { passthrough?: boolean } = { passthrough: true },
  ): ZodObject<any, any> {
    const processedShape = Object.entries(value.shape).reduce<Record<string, ZodType>>((acc, [key, propValue]) => {
      acc[key] = this.processZodType(propValue as ZodAny);
      return acc;
    }, {});

    let result: ZodObject<any, any> = z.object(processedShape);

    if (value._zod.def.catchall instanceof z.ZodNever) {
      result = z.strictObject(processedShape);
    }
    if (value._zod.def.catchall && !(value._zod.def.catchall instanceof z.ZodNever)) {
      result = result.catchall(value._zod.def.catchall);
    }

    if (value.description) {
      result = result.describe(value.description);
    }

    if (options.passthrough && value._zod.def.catchall instanceof z.ZodUnknown) {
      result = z.looseObject(processedShape);
    }

    return result;
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
  public defaultUnsupportedZodTypeHandler<T extends z.ZodObject<any, any>>(
    value: z.ZodAny,
    throwOnTypes: readonly UnsupportedZodType[] = UNSUPPORTED_ZOD_TYPES,
  ): ShapeValue<T> {
    if (throwOnTypes.includes(value.constructor.name as UnsupportedZodType)) {
      throw new Error(`${this.model.modelId} does not support zod type: ${value.constructor.name}`);
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
  public defaultZodArrayHandler(
    value: ZodArray<any>,
    handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
  ): ZodArray<any> {
    const zodArrayDef = value._zod.def;
    const processedType = this.processZodType(zodArrayDef.element);

    let result = z.array(processedType);

    const constraints: ArrayConstraints = {};
    if (zodArrayDef.checks) {
      for (const check of zodArrayDef.checks) {
        if (check._zod.def.check === 'min_length') {
          if (handleChecks.includes('min')) {
            // @ts-expect-error - fix later
            constraints.minLength = check._zod.def.minimum;
          } else {
            // @ts-expect-error - fix later
            result = result.min(check._zod.def.minimum);
          }
        }
        if (check._zod.def.check === 'max_length') {
          if (handleChecks.includes('max')) {
            // @ts-expect-error - fix later
            constraints.maxLength = check._zod.def.maximum;
          } else {
            // @ts-expect-error - fix later
            result = result.max(check._zod.def.maximum);
          }
        }
        if (check._zod.def.check === 'length_equals') {
          if (handleChecks.includes('length')) {
            // @ts-expect-error - fix later
            constraints.exactLength = check._zod.def.length;
          } else {
            // @ts-expect-error - fix later
            result = result.length(check._zod.def.length);
          }
        }
      }
    }

    const metaDescription = value.meta()?.description;
    const legacyDescription = value.description;

    const description = this.mergeParameterDescription(metaDescription || legacyDescription, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }

  /**
   * Default handler for Zod union types. Processes all union options.
   *
   * @param value - The Zod union to process
   * @returns The processed Zod union
   * @throws Error if union has fewer than 2 options
   */
  public defaultZodUnionHandler(value: ZodUnion<[ZodAny, ...ZodAny[]]>): ZodAny {
    const processedOptions = value._zod.def.options.map((option: ZodAny) => this.processZodType(option));
    if (processedOptions.length < 2) throw new Error('Union must have at least 2 options');
    let result = z.union(processedOptions as [ZodAny, ZodAny, ...ZodAny[]]);
    if (value.description) {
      result = result.describe(value.description);
    }
    // @ts-expect-error - fix later
    return result;
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
    const constraints: StringConstraints = {};
    const checks = value._zod.def.checks || [];
    type ZodStringCheck = (typeof checks)[number];
    const newChecks: ZodStringCheck[] = [];

    if (checks) {
      for (const check of checks) {
        if (handleChecks.includes(check._zod.def.check as StringCheckType)) {
          switch (check._zod.def.check) {
            case 'min_length':
              // @ts-expect-error - fix later
              constraints.minLength = check._zod.def.minimum;
              break;
            case 'max_length':
              // @ts-expect-error - fix later
              constraints.maxLength = check._zod.def.maximum;
              break;
            case 'string_format':
              {
                // @ts-expect-error - fix later
                switch (check._zod.def.format) {
                  case 'email':
                    constraints.email = true;
                    break;
                  case 'url':
                    constraints.url = true;
                    break;
                  case 'emoji':
                    constraints.emoji = true;
                    break;
                  case 'uuid':
                    constraints.uuid = true;
                    break;
                  case 'cuid':
                    constraints.cuid = true;
                    break;
                  case 'regex':
                    constraints.regex = {
                      // @ts-expect-error - fix later
                      pattern: check._zod.def.pattern,
                      // @ts-expect-error - fix later
                      flags: check._zod.def.flags,
                    };
                    break;
                }
              }
              break;
          }
        } else {
          newChecks.push(check);
        }
      }
    }

    let result = z.string();
    for (const check of newChecks) {
      result = result.check(check);
    }

    const metaDescription = value.meta()?.description;
    const legacyDescription = value.description;

    const description = this.mergeParameterDescription(metaDescription || legacyDescription, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
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
    const constraints: NumberConstraints = {};
    const checks = value._zod.def.checks || [];
    type ZodNumberCheck = (typeof checks)[number];
    const newChecks: ZodNumberCheck[] = [];

    if (checks) {
      for (const check of checks) {
        if (handleChecks.includes(check._zod.def.check as NumberCheckType)) {
          switch (check._zod.def.check) {
            case 'greater_than':
              // @ts-expect-error - fix later
              if (check._zod.def.inclusive) {
                // @ts-expect-error - fix later
                constraints.gte = check._zod.def.value;
              } else {
                // @ts-expect-error - fix later
                constraints.gt = check._zod.def.value;
              }
              break;
            case 'less_than':
              // @ts-expect-error - fix later
              if (check._zod.def.inclusive) {
                // @ts-expect-error - fix later
                constraints.lte = check._zod.def.value;
              } else {
                // @ts-expect-error - fix later
                constraints.lt = check._zod.def.value;
              }
              break;
            case 'multiple_of': {
              // @ts-expect-error - fix later
              constraints.multipleOf = check._zod.def.value;
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
      switch (check._zod.def.check) {
        case 'number_format': {
          // @ts-expect-error - fix later
          switch (check._zod.def.format) {
            case 'safeint':
              result = result.int();
              break;
          }
          break;
        }
        default:
          // @ts-expect-error - fix later
          result = result.check(check);
      }
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }

  /**
   * Default handler for Zod date types. Converts dates to ISO strings with constraint descriptions.
   *
   * @param value - The Zod date to process
   * @returns A Zod string schema representing the date in ISO format
   */
  public defaultZodDateHandler(value: ZodDate): ZodString {
    const constraints: DateConstraints = {};
    const checks = value._zod.def.checks || [];
    type ZodDateCheck = (typeof checks)[number];
    const newChecks: ZodDateCheck[] = [];
    if (checks) {
      for (const check of checks) {
        switch (check._zod.def.check) {
          case 'less_than':
            // @ts-expect-error - fix later
            const minDate = new Date(check._zod.def.value);
            if (!isNaN(minDate.getTime())) {
              constraints.minDate = minDate.toISOString();
            }
            break;
          case 'greater_than':
            // @ts-expect-error - fix later
            const maxDate = new Date(check._zod.def.value);
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
    return result;
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
  ): ZodType {
    if (handleTypes.includes(value.constructor.name as AllZodType)) {
      return this.processZodType(value._zod.def.innerType).optional();
    } else {
      return value;
    }
  }

  /**
   * Processes a Zod object schema and converts it to an AI SDK Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns An AI SDK Schema with provider-specific compatibility applied
   */
  public processToAISDKSchema(zodSchema: ZodType): Schema {
    const processedSchema = this.processZodType(zodSchema);

    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }

  /**
   * Processes a Zod object schema and converts it to a JSON Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns A JSONSchema7 object with provider-specific compatibility applied
   */
  public processToJSONSchema(zodSchema: ZodType): JSONSchema7 {
    return this.processToAISDKSchema(zodSchema).jsonSchema;
  }
}
