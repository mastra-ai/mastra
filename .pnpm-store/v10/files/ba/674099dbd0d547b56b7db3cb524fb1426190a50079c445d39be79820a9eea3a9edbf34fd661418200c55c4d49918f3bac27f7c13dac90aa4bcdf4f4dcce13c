import { test, expect, describe } from "vitest";
import { randomBytes } from "crypto";

import {
  slowBase64ToBigInt,
  slowBigIntToBase64,
  modernBase64ToBigInt,
  modernBigIntToBase64,
  convexToJson,
  jsonToConvex,
} from "./value.js";
import { compareValues } from "./compare.js";

describe("convexToJson", () => {
  test("serializes objects", () => {
    expect(
      convexToJson({
        property: "value",
      }),
    ).toEqual({ property: "value" });
  });

  test("serializes objects created with Object.create", () => {
    const obj = Object.create(null);
    obj.property = "value";
    expect(convexToJson(obj)).toEqual({ property: "value" });
  });

  test("serializes objects with BigInt values", () => {
    expect(
      convexToJson({
        property: BigInt("5151996"),
      }),
    ).toEqual({ property: { $integer: "/JxOAAAAAAA=" } });
  });

  test("throws an error on class instances", () => {
    expect(() => {
      convexToJson(new Date(0) as any);
    }).toThrow(/Date.*is not a supported Convex type/);
  });

  test("throws an error on class instances inside object", () => {
    expect(() => {
      convexToJson({ hello: new Date(0) } as any);
    }).toThrow(
      /Date.*is not a supported Convex type \(present at path .hello in original object/,
    );
  });

  test("throws an informative error on undefined array", () => {
    expect(() => {
      convexToJson([undefined] as any);
    }).toThrow(
      'undefined is not a valid Convex value (present at path [0] in original object ["undefined"]).',
    );
  });

  test("throws an informative error on undefined", () => {
    expect(() => {
      convexToJson(undefined as any);
    }).toThrow("undefined is not a valid Convex value.");
  });

  test("supports undefined keys in objects", () => {
    expect(
      convexToJson({
        property: undefined,
      }),
    ).toEqual({});
  });

  // BigInts throw in JSON.stringify, so ensure we can format them in errors.
  test("doesn't crash on bigint error", () => {
    expect(() => {
      convexToJson({ bigint: BigInt("123"), bad: [undefined] } as any);
    }).toThrow(
      'undefined is not a valid Convex value (present at path .bad[0] in original object {"bigint":"123n","bad":["undefined"]})',
    );
  });
});

describe("jsonToConvex", () => {
  test("deserializes object with BigInt value", () => {
    expect(jsonToConvex({ property: { $integer: "/JxOAAAAAAA=" } })).toEqual({
      property: BigInt("5151996"),
    });
  });
});

describe("bigints in Safari 14", () => {
  test("roundtrips BigInt even in Safari 14", () => {
    // https://caniuse.com/mdn-javascript_builtins_dataview_setbigint64
    const origGetBigInt64 = DataView.prototype.getBigInt64;
    const origSetBigInt64 = DataView.prototype.setBigInt64;
    DataView.prototype.getBigInt64 = () => {
      throw new Error("doesn't exist in Safari 14");
    };
    DataView.prototype.setBigInt64 = () => {
      throw new Error("doesn't exist in Safari 14");
    };
    try {
      const orig = "/JxOAAAAAAA=";
      expect(slowBigIntToBase64(slowBase64ToBigInt(orig))).toEqual(orig);
    } finally {
      DataView.prototype.getBigInt64 = origGetBigInt64;
      DataView.prototype.setBigInt64 = origSetBigInt64;
    }
  });
});

const MIN_INT64 = BigInt("-9223372036854775808");
const MAX_INT64 = BigInt("9223372036854775807");

function randomSignedInt64Bigint() {
  return BigInt("0x" + randomBytes(8).toString("hex")) + MIN_INT64;
}

describe("Our hand-rolled bigint code matches the fast implementation", () => {
  test("bigInt to bytes to bigint match", () => {
    const tests = [
      BigInt("0"),
      BigInt("1"),
      BigInt("-1"),
      MAX_INT64,
      MIN_INT64,
      ...[...Array(100).keys()].map(randomSignedInt64Bigint),
    ];
    for (const num of tests) {
      const expectedS = modernBigIntToBase64(num);
      const s = slowBigIntToBase64(num);
      expect(s).toEqual(expectedS);

      const numAgain = slowBase64ToBigInt(s);
      expect(numAgain).toEqual(modernBase64ToBigInt(s));
      expect(numAgain).toEqual(num);
    }
  });
});

describe("compare", () => {
  test("NaNs and negative zero", () => {
    const positiveNaN = Number.NaN;
    // Create DataViews for bit-level comparison
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, positiveNaN, /* little-endian */ true);

    // Read as BigInt to compare bits
    const v1Bits = BigInt(
      new DataView(buffer).getBigInt64(0, /* little-endian */ true),
    );
    // Flip the sign bit
    const negativeNaNBits = v1Bits | 0x8000000000000000n;
    // Convert back to a number
    const negativeNaNBuffer = new ArrayBuffer(8);
    new DataView(negativeNaNBuffer).setBigInt64(
      0,
      negativeNaNBits,
      /* little-endian */ true,
    );
    const negativeNaN = new DataView(negativeNaNBuffer).getFloat64(
      0,
      /* little-endian */ true,
    );
    const values = [negativeNaN, -0, 0, 1, positiveNaN];
    function repr(v: number) {
      if (v === 0) {
        return "-NaN";
      }
      if (v === 1) {
        return "-0";
      }
      if (v === 2) {
        return "0";
      }
      if (v === 3) {
        return "1";
      }
      if (v === 4) {
        return "+NaN";
      }
    }

    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const v1 = values[i];
        const v2 = values[j];
        expect(compareValues(v1, v2), `compare ${repr(i)} ${repr(j)}`).toEqual(
          -1,
        );
        expect(compareValues(v2, v1), `compare ${repr(j)} ${repr(i)}`).toEqual(
          1,
        );
      }
    }
  });
});
