import { describe, test } from "vitest";
import { assert, Equals } from "./test/type_testing.js";
import { BetterOmit } from "./type_utils.js";

describe("BetterOmit", () => {
  test("Basic object type", () => {
    type ObjectUnion = {
      property1: string;
      property2: string;
    };

    type Expected = {
      property2: string;
    };
    type Actual = BetterOmit<ObjectUnion, "property1">;

    assert<Equals<Expected, Actual>>;
  });

  test("Union", () => {
    type ObjectUnion =
      | {
          type: "left";
          sharedField: string;
          leftField: string;
        }
      | {
          type: "right";
          sharedField: string;
          rightField: string;
        };

    type Expected =
      | {
          type: "left";
          leftField: string;
        }
      | {
          type: "right";
          rightField: string;
        };
    type Actual = BetterOmit<ObjectUnion, "sharedField">;

    assert<Equals<Expected, Actual>>;
  });

  test("Index signature", () => {
    type ObjectUnion = {
      property1: string;
      property2: string;
      [propertyName: string]: any;
    };

    type Expected = {
      property2: string;
      [propertyName: string]: any;
    };
    type Actual = BetterOmit<ObjectUnion, "property1">;

    assert<Equals<Expected, Actual>>;
  });
});
