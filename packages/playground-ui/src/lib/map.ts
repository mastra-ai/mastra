export function getOrCreateMapValue<K, V>(map: Map<K, V>, key: K, createValue: () => V): V {
  if (map.has(key)) {
    return map.get(key) as V;
  }

  const value = createValue();
  map.set(key, value);
  return value;
}
