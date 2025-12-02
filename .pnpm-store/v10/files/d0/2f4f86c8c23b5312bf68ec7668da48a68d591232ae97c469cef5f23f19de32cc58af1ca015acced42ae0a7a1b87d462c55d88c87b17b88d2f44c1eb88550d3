import { knownUnsafeEditableEvent } from "../types.mjs";
import { includes } from "./string-utils.mjs";
const nativeIsArray = Array.isArray;
const ObjProto = Object.prototype;
const type_utils_hasOwnProperty = ObjProto.hasOwnProperty;
const type_utils_toString = ObjProto.toString;
const isArray = nativeIsArray || function(obj) {
    return '[object Array]' === type_utils_toString.call(obj);
};
const isFunction = (x)=>'function' == typeof x;
const isNativeFunction = (x)=>isFunction(x) && -1 !== x.toString().indexOf('[native code]');
const isObject = (x)=>x === Object(x) && !isArray(x);
const isEmptyObject = (x)=>{
    if (isObject(x)) {
        for(const key in x)if (type_utils_hasOwnProperty.call(x, key)) return false;
        return true;
    }
    return false;
};
const isUndefined = (x)=>void 0 === x;
const isString = (x)=>'[object String]' == type_utils_toString.call(x);
const isEmptyString = (x)=>isString(x) && 0 === x.trim().length;
const isNull = (x)=>null === x;
const isNullish = (x)=>isUndefined(x) || isNull(x);
const isNumber = (x)=>'[object Number]' == type_utils_toString.call(x);
const isBoolean = (x)=>'[object Boolean]' === type_utils_toString.call(x);
const isFormData = (x)=>x instanceof FormData;
const isFile = (x)=>x instanceof File;
const isPlainError = (x)=>x instanceof Error;
const isKnownUnsafeEditableEvent = (x)=>includes(knownUnsafeEditableEvent, x);
function isInstanceOf(candidate, base) {
    try {
        return candidate instanceof base;
    } catch  {
        return false;
    }
}
function isPrimitive(value) {
    return null === value || 'object' != typeof value;
}
function isBuiltin(candidate, className) {
    return Object.prototype.toString.call(candidate) === `[object ${className}]`;
}
function isError(candidate) {
    switch(Object.prototype.toString.call(candidate)){
        case '[object Error]':
        case '[object Exception]':
        case '[object DOMException]':
        case '[object DOMError]':
        case '[object WebAssembly.Exception]':
            return true;
        default:
            return isInstanceOf(candidate, Error);
    }
}
function isErrorEvent(event) {
    return isBuiltin(event, 'ErrorEvent');
}
function isEvent(candidate) {
    return !isUndefined(Event) && isInstanceOf(candidate, Event);
}
function isPlainObject(candidate) {
    return isBuiltin(candidate, 'Object');
}
const yesLikeValues = [
    true,
    'true',
    1,
    '1',
    'yes'
];
const isYesLike = (val)=>includes(yesLikeValues, val);
const noLikeValues = [
    false,
    'false',
    0,
    '0',
    'no'
];
const isNoLike = (val)=>includes(noLikeValues, val);
export { type_utils_hasOwnProperty as hasOwnProperty, isArray, isBoolean, isBuiltin, isEmptyObject, isEmptyString, isError, isErrorEvent, isEvent, isFile, isFormData, isFunction, isInstanceOf, isKnownUnsafeEditableEvent, isNativeFunction, isNoLike, isNull, isNullish, isNumber, isObject, isPlainError, isPlainObject, isPrimitive, isString, isUndefined, isYesLike, noLikeValues, yesLikeValues };
