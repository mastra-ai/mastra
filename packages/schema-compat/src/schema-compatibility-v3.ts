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
  ZodNullable,
} from 'zod/v3';
import type { ZodTypeAny } from 'zod/v3';
import type { ModelInformation } from './types';

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

// Type guards using instanceof - vitest workspace aliasing ensures both test and source
// files use the same Zod package
export const isOptional = (v: ZodTypeAny): v is ZodOptional<any> => v instanceof ZodOptional;
export const isObj = (v: ZodTypeAny): v is ZodObject<any, any, any> => v instanceof ZodObject;
export const isNull = (v: ZodTypeAny): v is ZodNull => v instanceof ZodNull;
export const isNullable = (v: ZodTypeAny): v is ZodNullable<any> => v instanceof ZodNullable;
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
  'ZodNullable',
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

type ConstraintHelperText = string[];

/**
 * Context for schema compatibility handler functions.
 */
export interface HandlerContext {
  model: ModelInformation;
  processZodType: (value: ZodTypeAny) => ZodTypeAny;
}

/**
 * Returns the list of unsupported Zod types.
 */
export function getUnsupportedZodTypes(): readonly string[] {
  return UNSUPPORTED_ZOD_TYPES;
}

/**
 * Merges validation constraints into a parameter description.
 */
export function mergeParameterDescription(
  description: string | undefined,
  constraints: ConstraintHelperText,
): string | undefined {
  if (constraints.length > 0) {
    return (description ? description + '\n' : '') + `constraints: ${constraints.join(`, `)}`;
  } else {
    return description;
  }
}

/**
 * Default handler for Zod object types. Recursively processes all properties in the object.
 */
export function defaultZodObjectHandler(
  ctx: HandlerContext,
  value: ZodObject<any, any, any>,
  options: { passthrough?: boolean } = { passthrough: true },
): ZodObject<any, any, any> {
  const processedShape = Object.entries(value.shape).reduce<Record<string, ZodTypeAny>>((acc, [key, propValue]) => {
    acc[key] = ctx.processZodType(propValue as ZodTypeAny);
    return acc;
  }, {});

  let result: ZodObject<any, any, any> = z.object(processedShape);

  if (value._def.unknownKeys === 'strict') {
    result = result.strict();
  }
  if (value._def.catchall && value._def.catchall._def?.typeName !== 'ZodNever') {
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
 * Default handler for unsupported Zod types. Throws an error for specified unsupported types.
 */
export function defaultUnsupportedZodTypeHandler<T extends z.AnyZodObject>(
  ctx: HandlerContext,
  value: z.ZodTypeAny,
  throwOnTypes: readonly UnsupportedZodType[] = UNSUPPORTED_ZOD_TYPES,
): ShapeValue<T> {
  if (throwOnTypes.includes(value._def?.typeName as UnsupportedZodType)) {
    throw new Error(`${ctx.model.modelId} does not support zod type: ${value._def?.typeName}`);
  }
  return value as ShapeValue<T>;
}

/**
 * Default handler for Zod array types. Processes array constraints according to provider support.
 */
export function defaultZodArrayHandler(
  ctx: HandlerContext,
  value: ZodArray<any, any>,
  handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
): ZodArray<any, any> {
  const zodArrayDef = value._def;
  const processedType = ctx.processZodType(zodArrayDef.type);

  let result = z.array(processedType);

  const constraints: ConstraintHelperText = [];

  if (zodArrayDef.minLength?.value !== undefined) {
    if (handleChecks.includes('min')) {
      constraints.push(`minimum length ${zodArrayDef.minLength.value}`);
    } else {
      result = result.min(zodArrayDef.minLength.value);
    }
  }

  if (zodArrayDef.maxLength?.value !== undefined) {
    if (handleChecks.includes('max')) {
      constraints.push(`maximum length ${zodArrayDef.maxLength.value}`);
    } else {
      result = result.max(zodArrayDef.maxLength.value);
    }
  }

  if (zodArrayDef.exactLength?.value !== undefined) {
    if (handleChecks.includes('length')) {
      constraints.push(`exact length ${zodArrayDef.exactLength.value}`);
    } else {
      result = result.length(zodArrayDef.exactLength.value);
    }
  }

  const description = mergeParameterDescription(value.description, constraints);
  if (description) {
    result = result.describe(description);
  }
  return result;
}

/**
 * Default handler for Zod union types. Processes all union options.
 */
export function defaultZodUnionHandler(ctx: HandlerContext, value: ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>): ZodTypeAny {
  const processedOptions = value._def.options.map((option: ZodTypeAny) => ctx.processZodType(option));
  if (processedOptions.length < 2) throw new Error('Union must have at least 2 options');
  let result = z.union(processedOptions as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
  if (value.description) {
    result = result.describe(value.description);
  }
  return result;
}

/**
 * Default handler for Zod string types. Processes string validation constraints.
 */
export function defaultZodStringHandler(
  value: ZodString,
  handleChecks: readonly StringCheckType[] = ALL_STRING_CHECKS,
): ZodString {
  const constraints: ConstraintHelperText = [];
  const checks = value._def.checks || [];
  type ZodStringCheck = (typeof checks)[number];
  const newChecks: ZodStringCheck[] = [];
  for (const check of checks) {
    if ('kind' in check) {
      if (handleChecks.includes(check.kind as StringCheckType)) {
        switch (check.kind) {
          case 'regex': {
            constraints.push(`input must match this regex ${check.regex.source}`);
            break;
          }
          case 'emoji':
          case 'email':
          case 'url':
          case 'uuid':
          case 'cuid': {
            constraints.push(`a valid ${check.kind}`);
            break;
          }
          case 'min':
          case 'max': {
            constraints.push(`${check.kind}imum length ${check.value}`);
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
  const description = mergeParameterDescription(value.description, constraints);
  if (description) {
    result = result.describe(description);
  }
  return result;
}

/**
 * Default handler for Zod number types. Processes number validation constraints.
 */
export function defaultZodNumberHandler(
  value: ZodNumber,
  handleChecks: readonly NumberCheckType[] = ALL_NUMBER_CHECKS,
): ZodNumber {
  const constraints: ConstraintHelperText = [];
  const checks = value._def.checks || [];
  type ZodNumberCheck = (typeof checks)[number];
  const newChecks: ZodNumberCheck[] = [];
  for (const check of checks) {
    if ('kind' in check) {
      if (handleChecks.includes(check.kind as NumberCheckType)) {
        switch (check.kind) {
          case 'min':
            if (check.inclusive) {
              constraints.push(`greater than or equal to ${check.value}`);
            } else {
              constraints.push(`greater than ${check.value}`);
            }
            break;
          case 'max':
            if (check.inclusive) {
              constraints.push(`lower than or equal to ${check.value}`);
            } else {
              constraints.push(`lower than ${check.value}`);
            }
            break;
          case 'multipleOf': {
            constraints.push(`multiple of ${check.value}`);
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
  const description = mergeParameterDescription(value.description, constraints);
  if (description) {
    result = result.describe(description);
  }
  return result;
}

/**
 * Default handler for Zod date types. Converts dates to ISO strings with constraint descriptions.
 */
export function defaultZodDateHandler(value: ZodDate): ZodString {
  const constraints: ConstraintHelperText = [];
  const checks = value._def.checks || [];
  type ZodDateCheck = (typeof checks)[number];
  const newChecks: ZodDateCheck[] = [];
  for (const check of checks) {
    if ('kind' in check) {
      switch (check.kind) {
        case 'min':
          const minDate = new Date(check.value);
          if (!isNaN(minDate.getTime())) {
            constraints.push(`Date must be newer than ${minDate.toISOString()} (ISO)`);
          }
          break;
        case 'max':
          const maxDate = new Date(check.value);
          if (!isNaN(maxDate.getTime())) {
            constraints.push(`Date must be older than ${maxDate.toISOString()} (ISO)`);
          }
          break;
        default:
          newChecks.push(check);
      }
    }
  }
  constraints.push(`Date format is date-time`);
  let result = z.string().describe('date-time');
  const description = mergeParameterDescription(value.description, constraints);
  if (description) {
    result = result.describe(description);
  }
  return result;
}

/**
 * Default handler for Zod optional types. Processes the inner type and maintains optionality.
 */
export function defaultZodOptionalHandler(
  ctx: HandlerContext,
  value: ZodOptional<any>,
  handleTypes: readonly string[] = SUPPORTED_ZOD_TYPES,
): ZodTypeAny {
  if (handleTypes.includes(value._def.innerType._def.typeName as AllZodType)) {
    return ctx.processZodType(value._def.innerType).optional();
  } else {
    return value;
  }
}
