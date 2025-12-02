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
var compare_utf8_exports = {};
__export(compare_utf8_exports, {
  compareUTF8: () => compareUTF8,
  greaterThan: () => greaterThan,
  greaterThanEq: () => greaterThanEq,
  lessThan: () => lessThan,
  lessThanEq: () => lessThanEq,
  utf16LengthForCodePoint: () => utf16LengthForCodePoint
});
module.exports = __toCommonJS(compare_utf8_exports);
function compareUTF8(a, b) {
  const aLength = a.length;
  const bLength = b.length;
  const length = Math.min(aLength, bLength);
  for (let i = 0; i < length; ) {
    const aCodePoint = a.codePointAt(i);
    const bCodePoint = b.codePointAt(i);
    if (aCodePoint !== bCodePoint) {
      if (aCodePoint < 128 && bCodePoint < 128) {
        return aCodePoint - bCodePoint;
      }
      const aLength2 = utf8Bytes(aCodePoint, aBytes);
      const bLength2 = utf8Bytes(bCodePoint, bBytes);
      return compareArrays(aBytes, aLength2, bBytes, bLength2);
    }
    i += utf16LengthForCodePoint(aCodePoint);
  }
  return aLength - bLength;
}
function compareArrays(a, aLength, b, bLength) {
  const length = Math.min(aLength, bLength);
  for (let i = 0; i < length; i++) {
    const aValue = a[i];
    const bValue = b[i];
    if (aValue !== bValue) {
      return aValue - bValue;
    }
  }
  return aLength - bLength;
}
function utf16LengthForCodePoint(aCodePoint) {
  return aCodePoint > 65535 ? 2 : 1;
}
const arr = () => Array.from({ length: 4 }, () => 0);
const aBytes = arr();
const bBytes = arr();
function utf8Bytes(codePoint, bytes) {
  if (codePoint < 128) {
    bytes[0] = codePoint;
    return 1;
  }
  let count;
  let offset;
  if (codePoint <= 2047) {
    count = 1;
    offset = 192;
  } else if (codePoint <= 65535) {
    count = 2;
    offset = 224;
  } else if (codePoint <= 1114111) {
    count = 3;
    offset = 240;
  } else {
    throw new Error("Invalid code point");
  }
  bytes[0] = (codePoint >> 6 * count) + offset;
  let i = 1;
  for (; count > 0; count--) {
    const temp = codePoint >> 6 * (count - 1);
    bytes[i++] = 128 | temp & 63;
  }
  return i;
}
function greaterThan(a, b) {
  return compareUTF8(a, b) > 0;
}
function greaterThanEq(a, b) {
  return compareUTF8(a, b) >= 0;
}
function lessThan(a, b) {
  return compareUTF8(a, b) < 0;
}
function lessThanEq(a, b) {
  return compareUTF8(a, b) <= 0;
}
//# sourceMappingURL=compare_utf8.js.map
