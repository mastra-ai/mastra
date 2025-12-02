"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmpty = isEmpty;
exports.isUndefined = isUndefined;
exports.isString = isString;
exports.isNumber = isNumber;
exports.isBoolean = isBoolean;
exports.isNull = isNull;
exports.isDate = isDate;
exports.isBigInt = isBigInt;
exports.isBuffer = isBuffer;
exports.isFunction = isFunction;
exports.isObject = isObject;
exports.isArrayBufferOrView = isArrayBufferOrView;
exports.isPlainObject = isPlainObject;
exports.getLast = getLast;
exports.freeze = freeze;
exports.asArray = asArray;
exports.asReadonlyArray = asReadonlyArray;
exports.isReadonlyArray = isReadonlyArray;
exports.noop = noop;
exports.compare = compare;
function isEmpty(obj) {
    if (Array.isArray(obj) || isString(obj) || isBuffer(obj)) {
        return obj.length === 0;
    }
    else if (obj) {
        return Object.keys(obj).length === 0;
    }
    return false;
}
function isUndefined(obj) {
    return typeof obj === 'undefined' || obj === undefined;
}
function isString(obj) {
    return typeof obj === 'string';
}
function isNumber(obj) {
    return typeof obj === 'number';
}
function isBoolean(obj) {
    return typeof obj === 'boolean';
}
function isNull(obj) {
    return obj === null;
}
function isDate(obj) {
    return obj instanceof Date;
}
function isBigInt(obj) {
    return typeof obj === 'bigint';
}
// Don't change the returnd type to `obj is Buffer` to not create a
// hard dependency to node.
function isBuffer(obj) {
    return typeof Buffer !== 'undefined' && Buffer.isBuffer(obj);
}
function isFunction(obj) {
    return typeof obj === 'function';
}
function isObject(obj) {
    return typeof obj === 'object' && obj !== null;
}
function isArrayBufferOrView(obj) {
    return obj instanceof ArrayBuffer || ArrayBuffer.isView(obj);
}
function isPlainObject(obj) {
    if (!isObject(obj) || getTag(obj) !== '[object Object]') {
        return false;
    }
    if (Object.getPrototypeOf(obj) === null) {
        return true;
    }
    let proto = obj;
    while (Object.getPrototypeOf(proto) !== null) {
        proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(obj) === proto;
}
function getLast(arr) {
    return arr[arr.length - 1];
}
function freeze(obj) {
    return Object.freeze(obj);
}
function asArray(arg) {
    if (isReadonlyArray(arg)) {
        return arg;
    }
    else {
        return [arg];
    }
}
function asReadonlyArray(arg) {
    if (isReadonlyArray(arg)) {
        return arg;
    }
    else {
        return freeze([arg]);
    }
}
function isReadonlyArray(arg) {
    return Array.isArray(arg);
}
function noop(obj) {
    return obj;
}
function compare(obj1, obj2) {
    if (isReadonlyArray(obj1) && isReadonlyArray(obj2)) {
        return compareArrays(obj1, obj2);
    }
    else if (isObject(obj1) && isObject(obj2)) {
        return compareObjects(obj1, obj2);
    }
    return obj1 === obj2;
}
function compareArrays(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; ++i) {
        if (!compare(arr1[i], arr2[i])) {
            return false;
        }
    }
    return true;
}
function compareObjects(obj1, obj2) {
    if (isBuffer(obj1) && isBuffer(obj2)) {
        return compareBuffers(obj1, obj2);
    }
    else if (isDate(obj1) && isDate(obj2)) {
        return compareDates(obj1, obj2);
    }
    return compareGenericObjects(obj1, obj2);
}
function compareBuffers(buf1, buf2) {
    return Buffer.compare(buf1, buf2) === 0;
}
function compareDates(date1, date2) {
    return date1.getTime() === date2.getTime();
}
function compareGenericObjects(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    for (const key of keys1) {
        if (!compare(obj1[key], obj2[key])) {
            return false;
        }
    }
    return true;
}
const toString = Object.prototype.toString;
function getTag(value) {
    if (value == null) {
        return value === undefined ? '[object Undefined]' : '[object Null]';
    }
    return toString.call(value);
}
