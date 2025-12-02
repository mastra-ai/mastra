'use strict';

const array = require('./array.cjs');
const typed = require('./typed.cjs');

const shake = (obj, filter = (x) => x === void 0) => {
  if (!obj)
    return {};
  const keys2 = Object.keys(obj);
  return keys2.reduce((acc, key) => {
    if (filter(obj[key])) {
      return acc;
    } else {
      acc[key] = obj[key];
      return acc;
    }
  }, {});
};
const mapKeys = (obj, mapFunc) => {
  const keys2 = Object.keys(obj);
  return keys2.reduce((acc, key) => {
    acc[mapFunc(key, obj[key])] = obj[key];
    return acc;
  }, {});
};
const mapValues = (obj, mapFunc) => {
  const keys2 = Object.keys(obj);
  return keys2.reduce((acc, key) => {
    acc[key] = mapFunc(obj[key], key);
    return acc;
  }, {});
};
const mapEntries = (obj, toEntry) => {
  if (!obj)
    return {};
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const [newKey, newValue] = toEntry(key, value);
    acc[newKey] = newValue;
    return acc;
  }, {});
};
const invert = (obj) => {
  if (!obj)
    return {};
  const keys2 = Object.keys(obj);
  return keys2.reduce((acc, key) => {
    acc[obj[key]] = key;
    return acc;
  }, {});
};
const lowerize = (obj) => mapKeys(obj, (k) => k.toLowerCase());
const upperize = (obj) => mapKeys(obj, (k) => k.toUpperCase());
const clone = (obj) => {
  if (typed.isPrimitive(obj)) {
    return obj;
  }
  if (typeof obj === "function") {
    return obj.bind({});
  }
  const newObj = new obj.constructor();
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    newObj[prop] = obj[prop];
  });
  return newObj;
};
const listify = (obj, toItem) => {
  if (!obj)
    return [];
  const entries = Object.entries(obj);
  if (entries.length === 0)
    return [];
  return entries.reduce((acc, entry) => {
    acc.push(toItem(entry[0], entry[1]));
    return acc;
  }, []);
};
const pick = (obj, keys2) => {
  if (!obj)
    return {};
  return keys2.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key))
      acc[key] = obj[key];
    return acc;
  }, {});
};
const omit = (obj, keys2) => {
  if (!obj)
    return {};
  if (!keys2 || keys2.length === 0)
    return obj;
  return keys2.reduce(
    (acc, key) => {
      delete acc[key];
      return acc;
    },
    { ...obj }
  );
};
const get = (value, path, defaultValue) => {
  const segments = path.split(/[\.\[\]]/g);
  let current = value;
  for (const key of segments) {
    if (current === null)
      return defaultValue;
    if (current === void 0)
      return defaultValue;
    const dequoted = key.replace(/['"]/g, "");
    if (dequoted.trim() === "")
      continue;
    current = current[dequoted];
  }
  if (current === void 0)
    return defaultValue;
  return current;
};
const set = (initial, path, value) => {
  if (!initial)
    return {};
  if (!path || value === void 0)
    return initial;
  const segments = path.split(/[\.\[\]]/g).filter((x) => !!x.trim());
  const _set = (node) => {
    if (segments.length > 1) {
      const key = segments.shift();
      const nextIsNum = /^\d+$/.test(segments[0]);
      node[key] = node[key] === void 0 ? nextIsNum ? [] : {} : node[key];
      _set(node[key]);
    } else {
      node[segments[0]] = value;
    }
  };
  const cloned = clone(initial);
  _set(cloned);
  return cloned;
};
const assign = (initial, override) => {
  if (!initial || !override)
    return initial ?? override ?? {};
  return Object.entries({ ...initial, ...override }).reduce(
    (acc, [key, value]) => {
      return {
        ...acc,
        [key]: (() => {
          if (typed.isObject(initial[key]))
            return assign(initial[key], value);
          return value;
        })()
      };
    },
    {}
  );
};
const keys = (value) => {
  if (!value)
    return [];
  const getKeys = (nested, paths) => {
    if (typed.isObject(nested)) {
      return Object.entries(nested).flatMap(
        ([k, v]) => getKeys(v, [...paths, k])
      );
    }
    if (typed.isArray(nested)) {
      return nested.flatMap((item, i) => getKeys(item, [...paths, `${i}`]));
    }
    return [paths.join(".")];
  };
  return getKeys(value, []);
};
const crush = (value) => {
  if (!value)
    return {};
  return array.objectify(
    keys(value),
    (k) => k,
    (k) => get(value, k)
  );
};
const construct = (obj) => {
  if (!obj)
    return {};
  return Object.keys(obj).reduce((acc, path) => {
    return set(acc, path, obj[path]);
  }, {});
};

exports.assign = assign;
exports.clone = clone;
exports.construct = construct;
exports.crush = crush;
exports.get = get;
exports.invert = invert;
exports.keys = keys;
exports.listify = listify;
exports.lowerize = lowerize;
exports.mapEntries = mapEntries;
exports.mapKeys = mapKeys;
exports.mapValues = mapValues;
exports.omit = omit;
exports.pick = pick;
exports.set = set;
exports.shake = shake;
exports.upperize = upperize;
//# sourceMappingURL=object.cjs.map
