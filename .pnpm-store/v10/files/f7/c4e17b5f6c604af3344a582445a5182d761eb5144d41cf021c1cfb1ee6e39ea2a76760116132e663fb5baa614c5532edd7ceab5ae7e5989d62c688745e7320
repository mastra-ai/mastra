// src/utils/json/is-json.ts
function isJSONValue(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJSONValue);
  }
  if (typeof value === "object") {
    return Object.entries(value).every(
      ([key, val]) => typeof key === "string" && isJSONValue(val)
    );
  }
  return false;
}
function isJSONArray(value) {
  return Array.isArray(value) && value.every(isJSONValue);
}
function isJSONObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(
    ([key, val]) => typeof key === "string" && isJSONValue(val)
  );
}
export {
  isJSONArray,
  isJSONObject,
  isJSONValue
};
//# sourceMappingURL=is-json.js.map