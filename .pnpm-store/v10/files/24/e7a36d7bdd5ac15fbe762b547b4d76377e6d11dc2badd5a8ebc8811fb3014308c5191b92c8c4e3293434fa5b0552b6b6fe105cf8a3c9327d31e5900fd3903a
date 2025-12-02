import { list } from './array.mjs';

const series = (items, toKey = (item) => `${item}`) => {
  const { indexesByKey, itemsByIndex } = items.reduce(
    (acc, item, idx) => ({
      indexesByKey: {
        ...acc.indexesByKey,
        [toKey(item)]: idx
      },
      itemsByIndex: {
        ...acc.itemsByIndex,
        [idx]: item
      }
    }),
    {
      indexesByKey: {},
      itemsByIndex: {}
    }
  );
  const min = (a, b) => {
    return indexesByKey[toKey(a)] < indexesByKey[toKey(b)] ? a : b;
  };
  const max = (a, b) => {
    return indexesByKey[toKey(a)] > indexesByKey[toKey(b)] ? a : b;
  };
  const first = () => {
    return itemsByIndex[0];
  };
  const last = () => {
    return itemsByIndex[items.length - 1];
  };
  const next = (current, defaultValue) => {
    return itemsByIndex[indexesByKey[toKey(current)] + 1] ?? defaultValue ?? first();
  };
  const previous = (current, defaultValue) => {
    return itemsByIndex[indexesByKey[toKey(current)] - 1] ?? defaultValue ?? last();
  };
  const spin = (current, num) => {
    if (num === 0)
      return current;
    const abs = Math.abs(num);
    const rel = abs > items.length ? abs % items.length : abs;
    return list(0, rel - 1).reduce(
      (acc) => num > 0 ? next(acc) : previous(acc),
      current
    );
  };
  return {
    min,
    max,
    first,
    last,
    next,
    previous,
    spin
  };
};

export { series };
//# sourceMappingURL=series.mjs.map
