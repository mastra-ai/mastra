'use strict';

const isSymbol = (value) => {
  return !!value && value.constructor === Symbol;
};
const isArray = Array.isArray;
const isObject = (value) => {
  return !!value && value.constructor === Object;
};
const isPrimitive = (value) => {
  return value === void 0 || value === null || typeof value !== "object" && typeof value !== "function";
};
const isFunction = (value) => {
  return !!(value && value.constructor && value.call && value.apply);
};
const isString = (value) => {
  return typeof value === "string" || value instanceof String;
};
const isInt = (value) => {
  return isNumber(value) && value % 1 === 0;
};
const isFloat = (value) => {
  return isNumber(value) && value % 1 !== 0;
};
const isNumber = (value) => {
  try {
    return Number(value) === value;
  } catch {
    return false;
  }
};
const isDate = (value) => {
  return Object.prototype.toString.call(value) === "[object Date]";
};
const isPromise = (value) => {
  if (!value)
    return false;
  if (!value.then)
    return false;
  if (!isFunction(value.then))
    return false;
  return true;
};
const isEmpty = (value) => {
  if (value === true || value === false)
    return true;
  if (value === null || value === void 0)
    return true;
  if (isNumber(value))
    return value === 0;
  if (isDate(value))
    return isNaN(value.getTime());
  if (isFunction(value))
    return false;
  if (isSymbol(value))
    return false;
  const length = value.length;
  if (isNumber(length))
    return length === 0;
  const size = value.size;
  if (isNumber(size))
    return size === 0;
  const keys = Object.keys(value).length;
  return keys === 0;
};
const isEqual = (x, y) => {
  if (Object.is(x, y))
    return true;
  if (x instanceof Date && y instanceof Date) {
    return x.getTime() === y.getTime();
  }
  if (x instanceof RegExp && y instanceof RegExp) {
    return x.toString() === y.toString();
  }
  if (typeof x !== "object" || x === null || typeof y !== "object" || y === null) {
    return false;
  }
  const keysX = Reflect.ownKeys(x);
  const keysY = Reflect.ownKeys(y);
  if (keysX.length !== keysY.length)
    return false;
  for (let i = 0; i < keysX.length; i++) {
    if (!Reflect.has(y, keysX[i]))
      return false;
    if (!isEqual(x[keysX[i]], y[keysX[i]]))
      return false;
  }
  return true;
};

exports.isArray = isArray;
exports.isDate = isDate;
exports.isEmpty = isEmpty;
exports.isEqual = isEqual;
exports.isFloat = isFloat;
exports.isFunction = isFunction;
exports.isInt = isInt;
exports.isNumber = isNumber;
exports.isObject = isObject;
exports.isPrimitive = isPrimitive;
exports.isPromise = isPromise;
exports.isString = isString;
exports.isSymbol = isSymbol;
//# sourceMappingURL=typed.cjs.map
