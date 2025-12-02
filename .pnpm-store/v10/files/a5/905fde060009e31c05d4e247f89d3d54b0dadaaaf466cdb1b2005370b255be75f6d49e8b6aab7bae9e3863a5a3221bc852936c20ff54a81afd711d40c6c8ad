/**
 * Taken from https://github.com/rocicorp/compare-utf8/blob/main/LICENSE
 * (Apache Version 2.0, January 2004)
 */

/**
 * This is copied here instead of added as a dependency to avoid bundling issues.
 */

/**
 * Compares two JavaScript strings as if they were UTF-8 encoded byte arrays.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareUTF8(a: string, b: string): number {
  const aLength = a.length;
  const bLength = b.length;
  const length = Math.min(aLength, bLength);
  for (let i = 0; i < length; ) {
    const aCodePoint = a.codePointAt(i)!;
    const bCodePoint = b.codePointAt(i)!;
    if (aCodePoint !== bCodePoint) {
      // Code points below 0x80 are represented the same way in UTF-8 as in
      // UTF-16.
      if (aCodePoint < 0x80 && bCodePoint < 0x80) {
        return aCodePoint - bCodePoint;
      }

      // get the UTF-8 bytes for the code points
      const aLength = utf8Bytes(aCodePoint, aBytes);
      const bLength = utf8Bytes(bCodePoint, bBytes);
      return compareArrays(aBytes, aLength, bBytes, bLength);
    }

    i += utf16LengthForCodePoint(aCodePoint);
  }

  return aLength - bLength;
}

/**
 * @param {number[]} a
 * @param {number} aLength
 * @param {number[]} b
 * @param {number} bLength
 * @returns {number}
 */
function compareArrays(
  a: number[],
  aLength: number,
  b: number[],
  bLength: number,
) {
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

/**
 * @param {number} aCodePoint
 * @returns {number}
 */
export function utf16LengthForCodePoint(aCodePoint: number) {
  return aCodePoint > 0xffff ? 2 : 1;
}

// 2 preallocated arrays for utf8Bytes.
const arr = () => Array.from({ length: 4 }, () => 0);
const aBytes = arr();
const bBytes = arr();

/**
 * @param {number} codePoint
 * @param {number[]} bytes
 * @returns {number}
 */
function utf8Bytes(codePoint: number, bytes: number[]) {
  if (codePoint < 0x80) {
    bytes[0] = codePoint;
    return 1;
  }

  let count;
  let offset;

  if (codePoint <= 0x07ff) {
    count = 1;
    offset = 0xc0;
  } else if (codePoint <= 0xffff) {
    count = 2;
    offset = 0xe0;
  } else if (codePoint <= 0x10ffff) {
    count = 3;
    offset = 0xf0;
  } else {
    throw new Error("Invalid code point");
  }

  bytes[0] = (codePoint >> (6 * count)) + offset;
  let i = 1;
  for (; count > 0; count--) {
    const temp = codePoint >> (6 * (count - 1));
    bytes[i++] = 0x80 | (temp & 0x3f);
  }
  return i;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function greaterThan(a: string, b: string) {
  return compareUTF8(a, b) > 0;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function greaterThanEq(a: string, b: string) {
  return compareUTF8(a, b) >= 0;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function lessThan(a: string, b: string) {
  return compareUTF8(a, b) < 0;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function lessThanEq(a: string, b: string) {
  return compareUTF8(a, b) <= 0;
}
