import { knownUnsafeEditableEvent, KnownUnsafeEditableEvent } from '../types'
import { includes } from './string-utils'

// eslint-disable-next-line posthog-js/no-direct-array-check
const nativeIsArray = Array.isArray
const ObjProto = Object.prototype
export const hasOwnProperty = ObjProto.hasOwnProperty
const toString = ObjProto.toString

export const isArray =
  nativeIsArray ||
  function (obj: any): obj is any[] {
    return toString.call(obj) === '[object Array]'
  }

// from a comment on http://dbj.org/dbj/?p=286
// fails on only one very rare and deliberate custom object:
// let bomb = { toString : undefined, valueOf: function(o) { return "function BOMBA!"; }};
export const isFunction = (x: unknown): x is (...args: any[]) => any => {
  // eslint-disable-next-line posthog-js/no-direct-function-check
  return typeof x === 'function'
}

export const isNativeFunction = (x: unknown): x is (...args: any[]) => any =>
  isFunction(x) && x.toString().indexOf('[native code]') !== -1

// Underscore Addons
export const isObject = (x: unknown): x is Record<string, any> => {
  // eslint-disable-next-line posthog-js/no-direct-object-check
  return x === Object(x) && !isArray(x)
}
export const isEmptyObject = (x: unknown) => {
  if (isObject(x)) {
    for (const key in x) {
      if (hasOwnProperty.call(x, key)) {
        return false
      }
    }
    return true
  }
  return false
}
export const isUndefined = (x: unknown): x is undefined => x === void 0

export const isString = (x: unknown): x is string => {
  // eslint-disable-next-line posthog-js/no-direct-string-check
  return toString.call(x) == '[object String]'
}

export const isEmptyString = (x: unknown): boolean => isString(x) && x.trim().length === 0

export const isNull = (x: unknown): x is null => {
  // eslint-disable-next-line posthog-js/no-direct-null-check
  return x === null
}

/*
    sometimes you want to check if something is null or undefined
    that's what this is for
 */
export const isNullish = (x: unknown): x is null | undefined => isUndefined(x) || isNull(x)

export const isNumber = (x: unknown): x is number => {
  // eslint-disable-next-line posthog-js/no-direct-number-check
  return toString.call(x) == '[object Number]'
}
export const isBoolean = (x: unknown): x is boolean => {
  // eslint-disable-next-line posthog-js/no-direct-boolean-check
  return toString.call(x) === '[object Boolean]'
}

export const isFormData = (x: unknown): x is FormData => {
  // eslint-disable-next-line posthog-js/no-direct-form-data-check
  return x instanceof FormData
}

export const isFile = (x: unknown): x is File => {
  // eslint-disable-next-line posthog-js/no-direct-file-check
  return x instanceof File
}

export const isPlainError = (x: unknown): x is Error => {
  return x instanceof Error
}

export const isKnownUnsafeEditableEvent = (x: unknown): x is KnownUnsafeEditableEvent => {
  return includes(knownUnsafeEditableEvent as unknown as string[], x)
}

export function isInstanceOf(candidate: unknown, base: any): boolean {
  try {
    return candidate instanceof base
  } catch {
    return false
  }
}

export function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object'
}

export function isBuiltin(candidate: unknown, className: string): boolean {
  return Object.prototype.toString.call(candidate) === `[object ${className}]`
}

export function isError(candidate: unknown): candidate is Error {
  switch (Object.prototype.toString.call(candidate)) {
    case '[object Error]':
    case '[object Exception]':
    case '[object DOMException]':
    case '[object DOMError]':
    case '[object WebAssembly.Exception]':
      return true
    default:
      return isInstanceOf(candidate, Error)
  }
}

export function isErrorEvent(event: unknown): boolean {
  return isBuiltin(event, 'ErrorEvent')
}

export function isEvent(candidate: unknown): candidate is Event {
  return !isUndefined(Event) && isInstanceOf(candidate, Event)
}

export function isPlainObject(candidate: unknown): candidate is Record<string, unknown> {
  return isBuiltin(candidate, 'Object')
}

export const yesLikeValues = [true, 'true', 1, '1', 'yes']
export const isYesLike = (val: string | boolean | number): boolean => includes(yesLikeValues, val)
export const noLikeValues = [false, 'false', 0, '0', 'no']
export const isNoLike = (val: string | boolean | number): boolean => includes(noLikeValues, val)
