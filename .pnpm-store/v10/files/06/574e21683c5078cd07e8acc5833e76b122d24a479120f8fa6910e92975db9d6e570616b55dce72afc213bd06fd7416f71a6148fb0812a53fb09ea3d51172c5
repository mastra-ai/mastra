import { Value } from "./value.js";
import { compareUTF8 } from "./compare_utf8.js";

export function compareValues(k1: Value | undefined, k2: Value | undefined) {
  return compareAsTuples(makeComparable(k1), makeComparable(k2));
}

function compareAsTuples<T>(a: [number, T], b: [number, T]): number {
  if (a[0] === b[0]) {
    return compareSameTypeValues(a[1], b[1]);
  } else if (a[0] < b[0]) {
    return -1;
  }
  return 1;
}

function compareSameTypeValues<T>(v1: T, v2: T): number {
  if (v1 === undefined || v1 === null) {
    return 0;
  }
  if (typeof v1 === "number") {
    if (typeof v2 !== "number") {
      throw new Error(`Unexpected type ${v2 as any}`);
    }
    return compareNumbers(v1, v2);
  }
  if (typeof v1 === "string") {
    if (typeof v2 !== "string") {
      throw new Error(`Unexpected type ${v2 as any}`);
    }
    return compareUTF8(v1, v2);
  }
  if (
    typeof v1 === "bigint" ||
    typeof v1 === "boolean" ||
    typeof v1 === "string"
  ) {
    return v1 < v2 ? -1 : v1 === v2 ? 0 : 1;
  }
  if (!Array.isArray(v1) || !Array.isArray(v2)) {
    throw new Error(`Unexpected type ${v1 as any}`);
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

function compareNumbers(v1: number, v2: number): number {
  // Handle NaN values
  if (isNaN(v1) || isNaN(v2)) {
    // Create DataViews for bit-level comparison
    const buffer1 = new ArrayBuffer(8);
    const buffer2 = new ArrayBuffer(8);
    new DataView(buffer1).setFloat64(0, v1, /* little-endian */ true);
    new DataView(buffer2).setFloat64(0, v2, /* little-endian */ true);

    // Read as BigInt to compare bits
    const v1Bits = BigInt(
      new DataView(buffer1).getBigInt64(0, /* little-endian */ true),
    );
    const v2Bits = BigInt(
      new DataView(buffer2).getBigInt64(0, /* little-endian */ true),
    );

    // The sign bit is the most significant bit (bit 63)
    const v1Sign = (v1Bits & 0x8000000000000000n) !== 0n;
    const v2Sign = (v2Bits & 0x8000000000000000n) !== 0n;

    // If one value is NaN and the other isn't, use sign bits first
    if (isNaN(v1) !== isNaN(v2)) {
      // If v1 is NaN, compare based on sign bits
      if (isNaN(v1)) {
        return v1Sign ? -1 : 1;
      }
      // If v2 is NaN, compare based on sign bits
      return v2Sign ? 1 : -1;
    }

    // If both are NaN, compare their binary representations
    if (v1Sign !== v2Sign) {
      return v1Sign ? -1 : 1; // true means negative
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

  // Handle regular number comparison
  return v1 < v2 ? -1 : 1;
}

// Returns an array which can be compared to other arrays as if they were tuples.
// For example, [1, null] < [2, 1n] means null sorts before all bigints
// And [3, 5] < [3, 6] means floats sort as expected
// And [7, [[5, "a"]]] < [7, [[5, "a"], [5, "b"]]] means arrays sort as expected
function makeComparable(v: Value | undefined): [number, any] {
  if (v === undefined) {
    return [0, undefined];
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
  // Otherwise, it's an POJO.
  const keys = Object.keys(v).sort();
  const pojo: Value[] = keys.map((k) => [k, v[k]!]);
  return [8, pojo.map(makeComparable)];
}
