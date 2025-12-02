import { keysOf } from './utilities.js';
const typedArrayTypeNames = [
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array',
];
function isTypedArrayName(name) {
    return typedArrayTypeNames.includes(name);
}
const objectTypeNames = [
    'Function',
    'Generator',
    'AsyncGenerator',
    'GeneratorFunction',
    'AsyncGeneratorFunction',
    'AsyncFunction',
    'Observable',
    'Array',
    'Buffer',
    'Blob',
    'Object',
    'RegExp',
    'Date',
    'Error',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'WeakRef',
    'ArrayBuffer',
    'SharedArrayBuffer',
    'DataView',
    'Promise',
    'URL',
    'FormData',
    'URLSearchParams',
    'HTMLElement',
    'NaN',
    ...typedArrayTypeNames,
];
function isObjectTypeName(name) {
    return objectTypeNames.includes(name);
}
const primitiveTypeNames = [
    'null',
    'undefined',
    'string',
    'number',
    'bigint',
    'boolean',
    'symbol',
];
function isPrimitiveTypeName(name) {
    return primitiveTypeNames.includes(name);
}
const assertionTypeDescriptions = [
    'positive number',
    'negative number',
    'Class',
    'string with a number',
    'null or undefined',
    'Iterable',
    'AsyncIterable',
    'native Promise',
    'EnumCase',
    'string with a URL',
    'truthy',
    'falsy',
    'primitive',
    'integer',
    'plain object',
    'TypedArray',
    'array-like',
    'tuple-like',
    'Node.js Stream',
    'infinite number',
    'empty array',
    'non-empty array',
    'empty string',
    'empty string or whitespace',
    'non-empty string',
    'non-empty string and not whitespace',
    'empty object',
    'non-empty object',
    'empty set',
    'non-empty set',
    'empty map',
    'non-empty map',
    'PropertyKey',
    'even integer',
    'odd integer',
    'T',
    'in range',
    'predicate returns truthy for any value',
    'predicate returns truthy for all values',
    'valid Date',
    'valid length',
    'whitespace string',
    ...objectTypeNames,
    ...primitiveTypeNames,
];
const getObjectType = (value) => {
    const objectTypeName = Object.prototype.toString.call(value).slice(8, -1);
    if (/HTML\w+Element/.test(objectTypeName) && isHtmlElement(value)) {
        return 'HTMLElement';
    }
    if (isObjectTypeName(objectTypeName)) {
        return objectTypeName;
    }
    return undefined;
};
function detect(value) {
    if (value === null) {
        return 'null';
    }
    switch (typeof value) {
        case 'undefined': {
            return 'undefined';
        }
        case 'string': {
            return 'string';
        }
        case 'number': {
            return Number.isNaN(value) ? 'NaN' : 'number';
        }
        case 'boolean': {
            return 'boolean';
        }
        case 'function': {
            return 'Function';
        }
        case 'bigint': {
            return 'bigint';
        }
        case 'symbol': {
            return 'symbol';
        }
        default:
    }
    if (isObservable(value)) {
        return 'Observable';
    }
    if (isArray(value)) {
        return 'Array';
    }
    if (isBuffer(value)) {
        return 'Buffer';
    }
    const tagType = getObjectType(value);
    if (tagType && tagType !== 'Object') {
        return tagType;
    }
    if (hasPromiseApi(value)) {
        return 'Promise';
    }
    if (value instanceof String || value instanceof Boolean || value instanceof Number) {
        throw new TypeError('Please don\'t use object wrappers for primitive types');
    }
    return 'Object';
}
function hasPromiseApi(value) {
    return isFunction(value?.then) && isFunction(value?.catch);
}
const is = Object.assign(detect, {
    all: isAll,
    any: isAny,
    array: isArray,
    arrayBuffer: isArrayBuffer,
    arrayLike: isArrayLike,
    asyncFunction: isAsyncFunction,
    asyncGenerator: isAsyncGenerator,
    asyncGeneratorFunction: isAsyncGeneratorFunction,
    asyncIterable: isAsyncIterable,
    bigint: isBigint,
    bigInt64Array: isBigInt64Array,
    bigUint64Array: isBigUint64Array,
    blob: isBlob,
    boolean: isBoolean,
    boundFunction: isBoundFunction,
    buffer: isBuffer,
    class: isClass,
    dataView: isDataView,
    date: isDate,
    detect,
    directInstanceOf: isDirectInstanceOf,
    emptyArray: isEmptyArray,
    emptyMap: isEmptyMap,
    emptyObject: isEmptyObject,
    emptySet: isEmptySet,
    emptyString: isEmptyString,
    emptyStringOrWhitespace: isEmptyStringOrWhitespace,
    enumCase: isEnumCase,
    error: isError,
    evenInteger: isEvenInteger,
    falsy: isFalsy,
    float32Array: isFloat32Array,
    float64Array: isFloat64Array,
    formData: isFormData,
    function: isFunction,
    generator: isGenerator,
    generatorFunction: isGeneratorFunction,
    htmlElement: isHtmlElement,
    infinite: isInfinite,
    inRange: isInRange,
    int16Array: isInt16Array,
    int32Array: isInt32Array,
    int8Array: isInt8Array,
    integer: isInteger,
    iterable: isIterable,
    map: isMap,
    nan: isNan,
    nativePromise: isNativePromise,
    negativeNumber: isNegativeNumber,
    nodeStream: isNodeStream,
    nonEmptyArray: isNonEmptyArray,
    nonEmptyMap: isNonEmptyMap,
    nonEmptyObject: isNonEmptyObject,
    nonEmptySet: isNonEmptySet,
    nonEmptyString: isNonEmptyString,
    nonEmptyStringAndNotWhitespace: isNonEmptyStringAndNotWhitespace,
    null: isNull,
    nullOrUndefined: isNullOrUndefined,
    number: isNumber,
    numericString: isNumericString,
    object: isObject,
    observable: isObservable,
    oddInteger: isOddInteger,
    plainObject: isPlainObject,
    positiveNumber: isPositiveNumber,
    primitive: isPrimitive,
    promise: isPromise,
    propertyKey: isPropertyKey,
    regExp: isRegExp,
    safeInteger: isSafeInteger,
    set: isSet,
    sharedArrayBuffer: isSharedArrayBuffer,
    string: isString,
    symbol: isSymbol,
    truthy: isTruthy,
    tupleLike: isTupleLike,
    typedArray: isTypedArray,
    uint16Array: isUint16Array,
    uint32Array: isUint32Array,
    uint8Array: isUint8Array,
    uint8ClampedArray: isUint8ClampedArray,
    undefined: isUndefined,
    urlInstance: isUrlInstance,
    urlSearchParams: isUrlSearchParams,
    urlString: isUrlString,
    optional: isOptional,
    validDate: isValidDate,
    validLength: isValidLength,
    weakMap: isWeakMap,
    weakRef: isWeakRef,
    weakSet: isWeakSet,
    whitespaceString: isWhitespaceString,
});
function isAbsoluteModule2(remainder) {
    return (value) => isInteger(value) && Math.abs(value % 2) === remainder;
}
export function isAll(predicate, ...values) {
    return predicateOnArray(Array.prototype.every, predicate, values);
}
export function isAny(predicate, ...values) {
    const predicates = isArray(predicate) ? predicate : [predicate];
    return predicates.some(singlePredicate => predicateOnArray(Array.prototype.some, singlePredicate, values));
}
export function isOptional(value, predicate) {
    return isUndefined(value) || predicate(value);
}
export function isArray(value, assertion) {
    if (!Array.isArray(value)) {
        return false;
    }
    if (!isFunction(assertion)) {
        return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return value.every(element => assertion(element));
}
export function isArrayBuffer(value) {
    return getObjectType(value) === 'ArrayBuffer';
}
export function isArrayLike(value) {
    return !isNullOrUndefined(value) && !isFunction(value) && isValidLength(value.length);
}
export function isAsyncFunction(value) {
    return getObjectType(value) === 'AsyncFunction';
}
export function isAsyncGenerator(value) {
    return isAsyncIterable(value) && isFunction(value.next) && isFunction(value.throw);
}
export function isAsyncGeneratorFunction(value) {
    return getObjectType(value) === 'AsyncGeneratorFunction';
}
export function isAsyncIterable(value) {
    return isFunction(value?.[Symbol.asyncIterator]);
}
export function isBigint(value) {
    return typeof value === 'bigint';
}
export function isBigInt64Array(value) {
    return getObjectType(value) === 'BigInt64Array';
}
export function isBigUint64Array(value) {
    return getObjectType(value) === 'BigUint64Array';
}
export function isBlob(value) {
    return getObjectType(value) === 'Blob';
}
export function isBoolean(value) {
    return value === true || value === false;
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function isBoundFunction(value) {
    return isFunction(value) && !Object.hasOwn(value, 'prototype');
}
/**
Note: [Prefer using `Uint8Array` instead of `Buffer`.](https://sindresorhus.com/blog/goodbye-nodejs-buffer)
*/
export function isBuffer(value) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return value?.constructor?.isBuffer?.(value) ?? false;
}
export function isClass(value) {
    return isFunction(value) && value.toString().startsWith('class ');
}
export function isDataView(value) {
    return getObjectType(value) === 'DataView';
}
export function isDate(value) {
    return getObjectType(value) === 'Date';
}
export function isDirectInstanceOf(instance, class_) {
    if (instance === undefined || instance === null) {
        return false;
    }
    return Object.getPrototypeOf(instance) === class_.prototype;
}
export function isEmptyArray(value) {
    return isArray(value) && value.length === 0;
}
export function isEmptyMap(value) {
    return isMap(value) && value.size === 0;
}
export function isEmptyObject(value) {
    return isObject(value) && !isMap(value) && !isSet(value) && Object.keys(value).length === 0;
}
export function isEmptySet(value) {
    return isSet(value) && value.size === 0;
}
export function isEmptyString(value) {
    return isString(value) && value.length === 0;
}
export function isEmptyStringOrWhitespace(value) {
    return isEmptyString(value) || isWhitespaceString(value);
}
export function isEnumCase(value, targetEnum) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return Object.values(targetEnum).includes(value);
}
export function isError(value) {
    // TODO: Use `Error.isError` when targeting Node.js 24.`
    return getObjectType(value) === 'Error';
}
export function isEvenInteger(value) {
    return isAbsoluteModule2(0)(value);
}
// Example: `is.falsy = (value: unknown): value is (not true | 0 | '' | undefined | null) => Boolean(value);`
export function isFalsy(value) {
    return !value;
}
// TODO: Support detecting Float16Array when targeting Node.js 24.
export function isFloat32Array(value) {
    return getObjectType(value) === 'Float32Array';
}
export function isFloat64Array(value) {
    return getObjectType(value) === 'Float64Array';
}
export function isFormData(value) {
    return getObjectType(value) === 'FormData';
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction(value) {
    return typeof value === 'function';
}
export function isGenerator(value) {
    return isIterable(value) && isFunction(value?.next) && isFunction(value?.throw);
}
export function isGeneratorFunction(value) {
    return getObjectType(value) === 'GeneratorFunction';
}
// eslint-disable-next-line @typescript-eslint/naming-convention
const NODE_TYPE_ELEMENT = 1;
// eslint-disable-next-line @typescript-eslint/naming-convention
const DOM_PROPERTIES_TO_CHECK = [
    'innerHTML',
    'ownerDocument',
    'style',
    'attributes',
    'nodeValue',
];
export function isHtmlElement(value) {
    return isObject(value)
        && value.nodeType === NODE_TYPE_ELEMENT
        && isString(value.nodeName)
        && !isPlainObject(value)
        && DOM_PROPERTIES_TO_CHECK.every(property => property in value);
}
export function isInfinite(value) {
    return value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY;
}
export function isInRange(value, range) {
    if (isNumber(range)) {
        return value >= Math.min(0, range) && value <= Math.max(range, 0);
    }
    if (isArray(range) && range.length === 2) {
        return value >= Math.min(...range) && value <= Math.max(...range);
    }
    throw new TypeError(`Invalid range: ${JSON.stringify(range)}`);
}
export function isInt16Array(value) {
    return getObjectType(value) === 'Int16Array';
}
export function isInt32Array(value) {
    return getObjectType(value) === 'Int32Array';
}
export function isInt8Array(value) {
    return getObjectType(value) === 'Int8Array';
}
export function isInteger(value) {
    return Number.isInteger(value);
}
export function isIterable(value) {
    return isFunction(value?.[Symbol.iterator]);
}
export function isMap(value) {
    return getObjectType(value) === 'Map';
}
export function isNan(value) {
    return Number.isNaN(value);
}
export function isNativePromise(value) {
    return getObjectType(value) === 'Promise';
}
export function isNegativeNumber(value) {
    return isNumber(value) && value < 0;
}
export function isNodeStream(value) {
    return isObject(value) && isFunction(value.pipe) && !isObservable(value);
}
export function isNonEmptyArray(value) {
    return isArray(value) && value.length > 0;
}
export function isNonEmptyMap(value) {
    return isMap(value) && value.size > 0;
}
// TODO: Use `not` operator here to remove `Map` and `Set` from type guard:
// - https://github.com/Microsoft/TypeScript/pull/29317
export function isNonEmptyObject(value) {
    return isObject(value) && !isMap(value) && !isSet(value) && Object.keys(value).length > 0;
}
export function isNonEmptySet(value) {
    return isSet(value) && value.size > 0;
}
// TODO: Use `not ''` when the `not` operator is available.
export function isNonEmptyString(value) {
    return isString(value) && value.length > 0;
}
// TODO: Use `not ''` when the `not` operator is available.
export function isNonEmptyStringAndNotWhitespace(value) {
    return isString(value) && !isEmptyStringOrWhitespace(value);
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function isNull(value) {
    return value === null;
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function isNullOrUndefined(value) {
    return isNull(value) || isUndefined(value);
}
export function isNumber(value) {
    return typeof value === 'number' && !Number.isNaN(value);
}
export function isNumericString(value) {
    return isString(value) && !isEmptyStringOrWhitespace(value) && !Number.isNaN(Number(value));
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function isObject(value) {
    return !isNull(value) && (typeof value === 'object' || isFunction(value));
}
export function isObservable(value) {
    if (!value) {
        return false;
    }
    // eslint-disable-next-line no-use-extend-native/no-use-extend-native, @typescript-eslint/no-unsafe-call
    if (Symbol.observable !== undefined && value === value[Symbol.observable]?.()) {
        return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (value === value['@@observable']?.()) {
        return true;
    }
    return false;
}
export function isOddInteger(value) {
    return isAbsoluteModule2(1)(value);
}
export function isPlainObject(value) {
    // From: https://github.com/sindresorhus/is-plain-obj/blob/main/index.js
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const prototype = Object.getPrototypeOf(value);
    return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}
export function isPositiveNumber(value) {
    return isNumber(value) && value > 0;
}
export function isPrimitive(value) {
    return isNull(value) || isPrimitiveTypeName(typeof value);
}
export function isPromise(value) {
    return isNativePromise(value) || hasPromiseApi(value);
}
// `PropertyKey` is any value that can be used as an object key (string, number, or symbol)
export function isPropertyKey(value) {
    return isAny([isString, isNumber, isSymbol], value);
}
export function isRegExp(value) {
    return getObjectType(value) === 'RegExp';
}
export function isSafeInteger(value) {
    return Number.isSafeInteger(value);
}
export function isSet(value) {
    return getObjectType(value) === 'Set';
}
export function isSharedArrayBuffer(value) {
    return getObjectType(value) === 'SharedArrayBuffer';
}
export function isString(value) {
    return typeof value === 'string';
}
export function isSymbol(value) {
    return typeof value === 'symbol';
}
// Example: `is.truthy = (value: unknown): value is (not false | not 0 | not '' | not undefined | not null) => Boolean(value);`
// eslint-disable-next-line unicorn/prefer-native-coercion-functions
export function isTruthy(value) {
    return Boolean(value);
}
export function isTupleLike(value, guards) {
    if (isArray(guards) && isArray(value) && guards.length === value.length) {
        return guards.every((guard, index) => guard(value[index]));
    }
    return false;
}
export function isTypedArray(value) {
    return isTypedArrayName(getObjectType(value));
}
export function isUint16Array(value) {
    return getObjectType(value) === 'Uint16Array';
}
export function isUint32Array(value) {
    return getObjectType(value) === 'Uint32Array';
}
export function isUint8Array(value) {
    return getObjectType(value) === 'Uint8Array';
}
export function isUint8ClampedArray(value) {
    return getObjectType(value) === 'Uint8ClampedArray';
}
export function isUndefined(value) {
    return value === undefined;
}
export function isUrlInstance(value) {
    return getObjectType(value) === 'URL';
}
// eslint-disable-next-line unicorn/prevent-abbreviations
export function isUrlSearchParams(value) {
    return getObjectType(value) === 'URLSearchParams';
}
export function isUrlString(value) {
    if (!isString(value)) {
        return false;
    }
    try {
        new URL(value); // eslint-disable-line no-new
        return true;
    }
    catch {
        return false;
    }
}
export function isValidDate(value) {
    return isDate(value) && !isNan(Number(value));
}
export function isValidLength(value) {
    return isSafeInteger(value) && value >= 0;
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function isWeakMap(value) {
    return getObjectType(value) === 'WeakMap';
}
// eslint-disable-next-line @typescript-eslint/ban-types, unicorn/prevent-abbreviations
export function isWeakRef(value) {
    return getObjectType(value) === 'WeakRef';
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function isWeakSet(value) {
    return getObjectType(value) === 'WeakSet';
}
export function isWhitespaceString(value) {
    return isString(value) && /^\s+$/.test(value);
}
function predicateOnArray(method, predicate, values) {
    if (!isFunction(predicate)) {
        throw new TypeError(`Invalid predicate: ${JSON.stringify(predicate)}`);
    }
    if (values.length === 0) {
        throw new TypeError('Invalid number of values');
    }
    return method.call(values, predicate);
}
function typeErrorMessage(description, value) {
    return `Expected value which is \`${description}\`, received value of type \`${is(value)}\`.`;
}
function unique(values) {
    // eslint-disable-next-line unicorn/prefer-spread
    return Array.from(new Set(values));
}
const andFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
const orFormatter = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' });
function typeErrorMessageMultipleValues(expectedType, values) {
    const uniqueExpectedTypes = unique((isArray(expectedType) ? expectedType : [expectedType]).map(value => `\`${value}\``));
    const uniqueValueTypes = unique(values.map(value => `\`${is(value)}\``));
    return `Expected values which are ${orFormatter.format(uniqueExpectedTypes)}. Received values of type${uniqueValueTypes.length > 1 ? 's' : ''} ${andFormatter.format(uniqueValueTypes)}.`;
}
export const assert = {
    all: assertAll,
    any: assertAny,
    optional: assertOptional,
    array: assertArray,
    arrayBuffer: assertArrayBuffer,
    arrayLike: assertArrayLike,
    asyncFunction: assertAsyncFunction,
    asyncGenerator: assertAsyncGenerator,
    asyncGeneratorFunction: assertAsyncGeneratorFunction,
    asyncIterable: assertAsyncIterable,
    bigint: assertBigint,
    bigInt64Array: assertBigInt64Array,
    bigUint64Array: assertBigUint64Array,
    blob: assertBlob,
    boolean: assertBoolean,
    boundFunction: assertBoundFunction,
    buffer: assertBuffer,
    class: assertClass,
    dataView: assertDataView,
    date: assertDate,
    directInstanceOf: assertDirectInstanceOf,
    emptyArray: assertEmptyArray,
    emptyMap: assertEmptyMap,
    emptyObject: assertEmptyObject,
    emptySet: assertEmptySet,
    emptyString: assertEmptyString,
    emptyStringOrWhitespace: assertEmptyStringOrWhitespace,
    enumCase: assertEnumCase,
    error: assertError,
    evenInteger: assertEvenInteger,
    falsy: assertFalsy,
    float32Array: assertFloat32Array,
    float64Array: assertFloat64Array,
    formData: assertFormData,
    function: assertFunction,
    generator: assertGenerator,
    generatorFunction: assertGeneratorFunction,
    htmlElement: assertHtmlElement,
    infinite: assertInfinite,
    inRange: assertInRange,
    int16Array: assertInt16Array,
    int32Array: assertInt32Array,
    int8Array: assertInt8Array,
    integer: assertInteger,
    iterable: assertIterable,
    map: assertMap,
    nan: assertNan,
    nativePromise: assertNativePromise,
    negativeNumber: assertNegativeNumber,
    nodeStream: assertNodeStream,
    nonEmptyArray: assertNonEmptyArray,
    nonEmptyMap: assertNonEmptyMap,
    nonEmptyObject: assertNonEmptyObject,
    nonEmptySet: assertNonEmptySet,
    nonEmptyString: assertNonEmptyString,
    nonEmptyStringAndNotWhitespace: assertNonEmptyStringAndNotWhitespace,
    null: assertNull,
    nullOrUndefined: assertNullOrUndefined,
    number: assertNumber,
    numericString: assertNumericString,
    object: assertObject,
    observable: assertObservable,
    oddInteger: assertOddInteger,
    plainObject: assertPlainObject,
    positiveNumber: assertPositiveNumber,
    primitive: assertPrimitive,
    promise: assertPromise,
    propertyKey: assertPropertyKey,
    regExp: assertRegExp,
    safeInteger: assertSafeInteger,
    set: assertSet,
    sharedArrayBuffer: assertSharedArrayBuffer,
    string: assertString,
    symbol: assertSymbol,
    truthy: assertTruthy,
    tupleLike: assertTupleLike,
    typedArray: assertTypedArray,
    uint16Array: assertUint16Array,
    uint32Array: assertUint32Array,
    uint8Array: assertUint8Array,
    uint8ClampedArray: assertUint8ClampedArray,
    undefined: assertUndefined,
    urlInstance: assertUrlInstance,
    urlSearchParams: assertUrlSearchParams,
    urlString: assertUrlString,
    validDate: assertValidDate,
    validLength: assertValidLength,
    weakMap: assertWeakMap,
    weakRef: assertWeakRef,
    weakSet: assertWeakSet,
    whitespaceString: assertWhitespaceString,
};
const methodTypeMap = {
    isArray: 'Array',
    isArrayBuffer: 'ArrayBuffer',
    isArrayLike: 'array-like',
    isAsyncFunction: 'AsyncFunction',
    isAsyncGenerator: 'AsyncGenerator',
    isAsyncGeneratorFunction: 'AsyncGeneratorFunction',
    isAsyncIterable: 'AsyncIterable',
    isBigint: 'bigint',
    isBigInt64Array: 'BigInt64Array',
    isBigUint64Array: 'BigUint64Array',
    isBlob: 'Blob',
    isBoolean: 'boolean',
    isBoundFunction: 'Function',
    isBuffer: 'Buffer',
    isClass: 'Class',
    isDataView: 'DataView',
    isDate: 'Date',
    isDirectInstanceOf: 'T',
    isEmptyArray: 'empty array',
    isEmptyMap: 'empty map',
    isEmptyObject: 'empty object',
    isEmptySet: 'empty set',
    isEmptyString: 'empty string',
    isEmptyStringOrWhitespace: 'empty string or whitespace',
    isEnumCase: 'EnumCase',
    isError: 'Error',
    isEvenInteger: 'even integer',
    isFalsy: 'falsy',
    isFloat32Array: 'Float32Array',
    isFloat64Array: 'Float64Array',
    isFormData: 'FormData',
    isFunction: 'Function',
    isGenerator: 'Generator',
    isGeneratorFunction: 'GeneratorFunction',
    isHtmlElement: 'HTMLElement',
    isInfinite: 'infinite number',
    isInRange: 'in range',
    isInt16Array: 'Int16Array',
    isInt32Array: 'Int32Array',
    isInt8Array: 'Int8Array',
    isInteger: 'integer',
    isIterable: 'Iterable',
    isMap: 'Map',
    isNan: 'NaN',
    isNativePromise: 'native Promise',
    isNegativeNumber: 'negative number',
    isNodeStream: 'Node.js Stream',
    isNonEmptyArray: 'non-empty array',
    isNonEmptyMap: 'non-empty map',
    isNonEmptyObject: 'non-empty object',
    isNonEmptySet: 'non-empty set',
    isNonEmptyString: 'non-empty string',
    isNonEmptyStringAndNotWhitespace: 'non-empty string and not whitespace',
    isNull: 'null',
    isNullOrUndefined: 'null or undefined',
    isNumber: 'number',
    isNumericString: 'string with a number',
    isObject: 'Object',
    isObservable: 'Observable',
    isOddInteger: 'odd integer',
    isPlainObject: 'plain object',
    isPositiveNumber: 'positive number',
    isPrimitive: 'primitive',
    isPromise: 'Promise',
    isPropertyKey: 'PropertyKey',
    isRegExp: 'RegExp',
    isSafeInteger: 'integer',
    isSet: 'Set',
    isSharedArrayBuffer: 'SharedArrayBuffer',
    isString: 'string',
    isSymbol: 'symbol',
    isTruthy: 'truthy',
    isTupleLike: 'tuple-like',
    isTypedArray: 'TypedArray',
    isUint16Array: 'Uint16Array',
    isUint32Array: 'Uint32Array',
    isUint8Array: 'Uint8Array',
    isUint8ClampedArray: 'Uint8ClampedArray',
    isUndefined: 'undefined',
    isUrlInstance: 'URL',
    isUrlSearchParams: 'URLSearchParams',
    isUrlString: 'string with a URL',
    isValidDate: 'valid Date',
    isValidLength: 'valid length',
    isWeakMap: 'WeakMap',
    isWeakRef: 'WeakRef',
    isWeakSet: 'WeakSet',
    isWhitespaceString: 'whitespace string',
};
const isMethodNames = keysOf(methodTypeMap);
function isIsMethodName(value) {
    return isMethodNames.includes(value);
}
export function assertAll(predicate, ...values) {
    if (!isAll(predicate, ...values)) {
        const expectedType = isIsMethodName(predicate.name) ? methodTypeMap[predicate.name] : 'predicate returns truthy for all values';
        throw new TypeError(typeErrorMessageMultipleValues(expectedType, values));
    }
}
export function assertAny(predicate, ...values) {
    if (!isAny(predicate, ...values)) {
        const predicates = isArray(predicate) ? predicate : [predicate];
        const expectedTypes = predicates.map(predicate => isIsMethodName(predicate.name) ? methodTypeMap[predicate.name] : 'predicate returns truthy for any value');
        throw new TypeError(typeErrorMessageMultipleValues(expectedTypes, values));
    }
}
export function assertOptional(value, assertion, message) {
    if (!isUndefined(value)) {
        assertion(value, message);
    }
}
export function assertArray(value, assertion, message) {
    if (!isArray(value)) {
        throw new TypeError(message ?? typeErrorMessage('Array', value));
    }
    if (assertion) {
        for (const element of value) {
            // @ts-expect-error: "Assertions require every name in the call target to be declared with an explicit type annotation."
            assertion(element, message);
        }
    }
}
export function assertArrayBuffer(value, message) {
    if (!isArrayBuffer(value)) {
        throw new TypeError(message ?? typeErrorMessage('ArrayBuffer', value));
    }
}
export function assertArrayLike(value, message) {
    if (!isArrayLike(value)) {
        throw new TypeError(message ?? typeErrorMessage('array-like', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertAsyncFunction(value, message) {
    if (!isAsyncFunction(value)) {
        throw new TypeError(message ?? typeErrorMessage('AsyncFunction', value));
    }
}
export function assertAsyncGenerator(value, message) {
    if (!isAsyncGenerator(value)) {
        throw new TypeError(message ?? typeErrorMessage('AsyncGenerator', value));
    }
}
export function assertAsyncGeneratorFunction(value, message) {
    if (!isAsyncGeneratorFunction(value)) {
        throw new TypeError(message ?? typeErrorMessage('AsyncGeneratorFunction', value));
    }
}
export function assertAsyncIterable(value, message) {
    if (!isAsyncIterable(value)) {
        throw new TypeError(message ?? typeErrorMessage('AsyncIterable', value));
    }
}
export function assertBigint(value, message) {
    if (!isBigint(value)) {
        throw new TypeError(message ?? typeErrorMessage('bigint', value));
    }
}
export function assertBigInt64Array(value, message) {
    if (!isBigInt64Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('BigInt64Array', value));
    }
}
export function assertBigUint64Array(value, message) {
    if (!isBigUint64Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('BigUint64Array', value));
    }
}
export function assertBlob(value, message) {
    if (!isBlob(value)) {
        throw new TypeError(message ?? typeErrorMessage('Blob', value));
    }
}
export function assertBoolean(value, message) {
    if (!isBoolean(value)) {
        throw new TypeError(message ?? typeErrorMessage('boolean', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertBoundFunction(value, message) {
    if (!isBoundFunction(value)) {
        throw new TypeError(message ?? typeErrorMessage('Function', value));
    }
}
/**
Note: [Prefer using `Uint8Array` instead of `Buffer`.](https://sindresorhus.com/blog/goodbye-nodejs-buffer)
*/
export function assertBuffer(value, message) {
    if (!isBuffer(value)) {
        throw new TypeError(message ?? typeErrorMessage('Buffer', value));
    }
}
export function assertClass(value, message) {
    if (!isClass(value)) {
        throw new TypeError(message ?? typeErrorMessage('Class', value));
    }
}
export function assertDataView(value, message) {
    if (!isDataView(value)) {
        throw new TypeError(message ?? typeErrorMessage('DataView', value));
    }
}
export function assertDate(value, message) {
    if (!isDate(value)) {
        throw new TypeError(message ?? typeErrorMessage('Date', value));
    }
}
export function assertDirectInstanceOf(instance, class_, message) {
    if (!isDirectInstanceOf(instance, class_)) {
        throw new TypeError(message ?? typeErrorMessage('T', instance));
    }
}
export function assertEmptyArray(value, message) {
    if (!isEmptyArray(value)) {
        throw new TypeError(message ?? typeErrorMessage('empty array', value));
    }
}
export function assertEmptyMap(value, message) {
    if (!isEmptyMap(value)) {
        throw new TypeError(message ?? typeErrorMessage('empty map', value));
    }
}
export function assertEmptyObject(value, message) {
    if (!isEmptyObject(value)) {
        throw new TypeError(message ?? typeErrorMessage('empty object', value));
    }
}
export function assertEmptySet(value, message) {
    if (!isEmptySet(value)) {
        throw new TypeError(message ?? typeErrorMessage('empty set', value));
    }
}
export function assertEmptyString(value, message) {
    if (!isEmptyString(value)) {
        throw new TypeError(message ?? typeErrorMessage('empty string', value));
    }
}
export function assertEmptyStringOrWhitespace(value, message) {
    if (!isEmptyStringOrWhitespace(value)) {
        throw new TypeError(message ?? typeErrorMessage('empty string or whitespace', value));
    }
}
export function assertEnumCase(value, targetEnum, message) {
    if (!isEnumCase(value, targetEnum)) {
        throw new TypeError(message ?? typeErrorMessage('EnumCase', value));
    }
}
export function assertError(value, message) {
    if (!isError(value)) {
        throw new TypeError(message ?? typeErrorMessage('Error', value));
    }
}
export function assertEvenInteger(value, message) {
    if (!isEvenInteger(value)) {
        throw new TypeError(message ?? typeErrorMessage('even integer', value));
    }
}
export function assertFalsy(value, message) {
    if (!isFalsy(value)) {
        throw new TypeError(message ?? typeErrorMessage('falsy', value));
    }
}
export function assertFloat32Array(value, message) {
    if (!isFloat32Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Float32Array', value));
    }
}
export function assertFloat64Array(value, message) {
    if (!isFloat64Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Float64Array', value));
    }
}
export function assertFormData(value, message) {
    if (!isFormData(value)) {
        throw new TypeError(message ?? typeErrorMessage('FormData', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertFunction(value, message) {
    if (!isFunction(value)) {
        throw new TypeError(message ?? typeErrorMessage('Function', value));
    }
}
export function assertGenerator(value, message) {
    if (!isGenerator(value)) {
        throw new TypeError(message ?? typeErrorMessage('Generator', value));
    }
}
export function assertGeneratorFunction(value, message) {
    if (!isGeneratorFunction(value)) {
        throw new TypeError(message ?? typeErrorMessage('GeneratorFunction', value));
    }
}
export function assertHtmlElement(value, message) {
    if (!isHtmlElement(value)) {
        throw new TypeError(message ?? typeErrorMessage('HTMLElement', value));
    }
}
export function assertInfinite(value, message) {
    if (!isInfinite(value)) {
        throw new TypeError(message ?? typeErrorMessage('infinite number', value));
    }
}
export function assertInRange(value, range, message) {
    if (!isInRange(value, range)) {
        throw new TypeError(message ?? typeErrorMessage('in range', value));
    }
}
export function assertInt16Array(value, message) {
    if (!isInt16Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Int16Array', value));
    }
}
export function assertInt32Array(value, message) {
    if (!isInt32Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Int32Array', value));
    }
}
export function assertInt8Array(value, message) {
    if (!isInt8Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Int8Array', value));
    }
}
export function assertInteger(value, message) {
    if (!isInteger(value)) {
        throw new TypeError(message ?? typeErrorMessage('integer', value));
    }
}
export function assertIterable(value, message) {
    if (!isIterable(value)) {
        throw new TypeError(message ?? typeErrorMessage('Iterable', value));
    }
}
export function assertMap(value, message) {
    if (!isMap(value)) {
        throw new TypeError(message ?? typeErrorMessage('Map', value));
    }
}
export function assertNan(value, message) {
    if (!isNan(value)) {
        throw new TypeError(message ?? typeErrorMessage('NaN', value));
    }
}
export function assertNativePromise(value, message) {
    if (!isNativePromise(value)) {
        throw new TypeError(message ?? typeErrorMessage('native Promise', value));
    }
}
export function assertNegativeNumber(value, message) {
    if (!isNegativeNumber(value)) {
        throw new TypeError(message ?? typeErrorMessage('negative number', value));
    }
}
export function assertNodeStream(value, message) {
    if (!isNodeStream(value)) {
        throw new TypeError(message ?? typeErrorMessage('Node.js Stream', value));
    }
}
export function assertNonEmptyArray(value, message) {
    if (!isNonEmptyArray(value)) {
        throw new TypeError(message ?? typeErrorMessage('non-empty array', value));
    }
}
export function assertNonEmptyMap(value, message) {
    if (!isNonEmptyMap(value)) {
        throw new TypeError(message ?? typeErrorMessage('non-empty map', value));
    }
}
export function assertNonEmptyObject(value, message) {
    if (!isNonEmptyObject(value)) {
        throw new TypeError(message ?? typeErrorMessage('non-empty object', value));
    }
}
export function assertNonEmptySet(value, message) {
    if (!isNonEmptySet(value)) {
        throw new TypeError(message ?? typeErrorMessage('non-empty set', value));
    }
}
export function assertNonEmptyString(value, message) {
    if (!isNonEmptyString(value)) {
        throw new TypeError(message ?? typeErrorMessage('non-empty string', value));
    }
}
export function assertNonEmptyStringAndNotWhitespace(value, message) {
    if (!isNonEmptyStringAndNotWhitespace(value)) {
        throw new TypeError(message ?? typeErrorMessage('non-empty string and not whitespace', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertNull(value, message) {
    if (!isNull(value)) {
        throw new TypeError(message ?? typeErrorMessage('null', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertNullOrUndefined(value, message) {
    if (!isNullOrUndefined(value)) {
        throw new TypeError(message ?? typeErrorMessage('null or undefined', value));
    }
}
export function assertNumber(value, message) {
    if (!isNumber(value)) {
        throw new TypeError(message ?? typeErrorMessage('number', value));
    }
}
export function assertNumericString(value, message) {
    if (!isNumericString(value)) {
        throw new TypeError(message ?? typeErrorMessage('string with a number', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertObject(value, message) {
    if (!isObject(value)) {
        throw new TypeError(message ?? typeErrorMessage('Object', value));
    }
}
export function assertObservable(value, message) {
    if (!isObservable(value)) {
        throw new TypeError(message ?? typeErrorMessage('Observable', value));
    }
}
export function assertOddInteger(value, message) {
    if (!isOddInteger(value)) {
        throw new TypeError(message ?? typeErrorMessage('odd integer', value));
    }
}
export function assertPlainObject(value, message) {
    if (!isPlainObject(value)) {
        throw new TypeError(message ?? typeErrorMessage('plain object', value));
    }
}
export function assertPositiveNumber(value, message) {
    if (!isPositiveNumber(value)) {
        throw new TypeError(message ?? typeErrorMessage('positive number', value));
    }
}
export function assertPrimitive(value, message) {
    if (!isPrimitive(value)) {
        throw new TypeError(message ?? typeErrorMessage('primitive', value));
    }
}
export function assertPromise(value, message) {
    if (!isPromise(value)) {
        throw new TypeError(message ?? typeErrorMessage('Promise', value));
    }
}
export function assertPropertyKey(value, message) {
    if (!isPropertyKey(value)) {
        throw new TypeError(message ?? typeErrorMessage('PropertyKey', value));
    }
}
export function assertRegExp(value, message) {
    if (!isRegExp(value)) {
        throw new TypeError(message ?? typeErrorMessage('RegExp', value));
    }
}
export function assertSafeInteger(value, message) {
    if (!isSafeInteger(value)) {
        throw new TypeError(message ?? typeErrorMessage('integer', value));
    }
}
export function assertSet(value, message) {
    if (!isSet(value)) {
        throw new TypeError(message ?? typeErrorMessage('Set', value));
    }
}
export function assertSharedArrayBuffer(value, message) {
    if (!isSharedArrayBuffer(value)) {
        throw new TypeError(message ?? typeErrorMessage('SharedArrayBuffer', value));
    }
}
export function assertString(value, message) {
    if (!isString(value)) {
        throw new TypeError(message ?? typeErrorMessage('string', value));
    }
}
export function assertSymbol(value, message) {
    if (!isSymbol(value)) {
        throw new TypeError(message ?? typeErrorMessage('symbol', value));
    }
}
export function assertTruthy(value, message) {
    if (!isTruthy(value)) {
        throw new TypeError(message ?? typeErrorMessage('truthy', value));
    }
}
export function assertTupleLike(value, guards, message) {
    if (!isTupleLike(value, guards)) {
        throw new TypeError(message ?? typeErrorMessage('tuple-like', value));
    }
}
export function assertTypedArray(value, message) {
    if (!isTypedArray(value)) {
        throw new TypeError(message ?? typeErrorMessage('TypedArray', value));
    }
}
export function assertUint16Array(value, message) {
    if (!isUint16Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Uint16Array', value));
    }
}
export function assertUint32Array(value, message) {
    if (!isUint32Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Uint32Array', value));
    }
}
export function assertUint8Array(value, message) {
    if (!isUint8Array(value)) {
        throw new TypeError(message ?? typeErrorMessage('Uint8Array', value));
    }
}
export function assertUint8ClampedArray(value, message) {
    if (!isUint8ClampedArray(value)) {
        throw new TypeError(message ?? typeErrorMessage('Uint8ClampedArray', value));
    }
}
export function assertUndefined(value, message) {
    if (!isUndefined(value)) {
        throw new TypeError(message ?? typeErrorMessage('undefined', value));
    }
}
export function assertUrlInstance(value, message) {
    if (!isUrlInstance(value)) {
        throw new TypeError(message ?? typeErrorMessage('URL', value));
    }
}
// eslint-disable-next-line unicorn/prevent-abbreviations
export function assertUrlSearchParams(value, message) {
    if (!isUrlSearchParams(value)) {
        throw new TypeError(message ?? typeErrorMessage('URLSearchParams', value));
    }
}
export function assertUrlString(value, message) {
    if (!isUrlString(value)) {
        throw new TypeError(message ?? typeErrorMessage('string with a URL', value));
    }
}
export function assertValidDate(value, message) {
    if (!isValidDate(value)) {
        throw new TypeError(message ?? typeErrorMessage('valid Date', value));
    }
}
export function assertValidLength(value, message) {
    if (!isValidLength(value)) {
        throw new TypeError(message ?? typeErrorMessage('valid length', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertWeakMap(value, message) {
    if (!isWeakMap(value)) {
        throw new TypeError(message ?? typeErrorMessage('WeakMap', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types, unicorn/prevent-abbreviations
export function assertWeakRef(value, message) {
    if (!isWeakRef(value)) {
        throw new TypeError(message ?? typeErrorMessage('WeakRef', value));
    }
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertWeakSet(value, message) {
    if (!isWeakSet(value)) {
        throw new TypeError(message ?? typeErrorMessage('WeakSet', value));
    }
}
export function assertWhitespaceString(value, message) {
    if (!isWhitespaceString(value)) {
        throw new TypeError(message ?? typeErrorMessage('whitespace string', value));
    }
}
export default is;
