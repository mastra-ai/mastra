import type { z as zV3 } from 'zod/v3';
import type { z as zV4 } from 'zod/v4';

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
export type ZodShape<T extends zV3.ZodObject<any, any, any> | zV4.ZodObject<any, any>> = T['shape'];

/**
 * Utility type to extract the keys from a Zod object shape.
 */
export type ShapeKey<T extends zV3.ZodObject<any, any, any> | zV4.ZodObject<any, any>> = keyof ZodShape<T>;

/**
 * Utility type to extract the value types from a Zod object shape.
 */
export type ShapeValue<T extends zV3.ZodObject<any, any, any> | zV4.ZodObject<any, any>> = ZodShape<T>[ShapeKey<T>];

export function isOptional<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodOptional<any>;
export function isOptional<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodOptional<any>;
export function isOptional<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodOptional'] => v instanceof z['ZodOptional'];
}

export function isObj<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodObject<any>;
export function isObj<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodObject;
export function isObj<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodObject'] => v instanceof z['ZodObject'];
}

export function isNull<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodNull;
export function isNull<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodNull;
export function isNull<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodNull'] => v instanceof z['ZodNull'];
}

export function isArr<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodArray<any>;
export function isArr<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodArray;
export function isArr<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodArray'] => v instanceof z['ZodArray'];
}

export function isUnion<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodUnion<any>;
export function isUnion<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodUnion;
export function isUnion<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodUnion'] => v instanceof z['ZodUnion'];
}

export function isString<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodString;
export function isString<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodString;
export function isString<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodString'] => v instanceof z['ZodString'];
}

export function isNumber<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodNumber;
export function isNumber<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodNumber;
export function isNumber<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodNumber'] => v instanceof z['ZodNumber'];
}

export function isDate<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodDate;
export function isDate<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodDate;
export function isDate<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodDate'] => v instanceof z['ZodDate'];
}

export function isDefault<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodDefault<any>;
export function isDefault<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodDefault;
export function isDefault<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodDefault'] => v instanceof z['ZodDefault'];
}

export function isNullable<Z extends typeof zV3>(z: Z): (v: any) => v is zV3.ZodNullable<any>;
export function isNullable<Z extends typeof zV4>(z: Z): (v: any) => v is zV4.ZodNullable;
export function isNullable<Z extends typeof zV3 | typeof zV4>(z: Z) {
  return (v: any): v is Z['ZodNullable'] => v instanceof z['ZodNullable'];
}
