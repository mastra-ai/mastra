// src/utils/accept.ts
var parseAccept = (acceptHeader) => {
  if (!acceptHeader) {
    return [];
  }
  const acceptValues = acceptHeader.split(",").map((value, index) => ({ value, index }));
  return acceptValues.map(parseAcceptValue).filter((item) => Boolean(item)).sort(sortByQualityAndIndex).map(({ type, params, q }) => ({ type, params, q }));
};
var parseAcceptValueRegex = /;(?=(?:(?:[^"]*"){2})*[^"]*$)/;
var parseAcceptValue = ({ value, index }) => {
  const parts = value.trim().split(parseAcceptValueRegex).map((s) => s.trim());
  const type = parts[0];
  if (!type) {
    return null;
  }
  const params = parseParams(parts.slice(1));
  const q = parseQuality(params.q);
  return { type, params, q, index };
};
var parseParams = (paramParts) => {
  return paramParts.reduce((acc, param) => {
    const [key, val] = param.split("=").map((s) => s.trim());
    if (key && val) {
      acc[key] = val;
    }
    return acc;
  }, {});
};
var parseQuality = (qVal) => {
  if (qVal === void 0) {
    return 1;
  }
  if (qVal === "") {
    return 1;
  }
  if (qVal === "NaN") {
    return 0;
  }
  const num = Number(qVal);
  if (num === Infinity) {
    return 1;
  }
  if (num === -Infinity) {
    return 0;
  }
  if (Number.isNaN(num)) {
    return 1;
  }
  if (num < 0 || num > 1) {
    return 1;
  }
  return num;
};
var sortByQualityAndIndex = (a, b) => {
  const qDiff = b.q - a.q;
  if (qDiff !== 0) {
    return qDiff;
  }
  return a.index - b.index;
};
export {
  parseAccept
};
