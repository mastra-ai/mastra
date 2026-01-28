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
} from 'zod/v4';
import type { ZodAny, ZodType } from 'zod/v4';
import type { ModelInformation } from './types';

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
  'ZodNullable',
] as const;

/**
 * All Zod types (both supported and unsupported).
 * @constant
 */
export const ALL_ZOD_TYPES = [...SUPPORTED_ZOD_TYPES, ...UNSUPPORTED_ZOD_TYPES] as const;

// Type guards using instanceof
export const isOptional = (v: ZodType | ZodOptional<any>): v is ZodOptional<any> => v instanceof ZodOptional;
export const isObj = (v: ZodType | ZodObject<any, any>): v is ZodObject<any, any> => v instanceof ZodObject;
export const isNull = (v: ZodType | ZodNull): v is ZodNull => v instanceof ZodNull;
export const isNullable = (v: ZodType | ZodNullable<any>): v is ZodNullable<any> => v instanceof ZodNullable;
export const isArr = (v: ZodType | ZodArray<any>): v is ZodArray<any> => v instanceof ZodArray;
export const isUnion = (v: ZodType | ZodUnion<[ZodAny, ...ZodAny[]]>): v is ZodUnion<[ZodAny, ...ZodAny[]]> =>
  v instanceof ZodUnion;
export const isString = (v: ZodType | ZodString): v is ZodString => v instanceof ZodString;
export const isNumber = (v: ZodType | ZodNumber): v is ZodNumber => v instanceof ZodNumber;
export const isDate = (v: ZodType | ZodDate): v is ZodDate => v instanceof ZodDate;
export const isDefault = (v: ZodType | ZodDefault<any>): v is ZodDefault<any> => v instanceof ZodDefault;

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

type ConstraintHelperText = string[];

/**
 * Context for schema compatibility handler functions.
 */
export interface HandlerContext {
  model: ModelInformation;
  processZodType: (value: ZodType) => ZodType;
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
  value: ZodObject<any, any>,
  options: { passthrough?: boolean } = { passthrough: true },
): ZodObject<any, any> {
  const processedShape = Object.entries(value.shape).reduce<Record<string, ZodType>>((acc, [key, propValue]) => {
    acc[key] = ctx.processZodType(propValue as ZodAny);
    return acc;
  }, {});

  let result: ZodObject<any, any> = z.object(processedShape);

  const catchallType = (value._zod.def.catchall as any)?._zod?.def?.type;
  if (catchallType === 'never') {
    result = z.strictObject(processedShape);
  } else if (catchallType === 'unknown') {
    // ZodUnknown catchall means passthrough - only keep if passthrough option is true
    if (options.passthrough) {
      result = z.looseObject(processedShape);
    }
    // When passthrough: false, we use the default z.object (strips unknown keys)
  } else if (value._zod.def.catchall) {
    // Explicit catchall (not never/unknown) - always copy
    result = result.catchall(value._zod.def.catchall);
  }

  if (value.description) {
    result = result.describe(value.description);
  }

  return result;
}

/**
 * Default handler for unsupported Zod types. Throws an error for specified unsupported types.
 */
export function defaultUnsupportedZodTypeHandler<T extends z.ZodObject<any, any>>(
  ctx: HandlerContext,
  value: z.ZodType,
  throwOnTypes: readonly UnsupportedZodType[] = UNSUPPORTED_ZOD_TYPES,
): ShapeValue<T> {
  if (throwOnTypes.includes(value.constructor.name as UnsupportedZodType)) {
    throw new Error(`${ctx.model.modelId} does not support zod type: ${value.constructor.name}`);
  }
  return value as ShapeValue<T>;
}

/**
 * Default handler for Zod array types. Processes array constraints according to provider support.
 */
export function defaultZodArrayHandler(
  ctx: HandlerContext,
  value: ZodArray<any>,
  handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
): ZodArray<any> {
  const zodArrayDef = value._zod.def;
  const processedType = ctx.processZodType(zodArrayDef.element);

  let result = z.array(processedType);

  const constraints: ConstraintHelperText = [];
  if (zodArrayDef.checks) {
    for (const check of zodArrayDef.checks) {
      if (check._zod.def.check === 'min_length') {
        if (handleChecks.includes('min')) {
          // @ts-expect-error - fix later
          constraints.push(`minimum length ${check._zod.def.minimum}`);
        } else {
          // @ts-expect-error - fix later
          result = result.min(check._zod.def.minimum);
        }
      }
      if (check._zod.def.check === 'max_length') {
        if (handleChecks.includes('max')) {
          // @ts-expect-error - fix later
          constraints.push(`maximum length ${check._zod.def.maximum}`);
        } else {
          // @ts-expect-error - fix later
          result = result.max(check._zod.def.maximum);
        }
      }
      if (check._zod.def.check === 'length_equals') {
        if (handleChecks.includes('length')) {
          // @ts-expect-error - fix later
          constraints.push(`exact length ${check._zod.def.length}`);
        } else {
          // @ts-expect-error - fix later
          result = result.length(check._zod.def.length);
        }
      }
    }
  }

  const metaDescription = value.meta()?.description;
  const legacyDescription = value.description;

  const description = mergeParameterDescription(metaDescription || legacyDescription, constraints);
  if (description) {
    result = result.describe(description);
  }
  return result;
}

/**
 * Default handler for Zod union types. Processes all union options.
 */
export function defaultZodUnionHandler(ctx: HandlerContext, value: ZodUnion<[ZodAny, ...ZodAny[]]>): ZodAny {
  const processedOptions = value._zod.def.options.map((option: ZodAny) => ctx.processZodType(option));
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
 */
export function defaultZodStringHandler(
  value: ZodString,
  handleChecks: readonly StringCheckType[] = ALL_STRING_CHECKS,
): ZodString {
  const constraints: ConstraintHelperText = [];
  const checks = value._zod.def.checks || [];
  type ZodStringCheck = (typeof checks)[number];
  const newChecks: ZodStringCheck[] = [];

  if (checks) {
    for (const check of checks) {
      if (handleChecks.includes(check._zod.def.check as StringCheckType)) {
        switch (check._zod.def.check) {
          case 'min_length':
            // @ts-expect-error - fix later
            constraints.push(`minimum length ${check._zod.def.minimum}`);
            break;
          case 'max_length':
            // @ts-expect-error - fix later
            constraints.push(`maximum length ${check._zod.def.maximum}`);
            break;
          case 'string_format':
            {
              // @ts-expect-error - fix later
              switch (check._zod.def.format) {
                case 'email':
                case 'url':
                case 'emoji':
                case 'uuid':
                case 'cuid':
                  // @ts-expect-error - fix later
                  constraints.push(`a valid ${check._zod.def.format}`);
                  break;
                case 'regex':
                  // @ts-expect-error - fix later
                  constraints.push(`input must match this regex ${check._zod.def.pattern}`);
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

  const description = mergeParameterDescription(metaDescription || legacyDescription, constraints);
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
              constraints.push(`greater than or equal to ${check._zod.def.value}`);
            } else {
              // @ts-expect-error - fix later
              constraints.push(`greater than ${check._zod.def.value}`);
            }
            break;
          case 'less_than':
            // @ts-expect-error - fix later
            if (check._zod.def.inclusive) {
              // @ts-expect-error - fix later
              constraints.push(`lower than or equal to ${check._zod.def.value}`);
            } else {
              // @ts-expect-error - fix later
              constraints.push(`lower than ${check._zod.def.value}`);
            }
            break;
          case 'multiple_of': {
            // @ts-expect-error - fix later
            constraints.push(`multiple of ${check._zod.def.value}`);
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
            constraints.push(`Date must be newer than ${minDate.toISOString()} (ISO)`);
          }
          break;
        case 'greater_than':
          // @ts-expect-error - fix later
          const maxDate = new Date(check._zod.def.value);
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
): ZodType {
  if (handleTypes.includes(value.constructor.name as AllZodType)) {
    return ctx.processZodType(value._zod.def.innerType).optional();
  } else {
    return value;
  }
}
