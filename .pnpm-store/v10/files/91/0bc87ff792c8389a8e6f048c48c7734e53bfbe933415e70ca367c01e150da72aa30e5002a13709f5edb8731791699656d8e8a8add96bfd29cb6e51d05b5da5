// src/api/subscribable/shallowEqual.ts
function shallowEqual(objA, objB) {
  if (objA === void 0 && objB === void 0) return true;
  if (objA === void 0) return false;
  if (objB === void 0) return false;
  for (const key of Object.keys(objA)) {
    const valueA = objA[key];
    const valueB = objB[key];
    if (!Object.is(valueA, valueB)) return false;
  }
  return true;
}
export {
  shallowEqual
};
//# sourceMappingURL=shallowEqual.js.map