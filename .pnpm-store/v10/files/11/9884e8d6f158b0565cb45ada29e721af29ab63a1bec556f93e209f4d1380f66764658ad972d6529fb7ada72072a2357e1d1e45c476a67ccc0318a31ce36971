/**
 * @vitest-environment custom-vitest-environment.ts
 */

import { test, expect } from "vitest";

import { Long } from "../../vendor/long.js";
import { longToU64, u64ToLong } from "./protocol.js";

test("Long serialization", async () => {
  expect(Long.fromNumber(89234097497)).toEqual(
    u64ToLong(longToU64(Long.fromNumber(89234097497))),
  );
});
