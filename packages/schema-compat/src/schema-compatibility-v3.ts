import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z, ZodOptional, ZodObject, ZodArray, ZodUnion, ZodString, ZodNumber, ZodDate, ZodDefault, ZodNull } from 'zod';
import type { ZodTypeAny } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import type { SchemaCompatLayer as ParentSchemaCompatLayer } from './schema-compatibility';
import type { ModelInformation } from './types';
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

export const isOptional = (v: ZodTypeAny): v is ZodOptional<any> => v instanceof ZodOptional;
export const isObj = (v: ZodTypeAny): v is ZodObject<any, any, any> => v instanceof ZodObject;
export const isNull = (v: ZodTypeAny): v is ZodNull => v instanceof ZodNull;
export const isArr = (v: ZodTypeAny): v is ZodArray<any, any> => v instanceof ZodArray;
export const isUnion = (v: ZodTypeAny): v is ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]> => v instanceof ZodUnion;
export const isString = (v: ZodTypeAny): v is ZodString => v instanceof ZodString;
export const isNumber = (v: ZodTypeAny): v is ZodNumber => v instanceof ZodNumber;
export const isDate = (v: ZodTypeAny): v is ZodDate => v instanceof ZodDate;
export const isDefault = (v: ZodTypeAny): v is ZodDefault<any> => v instanceof ZodDefault;

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
 *
 * @example
 * ```typescript
 * import { SchemaCompatLayer } from '@mastra/schema-compat';
 * import type { LanguageModelV1 } from 'ai';
 *
 * class CustomProviderCompat extends SchemaCompatLayer {
 *   constructor(model: ModelInformation) {
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
  isOptional(v: ZodTypeAny): v is ZodOptional<any> {
    return v instanceof ZodOptional;
  }

  /**
   * Type guard for object Zod types
   */
  isObj(v: ZodTypeAny): v is ZodObject<any, any, any> {
    return v instanceof ZodObject;
  }

  /**
   * Type guard for null Zod types
   */
  isNull(v: ZodTypeAny): v is ZodNull {
    return v instanceof ZodNull;
  }

  /**
   * Type guard for array Zod types
   */
  isArr(v: ZodTypeAny): v is ZodArray<any, any> {
    return v instanceof ZodArray;
  }

  /**
   * Type guard for union Zod types
   */
  isUnion(v: ZodTypeAny): v is ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]> {
    return v instanceof ZodUnion;
  }

  /**
   * Type guard for string Zod types
   */
  isString(v: ZodTypeAny): v is ZodString {
    return v instanceof ZodString;
  }

  /**
   * Type guard for number Zod types
   */
  isNumber(v: ZodTypeAny): v is ZodNumber {
    return v instanceof ZodNumber;
  }

  /**
   * Type guard for date Zod types
   */
  isDate(v: ZodTypeAny): v is ZodDate {
    return v instanceof ZodDate;
  }

  /**
   * Type guard for default Zod types
   */
  isDefault(v: ZodTypeAny): v is ZodDefault<any> {
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
  processZodType(value: ZodTypeAny): ZodTypeAny {
    return this.parent.processZodType(value);
  }

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
    const processedShape = Object.entries(value.shape).reduce<Record<string, ZodTypeAny>>((acc, [key, propValue]) => {
      acc[key] = this.processZodType(propValue as ZodTypeAny);
      return acc;
    }, {});

    let result: ZodObject<any, any, any> = z.object(processedShape);

    if (value._def.unknownKeys === 'strict') {
      result = result.strict();
    }
    if (value._def.catchall && !(value._def.catchall instanceof z.ZodNever)) {
      result = result.catchall(value._def.catchall);
    }

    if (value.description) {
      result = result.describe(value.description);
    }

    if (options.passthrough && value._def.unknownKeys === 'passthrough') {
      result = result.passthrough();
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
  public defaultUnsupportedZodTypeHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    throwOnTypes: readonly UnsupportedZodType[] = UNSUPPORTED_ZOD_TYPES,
  ): ShapeValue<T> {
    if (throwOnTypes.includes(value._def?.typeName as UnsupportedZodType)) {
      throw new Error(`${this.model.modelId} does not support zod type: ${value._def?.typeName}`);
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
    value: ZodArray<any, any>,
    handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
  ): ZodArray<any, any> {
    const zodArrayDef = value._def;
    const processedType = this.processZodType(zodArrayDef.type);

    let result = z.array(processedType);

    const constraints: ArrayConstraints = {};

    if (zodArrayDef.minLength?.value !== undefined) {
      if (handleChecks.includes('min')) {
        constraints.minLength = zodArrayDef.minLength.value;
      } else {
        result = result.min(zodArrayDef.minLength.value);
      }
    }

    if (zodArrayDef.maxLength?.value !== undefined) {
      if (handleChecks.includes('max')) {
        constraints.maxLength = zodArrayDef.maxLength.value;
      } else {
        result = result.max(zodArrayDef.maxLength.value);
      }
    }

    if (zodArrayDef.exactLength?.value !== undefined) {
      if (handleChecks.includes('length')) {
        constraints.exactLength = zodArrayDef.exactLength.value;
      } else {
        result = result.length(zodArrayDef.exactLength.value);
      }
    }

    const description = this.mergeParameterDescription(value.description, constraints);
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
  public defaultZodUnionHandler(value: ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>): ZodTypeAny {
    const processedOptions = value._def.options.map((option: ZodTypeAny) => this.processZodType(option));
    if (processedOptions.length < 2) throw new Error('Union must have at least 2 options');
    let result = z.union(processedOptions as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
    if (value.description) {
      result = result.describe(value.description);
    }
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
    const checks = value._def.checks || [];
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
    const checks = value._def.checks || [];
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
    const checks = value._def.checks || [];
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
  ): ZodTypeAny {
    if (handleTypes.includes(value._def.innerType._def.typeName as AllZodType)) {
      return this.processZodType(value._def.innerType).optional();
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
