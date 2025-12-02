export function shallowEqual<T extends object>(
  objA: T | undefined,
  objB: T | undefined,
) {
  if (objA === undefined && objB === undefined) return true;
  if (objA === undefined) return false;
  if (objB === undefined) return false;

  for (const key of Object.keys(objA)) {
    const valueA = objA[key as keyof T];
    const valueB = objB[key as keyof T];
    if (!Object.is(valueA, valueB)) return false;
  }

  return true;
}
