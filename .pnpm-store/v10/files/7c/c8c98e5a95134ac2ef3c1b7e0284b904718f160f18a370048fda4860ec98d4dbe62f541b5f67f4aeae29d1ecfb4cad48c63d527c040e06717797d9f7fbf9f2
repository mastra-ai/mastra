"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var accept_exports = {};
__export(accept_exports, {
  parseAccept: () => parseAccept
});
module.exports = __toCommonJS(accept_exports);
const parseAccept = (acceptHeader) => {
  if (!acceptHeader) {
    return [];
  }
  const acceptValues = acceptHeader.split(",").map((value, index) => ({ value, index }));
  return acceptValues.map(parseAcceptValue).filter((item) => Boolean(item)).sort(sortByQualityAndIndex).map(({ type, params, q }) => ({ type, params, q }));
};
const parseAcceptValueRegex = /;(?=(?:(?:[^"]*"){2})*[^"]*$)/;
const parseAcceptValue = ({ value, index }) => {
  const parts = value.trim().split(parseAcceptValueRegex).map((s) => s.trim());
  const type = parts[0];
  if (!type) {
    return null;
  }
  const params = parseParams(parts.slice(1));
  const q = parseQuality(params.q);
  return { type, params, q, index };
};
const parseParams = (paramParts) => {
  return paramParts.reduce((acc, param) => {
    const [key, val] = param.split("=").map((s) => s.trim());
    if (key && val) {
      acc[key] = val;
    }
    return acc;
  }, {});
};
const parseQuality = (qVal) => {
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
const sortByQualityAndIndex = (a, b) => {
  const qDiff = b.q - a.q;
  if (qDiff !== 0) {
    return qDiff;
  }
  return a.index - b.index;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseAccept
});
