"use strict";
import { compareUTF8 } from "./compare_utf8.js";
export function compareValues(k1, k2) {
  return compareAsTuples(makeComparable(k1), makeComparable(k2));
}
function compareAsTuples(a, b) {
  if (a[0] === b[0]) {
    return compareSameTypeValues(a[1], b[1]);
  } else if (a[0] < b[0]) {
    return -1;
  }
  return 1;
}
function compareSameTypeValues(v1, v2) {
  if (v1 === void 0 || v1 === null) {
    return 0;
  }
  if (typeof v1 === "number") {
    if (typeof v2 !== "number") {
      throw new Error(`Unexpected type ${v2}`);
    }
    return compareNumbers(v1, v2);
  }
  if (typeof v1 === "string") {
    if (typeof v2 !== "string") {
      throw new Error(`Unexpected type ${v2}`);
    }
    return compareUTF8(v1, v2);
  }
  if (typeof v1 === "bigint" || typeof v1 === "boolean" || typeof v1 === "string") {
    return v1 < v2 ? -1 : v1 === v2 ? 0 : 1;
  }
  if (!Array.isArray(v1) || !Array.isArray(v2)) {
    throw new Error(`Unexpected type ${v1}`);
  }
  for (let i = 0; i < v1.length && i < v2.length; i++) {
    const cmp = compareAsTuples(v1[i], v2[i]);
    if (cmp !== 0) {
      return cmp;
    }
  }
  if (v1.length < v2.length) {
    return -1;
  }
  if (v1.length > v2.length) {
    return 1;
  }
  return 0;
}
function compareNumbers(v1, v2) {
  if (isNaN(v1) || isNaN(v2)) {
    const buffer1 = new ArrayBuffer(8);
    const buffer2 = new ArrayBuffer(8);
    new DataView(buffer1).setFloat64(
      0,
      v1,
      /* little-endian */
      true
    );
    new DataView(buffer2).setFloat64(
      0,
      v2,
      /* little-endian */
      true
    );
    const v1Bits = BigInt(
      new DataView(buffer1).getBigInt64(
        0,
        /* little-endian */
        true
      )
    );
    const v2Bits = BigInt(
      new DataView(buffer2).getBigInt64(
        0,
        /* little-endian */
        true
      )
    );
    const v1Sign = (v1Bits & 0x8000000000000000n) !== 0n;
    const v2Sign = (v2Bits & 0x8000000000000000n) !== 0n;
    if (isNaN(v1) !== isNaN(v2)) {
      if (isNaN(v1)) {
        return v1Sign ? -1 : 1;
      }
      return v2Sign ? 1 : -1;
    }
    if (v1Sign !== v2Sign) {
      return v1Sign ? -1 : 1;
    }
    return v1Bits < v2Bits ? -1 : v1Bits === v2Bits ? 0 : 1;
  }
  if (Object.is(v1, v2)) {
    return 0;
  }
  if (Object.is(v1, -0)) {
    return Object.is(v2, 0) ? -1 : -Math.sign(v2);
  }
  if (Object.is(v2, -0)) {
    return Object.is(v1, 0) ? 1 : Math.sign(v1);
  }
  return v1 < v2 ? -1 : 1;
}
function makeComparable(v) {
  if (v === void 0) {
    return [0, void 0];
  }
  if (v === null) {
    return [1, null];
  }
  if (typeof v === "bigint") {
    return [2, v];
  }
  if (typeof v === "number") {
    return [3, v];
  }
  if (typeof v === "boolean") {
    return [4, v];
  }
  if (typeof v === "string") {
    return [5, v];
  }
  if (v instanceof ArrayBuffer) {
    return [6, Array.from(new Uint8Array(v)).map(makeComparable)];
  }
  if (Array.isArray(v)) {
    return [7, v.map(makeComparable)];
  }
  const keys = Object.keys(v).sort();
  const pojo = keys.map((k) => [k, v[k]]);
  return [8, pojo.map(makeComparable)];
}
//# sourceMappingURL=compare.js.map
