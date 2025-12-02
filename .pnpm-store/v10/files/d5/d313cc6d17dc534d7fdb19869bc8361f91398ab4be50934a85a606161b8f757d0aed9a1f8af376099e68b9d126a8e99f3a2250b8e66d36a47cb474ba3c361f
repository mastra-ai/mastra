// src/object.ts
var without = (obj, ...props) => {
  const copy = { ...obj };
  for (const prop of props) {
    delete copy[prop];
  }
  return copy;
};
var removeUndefined = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== void 0 && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {});
};
var applyFunctionToObj = (obj, fn) => {
  const result = {};
  for (const key in obj) {
    result[key] = fn(obj[key], key);
  }
  return result;
};
var filterProps = (obj, filter) => {
  const result = {};
  for (const key in obj) {
    if (obj[key] && filter(obj[key])) {
      result[key] = obj[key];
    }
  }
  return result;
};

export {
  without,
  removeUndefined,
  applyFunctionToObj,
  filterProps
};
//# sourceMappingURL=chunk-CFXQSUF6.mjs.map