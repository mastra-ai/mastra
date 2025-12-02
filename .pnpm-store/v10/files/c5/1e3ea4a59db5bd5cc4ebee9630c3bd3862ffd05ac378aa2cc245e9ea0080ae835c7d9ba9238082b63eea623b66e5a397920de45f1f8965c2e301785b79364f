import { isFunction, isArray } from './typed.mjs';

const group = (array, getGroupId) => {
  return array.reduce((acc, item) => {
    const groupId = getGroupId(item);
    if (!acc[groupId])
      acc[groupId] = [];
    acc[groupId].push(item);
    return acc;
  }, {});
};
function zip(...arrays) {
  if (!arrays || !arrays.length)
    return [];
  return new Array(Math.max(...arrays.map(({ length }) => length))).fill([]).map((_, idx) => arrays.map((array) => array[idx]));
}
function zipToObject(keys, values) {
  if (!keys || !keys.length) {
    return {};
  }
  const getValue = isFunction(values) ? values : isArray(values) ? (_k, i) => values[i] : (_k, _i) => values;
  return keys.reduce((acc, key, idx) => {
    acc[key] = getValue(key, idx);
    return acc;
  }, {});
}
const boil = (array, compareFunc) => {
  if (!array || (array.length ?? 0) === 0)
    return null;
  return array.reduce(compareFunc);
};
function sum(array, fn) {
  return (array || []).reduce((acc, item) => acc + (fn ? fn(item) : item), 0);
}
const first = (array, defaultValue = void 0) => {
  return array?.length > 0 ? array[0] : defaultValue;
};
const last = (array, defaultValue = void 0) => {
  return array?.length > 0 ? array[array.length - 1] : defaultValue;
};
const sort = (array, getter, desc = false) => {
  if (!array)
    return [];
  const asc = (a, b) => getter(a) - getter(b);
  const dsc = (a, b) => getter(b) - getter(a);
  return array.slice().sort(desc === true ? dsc : asc);
};
const alphabetical = (array, getter, dir = "asc") => {
  if (!array)
    return [];
  const asc = (a, b) => `${getter(a)}`.localeCompare(getter(b));
  const dsc = (a, b) => `${getter(b)}`.localeCompare(getter(a));
  return array.slice().sort(dir === "desc" ? dsc : asc);
};
const counting = (list2, identity) => {
  if (!list2)
    return {};
  return list2.reduce((acc, item) => {
    const id = identity(item);
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
};
const replace = (list2, newItem, match) => {
  if (!list2)
    return [];
  if (newItem === void 0)
    return [...list2];
  for (let idx = 0; idx < list2.length; idx++) {
    const item = list2[idx];
    if (match(item, idx)) {
      return [
        ...list2.slice(0, idx),
        newItem,
        ...list2.slice(idx + 1, list2.length)
      ];
    }
  }
  return [...list2];
};
const objectify = (array, getKey, getValue = (item) => item) => {
  return array.reduce((acc, item) => {
    acc[getKey(item)] = getValue(item);
    return acc;
  }, {});
};
const select = (array, mapper, condition) => {
  if (!array)
    return [];
  return array.reduce((acc, item, index) => {
    if (!condition(item, index))
      return acc;
    acc.push(mapper(item, index));
    return acc;
  }, []);
};
function max(array, getter) {
  const get = getter ?? ((v) => v);
  return boil(array, (a, b) => get(a) > get(b) ? a : b);
}
function min(array, getter) {
  const get = getter ?? ((v) => v);
  return boil(array, (a, b) => get(a) < get(b) ? a : b);
}
const cluster = (list2, size = 2) => {
  const clusterCount = Math.ceil(list2.length / size);
  return new Array(clusterCount).fill(null).map((_c, i) => {
    return list2.slice(i * size, i * size + size);
  });
};
const unique = (array, toKey) => {
  const valueMap = array.reduce((acc, item) => {
    const key = toKey ? toKey(item) : item;
    if (acc[key])
      return acc;
    acc[key] = item;
    return acc;
  }, {});
  return Object.values(valueMap);
};
function* range(startOrLength, end, valueOrMapper = (i) => i, step = 1) {
  const mapper = isFunction(valueOrMapper) ? valueOrMapper : () => valueOrMapper;
  const start = end ? startOrLength : 0;
  const final = end ?? startOrLength;
  for (let i = start; i <= final; i += step) {
    yield mapper(i);
    if (i + step > final)
      break;
  }
}
const list = (startOrLength, end, valueOrMapper, step) => {
  return Array.from(range(startOrLength, end, valueOrMapper, step));
};
const flat = (lists) => {
  return lists.reduce((acc, list2) => {
    acc.push(...list2);
    return acc;
  }, []);
};
const intersects = (listA, listB, identity) => {
  if (!listA || !listB)
    return false;
  const ident = identity ?? ((x) => x);
  const dictB = listB.reduce((acc, item) => {
    acc[ident(item)] = true;
    return acc;
  }, {});
  return listA.some((value) => dictB[ident(value)]);
};
const fork = (list2, condition) => {
  if (!list2)
    return [[], []];
  return list2.reduce(
    (acc, item) => {
      const [a, b] = acc;
      if (condition(item)) {
        return [[...a, item], b];
      } else {
        return [a, [...b, item]];
      }
    },
    [[], []]
  );
};
const merge = (root, others, matcher) => {
  if (!others && !root)
    return [];
  if (!others)
    return root;
  if (!root)
    return [];
  if (!matcher)
    return root;
  return root.reduce((acc, r) => {
    const matched = others.find((o) => matcher(r) === matcher(o));
    if (matched)
      acc.push(matched);
    else
      acc.push(r);
    return acc;
  }, []);
};
const replaceOrAppend = (list2, newItem, match) => {
  if (!list2 && !newItem)
    return [];
  if (!newItem)
    return [...list2];
  if (!list2)
    return [newItem];
  for (let idx = 0; idx < list2.length; idx++) {
    const item = list2[idx];
    if (match(item, idx)) {
      return [
        ...list2.slice(0, idx),
        newItem,
        ...list2.slice(idx + 1, list2.length)
      ];
    }
  }
  return [...list2, newItem];
};
const toggle = (list2, item, toKey, options) => {
  if (!list2 && !item)
    return [];
  if (!list2)
    return [item];
  if (!item)
    return [...list2];
  const matcher = toKey ? (x, idx) => toKey(x, idx) === toKey(item, idx) : (x) => x === item;
  const existing = list2.find(matcher);
  if (existing)
    return list2.filter((x, idx) => !matcher(x, idx));
  const strategy = options?.strategy ?? "append";
  if (strategy === "append")
    return [...list2, item];
  return [item, ...list2];
};
const sift = (list2) => {
  return list2?.filter((x) => !!x) ?? [];
};
const iterate = (count, func, initValue) => {
  let value = initValue;
  for (let i = 1; i <= count; i++) {
    value = func(value, i);
  }
  return value;
};
const diff = (root, other, identity = (t) => t) => {
  if (!root?.length && !other?.length)
    return [];
  if (root?.length === void 0)
    return [...other];
  if (!other?.length)
    return [...root];
  const bKeys = other.reduce((acc, item) => {
    acc[identity(item)] = true;
    return acc;
  }, {});
  return root.filter((a) => !bKeys[identity(a)]);
};
function shift(arr, n) {
  if (arr.length === 0)
    return arr;
  const shiftNumber = n % arr.length;
  if (shiftNumber === 0)
    return arr;
  return [...arr.slice(-shiftNumber, arr.length), ...arr.slice(0, -shiftNumber)];
}

export { alphabetical, boil, cluster, counting, diff, first, flat, fork, group, intersects, iterate, last, list, max, merge, min, objectify, range, replace, replaceOrAppend, select, shift, sift, sort, sum, toggle, unique, zip, zipToObject };
//# sourceMappingURL=array.mjs.map
