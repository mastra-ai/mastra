'use strict';

function inRange(number, start, end) {
  const isTypeSafe = typeof number === "number" && typeof start === "number" && (typeof end === "undefined" || typeof end === "number");
  if (!isTypeSafe) {
    return false;
  }
  if (typeof end === "undefined") {
    end = start;
    start = 0;
  }
  return number >= Math.min(start, end) && number < Math.max(start, end);
}
const toFloat = (value, defaultValue) => {
  const def = defaultValue === void 0 ? 0 : defaultValue;
  if (value === null || value === void 0) {
    return def;
  }
  const result = parseFloat(value);
  return isNaN(result) ? def : result;
};
const toInt = (value, defaultValue) => {
  const def = defaultValue === void 0 ? 0 : defaultValue;
  if (value === null || value === void 0) {
    return def;
  }
  const result = parseInt(value);
  return isNaN(result) ? def : result;
};

exports.inRange = inRange;
exports.toFloat = toFloat;
exports.toInt = toInt;
//# sourceMappingURL=number.cjs.map
