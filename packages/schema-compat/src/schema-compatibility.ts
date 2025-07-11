import type { Schema, LanguageModelV1 } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z, ZodOptional, ZodObject, ZodArray, ZodUnion, ZodString, ZodNumber, ZodDate, ZodDefault, ZodNull } from 'zod';
import type { ZodTypeAny } from 'zod';
import { 
  convertZodSchemaToAISDKSchema, 
  safeGetSchemaProperty,
  safeToJSONSchema
} from './utils';

/**
 * Utility functions for introspecting Zod v4 schemas using validation-based testing
 */
const SchemaIntrospection = {
  /**
   * Extract array length constraints by testing the schema
   */
  extractArrayConstraints(schema: ZodArray<any, any>): { min?: number; max?: number; exact?: number } {
    const constraints: { min?: number; max?: number; exact?: number } = {};
    
    // Test for minimum length constraint
    const emptyResult = schema.safeParse([]);
    if (!emptyResult.success) {
      const tooSmallError = emptyResult.error.issues.find(issue => issue.code === 'too_small');
      if (tooSmallError && 'minimum' in tooSmallError) {
        constraints.min = tooSmallError.minimum as number;
      }
    }

    // Test for maximum length constraint
    const largeArray = Array(1000).fill('test');
    const largeResult = schema.safeParse(largeArray);
    if (!largeResult.success) {
      const tooBigError = largeResult.error.issues.find(issue => issue.code === 'too_big');
      if (tooBigError && 'maximum' in tooBigError) {
        constraints.max = tooBigError.maximum as number;
      }
    }

    // Check if min and max are equal (exact length constraint)
    if (constraints.min !== undefined && constraints.max !== undefined && constraints.min === constraints.max) {
      constraints.exact = constraints.min;
    }

    return constraints;
  },

  /**
   * Extract string constraints by testing various inputs
   */
  extractStringConstraints(schema: ZodString): {
    min?: number;
    max?: number;
    email?: boolean;
    url?: boolean;
    uuid?: boolean;
    cuid?: boolean;
    emoji?: boolean;
    regex?: { pattern: string; flags: string };
  } {
    const constraints: any = {};

    // Test for minimum length
    const emptyResult = schema.safeParse('');
    if (!emptyResult.success) {
      const tooSmallError = emptyResult.error.issues.find(issue => issue.code === 'too_small');
      if (tooSmallError && 'minimum' in tooSmallError) {
        constraints.min = tooSmallError.minimum as number;
      }
    }

    // Test for maximum length with very long string
    const longString = 'a'.repeat(10000);
    const longResult = schema.safeParse(longString);
    if (!longResult.success) {
      const tooBigError = longResult.error.issues.find(issue => issue.code === 'too_big');
      if (tooBigError && 'maximum' in tooBigError) {
        constraints.max = tooBigError.maximum as number;
      }
    }

    // Test for email format
    const emailResult = schema.safeParse('invalid-email');
    if (!emailResult.success && emailResult.error.issues.some(issue => issue.code === 'invalid_string' && 'validation' in issue && issue.validation === 'email')) {
      constraints.email = true;
    }

    // Test for URL format
    const urlResult = schema.safeParse('invalid-url');
    if (!urlResult.success && urlResult.error.issues.some(issue => issue.code === 'invalid_string' && 'validation' in issue && issue.validation === 'url')) {
      constraints.url = true;
    }

    // Test for UUID format
    const uuidResult = schema.safeParse('invalid-uuid');
    if (!uuidResult.success && uuidResult.error.issues.some(issue => issue.code === 'invalid_string' && 'validation' in issue && issue.validation === 'uuid')) {
      constraints.uuid = true;
    }

    // Test for CUID format
    const cuidResult = schema.safeParse('invalid-cuid');
    if (!cuidResult.success && cuidResult.error.issues.some(issue => issue.code === 'invalid_string' && 'validation' in issue && issue.validation === 'cuid')) {
      constraints.cuid = true;
    }

    // Test for emoji format
    const emojiResult = schema.safeParse('not-emoji');
    if (!emojiResult.success && emojiResult.error.issues.some(issue => issue.code === 'invalid_string' && 'validation' in issue && issue.validation === 'emoji')) {
      constraints.emoji = true;
    }

    // Test for regex constraints by checking for regex validation errors
    const regexTestResult = schema.safeParse('test-string-for-regex');
    if (!regexTestResult.success) {
      const regexError = regexTestResult.error.issues.find(issue => issue.code === 'invalid_string' && 'validation' in issue && issue.validation === 'regex');
      if (regexError && 'regex' in regexError) {
        constraints.regex = {
          pattern: (regexError as any).regex.source,
          flags: (regexError as any).regex.flags,
        };
      }
    }

    return constraints;
  },

  /**
   * Extract number constraints by testing boundary values
   */
  extractNumberConstraints(schema: ZodNumber): {
    min?: number;
    max?: number;
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
    int?: boolean;
    finite?: boolean;
    multipleOf?: number;
  } {
    const constraints: any = {};

    // Test for minimum value with very small number
    const minResult = schema.safeParse(-Number.MAX_SAFE_INTEGER);
    if (!minResult.success) {
      const tooSmallError = minResult.error.issues.find(issue => issue.code === 'too_small');
      if (tooSmallError && 'minimum' in tooSmallError) {
        constraints.min = tooSmallError.minimum as number;
        // Check if inclusive (gte) or exclusive (gt)
        if ('inclusive' in tooSmallError && tooSmallError.inclusive) {
          constraints.gte = tooSmallError.minimum as number;
        } else {
          constraints.gt = tooSmallError.minimum as number;
        }
      }
    }

    // Test for maximum value with very large number
    const maxResult = schema.safeParse(Number.MAX_SAFE_INTEGER);
    if (!maxResult.success) {
      const tooBigError = maxResult.error.issues.find(issue => issue.code === 'too_big');
      if (tooBigError && 'maximum' in tooBigError) {
        constraints.max = tooBigError.maximum as number;
        // Check if inclusive (lte) or exclusive (lt)
        if ('inclusive' in tooBigError && tooBigError.inclusive) {
          constraints.lte = tooBigError.maximum as number;
        } else {
          constraints.lt = tooBigError.maximum as number;
        }
      }
    }

    // Test for integer constraint
    const floatResult = schema.safeParse(1.5);
    if (!floatResult.success && floatResult.error.issues.some(issue => issue.code === 'invalid_type' || issue.code === 'not_integer')) {
      constraints.int = true;
    }

    // Test for finite constraint
    const infinityResult = schema.safeParse(Infinity);
    if (!infinityResult.success && infinityResult.error.issues.some(issue => issue.code === 'not_finite')) {
      constraints.finite = true;
    }

    // Test for multipleOf constraint by testing known non-multiples
    // Try with common factors to detect multipleOf constraints
    const testValues = [1.1, 2.1, 3.3, 5.7, 7.3, 11.1];
    for (const testValue of testValues) {
      const multipleResult = schema.safeParse(testValue);
      if (!multipleResult.success) {
        const multipleError = multipleResult.error.issues.find(issue => issue.code === 'not_multiple_of');
        if (multipleError && 'multipleOf' in multipleError) {
          constraints.multipleOf = (multipleError as any).multipleOf;
          break;
        }
      }
    }

    return constraints;
  },

  /**
   * Extract element type from Zod array schema (v3/v4 compatible)
   */
  extractArrayElementType(schema: ZodArray<any, any>): ZodTypeAny {
    // Use library authors pattern for v3/v4 compatibility
    if (schema && typeof schema === 'object' && "_zod" in schema) {
      // Zod v4
      return (schema as any)._zod.def.type || z.unknown();
    } else if (schema && typeof schema === 'object' && "_def" in schema) {
      // Zod v3 (fallback) or v4 _def access
      return (schema as any)._def.type || (schema as any)._def.element || z.unknown();
    } else {
      return z.unknown();
    }
  }
};

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
  abstract processZodType(value: ZodTypeAny): ZodTypeAny;

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

    // CRITICAL: Only reconstruct if any properties actually changed during processing
    // This prevents corruption when no processing is needed
    let result: ZodObject<any, any, any>;
    const hasChanges = Object.entries(value.shape).some(([key, originalProp]) => 
      processedShape[key] !== originalProp
    );
    
    if (!hasChanges) {
      // No properties changed - preserve original structure
      result = value;
    } else {
      // Properties were processed - need to reconstruct with new shape
      result = z.object(processedShape);
    }

    // Copy description if available
    if (value.description) {
      result = result.describe(value.description);
    }

    // Preserve strictness constraints in Zod v4 using safe property access
    const originalCatchall = safeGetSchemaProperty(value, 'catchall');
    if (originalCatchall) {
      // In Zod v4, strict mode uses def.type === 'never'
      const catchallType = safeGetSchemaProperty(originalCatchall, 'type', originalCatchall.def?.type);
      if (catchallType === 'never') {
        result = result.strict();
      }
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
    // Use safe property access for v3/v4 compatibility
    const typeName = safeGetSchemaProperty(value, 'typeName');
    
    if (typeName && throwOnTypes.includes(typeName as UnsupportedZodType)) {
      throw new Error(`${this.model.modelId} does not support zod type: ${typeName}`);
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
    // Extract element type and constraints using utility functions (maintains existing functionality)
    const elementSchema = SchemaIntrospection.extractArrayElementType(value);
    const processedType = this.processZodType(elementSchema);
    const extractedConstraints = SchemaIntrospection.extractArrayConstraints(value);

    // CRITICAL: Only reconstruct if element type actually changed during processing
    // This prevents corruption when no processing is needed
    let result: ZodArray<any, any>;
    if (processedType === elementSchema) {
      // No change needed - preserve original structure
      result = value;
    } else {
      // Element was processed - need to reconstruct with new element type
      result = z.array(processedType);
    }
    const constraints: ArrayConstraints = {};

    // Apply extracted constraints based on handleChecks configuration
    if (extractedConstraints.min !== undefined) {
      if (handleChecks.includes('min')) {
        constraints.minLength = extractedConstraints.min;
      } else {
        result = result.min(extractedConstraints.min);
      }
    }

    if (extractedConstraints.max !== undefined) {
      if (handleChecks.includes('max')) {
        constraints.maxLength = extractedConstraints.max;
      } else {
        result = result.max(extractedConstraints.max);
      }
    }

    if (extractedConstraints.exact !== undefined) {
      if (handleChecks.includes('length')) {
        constraints.exactLength = extractedConstraints.exact;
      } else {
        result = result.length(extractedConstraints.exact);
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
    // Use v3/v4 compatible access pattern
    let options: ZodTypeAny[] = [];
    if ("_zod" in value) {
      // Zod v4
      options = value._zod.def.options || [];
    } else {
      // Zod v3 (fallback)
      options = (value as any)._def.options || [];
    }
    
    const processedOptions = options.map((option: ZodTypeAny) => this.processZodType(option));
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
    // Extract constraints using utility functions (maintains existing functionality)
    const extractedConstraints = SchemaIntrospection.extractStringConstraints(value);
    const constraints: StringConstraints = {};
    // Start with original schema to maintain validation structure
    let result = value;

    // Apply extracted constraints based on handleChecks configuration
    if (extractedConstraints.min !== undefined) {
      if (handleChecks.includes('min')) {
        constraints.minLength = extractedConstraints.min;
      } else {
        result = result.min(extractedConstraints.min);
      }
    }

    if (extractedConstraints.max !== undefined) {
      if (handleChecks.includes('max')) {
        constraints.maxLength = extractedConstraints.max;
      } else {
        result = result.max(extractedConstraints.max);
      }
    }

    if (extractedConstraints.email) {
      if (handleChecks.includes('email')) {
        constraints.email = true;
      } else {
        result = result.email();
      }
    }

    if (extractedConstraints.url) {
      if (handleChecks.includes('url')) {
        constraints.url = true;
      } else {
        result = result.url();
      }
    }

    if (extractedConstraints.uuid) {
      if (handleChecks.includes('uuid')) {
        constraints.uuid = true;
      } else {
        result = result.uuid();
      }
    }

    if (extractedConstraints.cuid) {
      if (handleChecks.includes('cuid')) {
        constraints.cuid = true;
      } else {
        result = result.cuid();
      }
    }

    if (extractedConstraints.emoji) {
      if (handleChecks.includes('emoji')) {
        constraints.emoji = true;
      } else {
        result = result.emoji();
      }
    }

    if (extractedConstraints.regex) {
      if (handleChecks.includes('regex')) {
        constraints.regex = extractedConstraints.regex;
      } else {
        const regex = new RegExp(extractedConstraints.regex.pattern, extractedConstraints.regex.flags);
        result = result.regex(regex);
      }
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
    // Extract constraints using utility functions
    const extractedConstraints = SchemaIntrospection.extractNumberConstraints(value);
    const constraints: NumberConstraints = {};
    // Start with original schema to preserve validation structure
    let result = value;

    // Apply extracted constraints based on handleChecks configuration
    if (extractedConstraints.gte !== undefined) {
      if (handleChecks.includes('min')) {
        constraints.gte = extractedConstraints.gte;
      } else {
        result = result.gte(extractedConstraints.gte);
      }
    }

    if (extractedConstraints.gt !== undefined) {
      if (handleChecks.includes('min')) {
        constraints.gt = extractedConstraints.gt;
      } else {
        result = result.gt(extractedConstraints.gt);
      }
    }

    if (extractedConstraints.lte !== undefined) {
      if (handleChecks.includes('max')) {
        constraints.lte = extractedConstraints.lte;
      } else {
        result = result.lte(extractedConstraints.lte);
      }
    }

    if (extractedConstraints.lt !== undefined) {
      if (handleChecks.includes('max')) {
        constraints.lt = extractedConstraints.lt;
      } else {
        result = result.lt(extractedConstraints.lt);
      }
    }

    if (extractedConstraints.multipleOf !== undefined) {
      if (handleChecks.includes('multipleOf')) {
        constraints.multipleOf = extractedConstraints.multipleOf;
      } else {
        result = result.multipleOf(extractedConstraints.multipleOf);
      }
    }

    if (extractedConstraints.int) {
      result = result.int();
    }

    if (extractedConstraints.finite) {
      result = result.finite();
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
    const constraints: DateConstraints = { dateFormat: 'date-time' };
    
    // Simple approach: Test the schema to find constraints
    let minDate: Date | undefined;
    let maxDate: Date | undefined;
    
    // Test for min constraint by trying a very old date
    const testOldDate = new Date('1900-01-01');
    const oldResult = value.safeParse(testOldDate);
    if (!oldResult.success) {
      const minError = oldResult.error.issues.find(issue => 
        issue.code === 'too_small' && 'minimum' in issue
      );
      if (minError && 'minimum' in minError) {
        minDate = new Date(minError.minimum as number);
        constraints.minDate = minDate.toISOString();
      }
    }
    
    // Test for max constraint by trying a very future date
    const testFutureDate = new Date('2100-01-01');
    const futureResult = value.safeParse(testFutureDate);
    if (!futureResult.success) {
      const maxError = futureResult.error.issues.find(issue => 
        issue.code === 'too_big' && 'maximum' in issue
      );
      if (maxError && 'maximum' in maxError) {
        maxDate = new Date(maxError.maximum as number);
        constraints.maxDate = maxDate.toISOString();
      }
    }
    
    let result = z.string().describe('date-time');
    
    // Apply date constraints as refinements
    if (minDate) {
      result = result.refine(dateStr => {
        try {
          const date = new Date(dateStr);
          return date >= minDate!;
        } catch {
          return false;
        }
      }, { message: `Date must be >= ${minDate.toISOString()}` });
    }
    
    if (maxDate) {
      result = result.refine(dateStr => {
        try {
          const date = new Date(dateStr);
          return date <= maxDate!;
        } catch {
          return false;
        }
      }, { message: `Date must be <= ${maxDate.toISOString()}` });
    }
    
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
    // Use v3/v4 compatible access pattern
    let innerType: ZodTypeAny;
    let typeName: string;
    
    if ("_zod" in value) {
      // Zod v4
      innerType = value._zod.def.innerType;
      typeName = innerType._zod?.def?.typeName || innerType._def?.typeName;
    } else {
      // Zod v3 (fallback)
      innerType = (value as any)._def.innerType;
      typeName = innerType._def?.typeName;
    }
    
    if (handleTypes.includes(typeName as AllZodType)) {
      return this.processZodType(innerType).optional();
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
