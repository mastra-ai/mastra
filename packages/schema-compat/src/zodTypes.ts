import type { z as zV3 } from 'zod/v3';
import type { z as zV4 } from 'zod/v4';

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
